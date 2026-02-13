import time
import datetime
import asyncio
import re
import logging
import difflib
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.core.weather import get_metar_taf, get_bulk_weather_data
from app.core.notams import get_notams
from app.core.ai import analyze_risk
from app.core.geography import get_nearest_reporting_stations, check_airspace_zones, airports_icao, airports_lid, get_coords_from_awc, calculate_distance
from app.core.rate_limit import RateLimiter
from app.core.logger import log_attempt
from app.core.cache import get_cached_report, save_cached_report
from app.core.settings import settings
from app.core.notifications import notifier
from app.core.db import database

router = APIRouter()
limiter = RateLimiter()

class AnalysisRequest(BaseModel):
    icao: str
    plane_size: str
    force: bool = False
    weather_override: Optional[str] = None

def parse_metar_time(metar_str):
    if not metar_str: return None
    match = re.search(r'\b(\d{2})(\d{2})(\d{2})Z\b', metar_str)
    if not match: return None
    
    day, hour, minute = map(int, match.groups())
    now = datetime.datetime.now(datetime.timezone.utc)
    
    try:
        dt = now.replace(day=day, hour=hour, minute=minute, second=0, microsecond=0)
    except ValueError:
        first_of_month = now.replace(day=1)
        last_month = first_of_month - datetime.timedelta(days=1)
        try:
            dt = last_month.replace(day=day, hour=hour, minute=minute, second=0, microsecond=0)
        except ValueError:
            return None

    if dt > now + datetime.timedelta(days=15):
        if dt.month == 1:
            dt = dt.replace(year=dt.year - 1, month=12)
        else:
            dt = dt.replace(month=dt.month - 1)
    return dt

@router.post("/analyze")
async def analyze_flight(request: AnalysisRequest, raw_request: Request, background_tasks: BackgroundTasks):
    is_paused = await settings.get("global_pause")
    if is_paused == "true":
        msg = await settings.get("global_pause_message", "System is under maintenance.")
        raise HTTPException(status_code=503, detail=msg)

    t_start = time.time()
    
    client_id = raw_request.headers.get("X-Client-ID", "UNKNOWN")
    client_ip = raw_request.headers.get("X-Forwarded-For", raw_request.client.host).split(',')[0].strip()
    
    raw_input = request.icao.upper().strip()
    
    # 1. Try exact match
    if raw_input in airports_icao:
        input_icao = raw_input
    # 2. Try LID match
    elif raw_input in airports_lid:
        lid_data = airports_lid[raw_input]
        input_icao = lid_data.get('icao') or raw_input
    # 3. Lazy US Pilot Logic
    elif len(raw_input) == 3 and ("K" + raw_input) in airports_icao:
        input_icao = "K" + raw_input
    else:
        # Final Sanity Check: If not in local DB, check the FAA remote records
        # This prevents "Fake" airports from hitting the AI and consuming tokens.
        remote_data = await get_coords_from_awc(raw_input)
        
        if not remote_data:
            suggestions = []
            raw_upper = raw_input.upper()

            # --- 1. GATHER KEYS ---
            # Merge ICAO and LID keys for searching
            all_keys = list(airports_icao.keys()) + list(airports_lid.keys())

            # --- 2. FUZZY CODE MATCHING (Handles "KFFAA" -> "KFFA" & "FFAA" -> "KFFA") ---
            # Only run fuzzy match if input is code-like (short, no spaces)
            if len(raw_upper) <= 7 and " " not in raw_upper:
                # cutoff=0.6 allows for 1-2 character differences/typos
                close_matches = difflib.get_close_matches(raw_upper, all_keys, n=3, cutoff=0.6)
                for m in close_matches:
                    data = airports_icao.get(m) or airports_lid.get(m)
                    if data: suggestions.append({"icao": m, "name": data['name']})

            # --- 3. CONFUSABLES (Handles 1 vs I vs L, 0 vs O) ---
            # Explicitly check for common visual swaps
            def get_variants(s):
                vars = set()
                # 1 <-> I <-> L
                if '1' in s: vars.add(s.replace('1', 'I')); vars.add(s.replace('1', 'L'))
                if 'I' in s: vars.add(s.replace('I', '1'))
                if 'L' in s: vars.add(s.replace('L', '1'))
                # 0 <-> O
                if '0' in s: vars.add(s.replace('0', 'O'))
                if 'O' in s: vars.add(s.replace('O', '0'))
                return vars

            for v in get_variants(raw_upper):
                if v == raw_upper: continue
                if v in airports_icao:
                    suggestions.append({"icao": v, "name": airports_icao[v]['name']})
                elif v in airports_lid:
                    suggestions.append({"icao": v, "name": airports_lid[v]['name']})

            # --- 4. NAME SEARCH (STRICTER) ---
            # Fixes "CIA" matching "Social Circle" (1OL2)
            # Only scan names if we don't have enough suggestions yet
            if len(suggestions) < 5:
                count = 0
                for code, data in airports_icao.items():
                    if count >= 5: break
                    name_up = data['name'].upper()
                    
                    # LOGIC:
                    # If input is short (<=3), MUST start with input (e.g. "CIA" -> "CIA Field")
                    # If input is long (>3), can be contained in (e.g. "KENNEDY" -> "John F Kennedy")
                    is_match = False
                    if len(raw_upper) <= 3:
                        if name_up.startswith(raw_upper): is_match = True
                    else:
                        if raw_upper in name_up: is_match = True
                    
                    if is_match:
                        suggestions.append({"icao": code, "name": data['name']})
                        count += 1

            # --- DEDUPLICATE & FORMAT ---
            seen = set()
            final_suggestions = []
            for s in suggestions:
                if s['icao'] not in seen:
                    final_suggestions.append(s)
                    seen.add(s['icao'])

            # Raise 404 with structured detail
            raise HTTPException(
                status_code=404, 
                detail={
                    "message": f"Airport '{raw_input}' not found.",
                    "suggestions": final_suggestions[:5]
                }
            )
        input_icao = raw_input
    
    resolved_icao = input_icao
    status = "FAIL" 
    error_msg = None
    model_used = None
    tokens_used = 0
    weather_icao = None
    weather_dist = 0
    weather_name = None 
    expiration_dt = None

    t_wx_fetch = 0
    t_notams = 0
    t_alt = 0
    t_ai = 0

    try:
        # 1. CACHE CHECK (Skipped if force=True)
        cached_result = None
        if not request.force:
            cached_result = await get_cached_report(input_icao, request.plane_size, request.weather_override)

        if cached_result:
            duration = time.time() - t_start
            status = "CACHE_HIT" 
            
            raw_data = cached_result.get('raw_data', {})
            weather_icao = raw_data.get('weather_source', resolved_icao)
            
            if 'valid_until' in cached_result:
                expiration_dt = datetime.datetime.fromtimestamp(cached_result['valid_until'], datetime.timezone.utc)
            
            output_for_log = resolved_icao
            if resolved_icao == ("K" + raw_input) and any(char.isdigit() for char in raw_input):
                output_for_log = raw_input

            await log_attempt(client_id, client_ip, raw_input, output_for_log, request.plane_size, duration, "CACHE_HIT", weather_icao=weather_icao, expiration=expiration_dt)
            
            cached_result['is_cached'] = True
            return cached_result

        # 2. RATE LIMIT CHECK
        # LOGIC UPDATE: Exempt authorized Kiosks from rate limits during forced refreshes
        is_exempt = False
        if request.force:
             # Check if this ICAO is in our "Paid/Authorized" Kiosk table
             # UPDATED: Checks new 'kiosk_profiles' table using target_icao
             kiosk_check = "SELECT 1 FROM kiosk_profiles WHERE target_icao = :icao AND is_active = 1"
             is_kiosk = await database.fetch_val(kiosk_check, values={"icao": resolved_icao})
             if is_kiosk:
                 is_exempt = True

        if not is_exempt:
            await limiter(raw_request)

        # 3. FETCH DATA
        # Unified Coordinate Resolution
        target_lat, target_lon = None, None
        airport_name = input_icao
        airport_tz = 'UTC'

        # Try Local DB (ICAO or LID)
        local_data = airports_icao.get(input_icao) or airports_lid.get(input_icao)
        if local_data:
            target_lat, target_lon = float(local_data['lat']), float(local_data['lon'])
            airport_name = local_data['name']
            airport_tz = local_data.get('tz', 'UTC')
            resolved_icao = local_data.get('icao', input_icao)
        else:
            # Try Remote (Re-use data from Sanity Check if available)
            if 'remote_data' in locals() and remote_data:
                 target_lat, target_lon = remote_data['lat'], remote_data['lon']
                 airport_name = remote_data.get('name', input_icao)

        airspace_warnings = []
        if target_lat is not None and target_lon is not None:
            try:
                airspace_warnings = check_airspace_zones(input_icao, target_lat, target_lon)
            except Exception: pass

        # Determine Weather Source (Override or Default)
        target_wx = request.weather_override if request.weather_override else input_icao

        # --- PARALLEL FETCH (TIMED) ---
        async def fetch_wx():
            t = time.time()
            data = await get_metar_taf(target_wx)
            return data, time.time() - t

        async def fetch_notams():
            t = time.time()
            data = await get_notams(input_icao)
            return data, time.time() - t

        (weather_data, t_wx_fetch), (notams, t_notams) = await asyncio.gather(fetch_wx(), fetch_notams())
        
        if weather_data:
            weather_icao = target_wx
            
            # Handle Override Logic (Name & Distance)
            if target_wx != input_icao:
                src_data = airports_icao.get(target_wx) or airports_lid.get(target_wx)
                weather_name = src_data['name'] if src_data else target_wx
                
                # Calculate Distance using unified coordinates
                if src_data and target_lat is not None and target_lon is not None:
                    try:
                         lat2, lon2 = float(src_data['lat']), float(src_data['lon'])
                         weather_dist = calculate_distance(target_lat, target_lon, lat2, lon2)
                    except: pass
            else:
                weather_name = airport_name
        
        # Weather Fallback Logic
        if not weather_data:
            t0_alt = time.time()
            candidates = await get_nearest_reporting_stations(input_icao)
            
            # --- BULK FETCH OPTIMIZATION ---
            # Instead of checking one-by-one (slow), fetch all candidates at once.
            candidate_codes = [c[0] for c in candidates]
            bulk_data = await get_bulk_weather_data(candidate_codes)
            
            # Strategy: Iterate to find a station with a TAF. 
            # If none found, fallback to the closest station with a METAR.
            fallback_data = None
            fallback_station = None
            fallback_dist = 0
            fallback_name = None

            for station, dist in candidates:
                # Use local bulk data instead of making a network call
                data = bulk_data.get(station)
                
                if data and data.get('metar'):
                    # Check for Valid TAF (Not empty, not the error string)
                    raw_taf = data.get('taf', "")
                    has_taf = raw_taf and "No TAF available" not in raw_taf
                    
                    # Resolve Name
                    st_data = airports_icao.get(station)
                    st_name = st_data.get('name', station) if st_data else station
                    
                    if has_taf:
                        # Winner! Found a prioritized station with a TAF.
                        weather_icao = station
                        weather_dist = dist
                        weather_data = data
                        weather_name = st_name
                        break
                    
                    # If this is the first station with at least a METAR, save it as fallback
                    if not fallback_data:
                        fallback_data = data
                        fallback_station = station
                        fallback_dist = dist
                        fallback_name = st_name

            # If loop finishes without a TAF-station, use the fallback (closest with METAR)
            if not weather_data and fallback_data:
                weather_icao = fallback_station
                weather_dist = fallback_dist
                weather_data = fallback_data
                weather_name = fallback_name
            
            t_alt = time.time() - t0_alt
        
        if not weather_data:
            weather_data = {"metar": None, "taf": None}

        # --- MID-STREAM CACHE CHECK (Smart Link) ---
        # Check if we have a specific report for [Input:KANP + Source:KBWI].
        if weather_icao and not request.force:
            mid_stream_cache = await get_cached_report(input_icao, request.plane_size, weather_icao)
            
            if mid_stream_cache:
                # 1. Backfill the "Auto" key (if this request was Auto)
                if not request.weather_override:
                     # Save to the "Default" key
                     await save_cached_report(input_icao, request.plane_size, mid_stream_cache, ttl_seconds=300, weather_source=None)

                # 2. Log & Return
                duration = time.time() - t_start
                
                output_for_log = resolved_icao
                if resolved_icao == ("K" + raw_input) and any(char.isdigit() for char in raw_input):
                    output_for_log = raw_input

                # Extract Expiration if present
                ms_exp_dt = None
                if 'valid_until' in mid_stream_cache:
                     ms_exp_dt = datetime.datetime.fromtimestamp(mid_stream_cache['valid_until'], datetime.timezone.utc)

                # IMPORTANT: Update status so 'finally' block knows we succeeded
                status = "CACHE_HIT_LINK"

                await log_attempt(
                    client_id, client_ip, raw_input, output_for_log, request.plane_size, 
                    duration, status, 
                    weather_icao=weather_icao, expiration=ms_exp_dt,
                    t_wx=t_wx_fetch, t_notams=t_notams, t_ai=0, t_alt=t_alt # Pass timings!
                )
                
                mid_stream_cache['is_cached'] = True
                return mid_stream_cache

        t0 = time.time()
        
        analysis = await analyze_risk(
            icao_code=resolved_icao,
            weather_data=weather_data,
            notams=notams,
            plane_size=request.plane_size,
            reporting_station=weather_icao,
            reporting_station_name=weather_name,
            airport_tz=airport_tz, 
            external_airspace_warnings=airspace_warnings,
            dist=weather_dist,
            target_icao=resolved_icao
        )
        t_ai = time.time() - t0

        if '_meta' in analysis:
            tokens_used = analysis['_meta'].get('tokens', 0)
            model_used = analysis['_meta'].get('model', 'unknown')
            del analysis['_meta']

        response_data = {
            "airport_name": airport_name,
            "airport_tz": airport_tz,
            "is_cached": False,
            "analysis": analysis,
            "raw_data": {
                "metar": weather_data['metar'],
                "taf": weather_data['taf'],
                "notams": notams,
                "weather_source": weather_icao,
                "weather_dist": round(weather_dist, 1),
                "weather_name": weather_name
            }
        }

        # --- CACHING ---
        now = datetime.datetime.now(datetime.timezone.utc)
        current_minute = now.minute
        should_cache = True
        ttl = 300 
        
        if current_minute < 50:
            minutes_until_update = 50 - current_minute
            ttl = minutes_until_update * 60
        else:
            metar_dt = parse_metar_time(weather_data['metar'])
            if metar_dt:
                is_fresh = (metar_dt.hour == now.hour) or \
                           (metar_dt > now - datetime.timedelta(minutes=15))
                if is_fresh:
                    ttl = 60 * 60
                else:
                    should_cache = False
            else:
                should_cache = False

        if should_cache:
            cache_override = request.weather_override if request.weather_override else None
            await save_cached_report(input_icao, request.plane_size, response_data, ttl_seconds=ttl, weather_source=cache_override)
            expiration_dt = now + datetime.timedelta(seconds=ttl)
        
        status = "SUCCESS"
        return response_data

    except HTTPException as e:
        if e.status_code == 429:
            status = "RATE_LIMIT"
            try:
                await notifier.send_alert("rate_limit", f"Rate Limit: {input_icao}", f"User {client_id}")
            except: pass
        else:
            status = "ERROR"
        error_msg = e.detail
        raise e
        
    except Exception as e:
        status = "ERROR"
        error_msg = str(e)
        background_tasks.add_task(notifier.send_alert, "error", "System Error", str(e))
        raise e
        
    finally:
        if status != "CACHE_HIT" and status != "CACHE_HIT_LINK":
            duration = time.time() - t_start
            
            perf_msg = f"⏱️  PERFORMANCE: {input_icao} | Total: {duration:.2f}s | Wx: {t_wx_fetch:.2f}s"
            if t_alt > 0:
                perf_msg += f" | Alt: {t_alt:.2f}s"
            perf_msg += f" | NOTAMs: {t_notams:.2f}s | AI: {t_ai:.2f}s"

            logging.getLogger("app.api.endpoints.analysis").info(perf_msg)
            
            output_for_log = resolved_icao
            if resolved_icao == ("K" + raw_input) and any(char.isdigit() for char in raw_input):
                output_for_log = raw_input

            await log_attempt(
                client_id, client_ip, raw_input, output_for_log, request.plane_size, 
                duration, status, error_msg, model_used, tokens_used, weather_icao, expiration_dt,
                t_wx=t_wx_fetch, t_notams=t_notams, t_ai=t_ai, t_alt=t_alt
            )

# --- STATUS ENDPOINT ---
@router.get("/system-status")
async def get_public_system_status():
    from app.core.settings import settings
    banner_enabled = await settings.get("banner_enabled")
    banner_msg = await settings.get("banner_message", "")
    return {
        "banner_enabled": banner_enabled == "true",
        "banner_message": banner_msg
    }
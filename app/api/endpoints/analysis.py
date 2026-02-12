import time
import datetime
import asyncio
import re
import logging
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.core.weather import get_metar_taf, get_bulk_weather_data
from app.core.notams import get_notams
from app.core.ai import analyze_risk
from app.core.geography import get_nearest_reporting_stations, check_airspace_zones, airports_icao, airports_lid, get_coords_from_awc
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
            raise HTTPException(
                status_code=404, 
                detail=f"Airport '{raw_input}' not found. Please verify the ICAO or LID code."
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
            cached_result = await get_cached_report(input_icao, request.plane_size)

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
             # We use fetch_val for speed (SELECT 1 returns 1 if found)
             kiosk_check = "SELECT 1 FROM kiosk_airports WHERE icao = :icao AND is_active = 1"
             is_kiosk = await database.fetch_val(kiosk_check, values={"icao": resolved_icao})
             if is_kiosk:
                 is_exempt = True

        if not is_exempt:
            await limiter(raw_request)

        # 3. FETCH DATA
        airport_data = airports_icao.get(input_icao) or airports_lid.get(input_icao)
        airport_name = airport_data['name'] if airport_data else input_icao
        airport_tz = airport_data.get('tz', 'UTC') if airport_data else 'UTC'
        
        if airport_data: resolved_icao = airport_data.get('icao', input_icao)

        airspace_warnings = []
        if airport_data:
            try:
                lat, lon = float(airport_data['lat']), float(airport_data['lon'])
                airspace_warnings = check_airspace_zones(input_icao, lat, lon)
            except Exception: pass

        # --- PARALLEL FETCH (TIMED) ---
        async def fetch_wx():
            t = time.time()
            data = await get_metar_taf(input_icao)
            return data, time.time() - t

        async def fetch_notams():
            t = time.time()
            data = await get_notams(input_icao)
            return data, time.time() - t

        (weather_data, t_wx_fetch), (notams, t_notams) = await asyncio.gather(fetch_wx(), fetch_notams())
        
        if weather_data:
            weather_icao = input_icao
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
            await save_cached_report(input_icao, request.plane_size, response_data, ttl_seconds=ttl)
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
        if status != "CACHE_HIT":
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
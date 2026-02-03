import time
import datetime
import asyncio
import re
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.core.weather import get_metar_taf
from app.core.notams import get_notams
from app.core.ai import analyze_risk
from app.core.geography import get_nearest_reporting_stations, check_airspace_zones, airports_icao, airports_lid
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

def parse_metar_time(metar_str):
    """
    Extracts the day/hour/minute from a METAR string (e.g., '251853Z').
    Returns a datetime object (UTC) or None if parsing fails.
    """
    if not metar_str: return None
    # Regex for DDHHMMZ
    match = re.search(r'\b(\d{2})(\d{2})(\d{2})Z\b', metar_str)
    if not match: return None
    
    day, hour, minute = map(int, match.groups())
    now = datetime.datetime.utcnow()
    
    try:
        dt = now.replace(day=day, hour=hour, minute=minute, second=0, microsecond=0)
        # Handle month boundary (e.g., today is 1st, METAR is 31st)
        if day > now.day + 1:
            # Likely previous month
            if now.month == 1:
                dt = dt.replace(year=now.year - 1, month=12)
            else:
                dt = dt.replace(month=now.month - 1)
        # Handle future drift (e.g. today is 31st, METAR says 1st)
        elif day < now.day - 1:
             if now.month == 12:
                 dt = dt.replace(year=now.year + 1, month=1)
             else:
                 dt = dt.replace(month=now.month + 1)
        return dt
    except ValueError:
        return None

@router.post("/analyze")
async def analyze_flight(request: AnalysisRequest, raw_request: Request, background_tasks: BackgroundTasks):
    if settings.get("global_pause") == "true":
        msg = settings.get("global_pause_message", "System is under maintenance.")
        raise HTTPException(status_code=503, detail=msg)

    t_start = time.time()
    
    client_id = raw_request.headers.get("X-Client-ID", "UNKNOWN")
    client_ip = raw_request.headers.get("X-Forwarded-For", raw_request.client.host).split(',')[0].strip()
    
    # --- INTERNATIONAL SUPPORT FIX ---
    raw_input = request.icao.upper().strip()
    
    # 1. Try exact match (International/ICAO)
    if raw_input in airports_icao:
        input_icao = raw_input
    
    # 2. Try LID match (e.g. "LAX"), but resolve to ICAO ("KLAX") immediately if possible
    elif raw_input in airports_lid:
        lid_data = airports_lid[raw_input]
        input_icao = lid_data.get('icao') or raw_input

    # 3. Lazy US Pilot Logic (JFK -> KJFK)
    elif len(raw_input) == 3 and ("K" + raw_input) in airports_icao:
        input_icao = "K" + raw_input
        
    else:
        # Fallback
        input_icao = raw_input
    
    resolved_icao = input_icao 
    status = "FAIL" 
    error_msg = None
    model_used = None
    tokens_used = 0

    t_weather = 0
    t_notams = 0
    t_ai = 0

    try:
        # 1. CACHE CHECK
        cached_result = await get_cached_report(input_icao, request.plane_size)
        if cached_result:
            duration = time.time() - t_start
            status = "CACHE_HIT" 
            await log_attempt(client_id, client_ip, input_icao, resolved_icao, request.plane_size, duration, "CACHE_HIT")
            # Inject UI Flags
            cached_result['is_cached'] = True
            return cached_result

        # 2. RATE LIMIT CHECK
        await limiter(raw_request)

        # 3. FETCH DATA (PARALLELIZED)
        airport_data = airports_icao.get(input_icao) or airports_lid.get(input_icao)
        airport_name = airport_data['name'] if airport_data else input_icao
        if airport_data: resolved_icao = airport_data.get('icao', input_icao)

        airspace_warnings = []
        if airport_data:
            try:
                lat, lon = float(airport_data['lat']), float(airport_data['lon'])
                airspace_warnings = check_airspace_zones(input_icao, lat, lon)
            except: pass

        t0_data = time.time()
        
        # --- PARALLEL FETCH ---
        weather_task = get_metar_taf(input_icao)
        notams_task = get_notams(input_icao)
        
        weather_data, notams = await asyncio.gather(weather_task, notams_task)
        
        total_data_time = time.time() - t0_data
        t_weather = total_data_time / 2
        t_notams = total_data_time / 2
        
        # Weather Fallback Logic
        weather_icao = input_icao
        if not weather_data:
            candidates = await get_nearest_reporting_stations(input_icao)
            for station in candidates:
                data = await get_metar_taf(station)
                if data:
                    weather_icao = station
                    weather_data = data
                    break
        
        if not weather_data:
            return {"error": "No airport or weather data found."}

        t0 = time.time()
        analysis = await analyze_risk(
            icao_code=input_icao,
            weather_data=weather_data,
            notams=notams,
            plane_size=request.plane_size,
            reporting_station=weather_icao,
            external_airspace_warnings=airspace_warnings
        )
        t_ai = time.time() - t0

        if '_meta' in analysis:
            tokens_used = analysis['_meta'].get('tokens', 0)
            model_used = analysis['_meta'].get('model', 'unknown')
            del analysis['_meta']

        response_data = {
            "airport_name": airport_name,
            # Inject Timezone for UI
            "airport_tz": airport_data.get('tz', 'UTC') if airport_data else 'UTC',
            "is_cached": False,
            "analysis": analysis,
            "raw_data": {
                "metar": weather_data['metar'],
                "taf": weather_data['taf'],
                "notams": notams,
                "weather_source": weather_icao
            }
        }

        # --- SMART CACHING STRATEGY ---
        now = datetime.datetime.utcnow()
        current_minute = now.minute
        should_cache = True
        
        # 1. STANDARD WINDOW (:00 to :50)
        # Goal: Cache ONLY until minute 50.
        # Example: At :10, cache for 40 mins. At :40, cache for 10 mins.
        if current_minute < 50:
            minutes_until_update = 50 - current_minute
            ttl = minutes_until_update * 60
            
        # 2. DANGER ZONE (:50 to :59)
        # Goal: Verify freshness. If fresh, cache long. If stale, don't cache.
        else:
            metar_dt = parse_metar_time(weather_data['metar'])
            if metar_dt:
                # Is the METAR from the current hour?
                # (Allow 5 min tolerance for clock drift/processing)
                is_fresh = (metar_dt.hour == now.hour) or \
                           (metar_dt > now - datetime.timedelta(minutes=15))
                
                if is_fresh:
                    # FRESH REPORT CAUGHT! 
                    # We can safely cache this for 60 mins (until next :50)
                    ttl = 60 * 60
                else:
                    # STALE REPORT (Still showing previous hour's data)
                    # Do NOT cache. Force next user to check for the new one.
                    should_cache = False
            else:
                # Parsing failed, be conservative
                should_cache = False
            # DANGER ZONE: Check METAR freshness
            metar_dt = parse_metar_time(weather_data['metar'])
            if metar_dt:
                # Is the METAR from the current hour?
                # (Allow 5 min tolerance for clock drift/processing)
                is_fresh = (metar_dt.hour == now.hour) or \
                           (metar_dt > now - datetime.timedelta(minutes=15))
                
                if is_fresh:
                    # FRESH REPORT: Cache for 60 mins (Safe!)
                    ttl = 60 * 60
                else:
                    # STALE REPORT (Previous hour): Do NOT cache.
                    # This forces the next user to re-check for the new report.
                    should_cache = False
            else:
                # Could not parse time; be conservative and do not cache in danger zone
                should_cache = False

        if should_cache:
            await save_cached_report(input_icao, request.plane_size, response_data, ttl_seconds=ttl)
        
        status = "SUCCESS"
        return response_data

    except HTTPException as e:
        if e.status_code == 429:
            status = "RATE_LIMIT"
            print(f"DEBUG: Triggering Rate Limit Alert for {client_ip}...")
            try:
                await notifier.send_alert(
                    "rate_limit", 
                    f"Rate Limit Hit: {input_icao}", 
                    f"User {client_id} (IP: {client_ip}) exceeded limits."
                )
            except Exception as mail_err:
                print(f"DEBUG: Alert System Failed: {mail_err}")
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
            print(f"⏱️  PERFORMANCE: {input_icao} | Total: {duration:.2f}s | Wx: {t_weather:.2f}s | NOTAMs: {t_notams:.2f}s | AI: {t_ai:.2f}s")
            await log_attempt(client_id, client_ip, input_icao, resolved_icao, request.plane_size, duration, status, error_msg, model_used, tokens_used)

# --- PUBLIC STATUS ENDPOINT ---
@router.get("/system-status")
async def get_public_system_status():
    """Public endpoint to fetch banner and non-sensitive status"""
    from app.core.settings import settings
    return {
        "banner_enabled": settings.get("banner_enabled") == "true",
        "banner_message": settings.get("banner_message", "")
    }
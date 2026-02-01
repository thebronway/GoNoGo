import time
import sqlite3
from fastapi import APIRouter, Request, HTTPException # Removed Depends
from pydantic import BaseModel
from app.core.weather import get_metar_taf
from app.core.notams import get_notams
from app.core.ai import analyze_risk
from app.core.geography import get_nearest_reporting_stations, check_airspace_zones, airports_icao, airports_lid
from app.core.rate_limit import RateLimiter
from app.core.logger import log_attempt, DB_PATH
from app.core.cache import get_cached_report, save_cached_report

# Limit: 5 requests per 5 minutes (Applied only to UNCACHED requests)
limiter = RateLimiter(calls=5, period=300)

router = APIRouter()

class AnalysisRequest(BaseModel):
    icao: str
    plane_size: str

@router.post("/api/analyze")
async def analyze_flight(request: AnalysisRequest, raw_request: Request):
    # 1. Start Timer & Setup Logging Variables
    start_time = time.time()
    
    # Extract Client Info (ID from header, IP from connection)
    # We don't use Client ID for limiting anymore, but we still log it if present
    client_id = raw_request.headers.get("X-Client-ID", "UNKNOWN")
    client_ip = raw_request.headers.get("X-Forwarded-For", raw_request.client.host).split(',')[0].strip()
    
    # --- ICAO NORMALIZATION (Fixing BWI -> KBWI) ---
    raw_input = request.icao.upper().strip()
    
    # 1. PRIORITY CHECK: Is it a 3-letter code that becomes a valid ICAO with 'K'?
    if len(raw_input) == 3 and ("K" + raw_input) in airports_icao:
        input_icao = "K" + raw_input
    # 2. Standard Check: Is the raw input valid as-is?
    elif raw_input in airports_icao or raw_input in airports_lid:
        input_icao = raw_input
    # 3. Fallback
    else:
        input_icao = raw_input
    
    # Default logging state
    resolved_icao = input_icao 
    status = "FAIL" 
    error_msg = None

    try:
        # --- CACHE CHECK START (Unlimited Access) ---
        cached_result = get_cached_report(input_icao, request.plane_size)
        if cached_result:
            status = "CACHE_HIT" 
            # We return early. Rate Limit is NEVER checked here.
            return cached_result
        # --- CACHE CHECK END ---

        # --- RATE LIMIT CHECK (Only for new/expensive requests) ---
        # If we are here, we have to spend money on AI. Now we check the wallet.
        await limiter(raw_request)
        # ----------------------------------------------------------

        # 2. Get Airport Data
        airport_data = None
        if input_icao in airports_icao:
            airport_data = airports_icao[input_icao]
        elif input_icao in airports_lid:
            airport_data = airports_lid[input_icao]
        
        airport_name = airport_data['name'] if airport_data else input_icao
        
        if airport_data:
             resolved_icao = airport_data.get('icao', input_icao)

        # 3. Check Airspace Zones
        airspace_warnings = []
        if airport_data:
            try:
                lat = float(airport_data['lat'])
                lon = float(airport_data['lon'])
                airspace_warnings = check_airspace_zones(input_icao, lat, lon)
            except Exception as e:
                print(f"DEBUG: Airspace check failed: {e}")

        # 4. Weather Logic
        weather_icao = input_icao
        weather_data = await get_metar_taf(input_icao)
        
        if not weather_data:
            candidates = await get_nearest_reporting_stations(input_icao)
            for station in candidates:
                data = await get_metar_taf(station)
                if data:
                    weather_icao = station
                    weather_data = data
                    break
        
        if not weather_data:
            error_msg = f"Could not find weather data for {input_icao} or nearby stations."
            return {"error": error_msg}

        # 5. NOTAMs
        notams = await get_notams(input_icao)

        # 6. AI Analysis
        analysis = await analyze_risk(
            icao_code=input_icao,
            weather_data=weather_data,
            notams=notams,
            plane_size=request.plane_size,
            reporting_station=weather_icao,
            external_airspace_warnings=airspace_warnings
        )

        response_data = {
            "airport_name": airport_name,
            "analysis": analysis,
            "raw_data": {
                "metar": weather_data['metar'],
                "taf": weather_data['taf'],
                "notams": notams,
                "weather_source": weather_icao
            }
        }

        # --- CACHE SAVE ---
        save_cached_report(input_icao, request.plane_size, response_data)

        if status == "FAIL": 
            status = "SUCCESS"

        return response_data

    except HTTPException as http_exc:
        # If Rate Limit (429) hits, we must catch it to log it properly
        status = "RATE_LIMIT" if http_exc.status_code == 429 else "ERROR"
        error_msg = str(http_exc.detail)
        raise http_exc 

    except Exception as e:
        status = "ERROR"
        error_msg = str(e)
        raise e 

    finally:
        # 7. LOG EVERYTHING
        duration = time.time() - start_time
        
        log_attempt(
            client_id=client_id, # We log Client ID for tracking, even if we limit by IP
            ip=client_ip,
            input_icao=input_icao,
            resolved_icao=resolved_icao,
            plane=request.plane_size,
            duration=duration,
            status=status,
            error_msg=error_msg
        )

# ... (get_logs and get_stats remain exactly the same) ...
@router.get("/api/logs")
async def get_logs(limit: int = 100):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('SELECT * FROM logs ORDER BY id DESC LIMIT ?', (limit,))
        rows = c.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/stats")
async def get_stats():
    """
    Returns aggregated stats for 24h, 7d, 30d, and All Time.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        stats = {}
        
        time_windows = [
            ("24h", "-1 day"),
            ("7d",  "-7 days"),
            ("30d", "-30 days"),
            ("All", "-100 years")
        ]
        
        for label, modifier in time_windows:
            where_clause = f"WHERE timestamp > datetime('now', '{modifier}')"
            
            # 1. Detailed Counts & Avg Latency
            # We count each Status type individually
            c.execute(f"""
                SELECT 
                    COUNT(*), 
                    AVG(duration_seconds),
                    SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN status = 'CACHE_HIT' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN status = 'RATE_LIMIT' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN status IN ('FAIL', 'ERROR') THEN 1 ELSE 0 END)
                FROM logs {where_clause}
            """)
            row = c.fetchone()
            
            total = row[0]
            avg_lat = row[1] if row[1] else 0.0
            
            # Create a breakdown dictionary
            breakdown = {
                "success": row[2] if row[2] else 0,
                "cache": row[3] if row[3] else 0,
                "limit": row[4] if row[4] else 0,
                "fail": row[5] if row[5] else 0
            }

            # 2. Most Popular Airport
            c.execute(f"""
                SELECT input_icao, COUNT(*) as c 
                FROM logs {where_clause} 
                GROUP BY input_icao 
                ORDER BY c DESC LIMIT 1
            """)
            pop_airport = c.fetchone()
            top_airport = f"{pop_airport[0]} ({pop_airport[1]})" if pop_airport else "-"

            # 3. Most Active IP
            c.execute(f"""
                SELECT ip_address, COUNT(*) as c 
                FROM logs {where_clause} 
                GROUP BY ip_address 
                ORDER BY c DESC LIMIT 1
            """)
            active_ip = c.fetchone()
            top_ip = f"{active_ip[0]} ({active_ip[1]})" if active_ip else "-"

            # 4. Most Rate Limited IP (The "Bad Actor")
            c.execute(f"""
                SELECT ip_address, COUNT(*) as c 
                FROM logs {where_clause} AND status = 'RATE_LIMIT'
                GROUP BY ip_address 
                ORDER BY c DESC LIMIT 1
            """)
            blocked_ip = c.fetchone()
            top_blocked = f"{blocked_ip[0]} ({blocked_ip[1]})" if blocked_ip else "-"

            stats[label] = {
                "total": total,
                "avg_latency": round(avg_lat, 2),
                "breakdown": breakdown,
                "top_airport": top_airport,
                "top_ip": top_ip,
                "top_blocked": top_blocked
            }

        conn.close()
        return stats
        
    except Exception as e:
        print(f"STATS ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
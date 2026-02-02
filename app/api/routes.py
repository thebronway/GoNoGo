import time
import sqlite3
import json
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel
from app.core.weather import get_metar_taf
from app.core.notams import get_notams
from app.core.ai import analyze_risk
from app.core.geography import get_nearest_reporting_stations, check_airspace_zones, airports_icao, airports_lid
from app.core.rate_limit import RateLimiter
from app.core.logger import log_attempt, DB_PATH
from app.core.cache import get_cached_report, save_cached_report
from app.core.settings import settings
from app.core.notifications import notifier

limiter = RateLimiter()
router = APIRouter()

class AnalysisRequest(BaseModel):
    icao: str
    plane_size: str

@router.post("/api/analyze")
async def analyze_flight(request: AnalysisRequest, raw_request: Request, background_tasks: BackgroundTasks):
    # 1. GLOBAL PAUSE CHECK
    if settings.get("global_pause") == "true":
        msg = settings.get("global_pause_message", "System is under maintenance.")
        raise HTTPException(status_code=503, detail=msg)

    start_time = time.time()
    
    # Client ID Logic
    client_id = raw_request.headers.get("X-Client-ID", "UNKNOWN")
    client_ip = raw_request.headers.get("X-Forwarded-For", raw_request.client.host).split(',')[0].strip()
    
    # Normalize ICAO
    raw_input = request.icao.upper().strip()
    if len(raw_input) == 3 and ("K" + raw_input) in airports_icao:
        input_icao = "K" + raw_input
    elif raw_input in airports_icao or raw_input in airports_lid:
        input_icao = raw_input
    else:
        input_icao = raw_input
    
    resolved_icao = input_icao 
    status = "FAIL" 
    error_msg = None
    model_used = None
    tokens_used = 0

    try:
        # 1. CACHE CHECK (First Priority - Free/Unlimited)
        cached_result = get_cached_report(input_icao, request.plane_size)
        if cached_result:
            status = "CACHE_HIT"
            duration = time.time() - start_time
            log_attempt(
                client_id=client_id, 
                ip=client_ip,
                input_icao=input_icao,
                resolved_icao=resolved_icao,
                plane=request.plane_size,
                duration=duration,
                status="CACHE_HIT",
                error_msg=None
            )
            return cached_result

        # 2. RATE LIMIT CHECK
        try:
            await limiter(raw_request)
        except HTTPException as re:
            print(f"DEBUG: Rate Limit Hit. Forcing Email to {client_id}...")
            try:
                notifier._send_email(
                    f"Rate Limit Hit by {client_id}", 
                    f"IP: {client_ip}\nTarget: {input_icao}\n\n(This alert was forced by the rate limiter)"
                )
            except Exception as email_err:
                print(f"CRITICAL EMAIL FAIL: {email_err}")

            # Log RATE_LIMIT immediately
            log_attempt(
                client_id=client_id, 
                ip=client_ip,
                input_icao=input_icao,
                resolved_icao=resolved_icao,
                plane=request.plane_size,
                duration=0,
                status="RATE_LIMIT",
                error_msg=str(re.detail)
            )
            status = "RATE_LIMIT" 
            raise re 

        # 3. FETCH DATA
        airport_data = None
        if input_icao in airports_icao:
            airport_data = airports_icao[input_icao]
        elif input_icao in airports_lid:
            airport_data = airports_lid[input_icao]
        
        airport_name = airport_data['name'] if airport_data else input_icao
        if airport_data: resolved_icao = airport_data.get('icao', input_icao)

        airspace_warnings = []
        if airport_data:
            try:
                lat = float(airport_data['lat'])
                lon = float(airport_data['lon'])
                airspace_warnings = check_airspace_zones(input_icao, lat, lon)
            except: pass

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
            error_msg = "No airport or weather data found. Please try again."
            return {"error": error_msg}

        notams = await get_notams(input_icao)

        analysis = await analyze_risk(
            icao_code=input_icao,
            weather_data=weather_data,
            notams=notams,
            plane_size=request.plane_size,
            reporting_station=weather_icao,
            external_airspace_warnings=airspace_warnings
        )

        if '_meta' in analysis:
            tokens_used = analysis['_meta']['tokens']
            model_used = analysis['_meta']['model']
            del analysis['_meta']

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

        save_cached_report(input_icao, request.plane_size, response_data)
        status = "SUCCESS"
        return response_data

    except HTTPException as e:
        if e.status_code != 429: 
            status = "ERROR"
            error_msg = str(e.detail)
        raise e
    except Exception as e:
        status = "ERROR"
        error_msg = str(e)
        background_tasks.add_task(notifier.send_alert, "error", "System Error", str(e))
        raise e
    finally:
        if status not in ["RATE_LIMIT", "CACHE_HIT"]:
            duration = time.time() - start_time
            log_attempt(
                client_id=client_id, 
                ip=client_ip,
                input_icao=input_icao,
                resolved_icao=resolved_icao,
                plane=request.plane_size,
                duration=duration,
                status=status,
                error_msg=error_msg,
                model=model_used,
                tokens=tokens_used
            )

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
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        stats = {}
        time_windows = [("24h", "-1 day"), ("7d", "-7 days"), ("30d", "-30 days"), ("All", "-100 years")]
        
        for label, modifier in time_windows:
            where_clause = f"WHERE timestamp > datetime('now', '{modifier}')"
            c.execute(f"""
                SELECT COUNT(*), AVG(duration_seconds),
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END),
                SUM(CASE WHEN status = 'CACHE_HIT' THEN 1 ELSE 0 END),
                SUM(CASE WHEN status = 'RATE_LIMIT' THEN 1 ELSE 0 END),
                SUM(CASE WHEN status IN ('FAIL', 'ERROR') THEN 1 ELSE 0 END)
                FROM logs {where_clause}
            """)
            row = c.fetchone()
            
            c.execute(f"SELECT input_icao, COUNT(*) as c FROM logs {where_clause} GROUP BY input_icao ORDER BY c DESC LIMIT 1")
            pop_ap = c.fetchone()
            
            c.execute(f"SELECT client_id, COUNT(*) as c FROM logs {where_clause} GROUP BY client_id ORDER BY c DESC LIMIT 1")
            top_user = c.fetchone()
            
            c.execute(f"SELECT client_id, COUNT(*) as c FROM logs {where_clause} AND status='RATE_LIMIT' GROUP BY client_id ORDER BY c DESC LIMIT 1")
            blocked = c.fetchone()

            stats[label] = {
                "total": row[0],
                "avg_latency": round(row[1] if row[1] else 0, 2),
                "breakdown": {"success": row[2] or 0, "cache": row[3] or 0, "limit": row[4] or 0, "fail": row[5] or 0},
                "top_airport": f"{pop_ap[0]} ({pop_ap[1]})" if pop_ap else "-",
                "top_user": f"{top_user[0][:8]}.. ({top_user[1]})" if top_user else "-",
                "top_blocked": f"{blocked[0][:8]}.. ({blocked[1]})" if blocked else "-"
            }
        conn.close()
        return stats
    except Exception as e:
        print(f"STATS ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/admin/clients")
async def get_client_stats():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        try:
            max_calls = int(settings.get("rate_limit_calls", 5))
            period = int(settings.get("rate_limit_period", 300))
        except:
            max_calls = 5
            period = 300
        
        cutoff_time = f"-{period} seconds"

        c.execute("""
            SELECT client_id, MAX(ip_address), COUNT(*), MAX(timestamp),
            SUM(CASE WHEN status = 'RATE_LIMIT' THEN 1 ELSE 0 END)
            FROM logs GROUP BY client_id ORDER BY COUNT(*) DESC
        """)
        rows = c.fetchall()
        
        data = []
        for r in rows:
            c_id = r[0]
            
            # CALCULATE REAL-TIME BLOCKED STATUS
            c.execute(f"""
                SELECT COUNT(*) FROM logs 
                WHERE client_id = ? 
                AND timestamp > datetime('now', '{cutoff_time}')
                AND status NOT IN ('CACHE_HIT', 'RATE_LIMIT')
            """, (c_id,))
            current_window_count = c.fetchone()[0]
            
            data.append({
                "client_id": c_id,
                "last_ip": r[1],
                "total": r[2],
                "last_seen": r[3],
                "blocked_count": r[4],
                "is_limited": current_window_count >= max_calls,
                "limit_key": c_id
            })
            
        conn.close()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UnblockRequest(BaseModel):
    key: str

@router.post("/api/admin/unblock")
async def unblock_client(data: UnblockRequest):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        c.execute("""
            DELETE FROM logs 
            WHERE client_id = ? 
            AND timestamp > datetime('now', '-1 hour')
            AND status NOT IN ('CACHE_HIT', 'RATE_LIMIT')
        """, (data.key,))
        
        deleted_count = c.rowcount
        conn.commit()
        conn.close()
        
        if deleted_count > 0:
            return {"status": "success", "message": f"Cleared {deleted_count} logs for {data.key}. User unblocked."}
        else:
            return {"status": "info", "message": "User had no recent logs to clear."}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/admin/settings")
async def get_all_settings():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM system_settings")
        settings_rows = [dict(row) for row in c.fetchall()]
        c.execute("SELECT * FROM notification_rules")
        rules_rows = [dict(row) for row in c.fetchall()]
        c.execute("SELECT SUM(tokens_used), COUNT(*) FROM logs WHERE model_used IS NOT NULL")
        usage = c.fetchone()
        conn.close()
        return {"config": settings_rows, "notifications": rules_rows, "usage": {"total_tokens": usage[0] or 0, "ai_calls": usage[1] or 0}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SettingUpdate(BaseModel):
    key: str
    value: str

@router.post("/api/admin/settings")
async def update_setting(data: SettingUpdate):
    if settings.set(data.key, data.value):
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to save")

class RuleUpdate(BaseModel):
    event_type: str
    channels: list[str]
    enabled: bool

@router.post("/api/admin/notifications")
async def update_notification_rule(data: RuleUpdate):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO notification_rules (event_type, channels, enabled) VALUES (?, ?, ?)", 
                  (data.event_type, json.dumps(data.channels), 1 if data.enabled else 0))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TestNotification(BaseModel):
    channel: str

@router.post("/api/admin/test-notification")
async def test_notification(data: TestNotification, background_tasks: BackgroundTasks):
    try:
        if data.channel == 'smtp': background_tasks.add_task(notifier._send_email, "Test", "Test Alert")
        elif data.channel == 'discord': background_tasks.add_task(notifier._send_discord, "Test", "Test Alert")
        elif data.channel == 'slack': background_tasks.add_task(notifier._send_slack, "Test", "Test Alert")
        return {"status": "queued"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
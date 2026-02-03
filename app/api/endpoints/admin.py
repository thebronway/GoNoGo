import json
import datetime
import os
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from app.core.db import database, redis_client
from app.core.settings import settings
from app.core.notifications import notifier

# --- SECURITY CONFIGURATION ---
API_KEY_NAME = "X-Admin-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def get_admin_key(api_key_header: str = Security(api_key_header)):
    secret = os.getenv("ADMIN_SECRET_KEY")
    if not secret:
        return 
    
    if api_key_header == secret:
        return

    raise HTTPException(status_code=403, detail="Invalid or missing Admin Key")

# Protect all routes in this file
router = APIRouter(dependencies=[Depends(get_admin_key)])

# --- 1. STATISTICS (THE CARDS) ---
@router.get("/stats")
async def get_stats():
    # 1. CACHE CHECK (5 Minute TTL)
    cache_key = "admin_stats_cache"
    cached_data = await redis_client.get(cache_key)
    if cached_data:
        return json.loads(cached_data)

    stats = {}
    
    # Use utcnow() for Naive timestamps (Matches Postgres)
    now_naive = datetime.datetime.utcnow()
    
    intervals = {
        "1h": now_naive - datetime.timedelta(hours=1),
        "24h": now_naive - datetime.timedelta(days=1),
        "7d": now_naive - datetime.timedelta(days=7),
        "30d": now_naive - datetime.timedelta(days=30),
        "60d": now_naive - datetime.timedelta(days=60),
        "90d": now_naive - datetime.timedelta(days=90),
    }
    
    for label, cutoff_time in intervals.items():
        query_base = "FROM logs WHERE timestamp > :cutoff"
        params = {"cutoff": cutoff_time}
        
        # 1. Aggregates
        query_agg = f"""
            SELECT COUNT(*) as total, AVG(duration_seconds) as avg_lat,
            SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
            SUM(CASE WHEN status = 'CACHE_HIT' THEN 1 ELSE 0 END) as cache,
            SUM(CASE WHEN status = 'RATE_LIMIT' THEN 1 ELSE 0 END) as limit_hit,
            SUM(CASE WHEN status IN ('FAIL', 'ERROR') THEN 1 ELSE 0 END) as fail
            {query_base}
        """
        row = await database.fetch_one(query_agg, values=params)
        
        # 2. Top Airport
        query_top_apt = f"SELECT input_icao, COUNT(*) as c {query_base} GROUP BY input_icao ORDER BY c DESC LIMIT 1"
        pop_ap = await database.fetch_one(query_top_apt, values=params)
        
        # 3. Top User
        query_top_user = f"SELECT client_id, COUNT(*) as c {query_base} GROUP BY client_id ORDER BY c DESC LIMIT 1"
        top_user = await database.fetch_one(query_top_user, values=params)

        # 4. Top Blocked
        query_blocked = f"SELECT client_id, COUNT(*) as c {query_base} AND status='RATE_LIMIT' GROUP BY client_id ORDER BY c DESC LIMIT 1"
        blocked = await database.fetch_one(query_blocked, values=params)

        stats[label] = {
            "total": row['total'] or 0,
            "avg_latency": round(row['avg_lat'] or 0, 2),
            "breakdown": {
                "success": row['success'] or 0, 
                "cache": row['cache'] or 0, 
                "limit": row['limit_hit'] or 0, 
                "fail": row['fail'] or 0
            },
            "top_airport": f"{pop_ap['input_icao']} ({pop_ap['c']})" if pop_ap else "-",
            "top_user": f"{top_user['client_id'][:8]}.. ({top_user['c']})" if top_user else "-",
            "top_blocked": f"{blocked['client_id'][:8]}.. ({blocked['c']})" if blocked else "-"
        }
    
    # 2. SAVE TO CACHE
    await redis_client.setex(cache_key, 300, json.dumps(stats))
    
    return stats

# --- 2. LOGS VIEWER ---
@router.get("/logs")
async def get_logs(limit: int = 100):
    query = "SELECT * FROM logs ORDER BY id DESC LIMIT :limit"
    rows = await database.fetch_all(query=query, values={"limit": limit})
    
    # FIX: Force timestamps to be UTC Aware so Frontend converts them correctly
    results = []
    for row in rows:
        r = dict(row)
        if r['timestamp'] and r['timestamp'].tzinfo is None:
            r['timestamp'] = r['timestamp'].replace(tzinfo=datetime.timezone.utc)
        results.append(r)
        
    return results

# --- 3. CLIENT MANAGEMENT & UNBLOCKING ---
@router.get("/clients")
async def get_client_stats():
    limit_count = int(settings.get("rate_limit_calls", 5))
    period_seconds = int(settings.get("rate_limit_period", 300))
    
    query = """
        SELECT client_id, MAX(ip_address) as last_ip, COUNT(*) as total, MAX(timestamp) as last_seen,
        SUM(CASE WHEN status = 'RATE_LIMIT' THEN 1 ELSE 0 END) as blocked_count
        FROM logs GROUP BY client_id ORDER BY total DESC
    """
    rows = await database.fetch_all(query)
    
    data = []
    for r in rows:
        c_id = r['client_id']
        q_window = """
            SELECT COUNT(*) FROM logs 
            WHERE client_id = :cid 
            AND timestamp > (NOW() - :seconds * INTERVAL '1 second')
            AND status NOT IN ('CACHE_HIT', 'RATE_LIMIT')
        """
        current_window_count = await database.fetch_val(q_window, values={"cid": c_id, "seconds": period_seconds})
        
        data.append({
            "client_id": c_id,
            "last_ip": r['last_ip'],
            "total": r['total'],
            "last_seen": r['last_seen'],
            "blocked_count": r['blocked_count'],
            "is_limited": current_window_count >= limit_count,
            "limit_key": c_id
        })
    return data

class UnblockRequest(BaseModel):
    key: str

@router.post("/unblock")
async def unblock_client(data: UnblockRequest):
    # 1. Clear DB History
    query = "DELETE FROM logs WHERE client_id = :key AND timestamp > NOW() - INTERVAL '1 hour'"
    await database.execute(query, values={"key": data.key})

    # 2. Smart Redis Unblock
    keys_to_check = [f"rate_limit:{data.key}"]
    ip_query = "SELECT ip_address FROM logs WHERE client_id = :key ORDER BY id DESC LIMIT 1"
    ip_row = await database.fetch_one(ip_query, values={"key": data.key})
    
    if ip_row and ip_row['ip_address']:
        keys_to_check.append(f"rate_limit:{ip_row['ip_address']}")

    deleted_count = 0
    for key in keys_to_check:
        res = await redis_client.delete(key)
        if res: deleted_count += 1
        
    return {"status": "success", "message": f"Unblocked {deleted_count} Redis keys."}

# --- 4. SETTINGS & PROBES ---
@router.get("/settings")
async def get_all_settings():
    query_conf = "SELECT * FROM system_settings"
    settings_rows = await database.fetch_all(query_conf)
    rules_rows = await settings.get_all_rules()
    query_usage = "SELECT SUM(tokens_used) as t, COUNT(*) as c FROM logs WHERE model_used IS NOT NULL"
    usage = await database.fetch_one(query_usage)
    
    return {
        "config": [dict(r) for r in settings_rows], 
        "notifications": rules_rows, 
        "usage": {"total_tokens": usage['t'] or 0, "ai_calls": usage['c'] or 0}
    }

class SettingUpdate(BaseModel):
    key: str
    value: str

@router.post("/settings")
async def update_setting(data: SettingUpdate):
    await settings.set(data.key, data.value)
    return {"status": "success"}

class RuleUpdate(BaseModel):
    event_type: str
    channels: list[str]
    enabled: bool

@router.post("/notifications")
async def update_notification_rule(data: RuleUpdate):
    await settings.set_rule(data.event_type, data.channels, data.enabled)
    return {"status": "success"}

class TestNotification(BaseModel):
    channel: str

@router.post("/test-notification")
async def test_notification(data: TestNotification, background_tasks: BackgroundTasks):
    if data.channel == 'smtp': background_tasks.add_task(notifier._send_email, "Test", "Test Alert")
    elif data.channel == 'discord': background_tasks.add_task(notifier._send_discord, "Test", "Test Alert")
    elif data.channel == 'slack': background_tasks.add_task(notifier._send_slack, "Test", "Test Alert")
    return {"status": "queued"}
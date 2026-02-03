import json
import datetime
from app.core.db import database

# Default fallback if no TTL specified (30 mins)
DEFAULT_TTL = 30 * 60

def get_plane_category(plane_input: str) -> str:
    p = plane_input.lower().strip()
    if any(x in p for x in ['boeing', 'airbus', '737', '747', 'a320', 'gulfstream', 'global', 'crj', 'erj']):
        return "LARGE"
    if any(x in p for x in ['king air', 'pilatus', 'pc-12', 'citation', 'phenom', 'learjet', 'tbm']):
        return "MEDIUM"
    return "SMALL"

async def get_cached_report(icao: str, plane_input: str):
    category = get_plane_category(plane_input)
    cache_key = f"{icao.upper()}_{category}"
    
    query = "SELECT * FROM flight_cache WHERE key = :key"
    row = await database.fetch_one(query=query, values={"key": cache_key})
    
    if not row:
        return None
        
    data = json.loads(row['data'])
    
    # --- SMART TTL CHECK ---
    # Check if this specific record has an expiration time
    valid_until_ts = data.get('valid_until')
    
    now = datetime.datetime.utcnow().timestamp()
    
    if valid_until_ts:
        # Smart Cache Logic: Respect the stamp
        if now > valid_until_ts:
            return None
    else:
        # Fallback Logic: Old records (30 min default)
        stored_time = row['timestamp']
        if stored_time.tzinfo is None:
            # Assume stored_time is naive UTC
            stored_ts = stored_time.replace(tzinfo=datetime.timezone.utc).timestamp()
        else:
            stored_ts = stored_time.timestamp()
            
        age = now - stored_ts
        if age > DEFAULT_TTL:
            return None

    return data

async def save_cached_report(icao: str, plane_input: str, data: dict, ttl_seconds: int = DEFAULT_TTL):
    category = get_plane_category(plane_input)
    cache_key = f"{icao.upper()}_{category}"
    
    # Inject Expiration Stamp into the Data Blob
    # This avoids needing a schema migration for a 'valid_until' column
    now = datetime.datetime.utcnow()
    valid_until = now + datetime.timedelta(seconds=ttl_seconds)
    data['valid_until'] = valid_until.timestamp()
    
    query = """
        INSERT INTO flight_cache (key, icao, category, timestamp, data)
        VALUES (:key, :icao, :category, :ts, :data)
        ON CONFLICT (key) DO UPDATE 
        SET timestamp = :ts, data = :data
    """
    
    values = {
        "key": cache_key,
        "icao": icao.upper(),
        "category": category,
        "ts": now, # Stored for reference/sorting
        "data": json.dumps(data)
    }
    
    await database.execute(query, values)
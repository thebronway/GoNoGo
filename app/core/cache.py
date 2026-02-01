import sqlite3
import json
import datetime
from app.core.logger import DB_PATH

# 30 Minutes in seconds
TTL_SECONDS = 30 * 60

def get_plane_category(plane_string: str) -> str:
    p = plane_string.lower().strip()
    if any(x in p for x in ['boeing', 'airbus', '737', '747', 'a320', 'gulfstream', 'global', 'crj', 'erj']):
        return "LARGE"
    if any(x in p for x in ['king air', 'pilatus', 'pc-12', 'citation', 'phenom', 'learjet', 'tbm']):
        return "MEDIUM"
    return "SMALL"

def get_cached_report(icao: str, plane_input: str):
    category = get_plane_category(plane_input)
    cache_key = f"{icao.upper()}_{category}"
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute("SELECT * FROM flight_cache WHERE key = ?", (cache_key,))
        row = c.fetchone()
        conn.close()
        
        if not row:
            return None
            
        stored_time = datetime.datetime.fromisoformat(row['timestamp'])
        age = (datetime.datetime.utcnow() - stored_time).total_seconds()
        
        if age > TTL_SECONDS:
            return None 
            
        return json.loads(row['data'])
        
    except Exception as e:
        print(f"CACHE READ ERROR: {e}")
        return None

def save_cached_report(icao: str, plane_input: str, data: dict):
    category = get_plane_category(plane_input)
    cache_key = f"{icao.upper()}_{category}"
    
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        c.execute("""
            INSERT OR REPLACE INTO flight_cache (key, icao, category, timestamp, data)
            VALUES (?, ?, ?, ?, ?)
        """, (
            cache_key, 
            icao.upper(), 
            category, 
            datetime.datetime.utcnow().isoformat(), 
            json.dumps(data)
        ))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"CACHE SAVE ERROR: {e}")
import os
import redis.asyncio as redis
from databases import Database

# 1. DATABASE CONNECTION
DATABASE_URL = os.getenv("DATABASE_URL")
database = Database(DATABASE_URL)

# 2. CACHE CONNECTION
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

async def init_db_tables():
    """
    Creates tables if they don't exist.
    """
    query_logs = """
    CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        client_id TEXT,
        ip_address TEXT,
        input_icao TEXT,
        resolved_icao TEXT,
        plane_profile TEXT,
        duration_seconds REAL,
        status TEXT,
        error_message TEXT,
        model_used TEXT,
        tokens_used INTEGER
    );
    """
    
    query_cache = """
    CREATE TABLE IF NOT EXISTS flight_cache (
        key TEXT PRIMARY KEY,
        icao TEXT,
        category TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data TEXT
    );
    """
    
    query_settings = """
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT
    );
    """
    
    query_notif = """
    CREATE TABLE IF NOT EXISTS notification_rules (
        event_type TEXT PRIMARY KEY,
        channels TEXT,
        enabled INTEGER DEFAULT 1
    );
    """
    
    try:
        async with database.transaction():
            await database.execute(query_logs)
            await database.execute(query_cache)
            await database.execute(query_settings)
            await database.execute(query_notif)
            
            # --- MIGRATION: Add new columns for Enhanced Logging ---
            # We use 'ADD COLUMN IF NOT EXISTS' which is valid in Postgres
            try:
                await database.execute("ALTER TABLE logs ADD COLUMN IF NOT EXISTS weather_icao TEXT")
                await database.execute("ALTER TABLE logs ADD COLUMN IF NOT EXISTS expiration_timestamp TIMESTAMP")
            except Exception as ex:
                print(f"DEBUG: Schema migration warning: {ex}")

    except Exception as e:
        # Ignore race conditions during startup (UniqueViolationError)
        # One worker will succeed, the others will fail harmlessly.
        print(f"DEBUG: DB Init skipped or failed (likely race condition): {e}")
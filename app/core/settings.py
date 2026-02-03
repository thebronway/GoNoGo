import json
from app.core.db import database, redis_client

class SettingsManager:
    async def load(self):
        pass

    async def get(self, key, default=None):
        # 1. Try Redis
        try:
            val = await redis_client.get(f"setting:{key}")
            if val is not None:
                return val
        except Exception:
            pass
        
        # 2. Try DB
        query = "SELECT value FROM system_settings WHERE key = :key"
        row = await database.fetch_one(query=query, values={"key": key})
        
        if row:
            val = row["value"]
            # 3. Backfill Redis (TTL 60s)
            try:
                await redis_client.setex(f"setting:{key}", 60, val)
            except Exception: pass
            return val
            
        return default

    async def set(self, key, value):
        s_val = str(value)
        # 1. Write to DB
        query = """
            INSERT INTO system_settings (key, value) VALUES (:key, :value)
            ON CONFLICT (key) DO UPDATE SET value = :value
        """
        await database.execute(query=query, values={"key": key, "value": s_val})
        
        # 2. Write to Redis
        try:
            await redis_client.setex(f"setting:{key}", 60, s_val)
        except Exception: pass
        
        return True

    # --- THIS WAS MISSING AND CAUSING THE CRASH ---
    async def get_all_rules(self):
        """Fetch notification rules"""
        # The table exists now (you created it), so this will work.
        query = "SELECT * FROM notification_rules"
        rows = await database.fetch_all(query)
        return [dict(row) for row in rows]

    async def set_rule(self, event_type, channels, enabled):
        query = """
            INSERT INTO notification_rules (event_type, channels, enabled) 
            VALUES (:event_type, :channels, :enabled)
            ON CONFLICT (event_type) DO UPDATE 
            SET channels = :channels, enabled = :enabled
        """
        values = {
            "event_type": event_type,
            "channels": json.dumps(channels),
            "enabled": 1 if enabled else 0
        }
        await database.execute(query, values)

settings = SettingsManager()
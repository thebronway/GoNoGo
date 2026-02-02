import sqlite3
import time
from app.core.logger import DB_PATH

class SettingsManager:
    def __init__(self):
        self._cache = {}
        self._last_fetch = 0
        self.TTL = 10  # Cache settings for 10 seconds

    def _refresh_cache(self):
        now = time.time()
        if now - self._last_fetch < self.TTL:
            return

        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT key, value FROM system_settings")
            rows = c.fetchall()
            
            new_cache = {}
            for row in rows:
                new_cache[row['key']] = row['value']
            
            self._cache = new_cache
            self._last_fetch = now
            conn.close()
        except Exception as e:
            print(f"SETTINGS ERROR: {e}")

    def get(self, key, default=None):
        self._refresh_cache()
        return self._cache.get(key, default)

    def set(self, key, value):
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)", (key, str(value)))
            conn.commit()
            conn.close()
            # Invalidate cache immediately
            self._last_fetch = 0 
            return True
        except Exception as e:
            print(f"SETTINGS WRITE ERROR: {e}")
            return False

settings = SettingsManager()
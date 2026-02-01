import sqlite3
import datetime
import os

# Store the DB file in the app directory
DB_PATH = "flight_logs.db"

def init_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # 1. Existing Logs Table
        c.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                client_id TEXT,
                ip_address TEXT,
                input_icao TEXT,
                resolved_icao TEXT,
                plane_size TEXT,
                duration_seconds REAL,
                status TEXT,
                error_msg TEXT
            )
        ''')
        
        # 2. NEW: Flight Cache Table
        c.execute('''
            CREATE TABLE IF NOT EXISTS flight_cache (
                key TEXT PRIMARY KEY,
                icao TEXT,
                category TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                data TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB INIT ERROR: {e}")

def log_attempt(client_id, ip, input_icao, resolved_icao, plane, duration, status, error_msg=None):
    """Insert a log entry safely."""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''
            INSERT INTO logs (
                timestamp, client_id, ip_address, input_icao, resolved_icao, 
                plane_profile, duration_seconds, status, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            datetime.datetime.now(), 
            client_id, 
            ip, 
            input_icao, 
            resolved_icao, 
            plane, 
            duration, 
            status, 
            error_msg
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"LOGGING ERROR: {e}")
import sqlite3
import ipaddress
from fastapi import Request, HTTPException
from app.core.settings import settings
from app.core.logger import DB_PATH

class RateLimiter:
    def __init__(self):
        self.exempt_networks = [
            ipaddress.ip_network("127.0.0.0/8"),
            ipaddress.ip_network("::1/128"),
            ipaddress.ip_network("10.0.0.0/8"),
            ipaddress.ip_network("172.16.0.0/12"),
        ]

    async def __call__(self, request: Request):
        try:
            max_calls = int(settings.get("rate_limit_calls", 5))
            period = int(settings.get("rate_limit_period", 300))
        except:
            max_calls = 5
            period = 300

        if max_calls <= 0:
             raise HTTPException(
                status_code=429, 
                detail="System is currently rejecting new requests (Rate Limit 0)."
            )

        client_ip = request.headers.get("X-Forwarded-For", request.client.host).split(',')[0].strip()
        client_id = request.headers.get("X-Client-ID")

        # Exemption Check
        try:
            ip_obj = ipaddress.ip_address(client_ip)
            if ip_obj.version == 6 and ip_obj.ipv4_mapped:
                ip_obj = ip_obj.ipv4_mapped
            for network in self.exempt_networks:
                if ip_obj in network: return 
        except ValueError: pass

        # DATABASE CHECK
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            
            cutoff_time = f"-{period} seconds"
            
            if client_id and client_id not in ["null", "undefined"]:
                query = """
                    SELECT COUNT(*) FROM logs 
                    WHERE client_id = ? 
                    AND timestamp > datetime('now', ?)
                    AND status NOT IN ('CACHE_HIT', 'RATE_LIMIT')
                """
                params = (client_id, cutoff_time)
            else:
                query = """
                    SELECT COUNT(*) FROM logs 
                    WHERE ip_address = ? 
                    AND timestamp > datetime('now', ?)
                    AND status NOT IN ('CACHE_HIT', 'RATE_LIMIT')
                """
                params = (client_ip, cutoff_time)

            c.execute(query, params)
            count = c.fetchone()[0]
            conn.close()

            if count >= max_calls:
                raise HTTPException(
                    status_code=429, 
                    detail=(
                        "Rate limit exceeded. To keep this tool free, "
                        "analysis is limited to 5 searches every 5 minutes. "
                        "Buy Me A Fuel Top-Up in the Footer helps with server costs"
                    )
                )

        except HTTPException:
            raise
        except Exception as e:
            print(f"RATE LIMIT DB ERROR: {e}")
            pass
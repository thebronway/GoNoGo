import ipaddress
from fastapi import Request, HTTPException
from app.core.settings import settings
from app.core.db import redis_client

class RateLimiter:
    def __init__(self):
        # RESTORED: 10.x exemption as requested
        self.exempt_networks = [
            ipaddress.ip_network("127.0.0.0/8"),
            ipaddress.ip_network("::1/128"),
            ipaddress.ip_network("10.0.0.0/8"), 
        ]

    async def __call__(self, request: Request):
        try:
            # Force refresh from cache to ensure "1" applies instantly
            max_calls_val = await settings.get("rate_limit_calls", 5)
            period_val = await settings.get("rate_limit_period", 300)
            max_calls = int(max_calls_val)
            period = int(period_val)
        except:
            max_calls = 5
            period = 300

        # Allow disabling limits by setting to 0
        if max_calls <= 0:
             return

        # 1. Identify User
        # We prefer X-Client-ID (Frontend UUID), fallback to IP
        client_ip = request.headers.get("X-Forwarded-For", request.client.host).split(',')[0].strip()
        client_id = request.headers.get("X-Client-ID")
        
        identifier = client_id if (client_id and client_id not in ["null", "undefined", "UNKNOWN"]) else client_ip
        
        # 2. Check Exemptions
        try:
            ip_obj = ipaddress.ip_address(client_ip)
            for network in self.exempt_networks:
                if ip_obj in network: 
                    # print(f"DEBUG: RateLimit EXEMPT IP={client_ip}") 
                    return 
        except ValueError: pass

        # 3. REDIS CHECK
        redis_key = f"rate_limit:{identifier}"

        # Increment counter (Atomic)
        current_count = await redis_client.incr(redis_key)

        # Set expiration on first hit
        if current_count == 1:
            await redis_client.expire(redis_key, period)

        # DEBUG LOG (Check this in 'docker logs' to verify it sees Limit=1)
        print(f"DEBUG: RateLimit Key={redis_key} Count={current_count}/{max_calls}")

        if current_count > max_calls:
            raise HTTPException(
                status_code=429, 
                detail=(
                        "Rate limit exceeded. To keep this tool free, "
                        "analysis is limited to 5 searches every 5 minutes. "
                        "Buy Me A Fuel Top-Up in the Footer helps with server costs"
                    )
            )

limiter = RateLimiter()
import ipaddress
from fastapi import Request, HTTPException
from app.core.settings import settings
from app.core.db import redis_client

class RateLimiter:
    def __init__(self):
        # Hardcoded Exemptions
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

        if max_calls <= 0:
             return

        # 1. Identify User (Prioritize IP, handle Docker NAT)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(',')[0].strip()
        else:
            client_ip = request.client.host
            
        identifier = client_ip
        
        # 2. Check Exemptions
        try:
            ip_obj = ipaddress.ip_address(client_ip)
            for network in self.exempt_networks:
                if ip_obj in network: 
                    return 
        except ValueError: pass

        # 3. REDIS CHECK
        redis_key = f"rate_limit:{identifier}"

        # Increment counter (Atomic)
        current_count = await redis_client.incr(redis_key)

        # Set expiration on first hit
        if current_count == 1:
            await redis_client.expire(redis_key, period)

        if current_count > max_calls:
            raise HTTPException(
                status_code=429, 
                detail="Rate limit exceeded."
            )

limiter = RateLimiter()
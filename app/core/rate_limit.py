import time
import ipaddress
from fastapi import Request, HTTPException

class RateLimiter:
    def __init__(self, calls: int, period: int):
        self.calls = calls       # Max calls allowed
        self.period = period     # Time period in seconds
        self.clients = {}        # Dictionary to store IPs
        
        # Define Exempt Networks
        self.exempt_networks = [
            ipaddress.ip_network("127.0.0.0/8"),     # Localhost IPv4
            ipaddress.ip_network("::1/128"),         # Localhost IPv6
            ipaddress.ip_network("10.0.0.0/8"),     # Your Local Network
            ipaddress.ip_network("172.16.0.0/12"),   # Docker Internal Ranges (Just in case)
        ]

    async def __call__(self, request: Request):
        # 1. Get Real IP
        client_ip = request.headers.get("X-Forwarded-For", request.client.host).split(',')[0].strip()

        # 2. Check Exemption (The "VIP List")
        try:
            ip_obj = ipaddress.ip_address(client_ip)
            
            # CRITICAL FIX: Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:10.0.0.71)
            if ip_obj.version == 6 and ip_obj.ipv4_mapped:
                ip_obj = ip_obj.ipv4_mapped

            is_exempt = False
            for network in self.exempt_networks:
                if ip_obj in network:
                    is_exempt = True
                    break
            
            # DEBUG PRINT (Check your Docker logs for this!)
            print(f"DEBUG: RateLimit IP=[{ip_obj}] Exempt=[{is_exempt}]")

            if is_exempt:
                return # User is VIP, skip the limit

        except ValueError:
            # If IP is malformed, just proceed to limit
            print(f"DEBUG: RateLimit Malformed IP: {client_ip}")
            pass

        # 3. Standard Rate Limiting Logic
        current_time = time.time()
        
        # Use the string version of the standardized IP object
        ip_key = str(ip_obj)

        if ip_key not in self.clients:
            self.clients[ip_key] = []

        # 4. Clean up old timestamps
        self.clients[ip_key] = [
            t for t in self.clients[ip_key] 
            if current_time - t < self.period
        ]

        # 5. Check if limit exceeded
        if len(self.clients[ip_key]) >= self.calls:
            print(f"DEBUG: BLOCKED IP {ip_key} (Count: {len(self.clients[ip_key])} >= {self.calls})")
            raise HTTPException(
                status_code=429, 
                detail=(
                    "Rate limit exceeded. To keep this tool free and ad-free, "
                    "analysis is limited to 5 searches every 5 minutes."
                )
            )

        # 6. Add new timestamp
        self.clients[ip_key].append(current_time)
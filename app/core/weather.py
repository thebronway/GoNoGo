import httpx
import asyncio

async def get_metar_taf(icao_code):
    if not icao_code:
        return None

    # AviationWeather API
    url = f"https://aviationweather.gov/api/data/metar?ids={icao_code}&format=raw&taf=true"

    async with httpx.AsyncClient(timeout=10.0) as client:
        for attempt in range(1, 4):
            try:
                # This is the non-blocking call
                response = await client.get(url)
                
                if response.status_code == 200:
                    raw_text = response.text.strip()
                    if not raw_text: return None

                    # Split METAR and TAF
                    lines = raw_text.split('\n')
                    metar = None
                    taf = None

                    for line in lines:
                        if "METAR" in line or (icao_code in line and "TAF" not in line):
                             if not metar: metar = line
                        if "TAF" in line:
                             taf = line
                    
                    # Fallbacks
                    if not metar and lines: metar = lines[0]
                    if not taf: taf = "No TAF available"

                    return {
                        "metar": metar.strip(),
                        "taf": taf.strip()
                    }
            
            except httpx.RequestError as e:
                # Exponential Backoff: 1s, 2s, 4s...
                wait_time = 2 ** (attempt - 1)
                print(f"DEBUG: Weather API Error ({e}). Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)

    return None
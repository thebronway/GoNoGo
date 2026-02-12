import httpx
import asyncio
import logging

logger = logging.getLogger(__name__)

async def get_metar_taf(icao_code):
    if not icao_code:
        return None

    # AviationWeather API
    url = f"https://aviationweather.gov/api/data/metar?ids={icao_code}&format=raw&taf=true"

    async with httpx.AsyncClient(timeout=10.0) as client:
        for attempt in range(1, 4):
            try:
                response = await client.get(url)
                
                # Check status code explicitly to trigger retry on 5xx errors
                if response.status_code != 200:
                    logger.warning(f"FAA API returned status {response.status_code} for {icao_code}. Retrying...")
                    # Force a retry by raising an exception or just continuing
                    if attempt < 3:
                        await asyncio.sleep(2 ** (attempt - 1))
                        continue
                    else:
                        return None

                raw_text = response.text.strip()
                if not raw_text: return None

                lines = raw_text.split('\n')
                metar = None
                taf_lines = []
                in_taf_block = False

                # Robust parser for potential multi-line responses
                for line in lines:
                    clean_line = line.strip()
                    if not clean_line: continue

                    # Identify METAR (First line or explicitly marked)
                    if "METAR" in clean_line or (icao_code in clean_line and "TAF" not in clean_line and not in_taf_block):
                            if not metar: metar = clean_line
                    
                    # Identify TAF Start
                    if "TAF" in clean_line:
                            in_taf_block = True
                    
                    # Accumulate TAF lines
                    if in_taf_block:
                        taf_lines.append(clean_line)
                
                # Fallbacks
                if not metar and lines: metar = lines[0]
                
                # Join multi-line TAF into one block
                taf = " ".join(taf_lines) if taf_lines else "No TAF available"

                return {
                    "metar": metar.strip(),
                    "taf": taf.strip()
                }
            
            except httpx.RequestError as e:
                wait_time = 2 ** (attempt - 1)
                logger.error(f"Weather API Connection Error ({e}). Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)

    return None

async def get_bulk_weather_data(icao_codes):
    """
    Fetches METAR and TAF for multiple airports in parallel using JSON.
    Returns a dict: { "ICAO": {"metar": "...", "taf": "..."}, ... }
    """
    if not icao_codes: return {}
    
    # Remove duplicates and join
    unique_ids = list(set(icao_codes))
    ids_str = ",".join(unique_ids)
    
    # We use JSON format for bulk because it's cleaner than parsing raw multi-station text
    metar_url = f"https://aviationweather.gov/api/data/metar?ids={ids_str}&format=json"
    taf_url = f"https://aviationweather.gov/api/data/taf?ids={ids_str}&format=json"
    
    results = {}
    
    async with httpx.AsyncClient(timeout=8.0) as client:
        try:
            # Parallel Fetch: Get both METARs and TAFs at the same time
            metar_resp, taf_resp = await asyncio.gather(
                client.get(metar_url),
                client.get(taf_url),
                return_exceptions=True
            )

            # Process METARs
            if isinstance(metar_resp, httpx.Response) and metar_resp.status_code == 200:
                try:
                    for item in metar_resp.json():
                        icao = item.get('icaoId')
                        raw_txt = item.get('rawOb')
                        if icao and raw_txt:
                            if icao not in results: results[icao] = {"metar": None, "taf": "No TAF available"}
                            results[icao]['metar'] = raw_txt
                except: pass

            # Process TAFs
            if isinstance(taf_resp, httpx.Response) and taf_resp.status_code == 200:
                try:
                    for item in taf_resp.json():
                        icao = item.get('icaoId')
                        raw_txt = item.get('rawTAF')
                        if icao and raw_txt:
                            if icao not in results: results[icao] = {"metar": None, "taf": "No TAF available"}
                            results[icao]['taf'] = raw_txt
                except: pass
                
        except Exception as e:
            logger.error(f"Bulk Fetch Error: {e}")
            
    return results
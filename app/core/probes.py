import asyncio
import httpx
from app.core.notifications import notifier
from app.core.ai import client as ai_client
from app.core.db import database

async def check_faa():
    try:
        url = "https://aviationweather.gov/api/data/metar?ids=KJFK"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200 and "KJFK" in resp.text:
                return True
    except: pass
    return False

async def check_openai():
    try:
        await ai_client.models.list()
        return True
    except: pass
    return False

async def run_probes():
    """Runs periodically in background"""
    while True:
        await asyncio.sleep(60 * 15) # Check every 15 mins

        try:
            # Clean logs older than 90 days
            await database.execute("DELETE FROM logs WHERE timestamp < NOW() - INTERVAL '90 days'")
        except Exception as e:
            print(f"CLEANUP ERROR: {e}")
        
        # Check FAA
        if not await check_faa():
            await notifier.send_alert("api_outage", "FAA API Down", "The AviationWeather API is failing to respond.")
        
        # Check OpenAI
        if not await check_openai():
            await notifier.send_alert("api_outage", "OpenAI API Down", "Cannot connect to OpenAI API.")
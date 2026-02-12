import json
import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.core.db import database
from app.core.weather import get_metar_taf
from app.api.endpoints.admin import get_admin_key

router = APIRouter()

# --- PUBLIC KIOSK ENDPOINTS ---

@router.get("/config/{icao}")
async def get_kiosk_config(icao: str):
    """
    Checks if a Kiosk is allowed and returns its settings.
    Used by Frontend to determine if it should render or redirect.
    """
    icao = icao.upper().strip()
    query = "SELECT * FROM kiosk_airports WHERE icao = :icao AND is_active = 1"
    row = await database.fetch_one(query, values={"icao": icao})
    
    if not row:
        raise HTTPException(status_code=404, detail="Kiosk not authorized")
        
    return {
        "icao": row['icao'],
        "default_profile": row['default_profile'],
        "allowed_profiles": json.loads(row['allowed_profiles'] or '["small"]')
    }

@router.get("/peek/{icao}")
async def peek_weather(icao: str, source: str = None):
    """
    Lightweight poller. Fetches ONLY raw weather to check for updates.
    If 'source' is provided (e.g. nearest reporting station), checks that instead.
    """
    target = source.upper().strip() if source else icao.upper().strip()
    
    # Reuse the existing weather fetcher
    data = await get_metar_taf(target)
    
    if not data or not data['metar']:
        return {"status": "unavailable", "raw_metar": None}
        
    # We return the raw string. The frontend will compare this string 
    # to what it currently has on screen. If they differ, Frontend calls /analyze.
    return {
        "status": "success",
        "raw_metar": data['metar']
    }

# --- ADMIN MANAGEMENT ENDPOINTS ---

class KioskAddRequest(BaseModel):
    icao: str
    subscriber_name: str
    default_profile: str = "small"
    allowed_profiles: list[str] = ["small"]

@router.get("/list", dependencies=[Depends(get_admin_key)])
async def list_kiosks():
    query = "SELECT * FROM kiosk_airports ORDER BY created_at DESC"
    rows = await database.fetch_all(query)
    return [dict(r) for r in rows]

@router.post("/add", dependencies=[Depends(get_admin_key)])
async def add_kiosk(data: KioskAddRequest):
    query = """
        INSERT INTO kiosk_airports (icao, subscriber_name, default_profile, allowed_profiles, is_active)
        VALUES (:icao, :sub, :def, :allowed, 1)
        ON CONFLICT (icao) DO UPDATE SET
        subscriber_name = :sub,
        default_profile = :def,
        allowed_profiles = :allowed,
        is_active = 1
    """
    values = {
        "icao": data.icao.upper(),
        "sub": data.subscriber_name,
        "def": data.default_profile,
        "allowed": json.dumps(data.allowed_profiles)
    }
    await database.execute(query, values)
    return {"status": "success"}

@router.delete("/remove/{icao}", dependencies=[Depends(get_admin_key)])
async def remove_kiosk(icao: str):
    query = "DELETE FROM kiosk_airports WHERE icao = :icao"
    await database.execute(query, values={"icao": icao.upper()})
    return {"status": "success"}
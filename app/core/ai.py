import os
import json
import re
from openai import AsyncOpenAI
from dotenv import load_dotenv
from app.core.settings import settings

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# --- NEW HELPER: Sanitizes GPT Response ---
def clean_json_string(s):
    """
    Strips Markdown code blocks (```json ... ```) and conversational filler 
    to ensure json.loads() doesn't crash.
    """
    if not s: return "{}"
    
    # Remove ```json ... ``` or just ``` ... ```
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', s, re.DOTALL)
    if match:
        s = match.group(1)
    
    return s.strip()

async def analyze_risk(icao_code, weather_data, notams, plane_size="small", reporting_station=None, external_airspace_warnings=[]):
    
    profiles = {
        "small": "Cessna 172/Piper Archer (Max X-Wind: 15kts, IFR: No Radar)",
        "medium": "Baron/Cirrus SR22 (Max X-Wind: 20kts, IFR: Capable)",
        "large": "TBM/Citation (Max X-Wind: 30kts, High Altitude Capable)"
    }
    selected_profile = profiles.get(plane_size, profiles["small"])

    station_context = ""
    if reporting_station and reporting_station != icao_code:
        station_context = f"NOTE: Target {icao_code} has no weather. Using {reporting_station} for METAR/TAF."

    airspace_alert_text = """
    NOTE: No intersection with Permanent Prohibited/Restricted zones (P-40, DC SFRA, etc.) detected.
    CRITICAL: This tool DOES NOT check dynamic TFRs (VIPs, Stadiums, Fire). 
    Pilot MUST verify TFRs at: https://tfr.faa.gov/
    """
    
    if external_airspace_warnings:
        bullet_list = "\n".join([f"- {w}" for w in external_airspace_warnings])
        airspace_alert_text = f"""
        [MANDATORY INCLUSION]
        The following PERMANENT AIRSPACE RESTRICTIONS were detected:
        {bullet_list}
        CRITICAL: Also verify dynamic TFRs at https://tfr.faa.gov/
        """

    system_prompt = f"""
    You are a Chief Pilot acting as a Go/No-Go decision aid.
    AIRCRAFT PROFILE: {selected_profile}
    
    YOUR TASKS:
    1. RUNWAY SELECTION & VECTOR MATH: Identify best runway and calculate Crosswind Component.
    2. RISK ASSESSMENT: Compare X-Wind vs Profile Max. >= Limit -> "HIGH". Within 5kts -> "MODERATE". Else "LOW".
    3. NOTAMS: Scan for MAJOR hazards (Closures, Lighting). Summarize top 3 in Plain English.
    4. SUMMARY: Single cohesive paragraph. Conditions -> Runway/Wind -> Airspace -> Critical NOTAMs.
    5. TIMELINE: Summarize next 6/12/24 hours (or "NO_TAF").
    6. BUBBLES: Short text for UI (e.g., "North at 10kts").
    
    OUTPUT JSON FORMAT ONLY:
    {{
        "flight_category": "VFR" | "MVFR" | "IFR" | "LIFR",
        "wind_risk": "LOW" | "MODERATE" | "HIGH",
        "executive_summary": "...",
        "timeline": {{ "t_06": "...", "t_12": "...", "t_24": "..." }},
        "bubbles": {{ 
            "wind": "...", 
            "visibility": "...", 
            "ceiling": "...", 
            "temp": "..." 
        }},
        "airspace_warnings": ["..."],
        "critical_notams": ["..."]
    }}
    """

    user_content = f"""
    TARGET: {icao_code}
    {station_context}
    
    AIRSPACE STATUS:
    {airspace_alert_text}
    
    METAR: {weather_data['metar']}
    TAF: {weather_data['taf']}
    NOTAMS: {str(notams[:50])} 
    """

    try:
        model_id = await settings.get("openai_model", "gpt-4o-mini")

        response = await client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"}
        )
        
        usage = response.usage
        tokens = usage.total_tokens if usage else 0
        model_used = response.model

        # --- APPLY CLEANER ---
        raw_content = response.choices[0].message.content
        cleaned_content = clean_json_string(raw_content)
        
        result = json.loads(cleaned_content)
        
        result['_meta'] = {
            "tokens": tokens,
            "model": model_used
        }
        
        return result

    except Exception as e:
        print(f"AI ERROR: {e}")
        return {
            "flight_category": "UNK",
            "wind_risk": "LOW",
            "executive_summary": f"AI Parsing Error: {str(e)}",
            "timeline": {"t_06": "--", "t_12": "--", "t_24": "--"},
            "bubbles": {"wind": "--", "visibility": "--", "ceiling": "--", "temp": "--"},
            "airspace_warnings": [],
            "critical_notams": []
        }
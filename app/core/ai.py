import os
import json
import re
import math
from datetime import datetime, timezone
from openai import AsyncOpenAI
from dotenv import load_dotenv
from app.core.settings import settings
from app.core.physics import calculate_crosswind
from app.core.geography import get_runway_headings

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def clean_json_string(s):
    if not s: return "{}"
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', s, re.DOTALL)
    if match:
        s = match.group(1)
    return s.strip()

def format_visibility(val: str) -> str:
    """Converts decimal visibility strings to aviation fractions."""
    mappings = {
        "0.125": "1/8",
        "0.25": "1/4",
        "0.375": "3/8",
        "0.5": "1/2",
        "0.625": "5/8",
        "0.75": "3/4",
        "1.25": "1 1/4",
        "1.5": "1 1/2",
        "1.75": "1 3/4"
    }
    
    # Extract the numeric part if 'SM' is attached
    clean_val = val.upper().replace("SM", "").strip()
    
    if clean_val in mappings:
        return f"{mappings[clean_val]} SM"
    
    return val # Return original if no mapping found or already a fraction

def parse_metar_wind(metar_text):
    """
    Extracts Direction, Speed, and Gust from METAR text using Regex.
    Returns (dir, speed, gust) or None.
    """
    if not metar_text: return None
    # Regex for standard winds: DDDSSKT or DDDSSGGGKT (e.g., 27015G24KT)
    regex = r'\b([0-9]{3}|VRB)([0-9]{2,3})(?:G([0-9]{2,3}))?KT\b'
    match = re.search(regex, metar_text)
    if match:
        d_str, s_str, g_str = match.groups()
        if d_str == "VRB": return None # Cannot calc crosswind for VRB
        
        direction = int(d_str)
        speed = int(s_str)
        gust = int(g_str) if g_str else 0
        return direction, speed, gust
    return None

async def analyze_risk(icao_code, weather_data, notams, plane_size="small", reporting_station=None, reporting_station_name=None, airport_tz="UTC", external_airspace_warnings=[], dist=0, target_icao=""):
    
    profiles = {
        "small": "Cessna 172/Piper Archer (Max Crosswind: 15kts, IFR: No Radar)",
        "medium": "Baron/Cirrus SR22 (Max Crosswind: 20kts, IFR: Capable)",
        "large": "TBM/Citation (Max Crosswind: 30kts, High Altitude Capable)"
    }
    selected_profile = profiles.get(plane_size, profiles["small"])
    
    # Get Max Crosswind Limit for Math
    limit_map = {"small": 15, "medium": 20, "large": 30}
    profile_limit = limit_map.get(plane_size, 15)

    # --- 1. CONTEXT BUILDER ---
    weather_source_name = reporting_station_name or reporting_station or icao_code
    target_code = target_icao if target_icao else icao_code
    target_display = reporting_station_name if reporting_station_name else target_code
    has_weather = weather_data.get('metar') is not None
    is_same_airport = (dist < 2.0) or (reporting_station == target_icao)

    # Defaults for Prompt Injection
    opening_instruction = "Start the weather section by stating weather data is unavailable."
    xwind_analysis_text = "Crosswind calculations unavailable due to missing weather data."
    
    # Pre-calculated Bubble Data (defaults)
    calc_rwy = "--"
    calc_xwind = "--"
    calc_status = "UNK"
    
    # --- 2. PYTHON MATH ENGINE (Pre-Calculation) ---
    if has_weather:
        # --- DEBUG START ---
        print(f"DEBUG AI: ICAO={icao_code} Target={target_icao}")
        print(f"DEBUG AI: METAR RAW={weather_data.get('metar')}")
        print(f"DEBUG AI: Wind Parsed={parse_metar_wind(weather_data.get('metar'))}")
        dbg_lookup = target_icao if target_icao else icao_code
        dbg_rwy = get_runway_headings(dbg_lookup)
        print(f"DEBUG AI: Runways Found ({dbg_lookup}) = {list(dbg_rwy.keys()) if dbg_rwy else 'None'}")
        # --- DEBUG END ---

        # A. Instructions
        if is_same_airport:
             opening_instruction = f"Start the weather section exactly with: 'Conditions at {target_display} are...'"
        else:
             opening_instruction = f"Start the weather section exactly with: 'Weather reported at {weather_source_name} ({dist:.1f}nm away) indicates...'"

        # B. Parse Wind
        wind_data = parse_metar_wind(weather_data['metar'])
        
        # C. Get Runways for TARGET
        # Use target_icao (e.g. KANP) if available, otherwise input icao
        lookup_icao = target_icao if target_icao else icao_code
        runways = get_runway_headings(lookup_icao)

        if wind_data and runways:
            w_dir, w_spd, w_gust = wind_data
            calc_peak = max(w_spd, w_gust) # Always use peak for safety

            # Find Best Runway (Minimize Angle Difference / Max Headwind)
            best_rwy = None
            best_score = -9999
            
            for rwy_id, rwy_hdg in runways.items():
                # Calc angular difference
                diff = abs(w_dir - rwy_hdg)
                if diff > 180: diff = 360 - diff
                
                # Headwind component = cos(theta) * speed
                # We want to MAXIMIZE headwind
                theta_rad = math.radians(diff)
                headwind = calc_peak * math.cos(theta_rad)
                
                if headwind > best_score:
                    best_score = headwind
                    best_rwy = (rwy_id, rwy_hdg)
            
            print(f"DEBUG AI: Best Score={best_score}, Selected={best_rwy}")

            if best_rwy:
                r_id, r_hdg = best_rwy
                calc_rwy = r_id
                
                # Calculate Crosswind for this best runway
                # We reuse the logic: sin(diff) * speed
                raw_xwind = calculate_crosswind(r_hdg, w_dir, calc_peak)
                calc_xwind = str(raw_xwind)
                
                # Determine Status
                if raw_xwind > profile_limit:
                    calc_status = "EXCEEDS PROFILE"
                    status_desc = f"exceeds the {profile_limit}kt threshold set"
                elif raw_xwind >= (profile_limit - 5):
                    calc_status = "NEAR LIMITS"
                    status_desc = f"is approaching the {profile_limit}kt threshold set"
                else:
                    calc_status = "WITHIN LIMITS"
                    status_desc = f"falls below the {profile_limit}kt threshold set"

                # Construct the "Logic Trace" Sentence
                source_tag = f" ({reporting_station})" if not is_same_airport else ""
                dest_tag = f" at {target_icao or icao_code}" if not is_same_airport else ""
                
                gust_text = f", gusting to {w_gust}kts" if w_gust > 0 else ""
                
                profile_name_map = {"small": "Small Aircraft", "medium": "Medium Aircraft", "large": "Large Aircraft"}
                profile_display = profile_name_map.get(plane_size, "Selected")

                xwind_analysis_text = (
                    f"Winds from {w_dir:03d}° at {w_spd}kts{source_tag}{gust_text}, create a {raw_xwind}kt crosswind component "
                    f"on Runway {r_id}{dest_tag}. This calculated crosswind component {status_desc} for the {profile_display} profile."
                )
            else:
                 # Should theoretically not hit this with best_score = -9999
                 xwind_analysis_text = "Crosswind calculations unavailable (Could not determine optimal runway)."
                 
        # --- IMPROVED ERROR FEEDBACK ---
        elif not wind_data:
            if "VRB" in weather_data['metar']:
                xwind_analysis_text = "Crosswind calculations unavailable (Winds are Variable)."
            else:
                xwind_analysis_text = "Crosswind calculations unavailable (Wind data format not recognized)."
        elif not runways:
            xwind_analysis_text = f"Crosswind calculations unavailable (Runway data for {lookup_icao} not found in database)."

    # --- 3. AIRSPACE LOGIC ---
    if external_airspace_warnings:
        bullet_list = "\n".join([f"- {w}" for w in external_airspace_warnings])
        airspace_status_content = f"WARNING - RESTRICTIONS DETECTED:\n{bullet_list}"
    else:
        airspace_status_content = "No intersection with Permanent Prohibited/Restricted zones (P-40, DC SFRA, etc) detected."
    airspace_status_content += "\n(Verify dynamic TFRs at tfr.faa.gov)."

    # --- 4. AI PROMPT CONSTRUCTION ---
    current_time_str = datetime.now(timezone.utc).strftime("%H:%MZ")

    system_prompt = f"""
    You are a Weather Analysis Assistant providing data for pilot interpretation.
    AIRCRAFT PROFILE: {selected_profile}
    TARGET TIMEZONE: {airport_tz}
    CURRENT TIME (UTC): {current_time_str}
    
    YOUR TASKS:
    1. STRUCTURE: Return JSON with summary strings and a timeline object.
    
    2. WEATHER SUMMARY ("summary_weather"):
       - OPENING: {opening_instruction}
       - CONTENT: Generate a comprehensive aviation weather narrative. Expand on wind conditions, visibility, cloud layers, and temperature/dewpoint spread. If present, detail significant weather phenomena.
       
    3. CROSSWIND SUMMARY ("summary_crosswind"):
       - MANDATORY: You MUST use the exact pre-calculated text provided below. Do not recalculate.
       - TEXT: "{xwind_analysis_text}"

    4. AIRSPACE SUMMARY ("summary_airspace"):
       - Summarize the provided "AIRSPACE STATUS" block.

    5. NOTAMS SUMMARY ("summary_notams"):
       - Scan for MAJOR hazards. Translate to plain English. Single paragraph.

    6. TIMELINE ("timeline"):
       - Analyze the TAF raw text to find specific forecast change groups (FM, BECMG, TEMPO).
       - RULE: Ignore any forecast periods starting within 1 hour of CURRENT TIME (immediate future).
       - "forecast_1": The FIRST significant forecast period > 1 hour from now. 
          - "time_label": Convert the forecast time to the target airport's LOCAL time (e.g. "From 2:00 PM EST"). Use the provided timezone: {airport_tz}.
          - "summary": Brief description.
       - "forecast_2": The NEXT significant forecast period immediately following the first one.
          - "time_label": Convert to LOCAL time.
          - "summary": Brief description.
       - If TAF is missing, set values to "NO_TAF".

    7. BUBBLES (UI DATA):
       - "wind": Format "DDD° @ SSkts" (or "DDD° @ SSkts | Gusting @ GGGkts").
       - "x_wind": Use the PRE-CALCULATED value: "{calc_xwind}kts".
       - "rwy": Use the PRE-CALCULATED value: "{calc_rwy}".
       - "visibility": Use aviation fractions (e.g. "10 SM").
       - "ceiling": Spell out layers (e.g. "Broken 2000 FT AGL"). Newline for multiple layers.

    OUTPUT JSON FORMAT ONLY:
    {{
        "flight_category": "VFR" | "MVFR" | "IFR" | "LIFR" | "UNK",
        "crosswind_status": "{calc_status}",
        "summary_weather": "...",
        "summary_crosswind": "...",
        "summary_airspace": "...",
        "summary_notams": "...",
        "timeline": {{
            "forecast_1": {{ "time_label": "...", "summary": "..." }},
            "forecast_2": {{ "time_label": "...", "summary": "..." }}
        }},
        "bubbles": {{ 
            "wind": "...", 
            "x_wind": "{calc_xwind}kts",
            "rwy": "{calc_rwy}",
            "visibility": "...", 
            "ceiling": "..."
        }},
        "airspace_warnings": ["..."],
        "critical_notams": ["..."]
    }}
    """

    user_content = f"""
    CURRENT_UTC: {current_time_str}
    TARGET: {target_display}
    SOURCE: {weather_source_name}
    DIST: {dist:.1f}nm
    AIRSPACE: {airspace_status_content}
    METAR: {weather_data.get('metar', 'N/A')}
    TAF: {weather_data.get('taf', 'N/A')}
    NOTAMS: {str(notams)} 
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

        raw_content = response.choices[0].message.content
        cleaned_content = clean_json_string(raw_content)
        result = json.loads(cleaned_content)
        
        # --- POST-PROCESSING ---
        if "unavailable" not in xwind_analysis_text.lower():
            result["summary_crosswind"] = xwind_analysis_text

        # 2. HARD OVERRIDE: Bubbles
        if "bubbles" in result:
             # Force the Python Math into the bubble
             result["bubbles"]["x_wind"] = f"{calc_xwind}kts" if calc_xwind != "--" else "--"
             result["bubbles"]["rwy"] = calc_rwy
             
             # Still fix visibility formatting
             if "visibility" in result["bubbles"]:
                result["bubbles"]["visibility"] = format_visibility(result["bubbles"]["visibility"])

        # 3. HARD OVERRIDE: Status Color
        result["crosswind_status"] = calc_status
        
        result['_meta'] = { "tokens": tokens, "model": model_used }
        return result

    except Exception as e:
        print(f"AI ERROR: {e}")
        # Return Error Structure
        return {
            "flight_category": "UNK",
            "crosswind_status": "UNK",
            "summary_weather": f"AI Error: {str(e)}",
            "summary_crosswind": "--",
            "summary_airspace": "--",
            "summary_notams": "--",
            "timeline": {},
            "bubbles": {},
            "airspace_warnings": [],
            "critical_notams": []
        }
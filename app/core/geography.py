import airportsdata
import math
import httpx

# Load Databases
print("DEBUG: Loading airport databases...")
airports_icao = airportsdata.load('ICAO')
airports_lid = airportsdata.load('LID')
print(f"DEBUG: Loaded {len(airports_icao)} ICAO and {len(airports_lid)} LID airports.")

# --- DEFINED AIRSPACE ZONES ---
RESTRICTED_ZONES = {
    "DC_SFRA": {
        "name": "Washington DC SFRA",
        "lat": 38.8512, "lon": -77.0377, "radius": 30, "type": "RESTRICTED"
    },
    "DC_FRZ": {
        "name": "Washington DC Flight Restricted Zone (FRZ)",
        "lat": 38.8512, "lon": -77.0377, "radius": 13, "type": "PROHIBITED"
    },
    "P_40": {
        "name": "P-40 (Camp David)",
        "lat": 39.6483, "lon": -77.4636, "radius": 5, "type": "PROHIBITED"
    },
    "P_47": {
        "name": "P-47 (Pantex Nuclear Facility, TX)",
        "lat": 35.3130, "lon": -101.5580, "radius": 4, "type": "PROHIBITED"
    },
    "P_49": {
        "name": "P-49 (Crawford, TX)",
        "lat": 31.5800, "lon": -97.4100, "radius": 5, "type": "PROHIBITED"
    },
    "P_50": {
        "name": "P-50 (Kings Bay Sub Base, GA)",
        "lat": 30.7967, "lon": -81.5200, "radius": 3, "type": "PROHIBITED"
    },
    "P_51": {
        "name": "P-51 (Bangor Sub Base, WA)",
        "lat": 47.7300, "lon": -122.7200, "radius": 4, "type": "PROHIBITED"
    },
    "DISNEY_FL": {
        "name": "Disney World (The Mouse)",
        "lat": 28.4179, "lon": -81.5812, "radius": 3, "type": "RESTRICTED"
    },
    "DISNEY_CA": {
        "name": "Disneyland",
        "lat": 33.8121, "lon": -117.9190, "radius": 3, "type": "RESTRICTED"
    }
}

async def get_coords_from_awc(icao):
    """Fallback: Ask FAA API (Async)."""
    try:
        url = f"https://aviationweather.gov/api/data/station?ids={icao}&format=json"
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                if data and isinstance(data, list) and len(data) > 0:
                    return {
                        "lat": float(data[0]["lat"]), 
                        "lon": float(data[0]["lon"]),
                        "name": data[0].get("site", icao)
                    }
    except Exception as e:
        print(f"DEBUG: API Lookup Error: {e}")
    return None

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c * 0.539957  # Convert to NM

def check_airspace_zones(target_code, target_lat, target_lon):
    """
    Checks if coordinates fall inside or near known restricted zones.
    Returns a list of warning strings using the target_code.
    """
    warnings = []
    
    for zone_id, zone in RESTRICTED_ZONES.items():
        dist = calculate_distance(target_lat, target_lon, zone['lat'], zone['lon'])
        
        # 1. DIRECT HIT
        if dist <= zone['radius']:
            if zone['type'] == "PROHIBITED":
                warnings.append(f"CRITICAL: {target_code} is located within the {zone['name']} ({dist:.1f}nm from center). Flight strictly restricted; special procedures required.")
            else:
                warnings.append(f"WARNING: {target_code} is located within the {zone['name']}. Special procedures required.")
        
        # 2. PROXIMITY WARNING (5nm Buffer)
        elif dist <= (zone['radius'] + 5):
             warnings.append(f"ADVISORY: {target_code} is just outside ({dist:.1f}nm from the center) of the {zone['name']}. Exercise caution near boundary.")

    return warnings

async def get_nearest_reporting_stations(target_code, limit=10):
    """
    Returns a LIST of tuples: [(icao, distance_nm), ...].
    PRIORITIZES Large/Medium airports to ensure we find a valid weather station quickly.
    """
    target_code = target_code.upper().strip()
    
    target = airports_icao.get(target_code) or airports_lid.get(target_code)
    
    if not target:
        target = await get_coords_from_awc(target_code)

    if not target:
        return []

    target_lat = float(target['lat'])
    target_lon = float(target['lon'])

    # Separate lists for prioritization
    primary_candidates = []   # Likely to have METAR (Large/Medium or standard ICAO)
    secondary_candidates = [] # Unlikely to have METAR (Small/Private/Alphanumeric)
    
    for code, data in airports_icao.items():
        if code == target_code: 
            continue
        try:
            lat = float(data['lat'])
            lon = float(data['lon'])
            dist = calculate_distance(target_lat, target_lon, lat, lon)
            
            if dist < 50: 
                # CLASSIFY THE AIRPORT
                # 'type' is typically 'large_airport', 'medium_airport', 'small_airport'
                apt_type = data.get('type', 'small_airport')
                
                # HEURISTIC: Prioritize Medium/Large OR standard 4-letter codes (e.g. KDOV)
                # Deprioritize alphanumeric codes (e.g. 6MD7) which rarely report weather.
                is_major = apt_type in ['large_airport', 'medium_airport']
                is_standard_icao = (len(code) == 4 and code.isalpha())
                
                if is_major or is_standard_icao:
                    primary_candidates.append((code, dist))
                else:
                    secondary_candidates.append((code, dist))
        except:
            continue

    # Sort both lists by distance
    primary_candidates.sort(key=lambda x: x[1])
    secondary_candidates.sort(key=lambda x: x[1])
    
    # Merge: Priority first, then secondary
    final_list = primary_candidates + secondary_candidates
    
    return final_list[:limit]

def get_runway_headings(icao):
    """
    Returns a dict of runway idents and their True headings.
    Example: {'22R': 224.0, '04L': 44.0}
    Checks ICAO first, then LID.
    """
    icao = icao.upper().strip()
    data = airports_icao.get(icao)
    
    # Fallback to LID if ICAO lookup fails
    if not data:
        data = airports_lid.get(icao)

    if not data or 'runways' not in data:
        return {}

    results = {}
    for _, rwy in data['runways'].items():
        # airportsdata provides both ends of the runway (le = low end, he = high end)
        if 'le_ident' in rwy and rwy['le_heading_degT']:
             results[rwy['le_ident']] = float(rwy['le_heading_degT'])
        if 'he_ident' in rwy and rwy['he_heading_degT']:
             results[rwy['he_ident']] = float(rwy['he_heading_degT'])
             
    return results
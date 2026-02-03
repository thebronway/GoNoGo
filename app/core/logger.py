import datetime
from app.core.db import database

async def log_attempt(client_id, ip, input_icao, resolved_icao, plane, duration, status, error_msg=None, model=None, tokens=0):
    query = """
        INSERT INTO logs (
            timestamp, client_id, ip_address, input_icao, resolved_icao, 
            plane_profile, duration_seconds, status, error_message,
            model_used, tokens_used
        ) VALUES (
            :timestamp, :client_id, :ip_address, :input_icao, :resolved_icao, 
            :plane_profile, :duration_seconds, :status, :error_message, 
            :model_used, :tokens_used
        )
    """
    
    # FIX: Use Naive UTC to match the "TIMESTAMP" column in Postgres (No Timezone)
    # This aligns with the query in admin.py and prevents format mismatch errors
    now_naive = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    
    values = {
        "timestamp": now_naive,
        "client_id": client_id,
        "ip_address": ip,
        "input_icao": input_icao,
        "resolved_icao": resolved_icao,
        "plane_profile": plane,
        "duration_seconds": duration,
        "status": status,
        "error_message": error_msg,
        "model_used": model,
        "tokens_used": tokens
    }

    try:
        await database.execute(query=query, values=values)
        print(f"📝 LOGGED: {input_icao} | {status}") # Verification print
    except Exception as e:
        print(f"❌ LOGGING FAILURE: {e}")
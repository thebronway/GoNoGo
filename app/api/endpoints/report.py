from fastapi import APIRouter, BackgroundTasks, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.core.notifications import notifier
from app.core.rate_limit import RateLimiter

router = APIRouter()
limiter = RateLimiter()

class ReportRequest(BaseModel):
    message: str
    email: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    # Secondary validation field
    phone: Optional[str] = None

@router.post("/report")
async def submit_report(data: ReportRequest, request: Request, background_tasks: BackgroundTasks):
    # 1. Rate Limit (Prevent spam floods)
    await limiter(request)

    # 2. Validation Check (Silent Fail for Bots)
    if data.phone:
        print(f"DEBUG: Bot detected via hidden field from {request.client.host}")
        return {"status": "success"}

    # 3. Format the Notification
    lines = []
    lines.append("📢 USER REPORT & DATA SNAPSHOT")
    lines.append("==================================================")
    lines.append(f"USER MESSAGE:\n{data.message}")
    lines.append("--------------------------------------------------")
    lines.append(f"CONTACT: {data.email if data.email else 'Anonymous'}")
    lines.append("==================================================\n")

    if data.context:
        ctx = data.context
        
        # SECTION 1: RAW DATA (The "Truth")
        lines.append("--- [1] RAW DATA SOURCE --------------------------")
        lines.append(f"AIRPORT: {ctx.get('airport', 'N/A')}")
        lines.append(f"\nMETAR:\n{ctx.get('metar', 'N/A')}")
        lines.append(f"\nTAF:\n{ctx.get('taf', 'N/A')}")
        
        raw_notams = ctx.get('raw_notams')
        if raw_notams and isinstance(raw_notams, list):
            lines.append(f"\nRAW NOTAMS ({len(raw_notams)} Total):")
            # Show first 5 for context
            for i, n in enumerate(raw_notams[:5]):
                lines.append(f"[{i+1}] {n[:300]}...")
            if len(raw_notams) > 5:
                lines.append(f"... (+ {len(raw_notams)-5} more)")

        # SECTION 2: AI OUPUT (The "Interpretation")
        lines.append("\n\n--- [2] AI GENERATED OUTPUT ----------------------")
        lines.append(f"MAIN SUMMARY:\n{ctx.get('summary', 'N/A')}")
        
        lines.append("\nTIMELINE FORECASTS:")
        timeline = ctx.get('timeline', {})
        # Handle simple string or object structure
        f1 = timeline.get('forecast_1', 'N/A')
        f2 = timeline.get('forecast_2', 'N/A')
        
        lines.append(f"1. {f1.get('summary', f1) if isinstance(f1, dict) else f1}")
        lines.append(f"2. {f2.get('summary', f2) if isinstance(f2, dict) else f2}")

        lines.append("\nCRITICAL NOTAMS (AI FLAGGED):")
        crit = ctx.get('notam_analysis', [])
        if crit:
            for c in crit: lines.append(f"- {c}")
        else:
            lines.append("None flagged.")

        lines.append("\nAIRSPACE WARNINGS:")
        air = ctx.get('airspace_analysis', [])
        if air:
            for a in air: lines.append(f"- {a}")
        else:
            lines.append("None.")

    final_body = "\n".join(lines)

    # 4. Dispatch (Event Type: 'user_report')
    background_tasks.add_task(
        notifier.send_alert,
        "user_report", 
        f"User Report: {data.message[:30]}...", 
        final_body
    )

    return {"status": "success"}
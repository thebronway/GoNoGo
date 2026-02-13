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
    lines = [f"📢 **User Report**"]
    lines.append(f"**Message:** {data.message}")
    
    if data.email:
        lines.append(f"**Contact:** {data.email}")
    else:
        lines.append("**Contact:** Anonymous")

    if data.context:
        lines.append("\n**--- FLIGHT CONTEXT ---**")
        lines.append(f"**Airport:** {data.context.get('airport', 'N/A')}")
        lines.append(f"**AI Summary:** {data.context.get('summary', 'N/A')}")
        
        # Timeline
        timeline = data.context.get('timeline')
        if timeline:
            lines.append(f"**Forecast 1:** {timeline.get('forecast_1', 'N/A')}")
            lines.append(f"**Forecast 2:** {timeline.get('forecast_2', 'N/A')}")

        lines.append(f"**METAR:** `{data.context.get('metar', 'N/A')}`")
        if data.context.get('taf'):
            lines.append(f"**TAF:** `{data.context.get('taf', 'N/A')}`")
            
        # Airspace Analysis
        airspace = data.context.get('airspace_analysis')
        if airspace and isinstance(airspace, list) and len(airspace) > 0:
            lines.append(f"**Airspace Warnings:** {'; '.join(airspace)}")
            
        # Critical NOTAMs
        crit_notams = data.context.get('notam_analysis')
        if crit_notams and isinstance(crit_notams, list) and len(crit_notams) > 0:
            lines.append(f"**Critical NOTAMs (AI):** {'; '.join(crit_notams)}")

        # Raw NOTAMs (Summarized)
        raw_notams = data.context.get('raw_notams')
        if raw_notams and isinstance(raw_notams, list):
            count = len(raw_notams)
            lines.append(f"**Total Raw NOTAMs:** {count}")
            # Attach first 3 just for quick context
            preview = raw_notams[:3]
            for i, n in enumerate(preview):
                lines.append(f"> {i+1}. {n[:200]}...") # Truncate long ones

    final_body = "\n".join(lines)

    # 4. Dispatch (Event Type: 'user_report')
    background_tasks.add_task(
        notifier.send_alert,
        "user_report", 
        f"User Report: {data.message[:30]}...", 
        final_body
    )

    return {"status": "success"}
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from app.core.notifications import notifier

router = APIRouter()

class KioskInquiryRequest(BaseModel):
    name: str
    email: str
    org: str
    icaos: str

@router.post("/kiosk-inquiry")
async def submit_kiosk_inquiry(data: KioskInquiryRequest, background_tasks: BackgroundTasks):
    subject = f"Kiosk Inquiry: {data.org}"
    body = f"""
    New Kiosk Inquiry Received:
    
    Name: {data.name}
    Email: {data.email}
    Organization: {data.org}
    Airports (ICAO/LID): {data.icaos}
    """
    
    # Send via existing notification system (Email/Discord/Slack)
    background_tasks.add_task(
        notifier.send_alert,
        "user_report",  # Reusing this event type to ensure it gets routed to admin
        subject, 
        body
    )
    return {"status": "success"}
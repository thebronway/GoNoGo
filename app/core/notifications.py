import os
import smtplib
import json
import httpx
from email.message import EmailMessage
from dotenv import load_dotenv
from app.core.db import database
from app.core.settings import settings

load_dotenv()

class NotificationManager:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST")
        port_str = os.getenv("SMTP_PORT", "587")
        self.smtp_port = int(port_str) if port_str.isdigit() else 587
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_pass = os.getenv("SMTP_PASS")
        self.discord_url = os.getenv("DISCORD_WEBHOOK_URL")
        self.slack_url = os.getenv("SLACK_WEBHOOK_URL")

    async def get_rules(self, event_type):
        try:
            query = "SELECT channels FROM notification_rules WHERE event_type = :type AND enabled = 1"
            row = await database.fetch_one(query=query, values={"type": event_type})
            
            if row:
                channels = json.loads(row['channels'])
                return channels
            
            # FALLBACK: If 'user_report' has no rule yet, default to SMTP (Email)
            if event_type == "user_report":
                print("DEBUG: No rule for 'user_report', defaulting to SMTP.")
                return ["smtp"]

            print(f"DEBUG: No enabled rules found in DB for event '{event_type}'")
            return []
        except Exception as e:
            print(f"DEBUG: DB Read Error in Notifications: {e}")
            return []

    async def send_alert(self, event_type, subject, message):
        channels = await self.get_rules(event_type)
        
        if not channels:
            print(f"DEBUG: Alert skipped. No channels enabled for '{event_type}'.")
            return

        print(f"DEBUG: Sending '{event_type}' alert via: {channels}")

        if "smtp" in channels and self.smtp_host:
            # FIX: Pass event_type to _send_email so the subject prefix works
            await self._send_email(subject, message, event_type)
        
        if "discord" in channels and self.discord_url:
            await self._send_discord(subject, message)
            
        if "slack" in channels and self.slack_url:
            await self._send_slack(subject, message)

    async def _send_email(self, subject, body, event_type=None):
        try:
            from_addr = await settings.get("smtp_from_email")
            to_addr = await settings.get("admin_alert_email")

            if not from_addr or not to_addr:
                print("DEBUG: Email skipped. Check 'smtp_from_email' and 'admin_alert_email' in Settings.")
                return

            print(f"DEBUG: Emailing {to_addr}...")

            # Subject Logic
            prefix = "[WxDecoder]"
            if event_type == "api_outage":
                prefix = "[WxDecoder CRITICAL]"
            elif subject.startswith("Test"):
                prefix = "[WxDecoder Test]"
            elif subject.startswith("Kiosk Inquiry"):
                prefix = "[WxDecoder Sales]"
            elif event_type == "user_report":
                prefix = "[WxDecoder Feedback]"

            msg = EmailMessage()
            msg.set_content(body)
            msg['Subject'] = f"{prefix} {subject}"
            msg['From'] = from_addr
            msg['To'] = to_addr

            s = smtplib.SMTP(self.smtp_host, self.smtp_port)
            s.starttls()
            s.login(self.smtp_user, self.smtp_pass)
            s.send_message(msg)
            s.quit()
            print("DEBUG: Email Sent Successfully.")
        except Exception as e:
            print(f"SMTP ERROR: {e}")

    async def _send_discord(self, subject, body):
        try:
            payload = {
                "username": "WxDecoder Watchdog",
                "embeds": [{
                    "title": subject,
                    "description": body,
                    "color": 15158332
                }]
            }
            async with httpx.AsyncClient() as client:
                await client.post(self.discord_url, json=payload)
        except Exception: pass

    async def _send_slack(self, subject, body):
        try:
            payload = {"text": f"*{subject}*\n{body}"}
            async with httpx.AsyncClient() as client:
                await client.post(self.slack_url, json=payload)
        except Exception: pass

notifier = NotificationManager()
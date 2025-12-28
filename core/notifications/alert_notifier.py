"""
Alert Notification System

Sends alerts via email and Slack when critical events occur.
"""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx
from typing import Optional, List
import structlog
from datetime import datetime
from core.config.settings import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class AlertNotifier:
    """
    Alert notification dispatcher
    
    Supports multiple channels:
    - Email (via SMTP)
    - Slack (via webhooks)
    - Future: SMS, PagerDuty, etc.
    """
    
    def __init__(self):
        """Initialize alert notifier"""
        self.email_enabled = bool(settings.SMTP_HOST and settings.SMTP_USER)
        self.slack_webhook: Optional[str] = None  # Set via environment
        
    async def send_alert(
        self,
        title: str,
        message: str,
        severity: str = "warning",
        channels: Optional[List[str]] = None
    ):
        """
        Send alert to configured channels
        
        Args:
            title: Alert title
            message: Alert message body
            severity: info, warning, critical
            channels: List of channels (email, slack) or None for all
        """
        if channels is None:
            channels = ["email", "slack"]
            
        logger.info(
            "Sending alert",
            title=title,
            severity=severity,
            channels=channels
        )
        
        # Send to each channel
        if "email" in channels and self.email_enabled:
            await self._send_email(title, message, severity)
            
        if "slack" in channels and self.slack_webhook:
            await self._send_slack(title, message, severity)
            
    async def _send_email(self, title: str, message: str, severity: str):
        """Send email alert"""
        try:
            # Create email
            msg = MIMEMultipart()
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = settings.SMTP_USER  # Send to admin email
            msg['Subject'] = f"[{severity.upper()}] Stockify Alert: {title}"
            
            # Email body
            body = f"""
            Stockify Alert
            ==============
            
            Severity: {severity.upper()}
            Time: {datetime.utcnow().isoformat()}
            
            {title}
            
            Details:
            {message}
            
            ---
            Stockify HFT Data Engine
            """
            
            msg.attach(MIMEText(body, 'plain'))
            
            # Send via SMTP
            async with aiosmtplib.SMTP(
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                use_tls=settings.SMTP_USE_TLS
            ) as smtp:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    await smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    
                await smtp.send_message(msg)
                
            logger.info("Email alert sent", title=title)
            
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
            
    async def _send_slack(self, title: str, message: str, severity: str):
        """Send Slack alert"""
        if not self.slack_webhook:
            return
            
        try:
            # Severity colors
            color_map = {
                "info": "#36a64f",
                "warning": "#ff9900",
                "critical": "#ff0000"
            }
            
            # Slack webhook payload
            payload = {
                "attachments": [
                    {
                        "color": color_map.get(severity, "#cccccc"),
                        "title": title,
                        "text": message,
                        "footer": "Stockify HFT Data Engine",
                        "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
                        "ts": int(datetime.utcnow().timestamp())
                    }
                ]
            }
            
            # Send to Slack webhook
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.slack_webhook,
                    json=payload,
                    timeout=10.0
                )
                response.raise_for_status()
                
            logger.info("Slack alert sent", title=title)
            
        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e}")


# Common alert templates

async def alert_high_error_rate(service: str, error_count: int, time_window: int):
    """Alert for high error rate"""
    notifier = AlertNotifier()
    await notifier.send_alert(
        title=f"High Error Rate: {service}",
        message=f"{error_count} errors in last {time_window} minutes",
        severity="warning"
    )


async def alert_service_down(service: str):
    """Alert for service down"""
    notifier = AlertNotifier()
    await notifier.send_alert(
        title=f"Service Down: {service}",
        message=f"Service {service} failed health check",
        severity="critical"
    )


async def alert_disk_space_low(usage_percent: float):
    """Alert for low disk space"""
    notifier = AlertNotifier()
    await notifier.send_alert(
        title="Low Disk Space",
        message=f"Disk usage at {usage_percent}%",
        severity="warning" if usage_percent < 90 else "critical"
    )


async def alert_database_connection_failed():
    """Alert for database connection failure"""
    notifier = AlertNotifier()
    await notifier.send_alert(
        title="Database Connection Failed",
        message="Unable to connect to TimescaleDB",
        severity="critical"
    )


# Global notifier instance
_notifier: Optional[AlertNotifier] = None


def get_alert_notifier() -> AlertNotifier:
    """Get or create alert notifier singleton"""
    global _notifier
    if _notifier is None:
        _notifier = AlertNotifier()
    return _notifier

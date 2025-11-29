"""
Alert Monitoring Engine - Automated Alert Checking

Continuously monitors system metrics and triggers alerts.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy import select
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx

from core.database.db import async_session_factory
from core.database.admin_models import AlertRuleDB, AlertHistoryDB
from core.config.settings import get_settings

settings = get_settings()
logger = logging.getLogger("alert_monitor")


class AlertMonitor:
    """Monitors system metrics and triggers alerts"""
    
    def __init__(self):
        self.running = False
        self.check_interval = 60  # Check every 60 seconds
        
    async def start(self):
        """Start the alert monitoring loop"""
        self.running = True
        logger.info("Alert monitor started")
        
        while self.running:
            try:
                await self.check_all_alerts()
            except Exception as e:
                logger.error(f"Alert check error: {e}")
            
            await asyncio.sleep(self.check_interval)
    
    def stop(self):
        """Stop the alert monitoring"""
        self.running = False
        logger.info("Alert monitor stopped")
    
    async def check_all_alerts(self):
        """Check all enabled alert rules"""
        async with async_session_factory() as session:
            stmt = select(AlertRuleDB).where(AlertRuleDB.enabled == True)
            result = await session.execute(stmt)
            alerts = result.scalars().all()
            
            for alert in alerts:
                await self.check_alert(alert, session)
    
    async def check_alert(self, alert: AlertRuleDB, session):
        """Check a single alert rule"""
        # Get current metric value
        metric_value = await self.get_metric_value(alert.metric)
        
        # Check if threshold is breached
        is_triggered = self.evaluate_condition(
            metric_value,
            alert.operator,
            alert.threshold
        )
        
        if is_triggered:
            # Check if this is a new trigger (not triggered recently)
            should_notify = await self.should_trigger_alert(alert, session)
            
            if should_notify:
                await self.trigger_alert(alert, metric_value, session)
    
    async def get_metric_value(self, metric: str) -> float:
        """Get current value for a metric"""
        import psutil
        
        if metric == "cpu":
            return psutil.cpu_percent(interval=0.1)
        elif metric == "memory":
            return psutil.virtual_memory().percent
        elif metric == "disk":
            return psutil.disk_usage('/').percent
        elif metric == "connections":
            # Would get from WebSocket manager
            return 0
        elif metric == "cache_hit_rate":
            # Would get from Redis
            return 0
        elif metric == "error_rate":
            # Would calculate from recent errors
            return 0
        elif metric == "latency":
            # Would get from metrics
            return 0
        else:
            return 0
    
    def evaluate_condition(self, value: float, operator: str, threshold: float) -> bool:
        """Evaluate if condition is met"""
        if operator == ">":
            return value > threshold
        elif operator == ">=":
            return value >= threshold
        elif operator == "<":
            return value < threshold
        elif operator == "<=":
            return value <= threshold
        elif operator == "==":
            return value == threshold
        return False
    
    async def should_trigger_alert(self, alert: AlertRuleDB, session) -> bool:
        """Check if we should trigger alert (avoid spam)"""
        # Don't trigger if triggered in last 15 minutes
        if alert.last_triggered:
            time_since_last = datetime.utcnow() - alert.last_triggered
            if time_since_last < timedelta(minutes=15):
                return False
        
        return True
    
    async def trigger_alert(self, alert: AlertRuleDB, metric_value: float, session):
        """Trigger an alert and send notifications"""
        logger.warning(f"ALERT TRIGGERED: {alert.name} - {alert.metric}={metric_value} {alert.operator} {alert.threshold}")
        
        # Create alert history entry
        history = AlertHistoryDB(
            alert_rule_id=alert.id,
            triggered_at=datetime.utcnow(),
            metric_value=metric_value,
            threshold_value=alert.threshold,
            notification_channels=alert.notification_channels
        )
        session.add(history)
        
        # Update alert rule
        alert.last_triggered = datetime.utcnow()
        alert.trigger_count += 1
        
        await session.commit()
        
        # Send notifications
        await self.send_notifications(alert, metric_value, history)
    
    async def send_notifications(self, alert: AlertRuleDB, metric_value: float, history: AlertHistoryDB):
        """Send alert notifications to configured channels"""
        message = f"""
        ALERT: {alert.name}
        Severity: {alert.severity.upper()}
        
        Metric: {alert.metric}
        Current Value: {metric_value:.2f}
        Threshold: {alert.threshold}
        
        Triggered at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
        """
        
        success_channels = []
        errors = []
        
        # Email notification
        if 'email' in alert.notification_channels and alert.email_addresses:
            try:
                await self.send_email(alert.email_addresses, alert.name, message)
                success_channels.append('email')
            except Exception as e:
                errors.append(f"Email error: {str(e)}")
        
        # Slack notification
        if 'slack' in alert.notification_channels and alert.slack_webhook:
            try:
                await self.send_slack(alert.slack_webhook, alert.name, message)
                success_channels.append('slack')
            except Exception as e:
                errors.append(f"Slack error: {str(e)}")
        
        # Update history
        async with async_session_factory() as session:
            stmt = select(AlertHistoryDB).where(AlertHistoryDB.id == history.id)
            result = await session.execute(stmt)
            hist = result.scalar_one()
            
            hist.notification_sent = len(success_channels) > 0
            if errors:
                hist.notification_error = "; ".join(errors)
            
            await session.commit()
    
    async def send_email(self, addresses: List[str], subject: str, body: str):
        """Send email notification via SMTP"""
        import aiosmtplib
        from core.config.settings import get_settings
        
        settings = get_settings()
        
        # Check if SMTP is configured
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning("SMTP not configured. Email notification skipped.")
            logger.info(f"Would send email to {addresses}: {subject}")
            return
        
        try:
            msg = MIMEMultipart()
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = ", ".join(addresses)
            msg['Subject'] = f"[STOCKIFY ALERT] {subject}"
            
            msg.attach(MIMEText(body, 'plain'))
            
            # Send via SMTP
            async with aiosmtplib.SMTP(
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                use_tls=False  # We'll use STARTTLS
            ) as smtp:
                if settings.SMTP_USE_TLS:
                    await smtp.starttls()
                await smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                await smtp.send_message(msg)
            
            logger.info(f"Email notification sent successfully to {addresses}")
            
        except Exception as e:
            logger.error(f"Failed to send email to {addresses}: {e}")
            raise
    
    async def send_slack(self, webhook_url: str, title: str, message: str):
        """Send Slack notification"""
        async with httpx.AsyncClient() as client:
            payload = {
                "text": f"*{title}*\n{message}"
            }
            response = await client.post(webhook_url, json=payload)
            response.raise_for_status()
        
        logger.info(f"Slack notification sent")


# Global alert monitor instance
alert_monitor = AlertMonitor()


async def start_alert_monitor():
    """Start the global alert monitor"""
    await alert_monitor.start()

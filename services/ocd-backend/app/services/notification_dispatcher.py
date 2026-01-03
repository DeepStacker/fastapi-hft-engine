"""
Notification Dispatcher Service
Multi-channel notification delivery system
"""
import logging
from typing import List, Optional
from datetime import datetime, time
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.notification import (
    Notification, 
    NotificationPreference,
    NotificationChannel,
    NotificationPurpose,
    NotificationPriority
)
from app.models.user import User

logger = logging.getLogger(__name__)


class NotificationDispatcher:
    """
    Multi-channel notification dispatcher
    
    Sends notifications through configured channels based on:
    - User preferences
    - Notification purpose
    - Priority level
    - Quiet hours
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def send(
        self,
        user_id: UUID,
        title: str,
        message: str,
        type: str = "info",
        purpose: str = "informative",
        priority: str = "normal",
        channels: Optional[List[str]] = None,
        link: Optional[str] = None,
        action_url: Optional[str] = None,
        action_label: Optional[str] = None,
        sound_enabled: bool = True,
        extra_data: Optional[str] = None,
    ) -> dict:
        """
        Send notification through appropriate channels
        
        Args:
            user_id: Target user ID
            title: Notification title
            message: Notification message
            type: Visual type (info, success, warning, error, trade, price)
            purpose: Purpose category (transactional, informative, cta, etc.)
            priority: Priority level (low, normal, high, urgent)
            channels: Override channels (None = use preferences)
            link: Optional navigation link
            action_url: Optional action button URL
            action_label: Optional action button label
            sound_enabled: Whether to play sound
            extra_data: JSON extra data
            
        Returns:
            dict with delivery status for each channel
        """
        result = {"success": True, "channels": {}}
        
        # Get user and preferences
        prefs = await self._get_preferences(user_id)
        
        # Determine channels
        if channels is None:
            channels = self._get_enabled_channels(prefs, purpose, priority)
        
        # Check quiet hours (skip for urgent)
        if priority != "urgent" and self._is_quiet_hours(prefs):
            # During quiet hours, only in_app silent
            channels = ["in_app"]
            sound_enabled = False
            logger.info(f"Quiet hours active for user {user_id}, limiting to in_app")
        
        # Send to each channel
        for channel in channels:
            try:
                if channel == "in_app":
                    notif = await self._send_in_app(
                        user_id, title, message, type, purpose, priority,
                        link, action_url, action_label, sound_enabled, extra_data
                    )
                    result["channels"]["in_app"] = {"success": True, "id": str(notif.id)}
                    
                elif channel == "push" and prefs and prefs.fcm_token:
                    success = await self._send_push(prefs.fcm_token, title, message, type)
                    result["channels"]["push"] = {"success": success}
                    
                elif channel == "email":
                    user = await self._get_user(user_id)
                    if user and user.email:
                        success = await self._send_email(user.email, title, message, type)
                        result["channels"]["email"] = {"success": success}
                        
            except Exception as e:
                logger.error(f"Failed to send via {channel}: {e}")
                result["channels"][channel] = {"success": False, "error": str(e)}
        
        return result
    
    async def _get_preferences(self, user_id: UUID) -> Optional[NotificationPreference]:
        """Get user notification preferences"""
        result = await self.db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_user(self, user_id: UUID) -> Optional[User]:
        """Get user by ID"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    def _get_enabled_channels(
        self, 
        prefs: Optional[NotificationPreference], 
        purpose: str,
        priority: str
    ) -> List[str]:
        """Determine enabled channels based on preferences and purpose"""
        channels = []
        
        # Default if no preferences
        if not prefs:
            return ["in_app"]
        
        # Check if purpose is enabled
        purpose_enabled = getattr(prefs, f"enable_{purpose}", True)
        if not purpose_enabled:
            return []
        
        # Build channel list
        if prefs.enable_in_app:
            channels.append("in_app")
        if prefs.enable_push:
            channels.append("push")
        if prefs.enable_email and priority in ["high", "urgent"]:
            # Email only for high priority
            channels.append("email")
            
        return channels
    
    def _is_quiet_hours(self, prefs: Optional[NotificationPreference]) -> bool:
        """Check if current time is within quiet hours"""
        if not prefs or not prefs.quiet_hours_start or not prefs.quiet_hours_end:
            return False
            
        now = datetime.now().time()
        start = prefs.quiet_hours_start
        end = prefs.quiet_hours_end
        
        # Handle overnight quiet hours (e.g., 22:00 - 08:00)
        if start > end:
            return now >= start or now <= end
        else:
            return start <= now <= end
    
    async def _send_in_app(
        self,
        user_id: UUID,
        title: str,
        message: str,
        type: str,
        purpose: str,
        priority: str,
        link: Optional[str],
        action_url: Optional[str],
        action_label: Optional[str],
        sound_enabled: bool,
        extra_data: Optional[str],
    ) -> Notification:
        """Save notification to database for in-app display"""
        from app.models.notification import NotificationType
        
        type_enum = NotificationType(type) if type in [e.value for e in NotificationType] else NotificationType.INFO
        
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type_enum,
            channel="in_app",
            purpose=purpose,
            priority=priority,
            link=link,
            action_url=action_url,
            action_label=action_label,
            sound_enabled=sound_enabled,
            extra_data=extra_data,
        )
        
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        
        logger.info(f"In-app notification sent to user {user_id}: {title}")
        return notification
    
    async def _send_push(
        self, 
        fcm_token: str, 
        title: str, 
        message: str, 
        type: str
    ) -> bool:
        """
        Send push notification via Firebase Cloud Messaging
        
        Note: Requires firebase-admin SDK to be configured
        For now, just log and return True
        """
        # TODO: Implement actual FCM sending
        # import firebase_admin
        # from firebase_admin import messaging
        # fcm_message = messaging.Message(
        #     notification=messaging.Notification(title=title, body=message),
        #     token=fcm_token,
        # )
        # messaging.send(fcm_message)
        
        logger.info(f"Push notification would be sent: {title}")
        return True
    
    async def _send_email(
        self,
        email: str,
        title: str,
        message: str,
        type: str
    ) -> bool:
        """
        Send email notification via SMTP
        
        Uses the core/notifications/alert_notifier.py infrastructure
        """
        try:
            from core.notifications.alert_notifier import AlertNotifier
            
            notifier = AlertNotifier()
            await notifier.send_alert(
                title=title,
                message=message,
                severity="info" if type in ["info", "success"] else "warning",
                channels=["email"]
            )
            
            logger.info(f"Email notification sent to {email}: {title}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {email}: {e}")
            return False


async def get_or_create_preferences(db: AsyncSession, user_id: UUID) -> NotificationPreference:
    """Get existing preferences or create default ones"""
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    
    if not prefs:
        prefs = NotificationPreference(user_id=user_id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
        
    return prefs

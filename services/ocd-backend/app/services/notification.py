"""
Notification Service
Contains business logic for creating and managing notifications.
"""
import logging
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)

async def create_welcome_notifications(db: AsyncSession, user_id: UUID) -> None:
    """Create welcome notifications for a new user"""
    welcome_notifications = [
        {
            "title": "Welcome to DeepStrike!",
            "message": "Start exploring real-time option chain data and analytics.",
            "type": NotificationType.SUCCESS,
            "link": "/dashboard"
        },
        {
            "title": "Pro Tip: Try Screeners",
            "message": "Use our Scalp and Positional screeners for trading opportunities.",
            "type": NotificationType.INFO,
            "link": "/screeners"
        },
    ]
    
    for notif in welcome_notifications:
        notification = Notification(
            user_id=user_id,
            title=notif["title"],
            message=notif["message"],
            type=notif["type"],
            link=notif["link"],
        )
        db.add(notification)
    
    await db.commit()
    logger.info(f"Created welcome notifications for user {user_id}")

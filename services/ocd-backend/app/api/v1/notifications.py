"""
Notifications API Endpoints
Provides endpoints for user notifications management.
"""
import logging
from typing import Optional, List
from datetime import datetime
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_

from app.config.database import get_db
from app.core.dependencies import CurrentUser, OptionalUser
from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Models ==============

class NotificationCreate(BaseModel):
    """Create a notification"""
    title: str = Field(..., max_length=100)
    message: str = Field(..., max_length=500)
    type: str = Field("info", pattern="^(info|success|warning|error|trade|price)$")
    link: Optional[str] = None


class NotificationResponse(BaseModel):
    """Notification response"""
    id: str
    title: str
    message: str
    type: str
    is_read: bool = False
    created_at: str
    link: Optional[str] = None


class NotificationListResponse(BaseModel):
    """List of notifications"""
    success: bool = True
    total: int
    unread_count: int
    notifications: List[NotificationResponse]


# ============== Helper Functions ==============

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


# ============== Endpoints ==============

@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    current_user: OptionalUser = None,
    limit: int = Query(20, ge=1, le=50),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """
    Get user notifications.
    """
    if not current_user:
        # Return empty for unauthenticated users
        return NotificationListResponse(
            success=True,
            total=0,
            unread_count=0,
            notifications=[]
        )
    
    user_id = current_user.id
    
    # Build query
    query = select(Notification).where(Notification.user_id == user_id)
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    query = query.order_by(Notification.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    # Count total and unread
    count_query = select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    unread_query = select(func.count()).select_from(Notification).where(
        and_(Notification.user_id == user_id, Notification.is_read == False)
    )
    unread_result = await db.execute(unread_query)
    unread_count = unread_result.scalar() or 0
    
    return NotificationListResponse(
        success=True,
        total=total,
        unread_count=unread_count,
        notifications=[
            NotificationResponse(
                id=str(n.id),
                title=n.title,
                message=n.message,
                type=n.type.value,
                is_read=n.is_read,
                link=n.link,
                created_at=n.created_at.isoformat() if n.created_at else datetime.utcnow().isoformat(),
            )
            for n in notifications
        ]
    )


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: OptionalUser = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a notification as read.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        notif_uuid = UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    # Update notification
    stmt = (
        update(Notification)
        .where(and_(Notification.id == notif_uuid, Notification.user_id == current_user.id))
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Notification marked as read"}


@router.post("/read-all")
async def mark_all_as_read(
    current_user: OptionalUser = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Mark all notifications as read.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    stmt = (
        update(Notification)
        .where(and_(Notification.user_id == current_user.id, Notification.is_read == False))
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.commit()
    
    return {"success": True, "message": f"Marked {result.rowcount} notifications as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: OptionalUser = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a notification.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        notif_uuid = UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    stmt = delete(Notification).where(
        and_(Notification.id == notif_uuid, Notification.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Notification deleted"}


@router.post("")
async def create_notification(
    notification: NotificationCreate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new notification (for testing/admin).
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Map string type to enum
    type_map = {
        "info": NotificationType.INFO,
        "success": NotificationType.SUCCESS,
        "warning": NotificationType.WARNING,
        "error": NotificationType.ERROR,
        "trade": NotificationType.TRADE,
        "price": NotificationType.PRICE,
    }
    
    notif_type = type_map.get(notification.type, NotificationType.INFO)
    
    new_notif = Notification(
        user_id=current_user.id,
        title=notification.title,
        message=notification.message,
        type=notif_type,
        link=notification.link,
    )
    
    db.add(new_notif)
    await db.commit()
    await db.refresh(new_notif)
    
    return {
        "success": True,
        "notification": NotificationResponse(
            id=str(new_notif.id),
            title=new_notif.title,
            message=new_notif.message,
            type=new_notif.type.value,
            is_read=new_notif.is_read,
            link=new_notif.link,
            created_at=new_notif.created_at.isoformat() if new_notif.created_at else datetime.utcnow().isoformat(),
        )
    }

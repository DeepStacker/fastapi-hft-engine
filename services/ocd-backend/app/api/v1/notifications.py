"""
Notifications API Endpoints
Provides endpoints for user notifications management.
Enhanced with preferences, channels, and multi-purpose support.
"""
import logging
from typing import Optional, List
from datetime import datetime, time
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_

from app.config.database import get_db
from app.core.dependencies import CurrentUser, OptionalUser
from app.models.notification import Notification, NotificationType, NotificationPreference
from app.utils.timezone import get_ist_isoformat
from app.services.notification import create_welcome_notifications
from app.services.notification_dispatcher import get_or_create_preferences

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Models ==============

class NotificationCreate(BaseModel):
    """Create a notification"""
    title: str = Field(..., max_length=100)
    message: str = Field(..., max_length=500)
    type: str = Field("info", pattern="^(info|success|warning|error|trade|price)$")
    purpose: str = Field("informative", pattern="^(transactional|informative|cta|personalized|system|feedback)$")
    priority: str = Field("normal", pattern="^(low|normal|high|urgent)$")
    link: Optional[str] = None
    action_url: Optional[str] = None
    action_label: Optional[str] = None


class NotificationResponse(BaseModel):
    """Notification response"""
    id: str
    title: str
    message: str
    type: str
    channel: str = "in_app"
    purpose: str = "informative"
    priority: str = "normal"
    is_read: bool = False
    sound_enabled: bool = True
    created_at: str
    link: Optional[str] = None
    action_url: Optional[str] = None
    action_label: Optional[str] = None


class NotificationListResponse(BaseModel):
    """List of notifications"""
    success: bool = True
    total: int
    unread_count: int
    notifications: List[NotificationResponse]


class PreferencesUpdate(BaseModel):
    """Update notification preferences"""
    enable_in_app: Optional[bool] = None
    enable_push: Optional[bool] = None
    enable_email: Optional[bool] = None
    enable_transactional: Optional[bool] = None
    enable_informative: Optional[bool] = None
    enable_cta: Optional[bool] = None
    enable_personalized: Optional[bool] = None
    enable_system: Optional[bool] = None
    enable_feedback: Optional[bool] = None
    enable_sound: Optional[bool] = None
    quiet_hours_start: Optional[str] = None  # HH:MM format
    quiet_hours_end: Optional[str] = None


class FCMTokenUpdate(BaseModel):
    """Register FCM token for push notifications"""
    fcm_token: str = Field(..., max_length=500)


# ============== Helper Functions ==============


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
                created_at=n.created_at.isoformat() if n.created_at else get_ist_isoformat(),
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
            created_at=new_notif.created_at.isoformat() if new_notif.created_at else get_ist_isoformat(),
        )
    }


# ============== Preferences Endpoints ==============

@router.get("/preferences")
async def get_preferences(
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Get user notification preferences"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    prefs = await get_or_create_preferences(db, current_user.id)
    
    return {
        "success": True,
        "preferences": prefs.to_dict()
    }


@router.put("/preferences")
async def update_preferences(
    prefs_update: PreferencesUpdate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Update user notification preferences"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    prefs = await get_or_create_preferences(db, current_user.id)
    
    # Update fields that are provided
    update_data = prefs_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field in ["quiet_hours_start", "quiet_hours_end"] and value:
            # Parse time string to time object
            try:
                hours, minutes = map(int, value.split(":"))
                value = time(hours, minutes)
            except (ValueError, AttributeError):
                continue
        setattr(prefs, field, value)
    
    await db.commit()
    await db.refresh(prefs)
    
    logger.info(f"User {current_user.id} updated notification preferences")
    
    return {
        "success": True,
        "message": "Preferences updated",
        "preferences": prefs.to_dict()
    }


@router.post("/preferences/fcm-token")
async def register_fcm_token(
    token_update: FCMTokenUpdate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Register FCM token for push notifications"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    prefs = await get_or_create_preferences(db, current_user.id)
    prefs.fcm_token = token_update.fcm_token
    
    await db.commit()
    
    logger.info(f"User {current_user.id} registered FCM token")
    
    return {
        "success": True,
        "message": "FCM token registered"
    }


@router.post("/preferences/test")
async def test_notification(
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Send a test notification to verify settings"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    from app.services.notification_dispatcher import NotificationDispatcher
    
    dispatcher = NotificationDispatcher(db)
    result = await dispatcher.send(
        user_id=current_user.id,
        title="Test Notification",
        message="This is a test notification to verify your settings are working correctly.",
        type="info",
        purpose="system",
        priority="normal",
        sound_enabled=True,
    )
    
    return {
        "success": True,
        "message": "Test notification sent",
        "delivery": result
    }


"""
Admin Notifications Router
Provides endpoints for admins to send notifications to users.
"""
import logging
import enum
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Column, String, Boolean, DateTime, Enum, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from core.database.pool import db_pool
from core.database.db import Base
from core.database.models import AppUserDB
from services.admin.auth import get_current_admin_user

logger = logging.getLogger("stockify.admin.notifications")


# ============== Models (inline to avoid cross-service imports) ==============

class NotificationType(str, enum.Enum):
    """Notification type enumeration"""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    TRADE = "trade"
    PRICE = "price"


class NotificationDB(Base):
    """Notification model for admin router - matches ocd-backend's Notification table"""
    __tablename__ = "notifications"
    __table_args__ = {'extend_existing': True}  # Don't recreate if exists
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(Enum(NotificationType), default=NotificationType.INFO, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    link = Column(String(255), nullable=True)
    extra_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
router = APIRouter(prefix="/notifications", tags=["notifications"])


# ============== Models ==============

class NotificationBroadcastRequest(BaseModel):
    """Request to broadcast a notification"""
    title: str = Field(..., min_length=1, max_length=100)
    message: str = Field(..., min_length=1, max_length=500)
    type: str = Field("info", pattern="^(info|success|warning|error|trade|price)$")
    target: str = Field("all", pattern="^(all|user)$")
    user_email: Optional[str] = Field(None, description="Required if target is 'user'")
    link: Optional[str] = None


class NotificationStats(BaseModel):
    """Notification statistics"""
    total_sent: int
    unread_count: int
    users_with_notifications: int


# ============== Helpers ==============

async def get_db():
    """Get database session from pool"""
    async with db_pool.get_session() as session:
        yield session


def get_notification_type(type_str: str) -> NotificationType:
    """Map string to NotificationType enum"""
    type_map = {
        "info": NotificationType.INFO,
        "success": NotificationType.SUCCESS,
        "warning": NotificationType.WARNING,
        "error": NotificationType.ERROR,
        "trade": NotificationType.TRADE,
        "price": NotificationType.PRICE,
    }
    return type_map.get(type_str, NotificationType.INFO)


# ============== Endpoints ==============

@router.post("/broadcast")
async def broadcast_notification(
    request: NotificationBroadcastRequest,
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Broadcast a notification.
    - target="all": Send to all active users
    - target="user": Send to specific user by email
    """
    notif_type = get_notification_type(request.type)
    sent_count = 0
    
    if request.target == "all":
        # Get all active users
        result = await db.execute(
            select(AppUserDB).where(AppUserDB.is_active == True)
        )
        users = result.scalars().all()
        
        # Create notification for each user
        for user in users:
            notification = NotificationDB(
                user_id=user.id,
                title=request.title,
                message=request.message,
                type=notif_type,
                link=request.link,
            )
            db.add(notification)
            sent_count += 1
        
        await db.commit()
        logger.info(f"Admin {admin.username} broadcast notification to {sent_count} users")
        
    elif request.target == "user":
        if not request.user_email:
            raise HTTPException(status_code=400, detail="user_email is required for target='user'")
        
        # Find user by email
        result = await db.execute(
            select(AppUserDB).where(AppUserDB.email == request.user_email)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail=f"User not found: {request.user_email}")
        
        # Create notification
        notification = NotificationDB(
            user_id=user.id,
            title=request.title,
            message=request.message,
            type=notif_type,
            link=request.link,
        )
        db.add(notification)
        await db.commit()
        sent_count = 1
        
        logger.info(f"Admin {admin.username} sent notification to user: {request.user_email}")
    
    return {
        "success": True,
        "message": f"Notification sent to {sent_count} user(s)",
        "sent_count": sent_count
    }


@router.get("/stats")
async def get_notification_stats(
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get notification statistics"""
    # Total notifications
    total_result = await db.execute(select(func.count()).select_from(NotificationDB))
    total_sent = total_result.scalar() or 0
    
    # Unread count
    unread_result = await db.execute(
        select(func.count()).select_from(NotificationDB).where(NotificationDB.is_read == False)
    )
    unread_count = unread_result.scalar() or 0
    
    # Users with notifications
    users_result = await db.execute(
        select(func.count(func.distinct(NotificationDB.user_id)))
    )
    users_with_notifications = users_result.scalar() or 0
    
    return NotificationStats(
        total_sent=total_sent,
        unread_count=unread_count,
        users_with_notifications=users_with_notifications
    )


@router.get("/users")
async def get_users_for_targeting(
    search: str = Query("", description="Search by email or username"),
    limit: int = Query(20, ge=1, le=100),
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get list of users for notification targeting"""
    query = select(AppUserDB.id, AppUserDB.email, AppUserDB.username).where(AppUserDB.is_active == True)
    
    if search:
        query = query.where(
            (AppUserDB.email.ilike(f"%{search}%")) | (AppUserDB.username.ilike(f"%{search}%"))
        )
    
    query = query.order_by(AppUserDB.email).limit(limit)
    result = await db.execute(query)
    users = result.all()
    
    return {
        "users": [
            {"id": str(u.id), "email": u.email, "username": u.username}
            for u in users
        ]
    }

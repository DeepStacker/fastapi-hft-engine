"""
Admin Notifications Router
Provides endpoints for admins to send notifications to users.
Enhanced with history, templates, analytics, and bulk operations.
"""
import logging
import enum
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Column, String, Boolean, DateTime, Enum, Text, ForeignKey, Index, delete, Integer
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
    __table_args__ = {'extend_existing': True}
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(Enum(NotificationType), default=NotificationType.INFO, nullable=False)
    channel = Column(String(20), nullable=False, default="system")  # system, email, push
    purpose = Column(String(20), nullable=False, default="alert")   # alert, trade, price, announcement
    priority = Column(String(20), nullable=False, default="normal") # low, normal, high, urgent
    is_read = Column(Boolean, default=False, nullable=False)
    sound_enabled = Column(Boolean, default=True, nullable=False)
    link = Column(String(255), nullable=True)
    action_url = Column(String(255), nullable=True)
    action_label = Column(String(50), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    extra_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class NotificationTemplateDB(Base):
    """Reusable notification templates"""
    __tablename__ = "notification_templates"
    __table_args__ = {'extend_existing': True}
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    name = Column(String(100), nullable=False, unique=True)
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="info")
    link = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(50), nullable=True)


class AdminNotificationHistoryDB(Base):
    """Tracks admin broadcast history for analytics"""
    __tablename__ = "admin_notification_history"
    __table_args__ = {'extend_existing': True}
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="info")
    target = Column(String(20), default="all")  # 'all' or 'user'
    target_email = Column(String(255), nullable=True)
    link = Column(String(255), nullable=True)
    sent_count = Column(Integer, default=0)
    sent_by = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


router = APIRouter(prefix="/notifications", tags=["notifications"])


# ============== Request/Response Models ==============

class NotificationBroadcastRequest(BaseModel):
    """Request to broadcast a notification"""
    title: str = Field(..., min_length=1, max_length=100)
    message: str = Field(..., min_length=1, max_length=500)
    type: str = Field("info", pattern="^(info|success|warning|error|trade|price)$")
    target: str = Field("all", pattern="^(all|user)$")
    user_email: Optional[str] = Field(None, description="Required if target is 'user'")
    link: Optional[str] = None
    template_id: Optional[str] = None


class NotificationStats(BaseModel):
    """Notification statistics"""
    total_sent: int
    unread_count: int
    users_with_notifications: int


class TemplateCreate(BaseModel):
    """Create a notification template"""
    name: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=100)
    message: str = Field(..., min_length=1, max_length=500)
    type: str = Field("info", pattern="^(info|success|warning|error|trade|price)$")
    link: Optional[str] = None


class TemplateUpdate(BaseModel):
    """Update a notification template"""
    name: Optional[str] = None
    title: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = None
    link: Optional[str] = None


class BulkDeleteRequest(BaseModel):
    """Bulk delete notifications"""
    notification_ids: List[str]


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


# ============== Broadcast Endpoints ==============

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
        sent_count = 1
    
    # Record in history
    history_entry = AdminNotificationHistoryDB(
        title=request.title,
        message=request.message,
        type=request.type,
        target=request.target,
        target_email=request.user_email if request.target == "user" else None,
        link=request.link,
        sent_count=sent_count,
        sent_by=admin.username,
    )
    db.add(history_entry)
    
    await db.commit()
    logger.info(f"Admin {admin.username} sent notification to {sent_count} user(s)")
    
    return {
        "success": True,
        "message": f"Notification sent to {sent_count} user(s)",
        "sent_count": sent_count,
        "history_id": str(history_entry.id)
    }


# ============== History Endpoints ==============

@router.get("/history")
async def get_notification_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: str = Query(None, description="Filter by notification type"),
    target: str = Query(None, description="Filter by target (all/user)"),
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated broadcast history"""
    query = select(AdminNotificationHistoryDB)
    
    if type:
        query = query.where(AdminNotificationHistoryDB.type == type)
    if target:
        query = query.where(AdminNotificationHistoryDB.target == target)
    
    # Get total count
    count_query = select(func.count()).select_from(AdminNotificationHistoryDB)
    if type:
        count_query = count_query.where(AdminNotificationHistoryDB.type == type)
    if target:
        count_query = count_query.where(AdminNotificationHistoryDB.target == target)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated results
    offset = (page - 1) * limit
    query = query.order_by(AdminNotificationHistoryDB.created_at.desc()).offset(offset).limit(limit)
    
    result = await db.execute(query)
    history = result.scalars().all()
    
    return {
        "success": True,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "history": [
            {
                "id": str(h.id),
                "title": h.title,
                "message": h.message,
                "type": h.type,
                "target": h.target,
                "target_email": h.target_email,
                "link": h.link,
                "sent_count": h.sent_count,
                "sent_by": h.sent_by,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in history
        ]
    }


@router.delete("/history/{history_id}")
async def delete_history_entry(
    history_id: str,
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a history entry"""
    try:
        uuid = UUID(history_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid history ID")
    
    result = await db.execute(
        delete(AdminNotificationHistoryDB).where(AdminNotificationHistoryDB.id == uuid)
    )
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="History entry not found")
    
    return {"success": True, "message": "History entry deleted"}


# ============== Bulk Operations ==============

@router.delete("/bulk")
async def bulk_delete_notifications(
    request: BulkDeleteRequest,
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk delete notifications by IDs"""
    if not request.notification_ids:
        raise HTTPException(status_code=400, detail="No notification IDs provided")
    
    uuids = []
    for nid in request.notification_ids:
        try:
            uuids.append(UUID(nid))
        except ValueError:
            continue
    
    if not uuids:
        raise HTTPException(status_code=400, detail="No valid notification IDs provided")
    
    result = await db.execute(
        delete(NotificationDB).where(NotificationDB.id.in_(uuids))
    )
    await db.commit()
    
    logger.info(f"Admin {admin.username} bulk deleted {result.rowcount} notifications")
    
    return {
        "success": True,
        "message": f"Deleted {result.rowcount} notifications",
        "deleted_count": result.rowcount
    }


@router.delete("/history/bulk")
async def bulk_delete_history(
    request: BulkDeleteRequest,
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk delete history entries by IDs"""
    if not request.notification_ids:
        raise HTTPException(status_code=400, detail="No history IDs provided")
    
    uuids = []
    for nid in request.notification_ids:
        try:
            uuids.append(UUID(nid))
        except ValueError:
            continue
    
    if not uuids:
        raise HTTPException(status_code=400, detail="No valid history IDs provided")
    
    result = await db.execute(
        delete(AdminNotificationHistoryDB).where(AdminNotificationHistoryDB.id.in_(uuids))
    )
    await db.commit()
    
    return {
        "success": True,
        "message": f"Deleted {result.rowcount} history entries",
        "deleted_count": result.rowcount
    }


# ============== Analytics Endpoints ==============

@router.get("/analytics")
async def get_notification_analytics(
    days: int = Query(30, ge=1, le=365),
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get notification analytics"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Total broadcasts
    total_broadcasts_result = await db.execute(
        select(func.count()).select_from(AdminNotificationHistoryDB)
    )
    total_broadcasts = total_broadcasts_result.scalar() or 0
    
    # Broadcasts in period
    period_broadcasts_result = await db.execute(
        select(func.count()).select_from(AdminNotificationHistoryDB)
        .where(AdminNotificationHistoryDB.created_at >= cutoff_date)
    )
    period_broadcasts = period_broadcasts_result.scalar() or 0
    
    # Total notifications sent
    total_sent_result = await db.execute(
        select(func.sum(AdminNotificationHistoryDB.sent_count))
    )
    total_sent = total_sent_result.scalar() or 0
    
    # Total notifications in DB
    total_notifs_result = await db.execute(
        select(func.count()).select_from(NotificationDB)
    )
    total_notifs = total_notifs_result.scalar() or 0
    
    # Read count
    read_count_result = await db.execute(
        select(func.count()).select_from(NotificationDB)
        .where(NotificationDB.is_read == True)
    )
    read_count = read_count_result.scalar() or 0
    
    # Unread count
    unread_count = total_notifs - read_count
    
    # Read rate
    read_rate = (read_count / total_notifs * 100) if total_notifs > 0 else 0
    
    # Broadcasts by type
    type_stats_result = await db.execute(
        select(
            AdminNotificationHistoryDB.type,
            func.count().label("count")
        )
        .group_by(AdminNotificationHistoryDB.type)
    )
    type_stats = {row.type: row.count for row in type_stats_result}
    
    # Broadcasts by target
    target_stats_result = await db.execute(
        select(
            AdminNotificationHistoryDB.target,
            func.count().label("count")
        )
        .group_by(AdminNotificationHistoryDB.target)
    )
    target_stats = {row.target: row.count for row in target_stats_result}
    
    # Daily broadcasts in period (last 7 days for chart)
    daily_result = await db.execute(
        select(
            func.date(AdminNotificationHistoryDB.created_at).label("date"),
            func.count().label("count"),
            func.sum(AdminNotificationHistoryDB.sent_count).label("sent")
        )
        .where(AdminNotificationHistoryDB.created_at >= datetime.utcnow() - timedelta(days=7))
        .group_by(func.date(AdminNotificationHistoryDB.created_at))
        .order_by(func.date(AdminNotificationHistoryDB.created_at))
    )
    daily_stats = [
        {"date": str(row.date), "broadcasts": row.count, "sent": row.sent or 0}
        for row in daily_result
    ]
    
    return {
        "success": True,
        "period_days": days,
        "total_broadcasts": total_broadcasts,
        "period_broadcasts": period_broadcasts,
        "total_notifications_sent": total_sent,
        "total_notifications_in_db": total_notifs,
        "read_count": read_count,
        "unread_count": unread_count,
        "read_rate_percent": round(read_rate, 1),
        "by_type": type_stats,
        "by_target": target_stats,
        "daily_stats": daily_stats,
    }


@router.get("/stats")
async def get_notification_stats(
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get notification statistics (legacy endpoint)"""
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


# ============== Template Endpoints ==============

@router.get("/templates")
async def list_templates(
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all notification templates"""
    result = await db.execute(
        select(NotificationTemplateDB).order_by(NotificationTemplateDB.name)
    )
    templates = result.scalars().all()
    
    return {
        "success": True,
        "templates": [
            {
                "id": str(t.id),
                "name": t.name,
                "title": t.title,
                "message": t.message,
                "type": t.type,
                "link": t.link,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "created_by": t.created_by,
            }
            for t in templates
        ]
    }


@router.post("/templates")
async def create_template(
    template: TemplateCreate,
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a notification template"""
    # Check for duplicate name
    existing = await db.execute(
        select(NotificationTemplateDB).where(NotificationTemplateDB.name == template.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Template with name '{template.name}' already exists")
    
    new_template = NotificationTemplateDB(
        name=template.name,
        title=template.title,
        message=template.message,
        type=template.type,
        link=template.link,
        created_by=admin.username,
    )
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    
    logger.info(f"Admin {admin.username} created template: {template.name}")
    
    return {
        "success": True,
        "message": "Template created",
        "template": {
            "id": str(new_template.id),
            "name": new_template.name,
            "title": new_template.title,
            "message": new_template.message,
            "type": new_template.type,
            "link": new_template.link,
        }
    }


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    template: TemplateUpdate,
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a notification template"""
    try:
        uuid = UUID(template_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid template ID")
    
    result = await db.execute(
        select(NotificationTemplateDB).where(NotificationTemplateDB.id == uuid)
    )
    existing = result.scalar_one_or_none()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check for name conflicts if changing name
    if template.name and template.name != existing.name:
        name_check = await db.execute(
            select(NotificationTemplateDB).where(NotificationTemplateDB.name == template.name)
        )
        if name_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Template with name '{template.name}' already exists")
    
    # Update fields
    if template.name is not None:
        existing.name = template.name
    if template.title is not None:
        existing.title = template.title
    if template.message is not None:
        existing.message = template.message
    if template.type is not None:
        existing.type = template.type
    if template.link is not None:
        existing.link = template.link
    
    await db.commit()
    
    logger.info(f"Admin {admin.username} updated template: {existing.name}")
    
    return {
        "success": True,
        "message": "Template updated",
        "template": {
            "id": str(existing.id),
            "name": existing.name,
            "title": existing.title,
            "message": existing.message,
            "type": existing.type,
            "link": existing.link,
        }
    }


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    admin = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a notification template"""
    try:
        uuid = UUID(template_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid template ID")
    
    result = await db.execute(
        delete(NotificationTemplateDB).where(NotificationTemplateDB.id == uuid)
    )
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    logger.info(f"Admin {admin.username} deleted template: {template_id}")
    
    return {"success": True, "message": "Template deleted"}


# ============== User Targeting ==============

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


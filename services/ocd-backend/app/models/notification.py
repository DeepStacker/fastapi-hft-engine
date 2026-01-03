"""
Notification Model - User notifications and alerts
Enhanced with multi-channel delivery, purposes, and user preferences
"""
import enum
from datetime import datetime, time
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Column, String, Boolean, DateTime, Enum, Text, ForeignKey, Index, Time
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin
from app.models.user import User


class NotificationType(str, enum.Enum):
    """Notification type enumeration (visual style)"""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    TRADE = "trade"
    PRICE = "price"


class NotificationChannel(str, enum.Enum):
    """Delivery channel for notifications"""
    IN_APP = "in_app"
    PUSH = "push"
    EMAIL = "email"


class NotificationPurpose(str, enum.Enum):
    """Purpose/category of notification"""
    TRANSACTIONAL = "transactional"  # Order fills, trade executions
    INFORMATIVE = "informative"      # Market news, price alerts
    CTA = "cta"                       # Call-to-action, urgent opportunities
    PERSONALIZED = "personalized"    # Recommendations, watchlist
    SYSTEM = "system"                # Maintenance, updates
    FEEDBACK = "feedback"            # Rate us, surveys


class NotificationPriority(str, enum.Enum):
    """Priority level affecting display behavior"""
    LOW = "low"         # Silent, badge only
    NORMAL = "normal"   # Standard toast
    HIGH = "high"       # Persistent toast with sound
    URGENT = "urgent"   # Modal/banner, override quiet hours


class Notification(Base, TimestampMixin):
    """
    Notification model for user alerts and messages.
    Supports multi-channel delivery with different purposes and priorities.
    """
    
    __tablename__ = "notifications"
    
    __table_args__ = (
        Index('ix_notifications_user_unread', 'user_id', 'is_read'),
        Index('ix_notifications_user_created', 'user_id', 'created_at'),
        Index('ix_notifications_user_purpose', 'user_id', 'purpose'),
        {'extend_existing': True}
    )
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    
    # User relationship
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("app_users.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    
    # Core content
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    
    # Type (visual style)
    type = Column(Enum(NotificationType), default=NotificationType.INFO, nullable=False)
    
    # Delivery channel
    channel = Column(String(20), default="in_app", nullable=False)
    
    # Purpose/category
    purpose = Column(String(20), default="informative", nullable=False)
    
    # Priority level
    priority = Column(String(20), default="normal", nullable=False)
    
    # Read status
    is_read = Column(Boolean, default=False, nullable=False)
    
    # Sound settings
    sound_enabled = Column(Boolean, default=True, nullable=False)
    
    # Action button
    link = Column(String(255), nullable=True)
    action_url = Column(String(255), nullable=True)
    action_label = Column(String(50), nullable=True)
    
    # Expiration
    expires_at = Column(DateTime, nullable=True)
    
    # Extra data (JSON)
    extra_data = Column(Text, nullable=True)

    # Relationship
    user = relationship(User, backref="notifications", lazy="select")
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "title": self.title,
            "message": self.message,
            "type": self.type.value,
            "channel": self.channel,
            "purpose": self.purpose,
            "priority": self.priority,
            "is_read": self.is_read,
            "sound_enabled": self.sound_enabled,
            "link": self.link,
            "action_url": self.action_url,
            "action_label": self.action_label,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def __repr__(self) -> str:
        return f"<Notification {self.title[:20]}... ({self.type.value}/{self.purpose})>"


class NotificationPreference(Base, TimestampMixin):
    """
    User notification preferences
    Controls which channels and purposes are enabled
    """
    
    __tablename__ = "notification_preferences"
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("app_users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    
    # Channel preferences
    enable_in_app = Column(Boolean, default=True, nullable=False)
    enable_push = Column(Boolean, default=True, nullable=False)
    enable_email = Column(Boolean, default=False, nullable=False)
    
    # Purpose preferences
    enable_transactional = Column(Boolean, default=True, nullable=False)
    enable_informative = Column(Boolean, default=True, nullable=False)
    enable_cta = Column(Boolean, default=True, nullable=False)
    enable_personalized = Column(Boolean, default=True, nullable=False)
    enable_system = Column(Boolean, default=True, nullable=False)
    enable_feedback = Column(Boolean, default=False, nullable=False)
    
    # Sound preferences
    enable_sound = Column(Boolean, default=True, nullable=False)
    quiet_hours_start = Column(Time, nullable=True)  # e.g., 22:00
    quiet_hours_end = Column(Time, nullable=True)    # e.g., 08:00
    
    # FCM token for push notifications
    fcm_token = Column(String(500), nullable=True)
    
    # Relationship
    user = relationship(User, backref="notification_preferences", lazy="select")
    
    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "enable_in_app": self.enable_in_app,
            "enable_push": self.enable_push,
            "enable_email": self.enable_email,
            "enable_transactional": self.enable_transactional,
            "enable_informative": self.enable_informative,
            "enable_cta": self.enable_cta,
            "enable_personalized": self.enable_personalized,
            "enable_system": self.enable_system,
            "enable_feedback": self.enable_feedback,
            "enable_sound": self.enable_sound,
            "quiet_hours_start": str(self.quiet_hours_start) if self.quiet_hours_start else None,
            "quiet_hours_end": str(self.quiet_hours_end) if self.quiet_hours_end else None,
        }


"""
Notification Model - User notifications and alerts
"""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Column, String, Boolean, DateTime, Enum, Text, ForeignKey, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class NotificationType(str, enum.Enum):
    """Notification type enumeration"""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    TRADE = "trade"
    PRICE = "price"


class Notification(Base, TimestampMixin):
    """
    Notification model for user alerts and messages.
    Stores system-generated and admin-created notifications for users.
    """
    
    __tablename__ = "notifications"
    
    # Indexes for common query patterns
    __table_args__ = (
        # Filter unread notifications for a user
        Index('ix_notifications_user_unread', 'user_id', 'is_read'),
        # Order by creation date
        Index('ix_notifications_user_created', 'user_id', 'created_at'),
    )
    
    # Primary key
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True
    )
    
    # User relationship (nullable for broadcast notifications)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    
    # Notification content
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    
    # Type for styling/categorization
    type = Column(
        Enum(NotificationType),
        default=NotificationType.INFO,
        nullable=False
    )
    
    # Read status
    is_read = Column(Boolean, default=False, nullable=False)
    
    # Optional link for action
    link = Column(String(255), nullable=True)
    
    # Optional extra data (JSON stored as text)
    extra_data = Column(Text, nullable=True)
    
    # Relationship to user
    user = relationship("User", backref="notifications", lazy="select")
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "title": self.title,
            "message": self.message,
            "type": self.type.value,
            "is_read": self.is_read,
            "link": self.link,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def __repr__(self) -> str:
        return f"<Notification {self.title[:20]}... ({self.type.value})>"

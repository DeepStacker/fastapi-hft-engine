"""
User Model - User account and authentication
"""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Column, String, Boolean, DateTime, Enum, Text, Index
)
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    """User role enumeration"""
    USER = "user"
    PREMIUM = "premium"
    ADMIN = "admin"


class User(Base, TimestampMixin):
    """User model for authentication and authorization"""
    
    __tablename__ = "users"
    
    # Composite indexes for common query patterns
    __table_args__ = (
        # Index for filtering active users by role (admin dashboards)
        Index('ix_users_active_role', 'is_active', 'role'),
        # Index for premium subscription queries
        Index('ix_users_role_subscription', 'role', 'subscription_expires'),
        # Index for last login tracking
        Index('ix_users_last_login', 'last_login'),
    )
    
    # Primary key
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True
    )
    
    # Firebase authentication
    firebase_uid = Column(
        String(128),
        unique=True,
        nullable=False,
        index=True
    )
    
    # User info
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=True)
    profile_image = Column(Text, nullable=True)
    
    # Authentication status
    is_email_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    login_provider = Column(String(50), default="email", nullable=False)
    
    # Role and subscription
    role = Column(
        Enum(UserRole),
        default=UserRole.USER,
        nullable=False
    )
    subscription_expires = Column(DateTime(timezone=True), nullable=True)
    
    # Session tracking
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_logout = Column(DateTime(timezone=True), nullable=True)
    
    @property
    def is_admin(self) -> bool:
        """Check if user is admin"""
        return self.role == UserRole.ADMIN
    
    @property
    def is_premium(self) -> bool:
        """Check if user has active premium subscription"""
        if self.role == UserRole.ADMIN:
            return True
        if self.role == UserRole.PREMIUM and self.subscription_expires:
            return self.subscription_expires > datetime.utcnow()
        return False
    
    @property
    def display_name(self) -> str:
        """Get display name (full name or username)"""
        return self.full_name or self.username
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "email": self.email,
            "username": self.username,
            "full_name": self.full_name,
            "profile_image": self.profile_image,
            "role": self.role.value,
            "is_active": self.is_active,
            "is_email_verified": self.is_email_verified,
            "is_premium": self.is_premium,
            "login_provider": self.login_provider,
            "subscription_expires": (
                self.subscription_expires.isoformat()
                if self.subscription_expires else None
            ),
            "last_login": (
                self.last_login.isoformat()
                if self.last_login else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def __repr__(self) -> str:
        return f"<User {self.username} ({self.email})>"

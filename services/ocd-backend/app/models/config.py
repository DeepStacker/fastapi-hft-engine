"""
Configuration Models - Admin-managed system configuration
"""
import enum
from uuid import uuid4
from typing import Optional

from sqlalchemy import (
    Column, String, Boolean, Text, Float, Integer, ForeignKey, Enum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class ConfigCategory(str, enum.Enum):
    """Configuration category enumeration"""
    API = "api"
    CACHE = "cache"
    SECURITY = "security"
    TRADING = "trading"
    UI = "ui"
    SYSTEM = "system"
    FEATURES = "features"


class SystemConfig(Base, TimestampMixin):
    """
    System configuration model for admin-managed settings.
    Allows configuration to be changed from UI without redeployment.
    """
    
    __tablename__ = "system_configs"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True
    )
    
    # Configuration key (unique identifier)
    key = Column(String(100), unique=True, nullable=False, index=True)
    
    # Configuration value (stored as string, can be JSON for complex values)
    value = Column(Text, nullable=False)
    
    # Category for grouping in admin UI
    category = Column(
        Enum(ConfigCategory),
        default=ConfigCategory.SYSTEM,
        nullable=False,
        index=True
    )
    
    # Description for admin UI
    description = Column(Text, nullable=True)
    
    # Display name for admin UI
    display_name = Column(String(100), nullable=True)
    
    # Whether value should be masked in API responses
    is_sensitive = Column(Boolean, default=False, nullable=False)
    
    # Whether this config is active
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Fallback value if this config is deleted or invalid
    fallback_value = Column(Text, nullable=True)
    
    # Value type hint for UI (string, number, boolean, json)
    value_type = Column(String(20), default="string", nullable=False)
    
    # Admin who last updated this config
    updated_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    
    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Convert to dictionary for API response"""
        value = self.value
        if self.is_sensitive and not include_sensitive:
            value = "********"
        
        return {
            "id": str(self.id),
            "key": self.key,
            "value": value,
            "category": self.category.value,
            "description": self.description,
            "display_name": self.display_name or self.key,
            "is_sensitive": self.is_sensitive,
            "is_active": self.is_active,
            "value_type": self.value_type,
            "fallback_value": self.fallback_value,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self) -> str:
        return f"<SystemConfig {self.key}={self.value[:20]}...>"


class TradingInstrument(Base, TimestampMixin):
    """
    Trading instrument configuration.
    Stores information about tradeable symbols/instruments.
    """
    
    __tablename__ = "trading_instruments"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True
    )
    
    # Symbol identifier (e.g., "NIFTY", "BANKNIFTY")
    symbol = Column(String(50), unique=True, nullable=False, index=True)
    
    # Display name (e.g., "Nifty 50", "Bank Nifty")
    display_name = Column(String(100), nullable=True)
    
    # Segment (IDX = Index, EQ = Equity)
    segment = Column(String(10), default="IDX", nullable=False)
    
    # Trading parameters
    lot_size = Column(Integer, default=1, nullable=False)
    tick_size = Column(Float, default=0.05, nullable=False)
    
    # Strike interval (for options chain)
    strike_interval = Column(Float, default=50.0, nullable=False)
    
    # Number of strikes to show on each side of ATM
    strikes_count = Column(Integer, default=20, nullable=False)
    
    # Whether this instrument is active
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Priority for display order
    priority = Column(Integer, default=0, nullable=False)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "symbol": self.symbol,
            "display_name": self.display_name or self.symbol,
            "segment": self.segment,
            "lot_size": self.lot_size,
            "tick_size": self.tick_size,
            "strike_interval": self.strike_interval,
            "strikes_count": self.strikes_count,
            "is_active": self.is_active,
            "priority": self.priority,
        }
    
    def __repr__(self) -> str:
        return f"<TradingInstrument {self.symbol}>"

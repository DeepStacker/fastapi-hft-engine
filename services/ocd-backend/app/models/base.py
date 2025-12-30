"""
Base Model - Common model utilities and mixins
"""
from datetime import datetime
from typing import Any
from sqlalchemy import Column, DateTime, func
from sqlalchemy.orm import DeclarativeBase, declared_attr


from core.database.db import Base

# Removed local Base definition to use shared core Base for relationship compatibility


class TimestampMixin:
    """Mixin that adds created_at and updated_at columns"""
    
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

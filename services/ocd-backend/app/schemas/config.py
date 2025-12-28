"""
Configuration Schemas - Request/Response models for admin config endpoints
"""
from typing import Optional, Any, List
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
import json


class ConfigBase(BaseModel):
    """Base config schema"""
    key: str = Field(..., min_length=1, max_length=100, pattern="^[A-Z][A-Z0-9_]*$")
    value: str
    category: str = Field(default="system", pattern="^(api|cache|security|trading|ui|system)$")
    description: Optional[str] = None
    display_name: Optional[str] = None
    is_sensitive: bool = False
    value_type: str = Field(default="string", pattern="^(string|number|boolean|json)$")
    fallback_value: Optional[str] = None


class ConfigCreate(ConfigBase):
    """Schema for creating a new config"""
    
    @field_validator("value")
    @classmethod
    def validate_value(cls, v: str, info) -> str:
        # Validate JSON if value_type is json
        if hasattr(info, 'data') and info.data.get("value_type") == "json":
            try:
                json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("Invalid JSON value")
        return v


class ConfigUpdate(BaseModel):
    """Schema for updating a config"""
    value: Optional[str] = None
    description: Optional[str] = None
    display_name: Optional[str] = None
    is_sensitive: Optional[bool] = None
    is_active: Optional[bool] = None
    fallback_value: Optional[str] = None


class ConfigResponse(BaseModel):
    """Config response schema"""
    id: UUID
    key: str
    value: str  # Will be masked if sensitive
    category: str
    description: Optional[str] = None
    display_name: str
    is_sensitive: bool
    is_active: bool
    value_type: str
    fallback_value: Optional[str] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ConfigListResponse(BaseModel):
    """Response for listing configs grouped by category"""
    category: str
    configs: List[ConfigResponse]


class InstrumentBase(BaseModel):
    """Base instrument schema"""
    symbol: str = Field(..., min_length=1, max_length=50)
    display_name: Optional[str] = None
    segment: str = Field(default="IDX", pattern="^(IDX|EQ)$")
    lot_size: int = Field(default=1, ge=1)
    tick_size: float = Field(default=0.05, gt=0)
    strike_interval: float = Field(default=50.0, gt=0)
    strikes_count: int = Field(default=20, ge=5, le=50)
    priority: int = Field(default=0, ge=0)


class InstrumentCreate(InstrumentBase):
    """Schema for creating a new instrument"""
    pass


class InstrumentUpdate(BaseModel):
    """Schema for updating an instrument"""
    display_name: Optional[str] = None
    lot_size: Optional[int] = Field(None, ge=1)
    tick_size: Optional[float] = Field(None, gt=0)
    strike_interval: Optional[float] = Field(None, gt=0)
    strikes_count: Optional[int] = Field(None, ge=5, le=50)
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0)


class InstrumentResponse(BaseModel):
    """Instrument response schema"""
    id: UUID
    symbol: str
    display_name: str
    segment: str
    lot_size: int
    tick_size: float
    strike_interval: float
    strikes_count: int
    is_active: bool
    priority: int
    
    class Config:
        from_attributes = True


class CacheClearRequest(BaseModel):
    """Request to clear cache"""
    pattern: Optional[str] = Field(None, description="Cache key pattern to clear")
    clear_all: bool = Field(default=False, description="Clear all cache")


class CacheClearResponse(BaseModel):
    """Response after clearing cache"""
    success: bool = True
    keys_cleared: int = 0
    message: str = "Cache cleared successfully"

"""
Input Validation Schemas

Pydantic models for request validation across all endpoints.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class OptionType(str, Enum):
    """Option type enum"""
    CE = "CE"
    PE = "PE"


class IntervalType(str, Enum):
    """Time interval enum"""
    ONE_MIN = "1m"
    FIVE_MIN = "5m"
    FIFTEEN_MIN = "15m"
    ONE_HOUR = "1h"


class TierType(str, Enum):
    """API tier enum"""
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"


# Historical Data Request Validation
class HistoricalOIRequest(BaseModel):
    """Validation for historical OI change requests"""
    symbol_id: int = Field(..., gt=0, description="Symbol ID")
    strike: float = Field(..., gt=0, description="Strike price")
    option_type: OptionType
    expiry: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$', description="Expiry date (YYYY-MM-DD)")
    from_time: datetime
    to_time: Optional[datetime] = None
    interval: IntervalType = IntervalType.ONE_MIN
    
    @validator('expiry')
    def validate_expiry(cls, v):
        """Validate expiry is a valid date"""
        try:
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('Invalid expiry date format. Use YYYY-MM-DD')
    
    @validator('to_time', always=True)
    def validate_time_range(cls, v, values):
        """Validate time range"""
        if v is None:
            v = datetime.utcnow()
        
        from_time = values.get('from_time')
        if from_time and v < from_time:
            raise ValueError('to_time must be after from_time')
        
        # Prevent queries too far in the future
        if v > datetime.utcnow():
            raise ValueError('to_time cannot be in the future')
        
        return v


class PatternRequest(BaseModel):
    """Validation for pattern detection requests"""
    symbol_id: int = Field(..., gt=0)
    from_time: Optional[datetime] = None
    to_time: Optional[datetime] = None
    min_confidence: float = Field(50.0, ge=0, le=100, description="Minimum confidence (0-100)")
    pattern_type: Optional[str] = None
    
    @validator('min_confidence')
    def validate_confidence(cls, v):
        """Ensure confidence is in valid range"""
        if not 0 <= v <= 100:
            raise ValueError('Confidence must be between 0 and 100')
        return v


# API Key Management Validation
class CreateAPIKeyRequest(BaseModel):
    """Validation for API key creation"""
    key_name: str = Field(..., min_length=1, max_length=100, description="Key name")
    client_name: str = Field(..., min_length=1, max_length=100, description="Client name")
    contact_email: Optional[str] = Field(None, pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    tier: TierType
    allowed_symbols: Optional[List[int]] = Field(None, description="Allowed symbol IDs")
    notes: Optional[str] = Field(None, max_length=500)
    expires_in_days: Optional[int] = Field(None, gt=0, le=3650, description="Expiry in days (max 10 years)")
    
    @validator('allowed_symbols')
    def validate_symbols(cls, v):
        """Validate symbol IDs"""
        if v is not None:
            if len(v) == 0:
                raise ValueError('allowed_symbols cannot be empty list. Use null for all symbols.')
            if len(v) > 100:
                raise ValueError('Cannot specify more than 100 symbols')
            if any(s <= 0 for s in v):
                raise ValueError('All symbol IDs must be positive')
        return v


class UpdateAPIKeyRequest(BaseModel):
    """Validation for API key updates"""
    key_name: Optional[str] = Field(None, min_length=1, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)
    allowed_symbols: Optional[List[int]] = None


# Admin Login Validation
class AdminLoginRequest(BaseModel):
    """Validation for admin login"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=100)


# Pagination Validation
class PaginationParams(BaseModel):
    """Standard pagination parameters"""
    page: int = Field(1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(50, ge=1, le=1000, description="Items per page (max 1000)")
    
    @property
    def offset(self) -> int:
        """Calculate offset from page"""
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        """Get limit"""
        return self.page_size


# Symbol Query Validation
class SymbolQueryParams(BaseModel):
    """Validation for symbol queries"""
    symbol_id: Optional[int] = Field(None, gt=0)
    symbol_name: Optional[str] = Field(None, min_length=1, max_length=50)
    active_only: bool = Field(True, description="Return only active symbols")


# Health Check Response
class HealthCheckResponse(BaseModel):
    """Health check response schema"""
    status: str = Field(..., pattern="^(healthy|degraded|unhealthy)$")
    timestamp: datetime
    checks: dict
    version: Optional[str] = None


# Error Response
class ErrorResponse(BaseModel):
    """Standard error response"""
    error: str
    status_code: int
    timestamp: datetime
    details: Optional[dict] = None

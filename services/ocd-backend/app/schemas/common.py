"""
Common Schemas - OCD Backend

Re-exports core schemas and adds OCD-specific schemas.
Import core.schemas for the canonical versions; this module
provides backward compatibility and OCD-specific additions.
"""
from typing import Any, Generic, List, Optional, TypeVar
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# Re-export from core schemas (single source of truth)
from core.schemas.common import (
    ErrorResponse,
    PaginatedResponse as CorePaginatedResponse,
    HealthResponse as CoreHealthResponse,
    ResponseWrapper,
    PaginationParams,
    CursorPaginationParams,
    TimeRangeParams,
    BulkOperationResult,
)

# Local imports
from app.utils.timezone import get_ist_now


T = TypeVar("T")


class ResponseModel(BaseModel, Generic[T]):
    """Standard API response wrapper - OCD specific"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None
    
    model_config = ConfigDict(from_attributes=True)


# Extend core PaginatedResponse with backward-compatible properties
class PaginatedResponse(CorePaginatedResponse[T], Generic[T]):
    """
    Paginated response with backward-compatible properties.
    Extends core.schemas.common.PaginatedResponse.
    """
    pages: int = Field(default=0, description="Alias for total_pages")
    
    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages
    
    @property
    def has_prev(self) -> bool:
        return self.page > 1


# OCD-specific health response with service checks
class HealthResponse(BaseModel):
    """Health check response with OCD-specific checks"""
    status: str = "healthy"
    version: str
    database: str = "connected"
    redis: str = "connected"
    timestamp: datetime = Field(default_factory=get_ist_now)
    uptime_seconds: Optional[float] = None
    
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )


class SortParams(BaseModel):
    """Sorting query parameters"""
    sort_by: Optional[str] = None
    sort_order: str = Field(default="asc", pattern="^(asc|desc)$")


# Re-export everything for backward compatibility
__all__ = [
    # Core re-exports
    "ErrorResponse",
    "ResponseWrapper",
    "PaginationParams",
    "CursorPaginationParams",
    "TimeRangeParams",
    "BulkOperationResult",
    # OCD-specific
    "ResponseModel",
    "PaginatedResponse",
    "HealthResponse",
    "SortParams",
]

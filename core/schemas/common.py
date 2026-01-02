"""
Core Common Schemas - Single Source of Truth

Consolidated response wrappers and common schemas.
All services should import from here instead of defining duplicates.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Generic, TypeVar
from datetime import datetime


T = TypeVar("T")


class ErrorResponse(BaseModel):
    """
    Standardized error response used across all APIs.
    
    Example:
        {
            "success": false,
            "error": "Validation failed",
            "error_code": "VALIDATION_ERROR",
            "details": {"field": "email", "message": "Invalid format"},
            "timestamp": "2025-12-30T12:00:00Z",
            "request_id": "req_abc123"
        }
    """
    success: bool = False
    error: str = Field(..., description="Human-readable error message")
    error_code: Optional[str] = Field(None, description="Machine-readable error code")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = Field(None, description="Request correlation ID")
    
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Standardized paginated response wrapper.
    
    Supports millions of records with cursor-based pagination option.
    
    Example:
        {
            "items": [...],
            "total": 1000000,
            "page": 1,
            "page_size": 100,
            "total_pages": 10000,
            "has_next": true,
            "has_previous": false,
            "cursor": "eyJpZCI6MTAwfQ=="
        }
    """
    items: List[T]
    total: int = Field(..., ge=0, description="Total count of items")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=1000, description="Items per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")
    has_next: bool = Field(..., description="Whether next page exists")
    has_previous: bool = Field(..., description="Whether previous page exists")
    cursor: Optional[str] = Field(None, description="Cursor for cursor-based pagination")
    
    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    """
    Standardized health check response for all services.
    
    Supports Kubernetes liveness/readiness probes.
    
    Example:
        {
            "status": "healthy",
            "version": "1.0.0",
            "timestamp": "2025-12-30T12:00:00Z",
            "uptime_seconds": 86400,
            "checks": {
                "database": "connected",
                "redis": "connected",
                "kafka": "connected"
            }
        }
    """
    status: str = Field(default="healthy", description="Overall health status")
    version: str = Field(default="1.0.0", description="Service version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    uptime_seconds: Optional[float] = Field(None, ge=0)
    checks: Optional[Dict[str, str]] = Field(
        None, 
        description="Individual component health checks"
    )
    
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )


class ResponseWrapper(BaseModel, Generic[T]):
    """
    Generic API response wrapper for consistent response format.
    
    Example:
        {
            "success": true,
            "data": {...},
            "message": "Operation completed",
            "meta": {"cache_hit": true, "execution_time_ms": 15}
        }
    """
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    meta: Optional[Dict[str, Any]] = Field(
        None, 
        description="Response metadata (cache status, timing, etc.)"
    )
    
    model_config = ConfigDict(from_attributes=True)


class PaginationParams(BaseModel):
    """
    Standard pagination query parameters.
    
    Use as dependency in FastAPI endpoints:
        async def list_items(pagination: PaginationParams = Depends()):
    """
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")
    sort_by: Optional[str] = Field(None, description="Field to sort by")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")
    
    @property
    def offset(self) -> int:
        """Calculate SQL OFFSET from page number"""
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        """SQL LIMIT is just page_size"""
        return self.page_size


class CursorPaginationParams(BaseModel):
    """
    Cursor-based pagination for high-scale scenarios.
    
    More efficient than offset pagination for millions of records.
    """
    cursor: Optional[str] = Field(None, description="Pagination cursor")
    limit: int = Field(default=100, ge=1, le=1000, description="Maximum items to return")
    direction: str = Field(default="next", pattern="^(next|prev)$")


class TimeRangeParams(BaseModel):
    """
    Standard time range query parameters for historical data.
    """
    start_time: Optional[datetime] = Field(None, description="Start of time range")
    end_time: Optional[datetime] = Field(None, description="End of time range")
    interval: Optional[str] = Field(
        None, 
        pattern="^(1m|5m|15m|1h|1d)$",
        description="Data aggregation interval"
    )


class BulkOperationResult(BaseModel):
    """
    Result of bulk operations (create, update, delete multiple records).
    """
    success_count: int = Field(default=0, ge=0)
    failure_count: int = Field(default=0, ge=0)
    total_requested: int = Field(..., ge=0)
    errors: Optional[List[Dict[str, Any]]] = None
    
    @property
    def all_succeeded(self) -> bool:
        return self.failure_count == 0

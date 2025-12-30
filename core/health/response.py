"""
Standardized Health Check Response

All services should use this schema for health endpoints.
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from core.utils.timezone import get_ist_now


class HealthResponse(BaseModel):
    """Standard health check response for all services"""
    
    status: str  # "healthy", "degraded", "unhealthy"
    service: str  # Service name
    version: str = "1.0.0"
    timestamp: datetime
    uptime_seconds: Optional[float] = None
    
    # Component health
    database: Optional[str] = None  # "connected", "disconnected", "error"
    redis: Optional[str] = None
    kafka: Optional[str] = None
    
    # Additional details
    details: Optional[Dict[str, Any]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "healthy",
                "service": "ocd-backend",
                "version": "2.0.0",
                "timestamp": "2024-01-15T10:30:00+05:30",
                "uptime_seconds": 3600,
                "database": "connected",
                "redis": "connected"
            }
        }


def create_health_response(
    service: str,
    version: str = "1.0.0",
    database: str = None,
    redis: str = None,
    kafka: str = None,
    uptime_seconds: float = None,
    details: Dict[str, Any] = None
) -> HealthResponse:
    """Factory function to create standardized health response"""
    
    # Determine overall status based on components
    components = [database, redis, kafka]
    active_components = [c for c in components if c is not None]
    
    if all(c == "connected" for c in active_components):
        status = "healthy"
    elif any(c == "error" for c in active_components):
        status = "unhealthy"
    elif any(c == "disconnected" for c in active_components):
        status = "degraded"
    else:
        status = "healthy"
    
    return HealthResponse(
        status=status,
        service=service,
        version=version,
        timestamp=get_ist_now(),
        uptime_seconds=uptime_seconds,
        database=database,
        redis=redis,
        kafka=kafka,
        details=details
    )

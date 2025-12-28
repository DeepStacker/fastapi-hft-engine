"""
Service Communication Contracts

Standardized request/response schemas for inter-service communication.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class ServiceStatus(str, Enum):
    """Service status values"""
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL = "partial"


class BaseServiceRequest(BaseModel):
    """Base request model for all inter-service calls"""
    request_id: str = Field(..., description="Unique request ID for tracing")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    service_name: str = Field(..., description="Calling service name")
    version: str = Field(default="v1", description="API version")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class BaseServiceResponse(BaseModel):
    """Base response model for all inter-service calls"""
    request_id: str
    status: ServiceStatus
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    service_name: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Analytics Service Contracts

class AnalyticsRequest(BaseServiceRequest):
    """Request for analytics calculation"""
    symbol_id: int
    expiry: str
    include_historical: bool = True
    analytics_types: List[str] = Field(
        default=["pcr", "gex", "iv_skew"],
        description="Types of analytics to calculate"
    )


class AnalyticsResponse(BaseServiceResponse):
    """Response from analytics service"""
    analytics: Optional[Dict[str, Any]] = None
    computation_time_ms: Optional[float] = None


# Storage Service Contracts

class StoreDataRequest(BaseServiceRequest):
    """Request to store market data"""
    data_type: str = Field(..., description="market_snapshot or option_contract")
    records: List[Dict[str, Any]]
    batch_id: Optional[str] = None


class StoreDataResponse(BaseServiceResponse):
    """Response from storage service"""
    records_stored: int
    batch_id: Optional[str] = None
    storage_time_ms: float


# Historical Service Contracts

class HistoricalQueryRequest(BaseServiceRequest):
    """Request for historical data"""
    symbol_id: int
    start_time: datetime
    end_time: datetime
    aggregation: Optional[str] = Field(
        default=None,
        description="Time aggregation: 1m, 5m, 15m, 1h, 1d"
    )
    metrics: List[str] = Field(
        default=["oi", "volume", "iv"],
        description="Metrics to retrieve"
    )


class HistoricalQueryResponse(BaseServiceResponse):
    """Response from historical service"""
    data_points: List[Dict[str, Any]]
    total_points: int
    aggregation_used: Optional[str] = None


# Real-time Service Contracts

class RealtimeSubscriptionRequest(BaseServiceRequest):
    """Request to subscribe to real-time updates"""
    symbol_ids: List[int]
    data_types: List[str] = Field(
        default=["option_chain", "analytics"],
        description="Types of data to subscribe to"
    )


class RealtimeDataUpdate(BaseModel):
    """Real-time data update (WebSocket message)"""
    symbol_id: int
    timestamp: datetime
    data_type: str
    data: Dict[str, Any]
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Error Contracts

class ServiceError(BaseModel):
    """Standardized error response"""
    code: str = Field(..., description="Error code (e.g., DB_CONNECTION_ERROR)")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Standard Error Codes

class ErrorCode:
    """Standard error codes across all services"""
    
    # Database errors
    DB_CONNECTION_ERROR = "DB_CONNECTION_ERROR"
    DB_QUERY_ERROR = "DB_QUERY_ERROR"
    DB_TIMEOUT = "DB_TIMEOUT"
    
    # Cache errors
    CACHE_ERROR = "CACHE_ERROR"
    CACHE_MISS = "CACHE_MISS"
    
    # Kafka errors
    KAFKA_PUBLISH_ERROR = "KAFKA_PUBLISH_ERROR"
    KAFKA_CONSUME_ERROR = "KAFKA_CONSUME_ERROR"
    KAFKA_CONNECTION_ERROR = "KAFKA_CONNECTION_ERROR"
    
    # Validation errors
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_INPUT = "INVALID_INPUT"
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD"
    
    # Business logic errors
    SYMBOL_NOT_FOUND = "SYMBOL_NOT_FOUND"
    DATA_NOT_AVAILABLE = "DATA_NOT_AVAILABLE"
    CALCULATION_ERROR = "CALCULATION_ERROR"
    
    # Service errors
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    SERVICE_TIMEOUT = "SERVICE_TIMEOUT"
    CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    
    # Authentication/Authorization
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    INVALID_TOKEN = "INVALID_TOKEN"


# Helper functions

def create_error_response(
    request_id: str,
    service_name: str,
    error_code: str,
    error_message: str,
    details: Optional[Dict] = None
) -> BaseServiceResponse:
    """Create standardized error response"""
    return BaseServiceResponse(
        request_id=request_id,
        status=ServiceStatus.ERROR,
        service_name=service_name,
        error={
            "code": error_code,
            "message": error_message,
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat()
        }
    )


def create_success_response(
    request_id: str,
    service_name: str,
    data: Dict[str, Any]
) -> BaseServiceResponse:
    """Create standardized success response"""
    return BaseServiceResponse(
        request_id=request_id,
        status=ServiceStatus.SUCCESS,
        service_name=service_name,
        data=data
    )

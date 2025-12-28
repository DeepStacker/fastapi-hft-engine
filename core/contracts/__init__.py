"""
API Contracts and Schemas

Standardized request/response schemas for inter-service communication.
"""

from core.contracts.schemas import (
    ServiceStatus,
    BaseServiceRequest,
    BaseServiceResponse,
    AnalyticsRequest,
    AnalyticsResponse,
    StoreDataRequest,
    StoreDataResponse,
    HistoricalQueryRequest,
    HistoricalQueryResponse,
    RealtimeSubscriptionRequest,
    RealtimeDataUpdate,
    ServiceError,
    ErrorCode,
    create_error_response,
    create_success_response
)

__all__ = [
    "ServiceStatus",
    "BaseServiceRequest",
    "BaseServiceResponse",
    "AnalyticsRequest",
    "AnalyticsResponse",
    "StoreDataRequest",
    "StoreDataResponse",
    "HistoricalQueryRequest",
    "HistoricalQueryResponse",
    "RealtimeSubscriptionRequest",
    "RealtimeDataUpdate",
    "ServiceError",
    "ErrorCode",
    "create_error_response",
    "create_success_response"
]

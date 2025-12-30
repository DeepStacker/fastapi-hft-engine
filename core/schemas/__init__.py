"""
Core Schemas Module - Single Source of Truth

This module provides consolidated Pydantic schemas used across all services.
Import from here instead of defining duplicates in each service.
"""

from .common import (
    ErrorResponse,
    PaginatedResponse,
    HealthResponse,
    ResponseWrapper,
    PaginationParams,
)

from .enums import (
    OptionType,
    BuildupType,
    MoneynessType,
    MarketSentiment,
    UserRole,
    ServiceStatus,
)

__all__ = [
    # Common Schemas
    "ErrorResponse",
    "PaginatedResponse", 
    "HealthResponse",
    "ResponseWrapper",
    "PaginationParams",
    # Enums
    "OptionType",
    "BuildupType",
    "MoneynessType",
    "MarketSentiment",
    "UserRole",
    "ServiceStatus",
]

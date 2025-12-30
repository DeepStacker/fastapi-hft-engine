"""
Custom Exception Classes for Stockify Application

Provides a hierarchy of exceptions for better error handling and logging.
Use these instead of bare `Exception` or generic `HTTPException`.

Usage:
    from core.exceptions import (
        StockifyException,
        DatabaseException,
        ExternalAPIException,
        ValidationException,
        AuthenticationException,
    )
"""
from typing import Optional, Dict, Any


class StockifyException(Exception):
    """Base exception for all application errors"""
    
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code or "INTERNAL_ERROR"
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_code": self.error_code,
            "message": self.message,
            "details": self.details
        }


# ============================================================================
# Database Exceptions
# ============================================================================

class DatabaseException(StockifyException):
    """Database operation failed"""
    
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(message, "DATABASE_ERROR", details)


class ConnectionException(DatabaseException):
    """Database connection failed"""
    
    def __init__(self, message: str = "Database connection failed"):
        super().__init__(message)
        self.error_code = "CONNECTION_ERROR"


class QueryException(DatabaseException):
    """Database query failed"""
    
    def __init__(self, message: str, query: Optional[str] = None):
        super().__init__(message, {"query": query[:100] if query else None})
        self.error_code = "QUERY_ERROR"


# ============================================================================
# External API Exceptions
# ============================================================================

class ExternalAPIException(StockifyException):
    """External API call failed"""
    
    def __init__(
        self,
        message: str,
        service: str = "unknown",
        status_code: Optional[int] = None
    ):
        super().__init__(
            message, 
            "EXTERNAL_API_ERROR",
            {"service": service, "status_code": status_code}
        )
        self.service = service
        self.status_code = status_code


class DhanAPIException(ExternalAPIException):
    """Dhan API specific error"""
    
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, "dhan", status_code)
        self.error_code = "DHAN_API_ERROR"


class TimeoutException(ExternalAPIException):
    """API request timed out"""
    
    def __init__(self, message: str = "Request timed out", service: str = "unknown"):
        super().__init__(message, service)
        self.error_code = "TIMEOUT_ERROR"


class RateLimitException(ExternalAPIException):
    """Rate limit exceeded"""
    
    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = 60):
        super().__init__(message, "rate_limiter", 429)
        self.error_code = "RATE_LIMIT_ERROR"
        self.retry_after = retry_after


# ============================================================================
# Validation Exceptions
# ============================================================================

class ValidationException(StockifyException):
    """Input validation failed"""
    
    def __init__(self, message: str, field: Optional[str] = None):
        super().__init__(message, "VALIDATION_ERROR", {"field": field})
        self.field = field


class InvalidSymbolException(ValidationException):
    """Invalid trading symbol"""
    
    def __init__(self, symbol: str):
        super().__init__(f"Invalid symbol: {symbol}", "symbol")
        self.error_code = "INVALID_SYMBOL"


class InvalidExpiryException(ValidationException):
    """Invalid expiry date"""
    
    def __init__(self, expiry: str):
        super().__init__(f"Invalid expiry: {expiry}", "expiry")
        self.error_code = "INVALID_EXPIRY"


# ============================================================================
# Authentication/Authorization Exceptions
# ============================================================================

class AuthenticationException(StockifyException):
    """Authentication failed"""
    
    def __init__(self, message: str = "Authentication required"):
        super().__init__(message, "AUTH_ERROR")


class TokenExpiredException(AuthenticationException):
    """Token has expired"""
    
    def __init__(self):
        super().__init__("Token expired")
        self.error_code = "TOKEN_EXPIRED"


class InvalidTokenException(AuthenticationException):
    """Token is invalid"""
    
    def __init__(self):
        super().__init__("Invalid token")
        self.error_code = "INVALID_TOKEN"


class PermissionDeniedException(StockifyException):
    """User lacks required permissions"""
    
    def __init__(self, resource: str = "resource"):
        super().__init__(
            f"Permission denied for {resource}",
            "PERMISSION_DENIED",
            {"resource": resource}
        )


# ============================================================================
# Business Logic Exceptions
# ============================================================================

class MarketClosedException(StockifyException):
    """Market is closed"""
    
    def __init__(self, message: str = "Market is currently closed"):
        super().__init__(message, "MARKET_CLOSED")


class DataNotFoundException(StockifyException):
    """Requested data not found"""
    
    def __init__(self, resource: str, identifier: Optional[str] = None):
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} '{identifier}' not found"
        super().__init__(message, "NOT_FOUND", {"resource": resource})


class ConfigurationException(StockifyException):
    """Configuration error"""
    
    def __init__(self, message: str, config_key: Optional[str] = None):
        super().__init__(message, "CONFIG_ERROR", {"key": config_key})


# ============================================================================
# Cache Exceptions
# ============================================================================

class CacheException(StockifyException):
    """Cache operation failed"""
    
    def __init__(self, message: str = "Cache operation failed"):
        super().__init__(message, "CACHE_ERROR")


class CacheConnectionException(CacheException):
    """Redis connection failed"""
    
    def __init__(self):
        super().__init__("Redis connection failed")
        self.error_code = "REDIS_CONNECTION_ERROR"

"""
Custom Exception Classes
Standardized exception handling across the application
"""
from typing import Any, Optional, Dict
from fastapi import HTTPException, status


class AppException(HTTPException):
    """Base application exception"""
    
    def __init__(
        self,
        status_code: int,
        detail: str,
        error_code: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.error_code = error_code or f"ERR_{status_code}"


class NotFoundException(AppException):
    """Resource not found exception"""
    
    def __init__(self, resource: str = "Resource", resource_id: Any = None):
        detail = f"{resource} not found"
        if resource_id:
            detail = f"{resource} with ID '{resource_id}' not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="NOT_FOUND"
        )


class UnauthorizedException(AppException):
    """Authentication failed exception"""
    
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="UNAUTHORIZED",
            headers={"WWW-Authenticate": "Bearer"}
        )


class ForbiddenException(AppException):
    """Access forbidden exception"""
    
    def __init__(self, detail: str = "You don't have permission to access this resource"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="FORBIDDEN"
        )


class ValidationException(AppException):
    """Validation error exception"""
    
    def __init__(self, detail: str = "Validation error", errors: Optional[list] = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
            error_code="VALIDATION_ERROR"
        )
        self.errors = errors or []


class ExternalAPIException(AppException):
    """External API call failed"""
    
    def __init__(
        self,
        service: str = "External API",
        detail: str = "External service unavailable",
        status_code: int = status.HTTP_503_SERVICE_UNAVAILABLE
    ):
        super().__init__(
            status_code=status_code,
            detail=f"{service}: {detail}",
            error_code="EXTERNAL_API_ERROR"
        )


class ConfigurationException(AppException):
    """Configuration error exception"""
    
    def __init__(self, detail: str = "Configuration error"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="CONFIG_ERROR"
        )


class RateLimitException(AppException):
    """Rate limit exceeded exception"""
    
    def __init__(self, detail: str = "Rate limit exceeded. Please try again later."):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            error_code="RATE_LIMIT_EXCEEDED"
        )


class DatabaseException(AppException):
    """Database operation exception"""
    
    def __init__(self, detail: str = "Database operation failed"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="DATABASE_ERROR"
        )


class WebSocketException(Exception):
    """WebSocket specific exception"""
    
    def __init__(self, code: int, reason: str):
        self.code = code
        self.reason = reason
        super().__init__(reason)

"""
Production Error Sanitization Middleware

Sanitizes error messages in production to avoid leaking sensitive information.
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import structlog
import traceback
from core.config.settings import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

async def sanitize_error_middleware(request: Request, call_next):
    """
    Middleware to catch and sanitize errors in production
    
    In production:
    - Hides stack traces
    - Sanitizes error messages
    - Logs full errors for debugging
    
    In development:
    - Shows detailed errors for debugging
    """
    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        # Log full error with stack trace
        logger.error(
            "Request failed with exception",
            path=request.url.path,
            method=request.method,
            exc_info=exc
        )
        
        # In production, return sanitized error
        if settings.ENVIRONMENT == "production":
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Internal server error",
                    "detail": "An unexpected error occurred. Please contact support.",
                    "request_id": request.headers.get("X-Request-ID", "N/A")
                }
            )
        else:
            # In development, show detailed error
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": str(exc),
                    "type": type(exc).__name__,
                    "traceback": traceback.format_exc()
                }
            )


def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle validation errors from Pydantic
    
    In production: Sanitize field names and values
    In development: Show detailed validation errors
    """
    if settings.ENVIRONMENT == "production":
        # Sanitized version for production
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Validation error",
                "detail": "Invalid request data. Please check your input.",
                "fields": len(exc.errors())  # Just count, don't expose field names
            }
        )
    else:
        # Detailed version for development
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Validation error",
                "detail": exc.errors(),
                "body": exc.body
            }
        )


def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handle HTTP exceptions
    
    Sanitize error messages in production while preserving status codes
    """
    # Don't sanitize client errors (4xx) as they're user-facing
    if 400 <= exc.status_code < 500:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.detail,
                "status_code": exc.status_code
            }
        )
    
    # Sanitize server errors (5xx) in production
    if settings.ENVIRONMENT == "production" and exc.status_code >= 500:
        logger.error(
            "HTTP exception",
            path=request.url.path,
            status_code=exc.status_code,
            detail=exc.detail
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "Server error",
                "detail": "An error occurred while processing your request.",
                "status_code": exc.status_code
            }
        )
    
    # In development, show full error
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )

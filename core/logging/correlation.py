"""
Request Correlation ID Middleware

Tracks requests across services with unique correlation IDs.
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import uuid
import structlog
from typing import Callable

logger = structlog.get_logger(__name__)


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add correlation ID to all requests
    
    Features:
    - Generates unique ID per request
    - Accepts existing ID from X-Correlation-ID header
    - Adds ID to response headers
    - Binds ID to logger context
    """
    
    async def dispatch(self, request: Request, call_next: Callable):
        """Process request with correlation ID"""
        
        # Get or generate correlation ID
        correlation_id = request.headers.get("X-Correlation-ID")
        
        if not correlation_id:
            correlation_id = str(uuid.uuid4())
            
        # Add to request state
        request.state.correlation_id = correlation_id
        
        # Bind to logger context
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            correlation_id=correlation_id,
            path=request.url.path,
            method=request.method
        )
        
        # Process request
        response = await call_next(request)
        
        # Add correlation ID to response headers
        response.headers["X-Correlation-ID"] = correlation_id
        
        return response


def get_correlation_id(request: Request) -> str:
    """
    Get correlation ID from request
    
    Args:
        request: FastAPI request object
        
    Returns:
        Correlation ID string
    """
    return getattr(request.state, "correlation_id", "unknown")

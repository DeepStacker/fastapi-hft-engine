"""
Correlation ID Middleware - Request tracing across distributed systems

Provides:
- Unique request correlation IDs for tracing
- Request context propagation
- Structured logging with correlation IDs
"""
import uuid
import logging
from typing import Callable, Optional
from contextvars import ContextVar

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Context variable for correlation ID (thread-safe)
correlation_id_var: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)


def get_correlation_id() -> Optional[str]:
    """Get current correlation ID from context"""
    return correlation_id_var.get()


def set_correlation_id(correlation_id: str) -> None:
    """Set correlation ID in context"""
    correlation_id_var.set(correlation_id)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware to generate and propagate correlation IDs.
    
    Features:
    - Generates unique ID for each request
    - Accepts incoming X-Correlation-ID header for distributed tracing
    - Adds correlation ID to response headers
    - Sets context variable for logging
    """
    
    HEADER_NAME = "X-Correlation-ID"
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get existing correlation ID from headers or generate new one
        correlation_id = request.headers.get(self.HEADER_NAME)
        
        if not correlation_id:
            # Generate new correlation ID (compact UUID)
            correlation_id = str(uuid.uuid4())[:12]
        
        # Set in context for logging
        set_correlation_id(correlation_id)
        
        # Store in request state for access in endpoints
        request.state.correlation_id = correlation_id
        
        try:
            response = await call_next(request)
            
            # Add correlation ID to response headers
            response.headers[self.HEADER_NAME] = correlation_id
            
            return response
        finally:
            # Clear context
            correlation_id_var.set(None)


class CorrelationIdFilter(logging.Filter):
    """
    Logging filter to add correlation ID to log records.
    
    Usage:
        handler.addFilter(CorrelationIdFilter())
        formatter = logging.Formatter('%(correlation_id)s - %(message)s')
    """
    
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = get_correlation_id() or "-"
        return True


def setup_correlation_logging():
    """
    Setup logging with correlation ID support.
    
    Call this during application startup to enable correlation ID in logs.
    """
    # Add filter to root logger
    root_logger = logging.getLogger()
    
    for handler in root_logger.handlers:
        handler.addFilter(CorrelationIdFilter())
    
    logger.info("Correlation ID logging enabled")

"""
Enhanced Error Handling Utilities

Provides structured error handling, context tracking, and error classification
for production debugging.
"""

import traceback
from typing import Optional, Dict, Any
from datetime import datetime
import structlog

logger = structlog.get_logger("error-handler")


class ErrorContext:
    """Context information for error tracking"""
    
    def __init__(self, operation: str, **kwargs):
        self.operation = operation
        self.context = kwargs
        self.timestamp = datetime.utcnow()
        self.traceback: Optional[str] = None
        self.error_type: Optional[str] = None
        self.error_message: Optional[str] = None
    
    def capture_exception(self, exc: Exception):
        """Capture exception details"""
        self.error_type = type(exc).__name__
        self.error_message = str(exc)
        self.traceback = traceback.format_exc()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "operation": self.operation,
            "timestamp": self.timestamp.isoformat(),
            "error_type": self.error_type,
            "error_message": self.error_message,
            "context": self.context,
            "traceback": self.traceback
        }


class ErrorHandler:
    """Centralized error handling with context"""
    
    @staticmethod
    async def handle_async(
        operation: str,
        func,
        *args,
        fallback=None,
        raise_on_error=True,
        **kwargs
    ):
        """
        Handle async function with error context.
        
        Args:
            operation: Operation description
            func: Async function to call
            fallback: Fallback value on error
            raise_on_error: Whether to raise exception
            **kwargs: Additional context
            
        Returns:
            Function result or fallback value
        """
        ctx = ErrorContext(operation, **kwargs)
        
        try:
            return await func(*args)
            
        except Exception as e:
            ctx.capture_exception(e)
            
            logger.error(
                f"Operation failed: {operation}",
                error_type=ctx.error_type,
                error=ctx.error_message,
                context=ctx.context,
                exc_info=True
            )
            
            if raise_on_error:
                raise
            
            return fallback
    
    @staticmethod
    def handle_sync(
        operation: str,
        func,
        *args,
        fallback=None,
        raise_on_error=True,
        **kwargs
    ):
        """Synchronous version of handle_async"""
        ctx = ErrorContext(operation, **kwargs)
        
        try:
            return func(*args)
            
        except Exception as e:
            ctx.capture_exception(e)
            
            logger.error(
                f"Operation failed: {operation}",
                error_type=ctx.error_type,
                error=ctx.error_message,
                context=ctx.context,
                exc_info=True
            )
            
            if raise_on_error:
                raise
            
            return fallback


# Decorator for automatic error handling
def handle_errors(operation: str, fallback=None, raise_on_error=True):
    """
    Decorator for automatic error handling.
    
    Usage:
        @handle_errors("fetch_data", fallback={})
        async def fetch_data():
            ...
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            return await ErrorHandler.handle_async(
                operation,
                func,
                *args,
                fallback=fallback,
                raise_on_error=raise_on_error,
                **kwargs
            )
        return wrapper
    return decorator


# Error classification
class ErrorClassifier:
    """Classify errors for appropriate handling"""
    
    RETRYABLE_ERRORS = (
        ConnectionError,
        TimeoutError,
        # Add more retryable types
    )
    
    CRITICAL_ERRORS = (
        MemoryError,
        SystemError,
        # Add more critical types
    )
    
    @classmethod
    def is_retryable(cls, error: Exception) -> bool:
        """Check if error is retryable"""
        return isinstance(error, cls.RETRYABLE_ERRORS)
    
    @classmethod
    def is_critical(cls, error: Exception) -> bool:
        """Check if error is critical"""
        return isinstance(error, cls.CRITICAL_ERRORS)
    
    @classmethod
    def get_severity(cls, error: Exception) -> str:
        """Get error severity level"""
        if cls.is_critical(error):
            return "CRITICAL"
        elif cls.is_retryable(error):
            return "WARNING"
        else:
            return "ERROR"

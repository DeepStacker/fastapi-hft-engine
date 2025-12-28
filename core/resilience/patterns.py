"""
Advanced Resilience Patterns

Provides circuit breaker, bulkhead, and retry mechanisms for robust microservices.
"""

from enum import Enum
from datetime import datetime, timedelta
from typing import Callable, Any, Optional
import asyncio
import random
import structlog

logger = structlog.get_logger("resilience")


# ============================================================================
# Bulkhead Pattern
# ============================================================================

class BulkheadRejection(Exception):
    """Raised when bulkhead rejects request"""
    pass


class Bulkhead:
    """
    Bulkhead pattern for resource isolation
    
    Prevents cascade failures by limiting concurrent operations.
    
    Usage:
        bulkhead = Bulkhead("database-queries", max_concurrent=10)
        result = await bulkhead.execute(db_query_function, arg1, arg2)
    """
    
    def __init__(
        self,
        name: str,
        max_concurrent: int = 10,
        max_queue: int = 100
    ):
        self.name = name
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.max_queue = max_queue
        self.queue_size = 0
        
        # Metrics
        self.total_requests = 0
        self.rejected_requests = 0
        self.concurrent_requests = 0
    
    async def execute(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with bulkhead protection"""
        self.total_requests += 1
        
        # Check queue size
        if self.queue_size >= self.max_queue:
            self.rejected_requests += 1
            logger.warning(f"Bulkhead {self.name} queue full, rejecting request")
            raise BulkheadRejection(f"Bulkhead {self.name} queue is full")
        
        self.queue_size += 1
        
        try:
            async with self.semaphore:
                self.concurrent_requests += 1
                self.queue_size -= 1
                try:
                    return await func(*args, **kwargs)
                finally:
                    self.concurrent_requests -= 1
        except Exception as e:
            logger.error(f"Bulkhead {self.name} execution error: {e}")
            raise
    
    def get_stats(self) -> dict:
        """Get bulkhead statistics"""
        return {
            "name": self.name,
            "total_requests": self.total_requests,
            "rejected_requests": self.rejected_requests,
            "rejection_rate": (
                self.rejected_requests / max(self.total_requests, 1) * 100
            ),
            "concurrent_requests": self.concurrent_requests,
            "queue_size": self.queue_size
        }


# ============================================================================
# Retry Pattern
# ============================================================================

class RetryExhausted(Exception):
    """Raised when all retry attempts exhausted"""
    pass


class RetryPolicy:
    """
    Retry policy with exponential backoff and jitter
    
    Usage:
        policy = RetryPolicy(max_attempts=3, base_delay=1.0)
        result = await policy.execute(api_call_function)
    """
    
    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True
    ):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
    
    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay for attempt with exponential backoff + jitter"""
        delay = min(
            self.base_delay * (self.exponential_base ** attempt),
            self.max_delay
        )
        
        if self.jitter:
            # Add random jitter (±25%)
            jitter_range = delay * 0.25
            delay += random.uniform(-jitter_range, jitter_range)
        
        return max(0, delay)
    
    async def execute(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """Execute function with retry logic"""
        last_exception = None
        
        for attempt in range(self.max_attempts):
            try:
                result = await func(*args, **kwargs)
                
                if attempt > 0:
                    logger.info(f"Retry succeeded on attempt {attempt + 1}")
                
                return result
            
            except Exception as e:
                last_exception = e
                
                if attempt < self.max_attempts - 1:
                    delay = self._calculate_delay(attempt)
                    logger.warning(
                        f"Attempt {attempt + 1} failed, retrying in {delay:.2f}s: {e}"
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"All {self.max_attempts} retry attempts exhausted")
        
        raise RetryExhausted(
            f"Failed after {self.max_attempts} attempts"
        ) from last_exception


# ============================================================================
# Timeout Pattern
# ============================================================================

class TimeoutError(Exception):
    """Raised when operation times out"""
    pass


async def with_timeout(
    func: Callable,
    timeout_seconds: float,
    *args,
    **kwargs
) -> Any:
    """
    Execute function with timeout
    
    Usage:
        result = await with_timeout(slow_function, 5.0, arg1, arg2)
    """
    try:
        return await asyncio.wait_for(
            func(*args, **kwargs),
            timeout=timeout_seconds
        )
    except asyncio.TimeoutError:
        raise TimeoutError(
            f"Operation timed out after {timeout_seconds}s"
        )


# ============================================================================
# Combined Resilience Decorator
# ============================================================================

def resilient(
    circuit_breaker: Optional['CircuitBreaker'] = None,
    bulkhead: Optional[Bulkhead] = None,
    retry_policy: Optional[RetryPolicy] = None,
    timeout: Optional[float] = None
):
    """
    Decorator combining multiple resilience patterns
    
    Usage:
        @resilient(
            circuit_breaker=my_circuit_breaker,
            bulkhead=my_bulkhead,
            retry_policy=RetryPolicy(max_attempts=3),
            timeout=10.0
        )
        async def api_call():
            ...
    """
    def decorator(func: Callable):
        async def wrapper(*args, **kwargs):
            async def execute():
                # Apply circuit breaker
                if circuit_breaker:
                    return await circuit_breaker.call(func, *args, **kwargs)
                return await func(*args, **kwargs)
            
            # Apply bulkhead
            if bulkhead:
                execute = lambda: bulkhead.execute(execute)
            
            # Apply timeout
            if timeout:
                execute_with_timeout = lambda: with_timeout(execute, timeout)
            else:
                execute_with_timeout = execute
            
            # Apply retry
            if retry_policy:
                return await retry_policy.execute(execute_with_timeout)
            
            return await execute_with_timeout()
        
        return wrapper
    return decorator

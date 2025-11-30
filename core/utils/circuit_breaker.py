"""
Circuit Breaker Implementation for External Service Calls

Prevents cascading failures by breaking the circuit when error threshold is reached.
"""
import asyncio
from functools import wraps
from typing import Callable, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger("stockify.circuit_breaker")


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open"""
    pass


class CircuitBreaker:
    """Simple async circuit breaker implementation"""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half_open
        
    def call(self, func: Callable) -> Callable:
        """Decorator to wrap function with circuit breaker"""
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if self.state == "open":
                if self._should_attempt_reset():
                    self.state = "half_open"
                    logger.info(f"Circuit breaker half-open for {func.__name__}")
                else:
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker is open for {func.__name__}"
                    )
            
            try:
                result = await func(*args, **kwargs)
                self._on_success()
                return result
            except self.expected_exception as e:
                self._on_failure()
                raise
        
        return wrapper
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return True
        return datetime.now() - self.last_failure_time > timedelta(seconds=self.recovery_timeout)
    
    def _on_success(self):
        """Handle successful call"""
        self.failure_count = 0
        if self.state == "half_open":
            self.state = "closed"
            logger.info("Circuit breaker closed after successful call")
    
    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "open"
            logger.error(
                f"Circuit breaker opened after {self.failure_count} failures"
            )
    
    def reset(self):
        """Manually reset circuit breaker to closed state"""
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"
        logger.info("Circuit breaker manually reset to closed state")


# Global circuit breakers for different services
# OPTIMIZED: Increased thresholds to handle higher concurrency
dhan_api_breaker = CircuitBreaker(
    failure_threshold=15,  # Increased from 5 to handle 12 concurrent requests
    recovery_timeout=30  # Reduced from 60 for faster recovery
)

# Per-endpoint circuit breakers for better isolation
dhan_option_chain_breaker = CircuitBreaker(failure_threshold=20, recovery_timeout=30)
dhan_expiry_breaker = CircuitBreaker(failure_threshold=10, recovery_timeout=30)
dhan_spot_breaker = CircuitBreaker(failure_threshold=10, recovery_timeout=30)

database_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)
kafka_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)
redis_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=30)

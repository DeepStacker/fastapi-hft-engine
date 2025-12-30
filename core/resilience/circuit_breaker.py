"""
Circuit Breaker Pattern Implementation

Provides fault tolerance for external service calls with automatic
failure detection and recovery.
"""

import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Callable, Optional
import structlog
from core.utils.timezone import get_ist_now

logger = structlog.get_logger("circuit-breaker")


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreaker:
    """
    Circuit breaker for protecting against cascading failures.
    
    Usage:
        breaker = CircuitBreaker(failure_threshold=5, timeout=60)
        
        async with breaker:
            result = await risky_operation()
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        timeout: int = 60,
        expected_exception: type = Exception
    ):
        """
        Args:
            failure_threshold: Number of failures before opening circuit
            timeout: Seconds to wait before attempting recovery
            expected_exception: Exception type to catch
        """
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.expected_exception = expected_exception
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.success_count = 0
    
    async def __aenter__(self):
        """Context manager entry"""
        if self.state == CircuitState.OPEN:
            # Check if timeout elapsed
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                logger.info("Circuit breaker entering HALF_OPEN state")
            else:
                raise CircuitBreakerOpenException(
                    f"Circuit breaker is OPEN. "
                    f"Retry after {self._time_until_reset():.1f}s"
                )
        
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        if exc_type is None:
            # Success
            self._on_success()
        elif issubclass(exc_type, self.expected_exception):
            # Expected failure
            self._on_failure()
        
        # Don't suppress exceptions
        return False
    
    def _on_success(self):
        """Handle successful call"""
        self.failure_count = 0
        
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            
            # Require 3 successes to close circuit
            if self.success_count >= 3:
                self.state = CircuitState.CLOSED
                self.success_count = 0
                logger.info("Circuit breaker CLOSED (recovered)")
        
    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = get_ist_now()
        
        if self.state == CircuitState.HALF_OPEN:
            # Failed during recovery, reopen
            self.state = CircuitState.OPEN
            self.success_count = 0
            logger.warning("Circuit breaker OPEN (recovery failed)")
        
        elif self.failure_count >= self.failure_threshold:
            # Threshold exceeded, open circuit
            self.state = CircuitState.OPEN
            logger.warning(
                "Circuit breaker OPEN",
                failures=self.failure_count,
                threshold=self.failure_threshold
            )
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if not self.last_failure_time:
            return True
        
        elapsed = (get_ist_now() - self.last_failure_time).total_seconds()
        return elapsed >= self.timeout
    
    def _time_until_reset(self) -> float:
        """Time remaining until reset attempt"""
        if not self.last_failure_time:
            return 0.0
        
        elapsed = (get_ist_now() - self.last_failure_time).total_seconds()
        return max(0.0, self.timeout - elapsed)
    
    def allow_request(self) -> bool:
        """
        Check if a request should be allowed.
        Returns True if circuit is closed/half-open, False if open.
        """
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                logger.info("Circuit breaker entering HALF_OPEN state")
                return True
            return False
        return True
    
    def record_success(self):
        """Record a successful call (alias for _on_success)"""
        self._on_success()
    
    def record_failure(self):
        """Record a failed call (alias for _on_failure)"""
        self._on_failure()
    
    def get_state(self) -> dict:
        """Get current circuit breaker state"""
        return {
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "time_until_reset": self._time_until_reset() if self.state == CircuitState.OPEN else None
        }


class CircuitBreakerOpenException(Exception):
    """Raised when circuit breaker is open"""
    pass


# Decorator version for convenience
def circuit_breaker(failure_threshold: int = 5, timeout: int = 60):
    """
    Decorator for circuit breaker pattern.
    
    Usage:
        @circuit_breaker(failure_threshold=5, timeout=60)
        async def fetch_data():
            ...
    """
    breaker = CircuitBreaker(failure_threshold, timeout)
    
    def decorator(func: Callable):
        async def wrapper(*args, **kwargs):
            async with breaker:
                return await func(*args, **kwargs)
        return wrapper
    
    return decorator

"""
Circuit Breaker Pattern for External API Calls

Prevents cascade failures when external APIs (like Dhan) become unavailable.
Implements the three states: CLOSED, OPEN, HALF_OPEN.
"""
import asyncio
import logging
import time
from enum import Enum
from typing import Callable, TypeVar, Optional
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject all calls
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit Breaker implementation for protecting against external service failures.
    
    States:
    - CLOSED: Normal operation, requests go through
    - OPEN: Too many failures, requests are rejected immediately
    - HALF_OPEN: Testing if service recovered, limited requests allowed
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 3,
        success_threshold: int = 2,
    ):
        """
        Initialize circuit breaker.
        
        Args:
            name: Identifier for this circuit breaker
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before trying half-open
            half_open_max_calls: Max calls allowed in half-open state
            success_threshold: Successes needed in half-open to close circuit
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.success_threshold = success_threshold
        
        # State tracking
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[float] = None
        self._half_open_calls = 0
        self._lock = asyncio.Lock()
        
        # Metrics
        self._total_calls = 0
        self._total_failures = 0
        self._total_rejections = 0
    
    @property
    def state(self) -> CircuitState:
        """Current state of the circuit breaker"""
        return self._state
    
    @property
    def is_closed(self) -> bool:
        return self._state == CircuitState.CLOSED
    
    @property
    def is_open(self) -> bool:
        return self._state == CircuitState.OPEN
    
    async def _check_state(self) -> bool:
        """
        Check and potentially transition state.
        Returns True if call should proceed.
        """
        async with self._lock:
            if self._state == CircuitState.CLOSED:
                return True
            
            if self._state == CircuitState.OPEN:
                # Check if recovery timeout has passed
                if self._last_failure_time:
                    elapsed = time.time() - self._last_failure_time
                    if elapsed >= self.recovery_timeout:
                        logger.info(f"Circuit {self.name}: OPEN -> HALF_OPEN")
                        self._state = CircuitState.HALF_OPEN
                        self._half_open_calls = 0
                        self._success_count = 0
                        return True
                
                # Still in timeout, reject
                self._total_rejections += 1
                return False
            
            if self._state == CircuitState.HALF_OPEN:
                # Allow limited calls
                if self._half_open_calls < self.half_open_max_calls:
                    self._half_open_calls += 1
                    return True
                return False
        
        return True
    
    async def _record_success(self):
        """Record a successful call"""
        async with self._lock:
            self._failure_count = 0
            
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.success_threshold:
                    logger.info(f"Circuit {self.name}: HALF_OPEN -> CLOSED")
                    self._state = CircuitState.CLOSED
    
    async def _record_failure(self):
        """Record a failed call"""
        async with self._lock:
            self._failure_count += 1
            self._total_failures += 1
            self._last_failure_time = time.time()
            
            if self._state == CircuitState.HALF_OPEN:
                # Any failure in half-open goes back to open
                logger.warning(f"Circuit {self.name}: HALF_OPEN -> OPEN")
                self._state = CircuitState.OPEN
            elif self._failure_count >= self.failure_threshold:
                logger.warning(f"Circuit {self.name}: CLOSED -> OPEN (threshold reached)")
                self._state = CircuitState.OPEN
    
    async def call(self, func: Callable[..., T], *args, **kwargs) -> T:
        """
        Execute function through circuit breaker.
        
        Raises:
            CircuitOpenError: If circuit is open and call is rejected
        """
        self._total_calls += 1
        
        if not await self._check_state():
            raise CircuitOpenError(
                f"Circuit {self.name} is OPEN. Request rejected."
            )
        
        try:
            result = await func(*args, **kwargs)
            await self._record_success()
            return result
        except Exception as e:
            await self._record_failure()
            raise
    
    def get_stats(self) -> dict:
        """Get circuit breaker statistics"""
        return {
            "name": self.name,
            "state": self._state.value,
            "total_calls": self._total_calls,
            "total_failures": self._total_failures,
            "total_rejections": self._total_rejections,
            "current_failures": self._failure_count,
        }


class CircuitOpenError(Exception):
    """Raised when circuit breaker is open and rejecting calls"""
    pass


def circuit_breaker(breaker: CircuitBreaker):
    """
    Decorator to wrap async function with circuit breaker.
    
    Usage:
        cb = CircuitBreaker("dhan_api")
        
        @circuit_breaker(cb)
        async def call_dhan_api():
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await breaker.call(func, *args, **kwargs)
        return wrapper
    return decorator


# Global circuit breakers for external services
dhan_circuit_breaker = CircuitBreaker(
    name="dhan_api",
    failure_threshold=5,
    recovery_timeout=30.0,
    half_open_max_calls=2,
    success_threshold=2,
)

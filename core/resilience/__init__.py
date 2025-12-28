"""
Resilience Patterns

Advanced resilience patterns for fault-tolerant microservices.
"""

from core.resilience.patterns import (
    BulkheadRejection,
    Bulkhead,
    RetryExhausted,
    RetryPolicy,
    TimeoutError,
    with_timeout,
    resilient
)

# Also expose circuit breaker if it exists
try:
    from core.resilience.circuit_breaker import (
        CircuitBreaker,
        CircuitState,
        CircuitBreakerOpenException
    )
    __all__ = [
        "BulkheadRejection",
        "Bulkhead",
        "RetryExhausted",
        "RetryPolicy",
        "TimeoutError",
        "with_timeout",
        "resilient",
        "CircuitBreaker",
        "CircuitState",
        "CircuitBreakerOpenException"
    ]
except ImportError:
    __all__ = [
        "BulkheadRejection",
        "Bulkhead",
        "RetryExhausted",
        "RetryPolicy",
        "TimeoutError",
        "with_timeout",
        "resilient"
    ]

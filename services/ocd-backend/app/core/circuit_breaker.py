"""
Circuit Breaker - Re-export from core

This module re-exports the circuit breaker implementation from core.resilience
for backward compatibility. All new code should import directly from core.resilience.
"""
from core.resilience.circuit_breaker import (
    CircuitBreaker,
    CircuitState,
)

# Create service-specific circuit breakers
dhan_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    timeout=30,
)

# Backward compatibility aliases
CircuitOpenError = Exception  # Placeholder for compatibility


__all__ = [
    "CircuitBreaker",
    "CircuitState", 
    "CircuitOpenError",
    "dhan_circuit_breaker",
]

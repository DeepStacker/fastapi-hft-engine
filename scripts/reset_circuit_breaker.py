#!/usr/bin/env python3
"""
Script to manually reset circuit breakers

Run this when circuit breakers are stuck in open state.
"""
from core.utils.circuit_breaker import dhan_api_breaker, dhan_option_chain_breaker, dhan_expiry_breaker, dhan_spot_breaker
from core.logging.logger import configure_logger, get_logger

configure_logger()
logger = get_logger("reset_circuit_breaker")

def reset_all_breakers():
    """Reset all circuit breakers to closed state"""
    breakers = [
        ("dhan_api_breaker", dhan_api_breaker),
        ("dhan_option_chain_breaker", dhan_option_chain_breaker),
        ("dhan_expiry_breaker", dhan_expiry_breaker),
        ("dhan_spot_breaker", dhan_spot_breaker)
    ]
    
    for name, breaker in breakers:
        logger.info(f"Resetting {name} (current state: {breaker.state}, failures: {breaker.failure_count})")
        breaker.reset()
    
    logger.info("All circuit breakers reset successfully!")

if __name__ == "__main__":
    reset_all_breakers()

"""
Retry Mechanism with Exponential Backoff and Jitter

Automatically retries failed operations with increasing delays to prevent
thundering herd problem and give systems time to recover.

Features:
- Exponential backoff (1s, 2s, 4s, 8s, ...)
- Jitter to prevent synchronized retries
- Configurable max attempts and delay
- Exception filtering

Usage:
    @retry(max_attempts=3, backoff=exponential_with_jitter)
    async def fetch_data():
        return await external_api.get()
    
    # Or manual:
    result = await retry_with_backoff(
        func=fetch_data,
        max_attempts=3
    )
"""

import asyncio
import random
from typing import Callable, Any, Optional, Tuple, Type
from functools import wraps
from core.logging.logger import get_logger

logger = get_logger(__name__)


def exponential_backoff(attempt: int, base_delay: float = 1.0, max_delay: float = 60.0) -> float:
    """
    Calculate exponential backoff delay.
    
    Args:
        attempt: Current attempt number (0-indexed)
        base_delay: Base delay in seconds
        max_delay: Maximum delay cap
        
    Returns:
        Delay in seconds (1s, 2s, 4s, 8s, 16s, ...)
    """
    delay = min(base_delay * (2 ** attempt), max_delay)
    return delay


def exponential_with_jitter(attempt: int, base_delay: float = 1.0, max_delay: float = 60.0) -> float:
    """
    Calculate exponential backoff with jitter (recommended).
    
    Jitter prevents thundering herd where all clients retry simultaneously.
    
    Args:
        attempt: Current attempt number (0-indexed)
        base_delay: Base delay in seconds
        max_delay: Maximum delay cap
        
    Returns:
        Delay in seconds with random jitter
    """
    delay = exponential_backoff(attempt, base_delay, max_delay)
    # Add ±25% jitter
    jitter = delay * 0.25 * (2 * random.random() - 1)
    return max(0, delay + jitter)


def linear_backoff(attempt: int, base_delay: float = 1.0, max_delay: float = 10.0) -> float:
    """
    Calculate linear backoff delay.
    
    Args:
        attempt: Current attempt number (0-indexed)
        base_delay: Base delay in seconds
        max_delay: Maximum delay cap
        
    Returns:
        Delay in seconds (1s, 2s, 3s, 4s, ...)
    """
    delay = base_delay * (attempt + 1)
    return min(delay, max_delay)


async def retry_with_backoff(
    func: Callable,
    max_attempts: int = 3,
    backoff: Callable[[int], float] = exponential_with_jitter,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable[[Exception, int, float], None]] = None
) -> Any:
    """
    Retry a coroutine with backoff strategy.
    
    Args:
        func: Async function to retry
        max_attempts: Maximum number of attempts
        backoff: Backoff strategy function
        exceptions: Tuple of exceptions to catch and retry
        on_retry: Optional callback called on each retry
        
    Returns:
        Result from successful execution
        
    Raises:
        Exception: Last exception if all attempts fail
    """
    last_exception = None
    
    for attempt in range(max_attempts):
        try:
            result = await func()
            
            if attempt > 0:
                logger.info(f"Retry successful after {attempt} attempts")
            
            return result
            
        except exceptions as e:
            last_exception = e
            
            if attempt < max_attempts - 1:
                delay = backoff(attempt)
                
                logger.warning(
                    f"Attempt {attempt + 1}/{max_attempts} failed: {str(e)}, "
                    f"retrying in {delay:.2f}s"
                )
                
                if on_retry:
                    on_retry(e, attempt, delay)
                
                await asyncio.sleep(delay)
            else:
                logger.error(
                    f"All {max_attempts} attempts failed: {str(e)}"
                )
    
    # All attempts exhausted
    raise last_exception


def retry(
    max_attempts: int = 3,
    backoff: Callable[[int], float] = exponential_with_jitter,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    base_delay: float = 1.0,
    max_delay: float = 60.0
):
    """
    Decorator for async functions with retry logic.
    
    Usage:
        @retry(max_attempts=5, backoff=exponential_with_jitter)
        async def fetch_data():
            return await external_api.get()
    
    Args:
        max_attempts: Maximum retry attempts
        backoff: Backoff strategy function
        exceptions: Tuple of exceptions to retry on
        base_delay: Base delay for backoff calculation
        max_delay: Maximum delay cap
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            
            # Create backoff function with configured delays
            def backoff_func(attempt: int) -> float:
                return backoff(attempt, base_delay, max_delay)
            
            for attempt in range(max_attempts):
                try:
                    result = await func(*args, **kwargs)
                    
                    if attempt > 0:
                        logger.info(
                            f"{func.__name__} successful after {attempt} retries"
                        )
                    
                    return result
                    
                except exceptions as e:
                    last_exception = e
                    
                    if attempt < max_attempts - 1:
                        delay = backoff_func(attempt)
                        
                        logger.warning(
                            f"{func.__name__} attempt {attempt + 1}/{max_attempts} "
                            f"failed: {str(e)}, retrying in {delay:.2f}s"
                        )
                        
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"{func.__name__} failed after {max_attempts} attempts: {str(e)}"
                        )
            
            raise last_exception
        
        return wrapper
    
    return decorator


class RetryConfig:
    """Configuration for retry behavior"""
    
    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        backoff_strategy: str = "exponential_jitter",
        retry_exceptions: Tuple[Type[Exception], ...] = (Exception,)
    ):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.retry_exceptions = retry_exceptions
        
        # Select backoff strategy
        if backoff_strategy == "exponential":
            self.backoff_func = exponential_backoff
        elif backoff_strategy == "exponential_jitter":
            self.backoff_func = exponential_with_jitter
        elif backoff_strategy == "linear":
            self.backoff_func = linear_backoff
        else:
            raise ValueError(f"Unknown backoff strategy: {backoff_strategy}")
    
    def get_delay(self, attempt: int) -> float:
        """Get delay for given attempt number"""
        return self.backoff_func(attempt, self.base_delay, self.max_delay)
    
    async def execute(self, func: Callable) -> Any:
        """Execute function with retry logic"""
        return await retry_with_backoff(
            func=func,
            max_attempts=self.max_attempts,
            backoff=lambda attempt: self.get_delay(attempt),
            exceptions=self.retry_exceptions
        )


# Pre-configured retry strategies
AGGRESSIVE_RETRY = RetryConfig(
    max_attempts=5,
    base_delay=0.5,
    max_delay=30.0,
    backoff_strategy="exponential_jitter"
)

MODERATE_RETRY = RetryConfig(
    max_attempts=3,
    base_delay=1.0,
    max_delay=60.0,
    backoff_strategy="exponential_jitter"
)

CONSERVATIVE_RETRY = RetryConfig(
    max_attempts=2,
    base_delay=2.0,
    max_delay=10.0,
    backoff_strategy="linear"
)

"""
Rate Limiter

Redis-based rate limiting for API requests.
Implements sliding window algorithm for accurate rate limiting.
"""

import redis.asyncio as redis
from datetime import datetime
import structlog

from core.config.settings import settings

logger = structlog.get_logger("rate-limiter")

# Redis client (initialized on startup)
redis_client: redis.Redis = None


async def initialize_redis():
    """Initialize Redis connection for rate limiting"""
    global redis_client
    redis_client = await redis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True
    )
    logger.info("Rate limiter Redis initialized")


async def check_rate_limit(
    key: str,
    limit: int,
    window_seconds: int = 60
) -> bool:
    """
    Check if rate limit is exceeded using sliding window.
    
    Args:
        key: Unique key for rate limit (e.g., 'ratelimit:min:api_key')
        limit: Maximum requests allowed
        window_seconds: Time window in seconds
        
    Returns:
        True if limit exceeded, False otherwise
    """
    try:
        now = datetime.utcnow().timestamp()
        window_start = now - window_seconds
        
        # Use sorted set for sliding window
        pipe = redis_client.pipeline()
        
        # Remove old entries
        pipe.zremrangebyscore(key, 0, window_start)
        
        # Count requests in current window
        pipe.zcard(key)
        
        # Add current request
        pipe.zadd(key, {str(now): now})
        
        # Set expiration
        pipe.expire(key, window_seconds)
        
        # Execute pipeline
        results = await pipe.execute()
        
        # results[1] is the count before adding current request
        current_count = results[1]
        
        # Check if limit exceeded
        if current_count >= limit:
            logger.debug(f"Rate limit exceeded for key: {key} ({current_count}/{limit})")
            return True
        
        return False
        
    except Exception as e:
        logger.error(f"Error in rate limiter: {e}", exc_info=True)
        # Fail open (don't block on error)
        return False


async def get_rate_limit_info(key: str, window_seconds: int = 60) -> dict:
    """
    Get current rate limit status.
    
    Args:
        key: Rate limit key
        window_seconds: Time window
        
    Returns:
        Dict with current count and reset time
    """
    try:
        now = datetime.utcnow().timestamp()
        window_start = now - window_seconds
        
        # Remove old entries
        await redis_client.zremrangebyscore(key, 0, window_start)
        
        # Get current count
        count = await redis_client.zcard(key)
        
        # Get oldest entry to calculate reset time
        oldest = await redis_client.zrange(key, 0, 0, withscores=True)
        
        if oldest:
            reset_at = oldest[0][1] + window_seconds
        else:
            reset_at = now + window_seconds
        
        return {
            'current': count,
            'reset_at': reset_at,
            'reset_in_seconds': int(reset_at - now)
        }
        
    except Exception as e:
        logger.error(f"Error getting rate limit info: {e}")
        return {'current': 0, 'reset_at': now, 'reset_in_seconds': 0}


async def reset_rate_limit(key: str):
    """
    Reset rate limit for a key (for testing or manual override).
    
    Args:
        key: Rate limit key to reset
    """
    try:
        await redis_client.delete(key)
        logger.info(f"Rate limit reset for key: {key}")
    except Exception as e:
        logger.error(f"Error resetting rate limit: {e}")

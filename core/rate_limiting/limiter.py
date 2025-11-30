"""
Rate Limiter with Multiple Time Windows

Provides rate limiting with per-minute and per-day windows
using Redis sorted sets (sliding window algorithm).
"""

import time
from typing import Tuple
from redis import asyncio as aioredis
import structlog

logger = structlog.get_logger("rate-limiter")


class RateLimiter:
    """
    Multi-window rate limiter using Redis sorted sets.
    
    Supports both per-minute and per-day limits with sliding windows.
    """
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
    
    async def check_rate_limit(
        self,
        key: str,
        limit_per_minute: int,
        limit_per_day: int
    ) -> Tuple[bool, dict]:
        """
        Check if request is within rate limits.
        
        Args:
            key: Unique identifier (e.g., API key or IP)
            limit_per_minute: Max requests per minute
            limit_per_day: Max requests per day
            
        Returns:
            Tuple of (allowed: bool, info: dict)
        """
        current_time = time.time()
        
        # Check minute window
        minute_key = f"rate_limit:{key}:minute"
        minute_window = 60  # seconds
        
        # Check day window
        day_key = f"rate_limit:{key}:day"
        day_window = 86400  # seconds
        
        # Remove old entries and count current requests
        pipe = self.redis.pipeline()
        
        # Minute window
        pipe.zremrangebyscore(minute_key, 0, current_time - minute_window)
        pipe.zcard(minute_key)
        pipe.zadd(minute_key, {str(current_time): current_time})
        pipe.expire(minute_key, minute_window)
        
        # Day window
        pipe.zremrangebyscore(day_key, 0, current_time - day_window)
        pipe.zcard(day_key)
        pipe.zadd(day_key, {str(current_time): current_time})
        pipe.expire(day_key, day_window)
        
        results = await pipe.execute()
        
        minute_count = results[1]  # Count before adding
        day_count = results[5]  # Count before adding
        
        # Check limits
        minute_exceeded = minute_count >= limit_per_minute
        day_exceeded = day_count >= limit_per_day
        
        allowed = not (minute_exceeded or day_exceeded)
        
        # Calculate reset times
        minute_reset = int(current_time + minute_window)
        day_reset = int(current_time + day_window)
        
        info = {
            "allowed": allowed,
            "minute": {
                "limit": limit_per_minute,
                "remaining": max(0, limit_per_minute - minute_count - 1),
                "reset": minute_reset
            },
            "day": {
                "limit": limit_per_day if limit_per_day else None,
                "remaining": max(0, limit_per_day - day_count - 1) if limit_per_day else None,
                "reset": day_reset if limit_per_day else None
            },
            "exceeded_limit": "minute" if minute_exceeded else ("day" if day_exceeded else None)
        }
        
        if not allowed:
            logger.warning(
                "Rate limit exceeded",
                key=key,
                minute_count=minute_count,
                day_count=day_count,
                exceeded=info["exceeded_limit"]
            )
        
        return allowed, info
    
    async def reset_limits(self, key: str):
        """Reset all rate limits for a key"""
        await self.redis.delete(
            f"rate_limit:{key}:minute",
            f"rate_limit:{key}:day"
        )
        logger.info(f"Rate limits reset for key: {key}")


# Dependency for admin endpoint rate limiting
async def admin_rate_limit(
    request,
    redis_client: aioredis.Redis
):
    """
    Rate limiting dependency for admin endpoints.
    
    Limits: 100 requests/minute for admin operations
    """
    # Use IP address as key for admin endpoints
    client_ip = request.client.host
    
    rate_limiter = RateLimiter(redis_client)
    allowed, info = await rate_limiter.check_rate_limit(
        key=f"admin:{client_ip}",
        limit_per_minute=100,
        limit_per_day=10000
    )
    
    if not allowed:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=429,
            detail=f"Admin rate limit exceeded. Try again in {info['minute']['reset'] - time.time():.0f}s",
            headers={
                "X-RateLimit-Limit": str(info['minute']['limit']),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(info['minute']['reset']),
                "Retry-After": str(int(info['minute']['reset'] - time.time()))
            }
        )
    
    return info

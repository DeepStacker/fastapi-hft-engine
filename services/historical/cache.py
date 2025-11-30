"""
Redis Cache Layer for Historical Service

Implements intelligent caching with TTL strategies.
"""

import redis.asyncio as redis
import json
from datetime import datetime, timedelta
from typing import Optional, Any
import structlog

from core.config.settings import settings

logger = structlog.get_logger("historical-cache")


class HistoricalCache:
    """
    Redis-based caching for historical queries.
    
    Strategy:
    - Recent data (last 1 hour): 1-minute TTL
    - Recent data (last 24 hours): 5-minute TTL
    - Historical data (>1 day old): 1-hour TTL
    - Very old data (>7 days): 24-hour TTL
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.enabled = True
        
    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = await redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Historical cache initialized")
        except Exception as e:
            logger.error(f"Failed to initialize cache: {e}")
            self.enabled = False
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get cached value.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None
        """
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            value = await self.redis_client.get(key)
            if value:
                logger.debug(f"Cache hit: {key}")
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ):
        """
        Set cached value with TTL.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
        """
        if not self.enabled or not self.redis_client:
            return
        
        try:
            serialized = json.dumps(value)
            if ttl:
                await self.redis_client.setex(key, ttl, serialized)
            else:
                await self.redis_client.set(key, serialized)
            logger.debug(f"Cache set: {key} (TTL: {ttl}s)")
        except Exception as e:
            logger.error(f"Cache set error: {e}")
    
    def calculate_ttl(self, from_time: datetime) -> int:
        """
        Calculate appropriate TTL based on data age.
        
        Args:
            from_time: Query start time
            
        Returns:
            TTL in seconds
        """
        from datetime import timezone
        now = datetime.now(timezone.utc)
        if from_time.tzinfo is None:
             from_time = from_time.replace(tzinfo=timezone.utc)
        age = now - from_time
        
        if age < timedelta(hours=1):
            # Very recent: 1 minute TTL
            return 60
        elif age < timedelta(hours=24):
            # Recent: 5 minute TTL
            return 300
        elif age < timedelta(days=7):
            # Historical: 1 hour TTL
            return 3600
        else:
            # Very old: 24 hour TTL
            return 86400
    
    def make_cache_key(
        self,
        endpoint: str,
        **params
    ) -> str:
        """
        Generate cache key from endpoint and parameters.
        
        Args:
            endpoint: API endpoint name
            **params: Query parameters
            
        Returns:
            Cache key string
        """
        # Sort params for consistent keys
        param_str = ":".join(
            f"{k}={v}"
            for k, v in sorted(params.items())
            if v is not None
        )
        return f"historical:{endpoint}:{param_str}"
    
    async def invalidate_pattern(self, pattern: str):
        """
        Invalidate all keys matching pattern.
        
        Args:
            pattern: Redis key pattern
        """
        if not self.enabled or not self.redis_client:
            return
        
        try:
            cursor = 0
            while True:
                cursor, keys = await self.redis_client.scan(
                    cursor,
                    match=pattern,
                    count=100
                )
                if keys:
                    await self.redis_client.delete(*keys)
                if cursor == 0:
                    break
            logger.info(f"Invalidated cache pattern: {pattern}")
        except Exception as e:
            logger.error(f"Cache invalidation error: {e}")
    
    async def get_stats(self) -> dict:
        """Get cache statistics"""
        if not self.enabled or not self.redis_client:
            return {"enabled": False}
        
        try:
            info = await self.redis_client.info("stats")
            return {
                "enabled": True,
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "hit_rate": (
                    info.get("keyspace_hits", 0) /
                    max(1, info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0))
                ) * 100
            }
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {"enabled": True, "error": str(e)}


# Global cache instance
cache = HistoricalCache()

import json
from typing import Any, Optional, Union
import redis.asyncio as redis
from core.config.settings import get_settings
import logging
from datetime import datetime

logger = logging.getLogger("stockify.admin.cache")
settings = get_settings()

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

class CacheService:
    """
    Redis Cache Service for Admin API
    
    Implements Read-Aside and Write-Through caching patterns.
    """
    def __init__(self):
        self.redis: redis.Redis = None
        
    async def connect(self):
        """Initialize Redis connection"""
        if not self.redis:
            self.redis = await redis.from_url(settings.REDIS_URL, decode_responses=True)
            logger.info("Cache service connected to Redis")
            
    async def close(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.redis:
            await self.connect()
            
        try:
            data = await self.redis.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Cache get error for {key}: {e}")
            return None
            
    async def set(self, key: str, value: Any, ttl: int = 3600):
        """Set value in cache with TTL"""
        if not self.redis:
            await self.connect()
            
        try:
            await self.redis.set(key, json.dumps(value, cls=DateTimeEncoder), ex=ttl)
        except Exception as e:
            logger.error(f"Cache set error for {key}: {e}")
            
    async def delete(self, key: str):
        """Delete value from cache"""
        if not self.redis:
            await self.connect()
            
        try:
            await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Cache delete error for {key}: {e}")
            
    async def invalidate_pattern(self, pattern: str):
        """Invalidate all keys matching pattern"""
        if not self.redis:
            await self.connect()
            
        try:
            keys = await self.redis.keys(pattern)
            if keys:
                await self.redis.delete(*keys)
                logger.info(f"Invalidated {len(keys)} keys matching {pattern}")
        except Exception as e:
            logger.error(f"Cache invalidation error for {pattern}: {e}")

# Singleton instance
cache_service = CacheService()

"""
Redis Cache Manager

Provides caching layer for expensive queries and calculations.
Supports TTL, key patterns, and cache invalidation.
"""

import redis.asyncio as redis
from redis.asyncio import Redis
import json
import pickle
from typing import Optional, Any, List
from datetime import timedelta
import structlog
from core.config.settings import settings

logger = structlog.get_logger("cache-manager")


class CacheManager:
    """
    Redis-based cache manager with async support.
    
    Features:
    - Automatic serialization (JSON/pickle)
    - TTL support
    - Key patterns for batch operations
    - Cache statistics
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize cache manager.
        
        Args:
            redis_url: Redis connection URL (defaults to settings)
        """
        self.redis_url = redis_url or getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')
        self.redis: Optional[Redis] = None
        self._stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0
        }
    
    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self.redis = await redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=False  # We'll handle decoding
            )
            await self.redis.ping()
            logger.info("Cache manager initialized", redis_url=self.redis_url)
        except Exception as e:
            logger.error(f"Failed to initialize cache: {e}")
            raise
    
    async def close(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            logger.info("Cache manager closed")
    
    async def get(self, key: str, deserialize: str = 'json') -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            deserialize: Deserialization method ('json' or 'pickle')
            
        Returns:
            Cached value or None if not found
        """
        if not self.redis:
            return None
        
        try:
            value = await self.redis.get(key)
            if value is None:
                self._stats['misses'] += 1
                return None
            
            self._stats['hits'] += 1
            
            # Deserialize
            if deserialize == 'json':
                return json.loads(value)
            elif deserialize == 'pickle':
                return pickle.loads(value)
            else:
                return value.decode('utf-8')
                
        except Exception as e:
            logger.error(f"Cache get error: {e}", key=key)
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = 60,
        serialize: str = 'json'
    ) -> bool:
        """
        Set value in cache with TTL.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds
            serialize: Serialization method ('json' or 'pickle')
            
        Returns:
            True if successful
        """
        if not self.redis:
            return False
        
        try:
            # Serialize
            if serialize == 'json':
                serialized = json.dumps(value)
            elif serialize == 'pickle':
                serialized = pickle.dumps(value)
            else:
                serialized = str(value)
            
            await self.redis.setex(
                key,
                timedelta(seconds=ttl),
                serialized
            )
            
            self._stats['sets'] += 1
            return True
            
        except Exception as e:
            logger.error(f"Cache set error: {e}", key=key)
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Delete key from cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if deleted
        """
        if not self.redis:
            return False
        
        try:
            result = await self.redis.delete(key)
            self._stats['deletes'] += 1
            return result > 0
        except Exception as e:
            logger.error(f"Cache delete error: {e}", key=key)
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern.
        
        Args:
            pattern: Key pattern (e.g., "pcr:*")
            
        Returns:
            Number of keys deleted
        """
        if not self.redis:
            return 0
        
        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)
            
            if keys:
                deleted = await self.redis.delete(*keys)
                self._stats['deletes'] += deleted
                return deleted
            return 0
            
        except Exception as e:
            logger.error(f"Cache delete pattern error: {e}", pattern=pattern)
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.redis:
            return False
        
        try:
            return await self.redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Cache exists error: {e}", key=key)
            return False
    
    async def get_stats(self) -> dict:
        """Get cache statistics"""
        total_ops = self._stats['hits'] + self._stats['misses']
        hit_rate = (self._stats['hits'] / total_ops * 100) if total_ops > 0 else 0
        
        return {
            'hits': self._stats['hits'],
            'misses': self._stats['misses'],
            'sets': self._stats['sets'],
            'deletes': self._stats['deletes'],
            'hit_rate_pct': round(hit_rate, 2),
            'total_operations': total_ops
        }
    
    def build_key(self, *parts: str) -> str:
        """
        Build cache key from parts.
        
        Example:
            build_key("pcr", "13", "2025-12-05") -> "pcr:13:2025-12-05"
        """
        return ":".join(str(p) for p in parts)


# Singleton instance
cache_manager = CacheManager()


# Decorator for caching function results
def cached(ttl: int = 60, key_prefix: str = ""):
    """
    Decorator to cache function results.
    
    Usage:
        @cached(ttl=120, key_prefix="analytics")
        async def expensive_operation(param1, param2):
            # ... expensive computation
            return result
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Build cache key from function name and arguments
            key_parts = [key_prefix, func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = cache_manager.build_key(*key_parts)
            
            # Try cache first
            cached_result = await cache_manager.get(cache_key)
            if cached_result is not None:
                logger.debug("Cache hit", key=cache_key)
                return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            await cache_manager.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator

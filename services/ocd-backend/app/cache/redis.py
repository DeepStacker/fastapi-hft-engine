"""
Redis Cache Service - Centralized caching layer
Provides async caching with automatic serialization and connection pooling
"""
import json
import logging
from typing import Optional, Any, Union
from datetime import timedelta

import redis.asyncio as redis
from redis.asyncio import Redis
from redis.asyncio.connection import ConnectionPool

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Global Redis connection pool with limits for high concurrency
_redis_pool: Optional[Redis] = None
_connection_pool: Optional[ConnectionPool] = None

# Pool settings for millions of connections
REDIS_POOL_MIN_SIZE = 10
REDIS_POOL_MAX_SIZE = getattr(settings, 'REDIS_POOL_MAX_SIZE', 100)


async def init_redis() -> Redis:
    """
    Initialize Redis with proper connection pooling.
    
    For high concurrency:
    - Uses connection pool with max limits
    - Supports Redis Cluster URLs (redis+cluster://)
    - Connection health checks enabled
    """
    global _redis_pool, _connection_pool
    
    if _redis_pool is None:
        redis_url = settings.REDIS_URL
        
        # Check for cluster mode
        if redis_url.startswith("redis+cluster://"):
            # Redis Cluster support
            from redis.asyncio.cluster import RedisCluster
            cluster_url = redis_url.replace("redis+cluster://", "redis://")
            _redis_pool = RedisCluster.from_url(
                cluster_url,
                decode_responses=True,
            )
            logger.info("Redis Cluster connection initialized")
        else:
            # Single node with connection pooling
            _connection_pool = ConnectionPool.from_url(
                redis_url,
                max_connections=REDIS_POOL_MAX_SIZE,
                decode_responses=True,
                health_check_interval=30,
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
                retry_on_timeout=True,
            )
            _redis_pool = Redis(connection_pool=_connection_pool)
            logger.info(f"Redis connection pool initialized (max: {REDIS_POOL_MAX_SIZE})")
    
    return _redis_pool


async def close_redis() -> None:
    """Close Redis connection pool"""
    global _redis_pool, _connection_pool
    
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
    if _connection_pool:
        await _connection_pool.disconnect()
        _connection_pool = None
    logger.info("Redis connection pool closed")


async def get_redis_connection() -> Redis:
    """Get Redis connection from pool"""
    if _redis_pool is None:
        await init_redis()
    return _redis_pool


async def get_pool_stats() -> dict:
    """Get connection pool statistics"""
    if _connection_pool:
        return {
            "max_connections": _connection_pool.max_connections,
            "current_connections": len(_connection_pool._available_connections) + len(_connection_pool._in_use_connections),
            "available": len(_connection_pool._available_connections),
            "in_use": len(_connection_pool._in_use_connections),
        }
    return {"cluster_mode": True}


class RedisCache:
    """Redis cache service with typed operations"""
    
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
    
    async def get(self, key: str) -> Optional[str]:
        """Get string value from cache"""
        try:
            return await self.redis.get(key)
        except Exception as e:
            logger.error(f"Redis GET error for key {key}: {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: Union[str, dict, list],
        ttl: Optional[int] = None
    ) -> bool:
        """
        Set value in cache with optional TTL.
        
        Args:
            key: Cache key
            value: Value to cache (string, dict, or list)
            ttl: Time to live in seconds
        """
        try:
            # Serialize complex types
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            
            if ttl:
                await self.redis.setex(key, ttl, value)
            else:
                await self.redis.set(key, value)
            return True
        except Exception as e:
            logger.error(f"Redis SET error for key {key}: {e}")
            return False
    
    async def get_json(self, key: str) -> Optional[Any]:
        """Get JSON value from cache"""
        try:
            value = await self.redis.get(key)
            if value:
                return json.loads(value)
            return None
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON in cache for key {key}")
            return None
        except Exception as e:
            logger.error(f"Redis GET JSON error for key {key}: {e}")
            return None
    
    async def set_json(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Set JSON value in cache"""
        return await self.set(key, json.dumps(value), ttl)
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis DELETE error for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)
            
            if keys:
                await self.redis.delete(*keys)
            return len(keys)
        except Exception as e:
            logger.error(f"Redis DELETE PATTERN error for {pattern}: {e}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        try:
            return await self.redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Redis EXISTS error for key {key}: {e}")
            return False
    
    async def expire(self, key: str, ttl: int) -> bool:
        """Set expiration on existing key"""
        try:
            return await self.redis.expire(key, ttl)
        except Exception as e:
            logger.error(f"Redis EXPIRE error for key {key}: {e}")
            return False
    
    async def incr(self, key: str) -> int:
        """Increment integer value"""
        try:
            return await self.redis.incr(key)
        except Exception as e:
            logger.error(f"Redis INCR error for key {key}: {e}")
            return 0
    
    async def decr(self, key: str) -> int:
        """Decrement integer value"""
        try:
            return await self.redis.decr(key)
        except Exception as e:
            logger.error(f"Redis DECR error for key {key}: {e}")
            return 0
    
    async def hget(self, name: str, key: str) -> Optional[str]:
        """Get hash field value"""
        try:
            return await self.redis.hget(name, key)
        except Exception as e:
            logger.error(f"Redis HGET error for {name}:{key}: {e}")
            return None
    
    async def hset(self, name: str, key: str, value: str) -> bool:
        """Set hash field value"""
        try:
            await self.redis.hset(name, key, value)
            return True
        except Exception as e:
            logger.error(f"Redis HSET error for {name}:{key}: {e}")
            return False
    
    async def hgetall(self, name: str) -> dict:
        """Get all hash fields"""
        try:
            return await self.redis.hgetall(name)
        except Exception as e:
            logger.error(f"Redis HGETALL error for {name}: {e}")
            return {}
    
    async def ping(self) -> bool:
        """Check Redis connection"""
        try:
            await self.redis.ping()
            return True
        except Exception as e:
            logger.error(f"Redis PING error: {e}")
            return False
    
    async def clear_all(self) -> bool:
        """Clear all cache (use with caution!)"""
        try:
            await self.redis.flushdb()
            logger.warning("Redis cache cleared")
            return True
        except Exception as e:
            logger.error(f"Redis FLUSHDB error: {e}")
            return False
    
    async def info(self, section: str = None) -> dict:
        """Get Redis server info"""
        try:
            return await self.redis.info(section) if section else await self.redis.info()
        except Exception as e:
            logger.error(f"Redis INFO error: {e}")
            return {}


# Cache key generators
class CacheKeys:
    """Standardized cache key generators"""
    
    @staticmethod
    def user(firebase_uid: str) -> str:
        return f"user:{firebase_uid}"
    
    @staticmethod
    def config(key: str) -> str:
        return f"config:{key}"
    
    @staticmethod
    def expiry(symbol: str) -> str:
        return f"expiry:{symbol}"
    
    @staticmethod
    def options_chain(symbol: str, expiry: str) -> str:
        return f"chain:{symbol}:{expiry}"
    
    @staticmethod
    def live_data(symbol: str, expiry: str) -> str:
        return f"live:{symbol}:{expiry}"
    
    @staticmethod
    def rate_limit(ip: str, endpoint: str) -> str:
        return f"ratelimit:{ip}:{endpoint}"


async def get_redis() -> RedisCache:
    """Dependency that provides Redis cache instance"""
    redis_client = await get_redis_connection()
    return RedisCache(redis_client)

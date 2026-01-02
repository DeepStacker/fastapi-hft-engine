"""
Redis Client Factory - Single Source of Truth

All services should use this factory for Redis connections.
Eliminates duplicate client creation and ensures consistent configuration.
"""
import logging
from typing import Optional
from redis import asyncio as aioredis
from core.config.settings import get_settings
from core.cache.manager import CacheManager

# Alias for compatibility with BaseDhanClient
RedisCache = CacheManager

settings = get_settings()
logger = logging.getLogger("redis_factory")

# Singleton client instance
_redis_client: Optional[aioredis.Redis] = None


async def get_redis_client(
    url: Optional[str] = None,
    max_connections: Optional[int] = None,
    decode_responses: bool = True,
) -> aioredis.Redis:
    """
    Get shared Redis client instance with connection pooling.
    
    Args:
        url: Redis URL (defaults to settings.REDIS_URL)
        max_connections: Max pool connections (defaults to settings.REDIS_POOL_MAX_SIZE)
        decode_responses: Whether to decode responses to strings
        
    Returns:
        Shared Redis client instance
    """
    global _redis_client
    
    if _redis_client is None:
        redis_url = url or settings.REDIS_URL
        pool_size = max_connections or settings.REDIS_POOL_MAX_SIZE
        
        logger.info(f"Creating Redis connection pool: {redis_url[:30]}... (max={pool_size})")
        
        _redis_client = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=decode_responses,
            max_connections=pool_size,
        )
        
    return _redis_client


async def close_redis_client():
    """Close Redis connection pool"""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis connection pool closed")


class RedisClientFactory:
    """
    Factory class for creating Redis clients with different configurations.
    Use for service-specific clients that need different settings.
    """
    
    @staticmethod
    async def create(
        url: Optional[str] = None,
        db: int = 0,
        max_connections: int = 50,
        decode_responses: bool = True,
    ) -> aioredis.Redis:
        """Create new Redis client (not shared)"""
        redis_url = url or settings.REDIS_URL
        
        # Append db number if not in URL
        if "?" not in redis_url and f"/{db}" not in redis_url:
            if redis_url.endswith("/0"):
                redis_url = redis_url[:-2] + f"/{db}"
            else:
                redis_url = redis_url.rstrip("/") + f"/{db}"
        
        return aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=decode_responses,
            max_connections=max_connections,
        )


# Key pattern constants for consistency
class RedisKeys:
    """Standard Redis key patterns"""
    
    # Live data
    @staticmethod
    def latest(symbol_id: int) -> str:
        return f"latest:{symbol_id}"
    
    @staticmethod
    def option_chain(symbol: str, expiry: str) -> str:
        return f"oc:{symbol}:{expiry}"
    
    # User data
    @staticmethod
    def user(firebase_uid: str) -> str:
        return f"user:{firebase_uid}"
    
    @staticmethod
    def session(session_id: str) -> str:
        return f"session:{session_id}"
    
    # Config
    @staticmethod
    def config(key: str) -> str:
        return f"config:{key}"
    
    # Rate limiting
    @staticmethod
    def rate_limit(ip: str, endpoint: str) -> str:
        return f"rate_limit:{ip}:{endpoint}"
    
    # Tokens
    DHAN_TOKENS = "dhan:tokens"

import asyncio
import redis.asyncio as redis
import logging
import orjson
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

# Redis setup with timeout
REDIS_URLS: List[str] = [
    "redis://localhost:6379",  # Default Redis/Memurai
    "redis://127.0.0.1:6379",  # Alternative localhost
    "redis://172.17.0.1:6379"  # WSL2 default IP
]
REDIS_TIMEOUT: int = 10  # seconds
REDIS_CACHE_TTL: int = 5  # 5 seconds cache

async def get_redis_connection() -> Optional[redis.Redis]:
    """Try multiple Redis connection URLs with timeout"""
    last_error = None
    for url in REDIS_URLS:
        try:
            pool = redis.ConnectionPool.from_url(
                url,
                max_connections=100,
                socket_timeout=REDIS_TIMEOUT,
                socket_connect_timeout=REDIS_TIMEOUT,
            )
            client = redis.Redis(connection_pool=pool)
            # Test connection
            await asyncio.wait_for(client.ping(), timeout=REDIS_TIMEOUT)
            logger.info(f"Successfully connected to Redis at {url}")
            return client
        except (redis.ConnectionError, asyncio.TimeoutError) as e:
            last_error = e
            logger.warning(f"Failed to connect to Redis at {url}: {e}")
            continue
        except Exception as e:
            last_error = e
            logger.error(f"Unexpected error connecting to Redis at {url}: {e}")
            continue

    logger.error(f"Could not connect to any Redis server: {last_error}")
    return None

async def get_cached_data(redis_client: Optional[redis.Redis], cache_key: str) -> Optional[Dict]:
    """Get data from Redis cache with improved error handling"""
    if not redis_client:
        return None
    try:
        data = await redis_client.get(cache_key)
        if data:
            logger.info(f"Cache hit for {cache_key}")
            return orjson.loads(data)
        logger.info(f"Cache miss for {cache_key}")
        return None
    except Exception as e:
        logger.error(f"Redis get error: {e}")
        return None

async def set_cached_data(redis_client: Optional[redis.Redis], cache_key: str, data: Dict):
    """Set data in Redis cache with compression"""
    if not redis_client:
        return
    try:
        # Compress and cache the data
        compressed_data = orjson.dumps(data)
        await redis_client.setex(cache_key, REDIS_CACHE_TTL, compressed_data)
        logger.info(f"Cached data for {cache_key} with TTL {REDIS_CACHE_TTL}s")
    except Exception as e:
        logger.error(f"Redis set error: {e}")


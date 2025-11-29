"""
High-Performance Multi-Tier Caching Layer

Level 1: In-memory LRU cache (0.1ms)
Level 2: Redis cache (1-2ms)
Level 3: Database (10-50ms)
"""
from cachetools import TTLCache
import asyncio
from typing import Optional, Dict, Any
import json
from functools import wraps
import hashlib
import redis.asyncio as redis
from core.config.settings import get_settings
from core.logging.logger import get_logger

settings = get_settings()
logger = get_logger("cache")

# Level 1: In-process LRU cache with TTL
snapshot_cache = TTLCache(maxsize=10000, ttl=1.0)   # 1 second TTL
instrument_cache = TTLCache(maxsize=1000, ttl=3600)  # 1 hour TTL
user_cache = TTLCache(maxsize=5000, ttl=300)         # 5 minutes TTL

# Redis client for Level 2 cache
redis_client: Optional[redis.Redis] = None


async def get_redis_client() -> redis.Redis:
    """Get or create Redis client with connection pooling"""
    global redis_client
    if redis_client is None:
        redis_client = await redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=settings.REDIS_MAX_CONNECTIONS
        )
    return redis_client


def cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate cache key from arguments"""
    key_str = f"{prefix}:{','.join(map(str, args))}:{json.dumps(kwargs, sort_keys=True)}"
    return hashlib.md5(key_str.encode()).hexdigest()


class MultiTierCache:
    """Multi-tier caching with automatic fallback"""
    
    def __init__(self, prefix: str, l1_ttl: int = 1, l2_ttl: int = 10):
        self.prefix = prefix
        self.l1_ttl = l1_ttl
        self.l2_ttl = l2_ttl
        self.l1_cache = TTLCache(maxsize=10000, ttl=l1_ttl)
        
    async def get(self, key: str) -> Optional[Any]:
        """Get from cache with automatic tier fallback"""
        # L1 check (in-memory)
        if key in self.l1_cache:
            logger.debug(f"L1 cache hit: {key}")
            return self.l1_cache[key]
        
        # L2 check (Redis)
        redis = await get_redis_client()
        try:
            value = await redis.get(f"{self.prefix}:{key}")
            if value:
                logger.debug(f"L2 cache hit: {key}")
                # Populate L1 cache
                parsed_value = json.loads(value)
                self.l1_cache[key] = parsed_value
                return parsed_value
        except Exception as e:
            logger.error(f"Redis get error: {e}")
        
        return None
    
    async def set(self, key: str, value: Any):
        """Set in both cache tiers"""
        # L1 cache
        self.l1_cache[key] = value
        
        # L2 cache (Redis)
        redis = await get_redis_client()
        try:
            await redis.setex(
                f"{self.prefix}:{key}",
                self.l2_ttl,
                json.dumps(value)
            )
        except Exception as e:
            logger.error(f"Redis set error: {e}")
    
    async def delete(self, key: str):
        """Delete from both cache tiers"""
        # L1
        if key in self.l1_cache:
            del self.l1_cache[key]
        
        # L2
        redis = await get_redis_client()
        try:
            await redis.delete(f"{self.prefix}:{key}")
        except Exception as e:
            logger.error(f"Redis delete error: {e}")


# Pre-configured caches for different data types
snapshot_multi_cache = MultiTierCache("snapshot", l1_ttl=1, l2_ttl=10)
instrument_multi_cache = MultiTierCache("instrument", l1_ttl=3600, l2_ttl=7200)
user_multi_cache = MultiTierCache("user", l1_ttl=300, l2_ttl=600)
expiry_multi_cache = MultiTierCache("expiry", l1_ttl=3600, l2_ttl=86400)


def cached(cache: MultiTierCache, key_func=None):
    """Decorator for automatic caching of async functions"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                key = key_func(*args, **kwargs)
            else:
                key = f"{func.__name__}:{args}:{kwargs}"
            
            # Try cache first
            cached_value = await cache.get(key)
            if cached_value is not None:
                return cached_value
            
            # Cache miss - compute and cache
            result = await func(*args, **kwargs)
            await cache.set(key, result)
            return result
        
        return wrapper
    return decorator


# Usage examples
@cached(snapshot_multi_cache, key_func=lambda symbol_id: str(symbol_id))
async def get_latest_snapshot_cached(symbol_id: int) -> Optional[Dict[str, Any]]:
    """Get latest snapshot with multi-tier caching"""
    from core.database.db import async_session_factory
    from core.database.models import MarketSnapshotDB
    from sqlalchemy import select, desc
    
    async with async_session_factory() as session:
        stmt = select(MarketSnapshotDB).where(
            MarketSnapshotDB.symbol_id == symbol_id
        ).order_by(desc(MarketSnapshotDB.timestamp)).limit(1)
        
        result = await session.execute(stmt)
        snapshot = result.scalar_one_or_none()
        
        if snapshot:
            return {
                "symbol_id": snapshot.symbol_id,
                "timestamp": snapshot.timestamp.isoformat(),
                "ltp": float(snapshot.ltp),
                "volume": snapshot.volume,
                "oi": snapshot.oi
            }
    
    return None


@cached(instrument_multi_cache, key_func=lambda symbol_id: str(symbol_id))
async def get_instrument_cached(symbol_id: int) -> Optional[Dict[str, Any]]:
    """Get instrument with long-term caching (1 hour)"""
    from core.database.db import async_session_factory
    from core.database.models import InstrumentDB
    from sqlalchemy import select
    
    async with async_session_factory() as session:
        stmt = select(InstrumentDB).where(InstrumentDB.symbol_id == symbol_id)
        result = await session.execute(stmt)
        instrument = result.scalar_one_or_none()
        
        if instrument:
            return {
                "symbol_id": instrument.symbol_id,
                "symbol": instrument.symbol,
                "segment": instrument.segment,
                "exchange": instrument.exchange
            }
    
    return None

"""
Caching Decorator for High-Performance API Endpoints

Provides a reusable async caching decorator with:
- Automatic cache key generation from function arguments
- Redis cache-aside pattern
- Configurable TTL per function
- Optional cache key prefix customization
- Request coalescing for identical concurrent requests
"""
import asyncio
import functools
import hashlib
import json
import logging
from typing import Optional, Callable, Any

from app.cache.redis import get_redis_connection

logger = logging.getLogger(__name__)

# In-flight request tracking for coalescing
_in_flight: dict[str, asyncio.Future] = {}


def cache_key_from_args(prefix: str, *args, **kwargs) -> str:
    """Generate a deterministic cache key from function arguments."""
    key_parts = [prefix]
    
    # Add positional args
    for arg in args:
        if hasattr(arg, '__dict__'):
            # Skip complex objects (like self, db sessions)
            continue
        key_parts.append(str(arg))
    
    # Add keyword args (sorted for consistency)
    for k in sorted(kwargs.keys()):
        v = kwargs[k]
        if v is not None and not hasattr(v, '__dict__'):
            key_parts.append(f"{k}={v}")
    
    # Create hash for long keys
    raw_key = ":".join(key_parts)
    if len(raw_key) > 200:
        hash_suffix = hashlib.md5(raw_key.encode()).hexdigest()[:12]
        return f"{prefix}:{hash_suffix}"
    
    return raw_key


def cached(
    prefix: str,
    ttl: int = 300,
    skip_args: int = 1,
    coalesce: bool = True
):
    """
    Caching decorator for async functions.
    
    Args:
        prefix: Cache key prefix (e.g., "hist:snap")
        ttl: Time-to-live in seconds (0 = no expiry)
        skip_args: Number of positional args to skip (default 1 for 'self')
        coalesce: If True, queue duplicate concurrent requests
    
    Usage:
        @cached("hist:snapshot", ttl=86400)
        async def get_snapshot(self, symbol: str, date: str):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key (skip 'self' and other non-serializable args)
            cache_key = cache_key_from_args(
                prefix,
                *args[skip_args:],
                **kwargs
            )
            
            # Request coalescing: check if identical request is in-flight
            if coalesce and cache_key in _in_flight:
                logger.debug(f"Coalescing request for {cache_key}")
                try:
                    return await _in_flight[cache_key]
                except Exception:
                    pass  # If the in-flight request failed, we'll try again
            
            # Create future for coalescing
            if coalesce:
                future = asyncio.get_event_loop().create_future()
                _in_flight[cache_key] = future
            
            try:
                # Check Redis cache
                redis = await get_redis_connection()
                cached_value = await redis.get(cache_key)
                
                if cached_value:
                    logger.debug(f"Cache HIT: {cache_key}")
                    result = json.loads(cached_value)
                    
                    if coalesce:
                        future.set_result(result)
                        _in_flight.pop(cache_key, None)
                    
                    return result
                
                logger.debug(f"Cache MISS: {cache_key}")
                
                # Execute the actual function
                result = await func(*args, **kwargs)
                
                # Cache the result
                if result is not None:
                    try:
                        serialized = json.dumps(result, default=str)
                        if ttl > 0:
                            await redis.setex(cache_key, ttl, serialized)
                        else:
                            await redis.set(cache_key, serialized)
                        logger.debug(f"Cached: {cache_key} (TTL: {ttl}s)")
                    except (TypeError, json.JSONEncodeError) as e:
                        logger.warning(f"Failed to cache {cache_key}: {e}")
                
                if coalesce:
                    future.set_result(result)
                    _in_flight.pop(cache_key, None)
                
                return result
                
            except Exception as e:
                if coalesce:
                    future.set_exception(e)
                    _in_flight.pop(cache_key, None)
                raise
        
        return wrapper
    return decorator


def invalidate_cache(pattern: str):
    """
    Decorator to invalidate cache keys matching a pattern after function execution.
    
    Usage:
        @invalidate_cache("hist:snap:NIFTY:*")
        async def update_snapshot(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            # Invalidate matching keys
            try:
                redis = await get_redis_connection()
                keys_deleted = 0
                async for key in redis.scan_iter(match=pattern):
                    await redis.delete(key)
                    keys_deleted += 1
                
                if keys_deleted > 0:
                    logger.info(f"Invalidated {keys_deleted} cache keys matching {pattern}")
            except Exception as e:
                logger.warning(f"Cache invalidation failed for {pattern}: {e}")
            
            return result
        
        return wrapper
    return decorator

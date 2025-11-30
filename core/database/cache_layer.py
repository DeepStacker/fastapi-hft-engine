"""
Query caching layer for database operations.
Provides TTL-based caching with async support and Prometheus metrics.
"""

import asyncio
import time
from typing import Any, Callable, Optional
from cachetools import TTLCache
from prometheus_client import Counter, Gauge, Histogram
import structlog

logger = structlog.get_logger(__name__)

# Metrics
cache_hits = Counter('cache_hits_total', 'Total cache hits', ['cache_name'])
cache_misses = Counter('cache_misses_total', 'Total cache misses', ['cache_name'])
cache_size = Gauge('cache_size_items', 'Current cache size', ['cache_name'])
cache_operation_duration = Histogram(
    'cache_operation_duration_seconds',
    'Cache operation duration',
    ['operation']
)


class QueryCache:
    """
    Thread-safe async query cache with TTL support.
    
    Usage:
        cache = QueryCache(maxsize=1000, ttl=60, name="snapshot_cache")
        
        async def fetch_data():
            return await db.fetch_snapshot(symbol_id)
        
        result = await cache.get_or_fetch("snapshot:13", fetch_data)
    """
    
    def __init__(self, maxsize: int = 1000, ttl: int = 60, name: str = "default"):
        """
        Initialize query cache.
        
        Args:
            maxsize: Maximum number of items in cache
            ttl: Time-to-live in seconds
            name: Cache name for metrics identification
        """
        self.cache = TTLCache(maxsize=maxsize, ttl=ttl)
        self._lock = asyncio.Lock()
        self.name = name
        self.maxsize = maxsize
        self.ttl = ttl
        self._stats = {
            'hits': 0,
            'misses': 0,
            'total_requests': 0
        }
        
        logger.info(
            "Cache initialized",
            cache_name=name,
            maxsize=maxsize,
            ttl=ttl
        )
    
    async def get_or_fetch(
        self,
        key: str,
        fetch_func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Get value from cache or fetch if not present.
        
        Args:
            key: Cache key
            fetch_func: Async function to call if cache miss
            *args, **kwargs: Arguments to pass to fetch_func
        
        Returns:
            Cached or fetched value
        """
        with cache_operation_duration.labels(operation='get').time():
            self._stats['total_requests'] += 1
            
            # Try to get from cache (no lock needed for read)
            if key in self.cache:
                cache_hits.labels(cache_name=self.name).inc()
                self._stats['hits'] += 1
                
                logger.debug(
                    "Cache hit",
                    cache_name=self.name,
                    key=key,
                    hit_rate=self.get_hit_rate()
                )
                
                return self.cache[key]
            
            # Cache miss - acquire lock to fetch
            async with self._lock:
                # Double-check after acquiring lock (another coroutine may have fetched)
                if key in self.cache:
                    cache_hits.labels(cache_name=self.name).inc()
                    self._stats['hits'] += 1
                    return self.cache[key]
                
                # Fetch data
                cache_misses.labels(cache_name=self.name).inc()
                self._stats['misses'] += 1
                
                logger.debug(
                    "Cache miss - fetching",
                    cache_name=self.name,
                    key=key
                )
                
                with cache_operation_duration.labels(operation='fetch').time():
                    result = await fetch_func(*args, **kwargs)
                
                # Store in cache
                self.cache[key] = result
                cache_size.labels(cache_name=self.name).set(len(self.cache))
                
                return result
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache (returns None if not present).
        
        Args:
            key: Cache key
        
        Returns:
            Cached value or None
        """
        return self.cache.get(key)
    
    async def set(self, key: str, value: Any) -> None:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
        """
        async with self._lock:
            self.cache[key] = value
            cache_size.labels(cache_name=self.name).set(len(self.cache))
            
            logger.debug(
                "Cache set",
                cache_name=self.name,
                key=key
            )
    
    async def delete(self, key: str) -> bool:
        """
        Delete key from cache.
        
        Args:
            key: Cache key to delete
        
        Returns:
            True if key was present, False otherwise
        """
        async with self._lock:
            if key in self.cache:
                del self.cache[key]
                cache_size.labels(cache_name=self.name).set(len(self.cache))
                logger.debug("Cache delete", cache_name=self.name, key=key)
                return True
            return False
    
    async def clear(self) -> None:
        """Clear all items from cache."""
        async with self._lock:
            self.cache.clear()
            cache_size.labels(cache_name=self.name).set(0)
            logger.info("Cache cleared", cache_name=self.name)
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all keys matching pattern.
        
        Args:
            pattern: Pattern to match (e.g., "snapshot:*")
        
        Returns:
            Number of keys invalidated
        """
        async with self._lock:
            keys_to_delete = [
                key for key in self.cache.keys()
                if pattern.replace('*', '') in str(key)
            ]
            
            for key in keys_to_delete:
                del self.cache[key]
            
            cache_size.labels(cache_name=self.name).set(len(self.cache))
            
            logger.info(
                "Cache invalidated by pattern",
                cache_name=self.name,
                pattern=pattern,
                keys_deleted=len(keys_to_delete)
            )
            
            return len(keys_to_delete)
    
    def get_stats(self) -> dict:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        return {
            'name': self.name,
            'size': len(self.cache),
            'maxsize': self.maxsize,
            'ttl': self.ttl,
            'hits': self._stats['hits'],
            'misses': self._stats['misses'],
            'total_requests': self._stats['total_requests'],
            'hit_rate': self.get_hit_rate()
        }
    
    def get_hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self._stats['total_requests']
        if total == 0:
            return 0.0
        return (self._stats['hits'] / total) * 100


class CacheManager:
    """
    Manages multiple named caches.
    
    Usage:
        manager = CacheManager()
        snapshot_cache = manager.get_cache("snapshots", maxsize=5000, ttl=30)
        historical_cache = manager.get_cache("historical", maxsize=1000, ttl=300)
    """
    
    def __init__(self):
        self._caches: dict[str, QueryCache] = {}
        logger.info("CacheManager initialized")
    
    def get_cache(
        self,
        name: str,
        maxsize: int = 1000,
        ttl: int = 60,
        create_if_missing: bool = True
    ) -> Optional[QueryCache]:
        """
        Get or create a named cache.
        
        Args:
            name: Cache name
            maxsize: Maximum cache size
            ttl: Time-to-live in seconds
            create_if_missing: Create cache if it doesn't exist
        
        Returns:
            QueryCache instance or None
        """
        if name not in self._caches and create_if_missing:
            self._caches[name] = QueryCache(maxsize=maxsize, ttl=ttl, name=name)
        
        return self._caches.get(name)
    
    def get_all_stats(self) -> dict:
        """Get statistics for all caches."""
        return {
            name: cache.get_stats()
            for name, cache in self._caches.items()
        }
    
    async def clear_all(self) -> None:
        """Clear all caches."""
        for cache in self._caches.values():
            await cache.clear()
        logger.info("All caches cleared")


# Global cache manager instance
cache_manager = CacheManager()

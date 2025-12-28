"""
Layered Cache Manager with L1 (Memory) + L2 (Redis Cluster) Support

Provides multi-tier caching for optimal performance:
- L1: In-memory TTL cache (5s, 10K entries)
- L2: Redis cluster cache (60s, distributed)

For millions of transactions/sec, this reduces Redis load by 90%+
"""

import redis.asyncio as redis
from redis.asyncio.cluster import RedisCluster
from redis.asyncio import Redis
from cachetools import TTLCache
import json
import pickle
from typing import Optional, Any, List
from datetime import timedelta
import structlog
import threading
from core.config.settings import settings

logger = structlog.get_logger("layered-cache")


class LayeredCacheManager:
    """
    Two-tier cache manager with in-memory L1 and Redis cluster L2.
    
    Cache Strategy:
    - Hot data (accessed \u003c5s ago): Served from L1 memory cache
    - Warm data (5-60s): Served from L2 Redis cluster
    - Cold data (\u003e60s): Cache miss, query database
    
    This dramatically reduces Redis load for high-frequency reads.
    """
    
    def __init__(
        self,
        redis_url: Optional[str] = None,
        redis_cluster_nodes: Optional[List[dict]] = None,
        l1_size: int = 10000,
        l1_ttl: int = 5,
        l2_ttl: int = 60
    ):
        """
        Initialize layered cache.
        
        Args:
            redis_url: Single Redis URL (for non-cluster mode)
            redis_cluster_nodes: List of cluster nodes [{"host": "...", "port": 7001}, ...]
            l1_size: Max entries in L1 cache
            l1_ttl: L1 TTL in seconds
            l2_ttl: Default L2 TTL in seconds
        """
        self.redis_url = redis_url or getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')
        self.redis_cluster_nodes = redis_cluster_nodes or self._parse_cluster_nodes()
        self.use_cluster = bool(self.redis_cluster_nodes)
        
        # L1: Thread-safe in-memory cache with TTL
        self.l1 = TTLCache(maxsize=l1_size, ttl=l1_ttl)
        self.l1_lock = threading.RLock()
        
        # L2: Redis or Redis Cluster
        self.redis: Optional[Redis | RedisCluster] = None
        self.l2_default_ttl = l2_ttl
        
        self._stats = {
            'l1_hits': 0,
            'l1_misses': 0,
            'l2_hits': 0,
            'l2_misses': 0,
            'l2_sets': 0,
            'l2_deletes': 0
        }
    
    def _parse_cluster_nodes(self) -> Optional[List[dict]]:
        """Parse cluster nodes from environment variable"""
        cluster_str = getattr(settings, 'REDIS_CLUSTER_NODES', None)
        if not cluster_str:
            return None
        
        # Format: "host1:port1,host2:port2,host3:port3"
        nodes = []
        for node_str in cluster_str.split(','):
            if ':' in node_str:
                host, port = node_str.split(':')
                nodes.append({"host": host.strip(), "port": int(port)})
        
        return nodes if nodes else None
    
    async def initialize(self):
        """Initialize Redis connection (single or cluster)"""
        try:
            if self.use_cluster:
                # Redis Cluster mode
                startup_nodes = [
                    redis.cluster.ClusterNode(node["host"], node["port"])
                    for node in self.redis_cluster_nodes
                ]
                self.redis = RedisCluster(
                    startup_nodes=startup_nodes,
                    decode_responses=False,
                    skip_full_coverage_check=True,
                    max_connections=100,
                    max_connections_per_node=True
                )
                logger.info("✓ Redis Cluster initialized", nodes=len(startup_nodes))
            else:
                # Single Redis mode
                self.redis = await redis.from_url(
                    self.redis_url,
                    encoding="utf-8",
                    decode_responses=False,
                    max_connections=50
                )
                logger.info("✓ Single Redis initialized", url=self.redis_url)
            
            await self.redis.ping()
            
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
        Get value from cache (L1 → L2 → None).
        
        Args:
            key: Cache key
            deserialize: Deserialization method ('json' or 'pickle')
            
        Returns:
            Cached value or None if not found
        """
        # Try L1 first (in-memory)
        with self.l1_lock:
            if key in self.l1:
                self._stats['l1_hits'] += 1
                logger.debug(f"L1 cache hit: {key}")
                return self.l1[key]
            self._stats['l1_misses'] += 1
        
        # Try L2 (Redis)
        if not self.redis:
            return None
        
        try:
            value = await self.redis.get(key)
            if value is None:
                self._stats['l2_misses'] += 1
                return None
            
            self._stats['l2_hits'] += 1
            
            # Deserialize
            if deserialize == 'json':
                deserialized = json.loads(value)
            elif deserialize == 'pickle':
                deserialized = pickle.loads(value)
            else:
                deserialized = value.decode('utf-8')
            
            # Populate L1 for future hits
            with self.l1_lock:
                self.l1[key] = deserialized
            
            logger.debug(f"L2 cache hit: {key}")
            return deserialized
                
        except Exception as e:
            logger.error(f"Cache get error: {e}", key=key)
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        serialize: str = 'json'
    ) -> bool:
        """
        Set value in both L1 and L2 caches.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: L2 TTL in seconds (uses default if None)
            serialize: Serialization method ('json' or 'pickle')
            
        Returns:
            True if successful
        """
        # Set in L1 (in-memory)
        with self.l1_lock:
            self.l1[key] = value
        
        # Set in L2 (Redis)
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
            
            l2_ttl = ttl or self.l2_default_ttl
            await self.redis.setex(
                key,
                timedelta(seconds=l2_ttl),
                serialized
            )
            
            self._stats['l2_sets'] += 1
            return True
            
        except Exception as e:
            logger.error(f"Cache set error: {e}", key=key)
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Delete key from both L1 and L2 caches.
        
        Args:
            key: Cache key
            
        Returns:
            True if deleted from L2
        """
        # Delete from L1
        with self.l1_lock:
            self.l1.pop(key, None)
        
        # Delete from L2
        if not self.redis:
            return False
        
        try:
            result = await self.redis.delete(key)
            self._stats['l2_deletes'] += 1
            return result > 0
        except Exception as e:
            logger.error(f"Cache delete error: {e}", key=key)
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern from L2 (L1 auto-expires).
        
        Args:
            pattern: Key pattern (e.g., "pcr:*")
            
        Returns:
            Number of keys deleted from L2
        """
        # Clear L1 (simpler to just clear all)
        with self.l1_lock:
            self.l1.clear()
        
        if not self.redis:
            return 0
        
        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)
            
            if keys:
                deleted = await self.redis.delete(*keys)
                self._stats['l2_deletes'] += deleted
                return deleted
            return 0
            
        except Exception as e:
            logger.error(f"Cache delete pattern error: {e}", pattern=pattern)
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in L1 or L2"""
        # Check L1
        with self.l1_lock:
            if key in self.l1:
                return True
        
        # Check L2
        if not self.redis:
            return False
        
        try:
            return await self.redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Cache exists error: {e}", key=key)
            return False
    
    async def get_stats(self) -> dict:
        """Get detailed cache statistics"""
        l1_size = len(self.l1)
        l1_total = self._stats['l1_hits'] + self._stats['l1_misses']
        l2_total = self._stats['l2_hits'] + self._stats['l2_misses']
        total_ops = l1_total + l2_total
        
        l1_hit_rate = (self._stats['l1_hits'] / l1_total * 100) if l1_total > 0 else 0
        l2_hit_rate = (self._stats['l2_hits'] / l2_total * 100) if l2_total > 0 else 0
        overall_hit_rate = (
            (self._stats['l1_hits'] + self._stats['l2_hits']) / total_ops * 100
            if total_ops > 0 else 0
        )
        
        return {
            'l1': {
                'hits': self._stats['l1_hits'],
                'misses': self._stats['l1_misses'],
                'hit_rate_pct': round(l1_hit_rate, 2),
                'current_size': l1_size,
                'max_size': self.l1.maxsize
            },
            'l2': {
                'hits': self._stats['l2_hits'],
                'misses': self._stats['l2_misses'],
                'sets': self._stats['l2_sets'],
                'deletes': self._stats['l2_deletes'],
                'hit_rate_pct': round(l2_hit_rate, 2),
                'mode': 'cluster' if self.use_cluster else 'single'
            },
            'overall': {
                'hit_rate_pct': round(overall_hit_rate, 2),
                'total_operations': total_ops
            }
        }
    
    def build_key(self, *parts: str) -> str:
        """
        Build cache key from parts.
        
        Example:
            build_key("pcr", "13", "2025-12-05") -> "pcr:13:2025-12-05"
        """
        return ":".join(str(p) for p in parts)


# Singleton instance (will use cluster if REDIS_CLUSTER_NODES is set)
layered_cache = LayeredCacheManager()


# Decorator for caching function results
def layered_cached(ttl: int = 60, key_prefix: str = ""):
    """
    Decorator to cache function results in layered cache.
    
    Usage:
        @layered_cached(ttl=120, key_prefix="analytics")
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
            cache_key = layered_cache.build_key(*key_parts)
            
            # Try cache first
            cached_result = await layered_cache.get(cache_key)
            if cached_result is not None:
                logger.debug("Layered cache hit", key=cache_key)
                return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            await layered_cache.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator

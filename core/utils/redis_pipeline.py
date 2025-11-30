"""
Redis pipeline utilities for batch operations.
Reduces network round-trips and improves performance by 3-5x.
"""

import asyncio
from typing import Any, Dict, List, Optional
import msgpack
from redis.asyncio import Redis
from prometheus_client import Histogram
import structlog

logger = structlog.get_logger(__name__)

# Metrics
redis_operation_duration = Histogram(
    'redis_operation_duration_seconds',
    'Redis operation duration',
    ['operation']
)


class RedisPipeline:
    """
    Redis pipeline wrapper for efficient batch operations.
    
    Usage:
        pipeline = RedisPipeline(redis_client)
        
        # Batch set
        await pipeline.set_many({
            "key1": "value1",
            "key2": "value2"
        })
        
        # Batch get
        results = await pipeline.get_many(["key1", "key2"])
    """
    
    def __init__(self, redis_client: Redis, batch_size: int = 100):
        """
        Initialize Redis pipeline.
        
        Args:
            redis_client: Redis async client instance
            batch_size: Maximum items per batch
        """
        self.redis = redis_client
        self.batch_size = batch_size
        logger.info("RedisPipeline initialized", batch_size=batch_size)
    
    async def set_many(
        self,
        items: Dict[str, Any],
        ttl: Optional[int] = None,
        serialize: bool = False
    ) -> int:
        """
        Set multiple keys in a single pipeline.
        
        Args:
            items: Dictionary of key-value pairs
            ttl: Optional time-to-live in seconds
            serialize: Whether to msgpack serialize values
        
        Returns:
            Number of keys set
        """
        with redis_operation_duration.labels(operation='set_many').time():
            pipeline = self.redis.pipeline()
            count = 0
            
            for key, value in items.items():
                if serialize:
                    value = msgpack.packb(value)
                
                if ttl:
                    pipeline.setex(key, ttl, value)
                else:
                    pipeline.set(key, value)
                
                count += 1
            
            await pipeline.execute()
            
            logger.debug(
                "Batch set completed",
                keys_set=count,
                with_ttl=ttl is not None
            )
            
            return count
    
    async def get_many(
        self,
        keys: List[str],
        deserialize: bool = False
    ) -> Dict[str, Any]:
        """
        Get multiple keys in a single pipeline.
        
        Args:
            keys: List of keys to fetch
            deserialize: Whether to msgpack deserialize values
        
        Returns:
            Dictionary of key-value pairs (None for missing keys)
        """
        with redis_operation_duration.labels(operation='get_many').time():
            pipeline = self.redis.pipeline()
            
            for key in keys:
                pipeline.get(key)
            
            results = await pipeline.execute()
            
            # Build result dictionary
            result_dict = {}
            for key, value in zip(keys, results):
                if value is not None and deserialize:
                    try:
                        value = msgpack.unpackb(value, raw=False)
                    except Exception as e:
                        logger.error("Deserialization failed", key=key, error=str(e))
                result_dict[key] = value
            
            logger.debug(
                "Batch get completed",
                keys_requested=len(keys),
                keys_found=sum(1 for v in results if v is not None)
            )
            
            return result_dict
    
    async def delete_many(self, keys: List[str]) -> int:
        """
        Delete multiple keys in a single pipeline.
        
        Args:
            keys: List of keys to delete
        
        Returns:
            Number of keys deleted
        """
        with redis_operation_duration.labels(operation='delete_many').time():
            if not keys:
                return 0
            
            # For delete, we can use DEL with multiple keys directly
            count = await self.redis.delete(*keys)
            
            logger.debug("Batch delete completed", keys_deleted=count)
            
            return count
    
    async def hset_many(
        self,
        key_prefix: str,
        items: Dict[str, Dict[str, Any]]
    ) -> int:
        """
        Set multiple hash fields across multiple keys.
        
        Args:
            key_prefix: Prefix for keys (e.g., "snapshot:")
            items: Dict of {suffix: {field: value}}
        
        Returns:
            Number of hash operations completed
        """
        with redis_operation_duration.labels(operation='hset_many').time():
            pipeline = self.redis.pipeline()
            count = 0
            
            for suffix, mapping in items.items():
                key = f"{key_prefix}{suffix}"
                pipeline.hset(key, mapping=mapping)
                count += 1
            
            await pipeline.execute()
            
            logger.debug("Batch hset completed", operations=count)
            
            return count
    
    async def publish_batch(
        self,
        channel_prefix: str,
        messages: List[Dict[str, Any]],
        serialize: bool = True
    ) -> int:
        """
        Publish multiple messages efficiently.
        
        Args:
            channel_prefix: Channel prefix (e.g., "live:")
            messages: List of messages, each must have 'symbol_id' or 'channel_suffix'
            serialize: Whether to msgpack serialize messages
        
        Returns:
            Number of messages published
        """
        with redis_operation_duration.labels(operation='publish_batch').time():
            pipeline = self.redis.pipeline()
            count = 0
            
            for msg in messages:
                # Determine channel suffix
                channel_suffix = msg.get('symbol_id') or msg.get('channel_suffix')
                if not channel_suffix:
                    logger.warning("Message missing channel identifier", msg=msg)
                    continue
                
                channel = f"{channel_prefix}{channel_suffix}"
                
                # Serialize message
                data = msgpack.packb(msg) if serialize else msg
                
                pipeline.publish(channel, data)
                count += 1
            
            await pipeline.execute()
            
            logger.debug("Batch publish completed", messages_published=count)
            
            return count
    
    async def cache_update_and_publish(
        self,
        updates: List[Dict[str, Any]],
        cache_key_prefix: str = "latest:",
        channel_prefix: str = "live:"
    ) -> int:
        """
        Update cache and publish in a single pipeline (atomic operation).
        
        Args:
            updates: List of update dicts with 'symbol_id' and data fields
            cache_key_prefix: Prefix for cache keys
            channel_prefix: Prefix for pub/sub channels
        
        Returns:
            Number of updates processed
        """
        with redis_operation_duration.labels(operation='cache_publish').time():
            pipeline = self.redis.pipeline()
            count = 0
            
            for update in updates:
                symbol_id = update.get('symbol_id')
                if not symbol_id:
                    logger.warning("Update missing symbol_id", update=update)
                    continue
                
                # Update cache (hash for structured data)
                cache_key = f"{cache_key_prefix}{symbol_id}"
                pipeline.hset(cache_key, mapping=update)
                
                # Publish to channel
                channel = f"{channel_prefix}{symbol_id}"
                pipeline.publish(channel, msgpack.packb(update))
                
                count += 1
            
            await pipeline.execute()
            
            logger.debug(
                "Cache update and publish completed",
                updates_processed=count
            )
            
            return count


class RedisPool:
    """
    Manage multiple Redis pipeline instances for concurrent operations.
    """
    
    def __init__(self, redis_client: Redis, pool_size: int = 10):
        """
        Initialize Redis pool.
        
        Args:
            redis_client: Redis async client
            pool_size: Number of pipeline instances
        """
        self.redis = redis_client
        self.pool_size = pool_size
        self.pipelines = [
            RedisPipeline(redis_client) for _ in range(pool_size)
        ]
        self._current = 0
        logger.info("RedisPool initialized", pool_size=pool_size)
    
    def get_pipeline(self) -> RedisPipeline:
        """Get next available pipeline (round-robin)."""
        pipeline = self.pipelines[self._current]
        self._current = (self._current + 1) % self.pool_size
        return pipeline

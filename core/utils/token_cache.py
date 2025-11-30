"""
High-Performance Token Cache Manager

Provides 3-tier caching for Dhan API tokens:
- L1: In-memory cache (<0.01ms)
- L2: Redis cache (~1ms)
- L3: ConfigManager fallback (~0.1ms)

Includes automatic cache invalidation via Redis Pub/Sub.
"""
import asyncio
import json
from typing import Dict, Optional
from datetime import datetime
import redis.asyncio as redis
from core.logging.logger import get_logger

logger = get_logger("token-cache")


class TokenCacheManager:
    """
    High-performance token caching with automatic invalidation.
    
    Usage:
        cache = TokenCacheManager(config_manager, redis_url)
        await cache.initialize()
        
        # Get tokens (ultra-fast)
        tokens = await cache.get_dhan_tokens()
        
        # Invalidate on update
        await cache.invalidate()
    """
    
    def __init__(self, config_manager, redis_url: str = "redis://redis:6379/0"):
        self._config_manager = config_manager
        self._redis_url = redis_url
        self._redis: Optional[redis.Redis] = None
        self._pubsub: Optional[redis.client.PubSub] = None
        
        # L1 Cache: In-memory (instant access)
        self._l1_cache: Dict[str, str] = {}
        
        self._listener_task: Optional[asyncio.Task] = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize Redis connection and start Pub/Sub listener."""
        if self._initialized:
            return
        
        logger.info("Initializing TokenCacheManager...")
        
        # Connect to Redis
        self._redis = await redis.from_url(self._redis_url, decode_responses=True)
        
        # Subscribe to token update notifications
        self._pubsub = self._redis.pubsub()
        await self._pubsub.subscribe("dhan:tokens:updated")
        
        # Start background listener
        self._listener_task = asyncio.create_task(self._listen_for_updates())
        
        # Pre-warm cache
        await self.get_dhan_tokens()
        
        self._initialized = True
        logger.info("TokenCacheManager initialized with cached tokens")
    
    async def get_dhan_tokens(self) -> Dict[str, str]:
        """
        Get Dhan API tokens with 3-tier caching.
        
        Returns:
            Dict with 'auth_token' and 'authorization_token' keys
        """
        # L1: In-memory cache (instant)
        if self._l1_cache:
            logger.debug("L1 cache hit: Dhan tokens")
            return self._l1_cache
        
        # L2: Redis cache (~1ms)
        tokens = await self._get_from_redis()
        if tokens:
            logger.debug("L2 cache hit: Dhan tokens")
            self._l1_cache = tokens
            return tokens
        
        # L3: ConfigManager (DB-backed, already cached in memory)
        logger.info("Cache miss - loading Dhan tokens from ConfigManager")
        tokens = self._load_from_config()
        
        # Populate caches
        await self._set_to_redis(tokens)
        self._l1_cache = tokens
        
        return tokens
    
    def _load_from_config(self) -> Dict[str, str]:
        """Load tokens from ConfigManager (L3 fallback)."""
        return {
            "auth_token": self._config_manager.get(
                "dhan_auth_token",
                self._get_default_auth_token()
            ),
            "authorization_token": self._config_manager.get(
                "dhan_authorization_token", 
                self._get_default_authorization_token()
            )
        }
    
    async def _get_from_redis(self) -> Optional[Dict[str, str]]:
        """Get tokens from Redis (L2)."""
        if not self._redis:
            return None
        
        try:
            value = await self._redis.get("dhan:tokens")
            if value:
                return json.loads(value)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
        
        return None
    
    async def _set_to_redis(self, tokens: Dict[str, str]):
        """Set tokens in Redis with 1 hour TTL."""
        if not self._redis:
            return
        
        try:
            await self._redis.setex(
                "dhan:tokens",
                3600,  # 1 hour TTL
                json.dumps(tokens)
            )
        except Exception as e:
            logger.error(f"Redis set error: {e}")
    
    async def invalidate(self):
        """
        Clear all cache levels.
        Called when tokens are updated via admin panel.
        """
        logger.info("Invalidating Dhan token cache (all levels)")
        
        # Clear L1
        self._l1_cache.clear()
        
        # Clear L2
        if self._redis:
            try:
                await self._redis.delete("dhan:tokens")
            except Exception as e:
                logger.error(f"Redis delete error: {e}")
        
        logger.info("Token cache invalidated - will reload on next access")
    
    async def _listen_for_updates(self):
        """Background task to listen for token update notifications."""
        logger.info("Starting token update listener...")
        
        try:
            async for message in self._pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        logger.info(f"Received token update notification: {data}")
                        
                        # Invalidate cache
                        await self.invalidate()
                        
                        # Immediately reload fresh tokens
                        await self.get_dhan_tokens()
                        
                        logger.info("Token cache refreshed with new values")
                    except Exception as e:
                        logger.error(f"Error processing token update: {e}")
        except asyncio.CancelledError:
            logger.info("Token update listener stopped")
        except Exception as e:
            logger.error(f"Token update listener error: {e}")
    
    async def close(self):
        """Clean up resources."""
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        
        if self._pubsub:
            await self._pubsub.unsubscribe("dhan:tokens:updated")
            await self._pubsub.close()
        
        if self._redis:
            await self._redis.close()
        
        logger.info("TokenCacheManager closed")
    
    @staticmethod
    def _get_default_auth_token() -> str:
        """Fallback default auth token."""
        return "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwiZXhwIjoxNzY0NTM0ODgzLCJjbGllbnRfaWQiOiIxMTAwMjExMTIwIn0.Ka1DziA0M2U0UO0O8JWWBPvWZvd1uNPJK_4OfLfW4wdomRyaijkZZcXNKrHqHYSlfK5QC6f5JLkM8SMN6KawKQ"
    
    @staticmethod
    def _get_default_authorization_token() -> str:
        """Fallback default authorization token."""
        return "eyJhbGciOiJIUzUxMiJ9.eyJleHAiOjE3NjQ1MzQ4ODMsImNsaWVudElkIjoiMTEwMDIxMTEyMCJ9.PsjjFt8uMrCY_bMBjdv14Xsp0XwN68lCy1HWEPC9xCGOX6IgLdR2BQcJePxPD7Y33_u2LFMZDwRKXvWPlWrYyw"

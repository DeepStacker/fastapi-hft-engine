"""
Redis Pub/Sub Manager for WebSocket Horizontal Scaling

Enables WebSocket messages to be broadcast across multiple server instances.
Each instance subscribes to Redis pub/sub channels and relays messages to local clients.
"""
import logging
import asyncio
import json
from typing import Optional, Callable, Dict, Any
from contextlib import asynccontextmanager

import redis.asyncio as redis
from redis.asyncio.client import PubSub

from app.config.settings import settings

logger = logging.getLogger(__name__)


class RedisPubSubManager:
    """
    Manages Redis Pub/Sub for cross-instance WebSocket communication.
    
    Architecture:
    - Each server instance subscribes to Redis channels for symbol:expiry pairs
    - When data is broadcast, it's published to Redis channel
    - All instances receive the message and forward to their local clients
    """
    
    def __init__(self):
        self._redis: Optional[redis.Redis] = None
        self._pubsub: Optional[PubSub] = None
        self._listener_task: Optional[asyncio.Task] = None
        self._message_handlers: Dict[str, Callable] = {}
        self._subscribed_channels: set = set()
        self._running = False
    
    async def connect(self) -> bool:
        """Initialize Redis connection for pub/sub"""
        try:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=False,  # We handle binary msgpack
            )
            self._pubsub = self._redis.pubsub()
            logger.info("Redis Pub/Sub manager initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Redis Pub/Sub: {e}")
            return False
    
    async def disconnect(self):
        """Cleanup Redis connections"""
        self._running = False
        
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        
        if self._pubsub:
            await self._pubsub.unsubscribe()
            await self._pubsub.close()
        
        if self._redis:
            await self._redis.close()
        
        logger.info("Redis Pub/Sub manager disconnected")
    
    def get_channel_name(self, symbol: str, expiry: str) -> str:
        """Generate channel name for symbol/expiry pair"""
        return f"ws:broadcast:{symbol.upper()}:{expiry}"
    
    async def subscribe(
        self, 
        symbol: str, 
        expiry: str, 
        handler: Callable[[bytes], Any]
    ) -> bool:
        """
        Subscribe to a symbol/expiry channel.
        
        Args:
            symbol: Trading symbol
            expiry: Expiry timestamp
            handler: Async function to call when message received
        """
        if not self._pubsub:
            return False
        
        channel = self.get_channel_name(symbol, expiry)
        
        if channel in self._subscribed_channels:
            return True
        
        try:
            await self._pubsub.subscribe(channel)
            self._subscribed_channels.add(channel)
            self._message_handlers[channel] = handler
            
            # Start listener if not running
            if not self._running:
                self._running = True
                self._listener_task = asyncio.create_task(self._listen())
            
            logger.info(f"Subscribed to Redis channel: {channel}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to subscribe to {channel}: {e}")
            return False
    
    async def unsubscribe(self, symbol: str, expiry: str) -> bool:
        """Unsubscribe from a symbol/expiry channel"""
        if not self._pubsub:
            return False
        
        channel = self.get_channel_name(symbol, expiry)
        
        if channel not in self._subscribed_channels:
            return True
        
        try:
            await self._pubsub.unsubscribe(channel)
            self._subscribed_channels.discard(channel)
            self._message_handlers.pop(channel, None)
            logger.info(f"Unsubscribed from Redis channel: {channel}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to unsubscribe from {channel}: {e}")
            return False
    
    async def publish(self, symbol: str, expiry: str, data: bytes) -> int:
        """
        Publish data to all instances subscribed to symbol/expiry.
        
        Args:
            symbol: Trading symbol
            expiry: Expiry timestamp
            data: Pre-encoded data (msgpack bytes)
            
        Returns:
            Number of subscribers that received the message
        """
        if not self._redis:
            return 0
        
        channel = self.get_channel_name(symbol, expiry)
        
        try:
            return await self._redis.publish(channel, data)
        except Exception as e:
            logger.error(f"Failed to publish to {channel}: {e}")
            return 0
    
    async def _listen(self):
        """Background task to listen for pub/sub messages"""
        logger.info("Starting Redis Pub/Sub listener")
        
        while self._running:
            try:
                message = await self._pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0
                )
                
                if message and message["type"] == "message":
                    channel = message["channel"]
                    if isinstance(channel, bytes):
                        channel = channel.decode("utf-8")
                    
                    handler = self._message_handlers.get(channel)
                    if handler:
                        try:
                            await handler(message["data"])
                        except Exception as e:
                            logger.error(f"Error in message handler for {channel}: {e}")
                
                await asyncio.sleep(0.01)  # Prevent busy loop
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Redis Pub/Sub listener error: {e}")
                await asyncio.sleep(1)  # Back off on error
        
        logger.info("Redis Pub/Sub listener stopped")


# Global instance
pubsub_manager = RedisPubSubManager()


async def init_pubsub() -> bool:
    """Initialize the global pub/sub manager"""
    return await pubsub_manager.connect()


async def close_pubsub():
    """Cleanup the global pub/sub manager"""
    await pubsub_manager.disconnect()

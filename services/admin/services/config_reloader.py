"""
Config Reloader Service

Handles hot configuration reload by publishing updates to Redis.
Services subscribe to 'config_updates' channel to receive notifications.
"""
import json
import logging
import redis.asyncio as redis
from typing import Dict, Any
from core.config.settings import get_settings

logger = logging.getLogger("stockify.admin.config")


class ConfigReloader:
    """Manage configuration reload broadcasting"""
    
    def __init__(self):
        self.settings = get_settings()
        self.redis_url = self.settings.REDIS_URL
        self.redis = None
    
    async def get_redis(self):
        """Get or create Redis connection"""
        if not self.redis:
            self.redis = redis.from_url(self.redis_url, decode_responses=True)
        return self.redis
    
    async def broadcast_update(self, key: str, value: Any, service: str = "all"):
        """
        Broadcast configuration update to services
        
        Args:
            key: Configuration key
            value: New value
            service: Target service name or "all"
        """
        try:
            r = await self.get_redis()
            
            message = {
                "type": "config_update",
                "key": key,
                "value": value,
                "target_service": service
            }
            
            # Publish to config_updates channel
            await r.publish("config_updates", json.dumps(message))
            logger.info(f"Broadcasted config update for {key} to {service}")
            return True
            
        except Exception as e:
            logger.error(f"Error broadcasting config update: {e}")
            return False
    
    async def trigger_reload(self, service_name: str):
        """
        Trigger a full configuration reload for a service
        """
        try:
            r = await self.get_redis()
            
            message = {
                "type": "reload_request",
                "target_service": service_name
            }
            
            await r.publish("config_updates", json.dumps(message))
            logger.info(f"Triggered config reload for {service_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error triggering reload: {e}")
            return False


# Singleton instance
config_reloader = ConfigReloader()

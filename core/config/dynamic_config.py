"""
Dynamic Configuration Manager

Provides centralized access to database-backed configuration with Redis Pub/Sub
for real-time updates across all services.
"""
import asyncio
import json
from typing import Any, Dict, Optional, Callable, List
from datetime import datetime
import redis.asyncio as redis
from sqlalchemy import select
from core.database.db import async_session_factory
from core.database.models import SystemConfigDB
from core.logging.logger import get_logger

logger = get_logger("config-manager")


class ConfigManager:
    """
    Manages dynamic configuration with database persistence and Redis Pub/Sub.
    
    Usage:
        config = ConfigManager()
        await config.initialize()
        
        # Get config
        value = config.get("trading_start_time", "09:15")
        
        # Listen for changes
        await config.subscribe_to_changes(my_callback)
    """
    
    def __init__(self, redis_url: str = "redis://redis:6379/0"):
        self._configs: Dict[str, Any] = {}
        self._redis_url = redis_url
        self._redis: Optional[redis.Redis] = None
        self._pubsub: Optional[redis.client.PubSub] = None
        self._callbacks: List[Callable] = []
        self._listener_task: Optional[asyncio.Task] = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize the config manager: load from DB and setup Redis listener."""
        if self._initialized:
            return
            
        logger.info("Initializing ConfigManager...")
        
        # Load configs from database
        await self.reload_from_db()
        
        # Setup Redis Pub/Sub
        self._redis = await redis.from_url(self._redis_url, decode_responses=True)
        self._pubsub = self._redis.pubsub()
        await self._pubsub.subscribe("config:updates")
        
        # Start listener task
        self._listener_task = asyncio.create_task(self._listen_for_updates())
        
        self._initialized = True
        logger.info(f"ConfigManager initialized with {len(self._configs)} configs")
    
    async def reload_from_db(self):
        """Reload all configurations from database."""
        async with async_session_factory() as session:
            result = await session.execute(select(SystemConfigDB))
            configs = result.scalars().all()
            
            for config in configs:
                # Parse value based on data_type
                parsed_value = self._parse_value(config.value, config.data_type)
                self._configs[config.key] = parsed_value
            
            logger.info(f"Loaded {len(configs)} configurations from database")
    
    def _parse_value(self, value: str, data_type: Optional[str]) -> Any:
        """Parse config value based on type."""
        if not data_type or data_type == "string":
            return value
        
        try:
            if data_type == "int":
                return int(value)
            elif data_type == "float":
                return float(value)
            elif data_type == "bool":
                return value.lower() in ("true", "1", "yes", "on")
            elif data_type == "json":
                return json.loads(value)
            elif data_type == "list":
                return json.loads(value) if value.startswith("[") else value.split(",")
        except (ValueError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to parse config value '{value}' as {data_type}: {e}")
            return value
        
        return value
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key."""
        return self._configs.get(key, default)
    
    def get_int(self, key: str, default: int = 0) -> int:
        """Get configuration as integer."""
        value = self.get(key, default)
        try:
            return int(value)
        except (ValueError, TypeError):
            return default
    
    def get_float(self, key: str, default: float = 0.0) -> float:
        """Get configuration as float."""
        value = self.get(key, default)
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
    
    def get_bool(self, key: str, default: bool = False) -> bool:
        """Get configuration as boolean."""
        value = self.get(key, default)
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ("true", "1", "yes", "on")
        return default
    
    def get_list(self, key: str, default: List = None) -> List:
        """Get configuration as list."""
        value = self.get(key, default or [])
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value.split(",")
        return default or []
    
    async def subscribe_to_changes(self, callback: Callable[[str, Any], None]):
        """
        Subscribe to configuration changes.
        
        Args:
            callback: Function to call when config changes. 
                     Signature: async def callback(key: str, new_value: Any)
        """
        self._callbacks.append(callback)
        logger.info(f"Registered config change callback: {callback.__name__}")
    
    async def _listen_for_updates(self):
        """Background task to listen for Redis Pub/Sub messages."""
        logger.info("Starting config update listener...")
        
        try:
            async for message in self._pubsub.listen():
                if message["type"] == "message":
                    try:
                        # Message format: {"key": "config_key", "action": "update"}
                        data = json.loads(message["data"])
                        key = data.get("key")
                        action = data.get("action", "update")
                        
                        if action == "update" and key:
                            # Reload this specific config from DB
                            await self._reload_single_config(key)
                            
                            # Notify callbacks
                            new_value = self._configs.get(key)
                            for callback in self._callbacks:
                                try:
                                    if asyncio.iscoroutinefunction(callback):
                                        await callback(key, new_value)
                                    else:
                                        callback(key, new_value)
                                except Exception as e:
                                    logger.error(f"Callback {callback.__name__} failed: {e}")
                        
                        elif action == "reload_all":
                            # Full reload
                            await self.reload_from_db()
                            logger.info("Full config reload triggered")
                            
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid config update message: {e}")
                    except Exception as e:
                        logger.error(f"Error processing config update: {e}")
        
        except asyncio.CancelledError:
            logger.info("Config update listener cancelled")
        except Exception as e:
            logger.error(f"Config listener error: {e}")
    
    async def _reload_single_config(self, key: str):
        """Reload a single configuration from database."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(SystemConfigDB).where(SystemConfigDB.key == key)
            )
            config = result.scalar_one_or_none()
            
            if config:
                parsed_value = self._parse_value(config.value, config.data_type)
                old_value = self._configs.get(key)
                self._configs[key] = parsed_value
                
                logger.info(f"Config updated: {key} = {parsed_value} (was: {old_value})")
            else:
                # Config was deleted
                if key in self._configs:
                    del self._configs[key]
                    logger.info(f"Config deleted: {key}")
    
    async def close(self):
        """Cleanup resources."""
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        
        if self._pubsub:
            await self._pubsub.unsubscribe("config:updates")
            await self._pubsub.close()
        
        if self._redis:
            await self._redis.close()
        
        logger.info("ConfigManager closed")
    
    def __repr__(self):
        return f"<ConfigManager configs={len(self._configs)}>"


# Global singleton instance
_config_manager: Optional[ConfigManager] = None


async def get_config_manager() -> ConfigManager:
    """Get or create the global ConfigManager instance."""
    global _config_manager
    
    if _config_manager is None:
        _config_manager = ConfigManager()
        await _config_manager.initialize()
    
    return _config_manager

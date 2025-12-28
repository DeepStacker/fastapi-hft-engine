"""
Config Service - Centralized config loading with Redis caching
Hierarchy: Redis Cache -> Database -> settings.py defaults
"""
import logging
from typing import Optional, Any, Dict
import asyncio

from app.config.settings import settings
from app.cache.redis import RedisCache
from app.config.database import AsyncSessionLocal
from app.repositories.config import ConfigRepository

logger = logging.getLogger(__name__)

# Cache prefix for configs
CONFIG_CACHE_PREFIX = "config:"
CONFIG_CACHE_TTL = 300  # 5 minutes


class ConfigService:
    """
    Centralized config service with Redis caching.
    
    Usage:
        service = ConfigService(redis_cache)
        token = await service.get("DHAN_AUTH_TOKEN")
    """
    
    # In-memory defaults from settings.py
    _defaults: Dict[str, Any] = {
        # API Settings
        "DHAN_API_BASE_URL": getattr(settings, "DHAN_API_BASE_URL", "https://scanx.dhan.co/scanx"),
        "DHAN_API_TIMEOUT": getattr(settings, "DHAN_API_TIMEOUT", 10),
        "DHAN_API_RETRY_COUNT": getattr(settings, "DHAN_API_RETRY_COUNT", 2),
        "DHAN_API_RETRY_DELAY": getattr(settings, "DHAN_API_RETRY_DELAY", 0.3),
        "DHAN_AUTH_TOKEN": getattr(settings, "DHAN_AUTH_TOKEN", ""),
        "DHAN_CLIENT_ID": getattr(settings, "DHAN_CLIENT_ID", ""),
        
        # Cache Settings
        "REDIS_CACHE_TTL": getattr(settings, "REDIS_CACHE_TTL", 60),
        "REDIS_OPTIONS_CACHE_TTL": getattr(settings, "REDIS_OPTIONS_CACHE_TTL", 2),
        "REDIS_EXPIRY_CACHE_TTL": getattr(settings, "REDIS_EXPIRY_CACHE_TTL", 300),
        
        # Trading Settings
        "DEFAULT_RISK_FREE_RATE": getattr(settings, "DEFAULT_RISK_FREE_RATE", 0.10),
        "DEFAULT_SYMBOL": getattr(settings, "DEFAULT_SYMBOL", "NIFTY"),
        
        # WebSocket Settings
        "WS_HEARTBEAT_INTERVAL": getattr(settings, "WS_HEARTBEAT_INTERVAL", 30),
        "WS_BROADCAST_INTERVAL": getattr(settings, "WS_BROADCAST_INTERVAL", 0.5),
        "WS_MAX_CONNECTIONS": getattr(settings, "WS_MAX_CONNECTIONS", 100),
        
        # Rate Limiting
        "RATE_LIMIT_PER_MINUTE": getattr(settings, "RATE_LIMIT_PER_MINUTE", 100),
        "RATE_LIMIT_BURST": getattr(settings, "RATE_LIMIT_BURST", 200),
    }
    
    def __init__(self, cache: Optional[RedisCache] = None):
        self.cache = cache
    
    def _get_cache_key(self, key: str) -> str:
        """Get Redis cache key for config"""
        return f"{CONFIG_CACHE_PREFIX}{key}"
    
    async def get(self, key: str, default: Any = None) -> Any:
        """
        Get config value with caching hierarchy:
        1. Redis cache (fastest)
        2. Database (UI-configurable)
        3. settings.py default
        4. Provided default
        """
        cache_key = self._get_cache_key(key)
        
        # 1. Try Redis cache first (fastest)
        if self.cache:
            try:
                cached_value = await self.cache.get(cache_key)
                if cached_value is not None:
                    logger.debug(f"Config {key} from Redis cache")
                    return self._convert_type(cached_value, key)
            except Exception as e:
                logger.warning(f"Redis cache error for {key}: {e}")
        
        # 2. Try database (UI-configured values)
        try:
            async with AsyncSessionLocal() as db:
                repo = ConfigRepository(db)
                config = await repo.get_by_key(key)
                if config and config.is_active:
                    value = config.value
                    
                    # Cache in Redis for next time
                    if self.cache:
                        try:
                            await self.cache.set(cache_key, str(value), ttl=CONFIG_CACHE_TTL)
                        except Exception as e:
                            logger.warning(f"Failed to cache config {key}: {e}")
                    
                    logger.debug(f"Config {key} from database")
                    return self._convert_type(value, key)
        except Exception as e:
            logger.warning(f"Database config error for {key}: {e}")
        
        # 3. Fall back to settings.py defaults
        if key in self._defaults:
            logger.debug(f"Config {key} from defaults")
            return self._defaults[key]
        
        # 4. Use provided default
        return default
    
    def _convert_type(self, value: Any, key: str) -> Any:
        """Convert string value to appropriate type based on key"""
        if value is None:
            return None
        
        str_value = str(value)
        
        # Boolean conversion
        if str_value.lower() in ("true", "false"):
            return str_value.lower() == "true"
        
        # Numeric conversion for known numeric keys
        numeric_keys = [
            "TIMEOUT", "TTL", "COUNT", "DELAY", "RATE", "LIMIT",
            "INTERVAL", "MAX", "MIN", "SIZE", "THRESHOLD"
        ]
        
        if any(nk in key.upper() for nk in numeric_keys):
            try:
                if "." in str_value:
                    return float(str_value)
                return int(str_value)
            except ValueError:
                pass
        
        return str_value
    
    async def set(self, key: str, value: Any) -> None:
        """Set config value in cache (DB update should be via admin API)"""
        if self.cache:
            cache_key = self._get_cache_key(key)
            await self.cache.set(cache_key, str(value), ttl=CONFIG_CACHE_TTL)
    
    async def invalidate(self, key: str) -> None:
        """Invalidate config cache for a key"""
        if self.cache:
            cache_key = self._get_cache_key(key)
            await self.cache.delete(cache_key)
    
    async def invalidate_all(self) -> None:
        """Invalidate all config cache"""
        if self.cache:
            # Delete all config keys
            try:
                keys = await self.cache.keys(f"{CONFIG_CACHE_PREFIX}*")
                if keys:
                    for key in keys:
                        await self.cache.delete(key)
            except Exception as e:
                logger.warning(f"Failed to invalidate config cache: {e}")
    
    async def get_dhan_token(self) -> str:
        """Get Dhan auth token with proper caching"""
        return await self.get("DHAN_AUTH_TOKEN", "")
    
    async def get_dhan_base_url(self) -> str:
        """Get Dhan API base URL"""
        return await self.get("DHAN_API_BASE_URL", "https://scanx.dhan.co/scanx")
    
    async def get_dhan_timeout(self) -> int:
        """Get Dhan API timeout"""
        return await self.get("DHAN_API_TIMEOUT", 10)
    
    async def get_dhan_retry_count(self) -> int:
        """Get Dhan API retry count"""
        return await self.get("DHAN_API_RETRY_COUNT", 2)
    
    async def get_dhan_retry_delay(self) -> float:
        """Get Dhan API retry delay"""
        return await self.get("DHAN_API_RETRY_DELAY", 0.3)


# Global singleton instance
_config_service: Optional[ConfigService] = None


async def get_config_service(cache: Optional[RedisCache] = None) -> ConfigService:
    """Get or create global config service instance"""
    global _config_service
    if _config_service is None:
        _config_service = ConfigService(cache)
    elif cache is not None and _config_service.cache is None:
        _config_service.cache = cache
    return _config_service


async def get_config(key: str, default: Any = None, cache: Optional[RedisCache] = None) -> Any:
    """
    Convenience function to get a config value.
    
    Usage:
        token = await get_config("DHAN_AUTH_TOKEN")
    """
    service = await get_config_service(cache)
    return await service.get(key, default)

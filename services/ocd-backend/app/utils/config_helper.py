"""
Config Helper - Easy access to admin-managed configurations
Provides a simple interface to get config values with fallbacks
"""
import logging
from typing import Optional, Any, Dict
from functools import lru_cache

from app.config.settings import settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# Default Fallback Values
# These are used when config is not in DB and not in cache
# ═══════════════════════════════════════════════════════════════════

DEFAULTS: Dict[str, Any] = {
    # API Settings
    "DHAN_API_BASE_URL": settings.DHAN_API_BASE_URL,
    "DHAN_API_TIMEOUT": settings.DHAN_API_TIMEOUT,
    "DHAN_API_RETRY_COUNT": settings.DHAN_API_RETRY_COUNT,
    "DHAN_API_RETRY_DELAY": settings.DHAN_API_RETRY_DELAY,
    
    # Cache Settings
    "REDIS_CACHE_TTL": settings.REDIS_CACHE_TTL,
    "REDIS_OPTIONS_CACHE_TTL": settings.REDIS_OPTIONS_CACHE_TTL,
    "REDIS_EXPIRY_CACHE_TTL": settings.REDIS_EXPIRY_CACHE_TTL,
    
    # Trading Settings
    "DEFAULT_RISK_FREE_RATE": settings.DEFAULT_RISK_FREE_RATE,
    "DEFAULT_SYMBOL": settings.DEFAULT_SYMBOL,
    
    # WebSocket Settings
    "WS_HEARTBEAT_INTERVAL": settings.WS_HEARTBEAT_INTERVAL,
    "WS_BROADCAST_INTERVAL": settings.WS_BROADCAST_INTERVAL,
    "WS_MAX_CONNECTIONS": settings.WS_MAX_CONNECTIONS,
    
    # Rate Limiting
    "RATE_LIMIT_PER_MINUTE": settings.RATE_LIMIT_PER_MINUTE,
    "RATE_LIMIT_BURST": settings.RATE_LIMIT_BURST,
    
    # UI Settings
    "UI_DEFAULT_THEME": "dark",
    "UI_DEFAULT_STRIKES_COUNT": 21,
    "UI_ENABLE_ANIMATIONS": True,
    
    # Logging
    "LOG_LEVEL": settings.LOG_LEVEL,
}


def get_default(key: str, fallback: Any = None) -> Any:
    """
    Get default value for a config key.
    Falls back to settings.py values, then to provided fallback.
    
    Args:
        key: Configuration key
        fallback: Final fallback if not in DEFAULTS
        
    Returns:
        Default value for the key
    """
    return DEFAULTS.get(key, fallback)


def get_all_defaults() -> Dict[str, Any]:
    """Get all default configuration values"""
    return DEFAULTS.copy()


class ConfigCache:
    """
    In-memory config cache for quick access without DB/Redis calls.
    Used for frequently accessed configs during request processing.
    """
    
    _cache: Dict[str, Any] = {}
    
    @classmethod
    def get(cls, key: str, fallback: Any = None) -> Any:
        """Get cached config value or fallback"""
        if key in cls._cache:
            return cls._cache[key]
        return get_default(key, fallback)
    
    @classmethod
    def set(cls, key: str, value: Any) -> None:
        """Set cached config value"""
        cls._cache[key] = value
    
    @classmethod
    def update(cls, configs: Dict[str, Any]) -> None:
        """Bulk update cache"""
        cls._cache.update(configs)
    
    @classmethod
    def clear(cls) -> None:
        """Clear all cached configs"""
        cls._cache.clear()
    
    @classmethod
    def remove(cls, key: str) -> None:
        """Remove a single key from cache"""
        cls._cache.pop(key, None)


# Convenience functions for common config access
def get_api_timeout() -> int:
    """Get API timeout in seconds"""
    return int(ConfigCache.get("DHAN_API_TIMEOUT", 10))


def get_api_retry_count() -> int:
    """Get number of API retries"""
    return int(ConfigCache.get("DHAN_API_RETRY_COUNT", 2))


def get_api_retry_delay() -> float:
    """Get delay between retries in seconds"""
    return float(ConfigCache.get("DHAN_API_RETRY_DELAY", 0.3))


def get_options_cache_ttl() -> int:
    """Get options data cache TTL in seconds"""
    return int(ConfigCache.get("REDIS_OPTIONS_CACHE_TTL", 2))


def get_risk_free_rate() -> float:
    """Get risk-free rate for BSM calculations"""
    return float(ConfigCache.get("DEFAULT_RISK_FREE_RATE", 0.10))


def get_default_symbol() -> str:
    """Get default trading symbol"""
    return str(ConfigCache.get("DEFAULT_SYMBOL", "NIFTY"))


def get_ws_broadcast_interval() -> float:
    """Get WebSocket broadcast interval in seconds"""
    return float(ConfigCache.get("WS_BROADCAST_INTERVAL", 0.5))


def get_rate_limit() -> int:
    """Get rate limit per minute"""
    return int(ConfigCache.get("RATE_LIMIT_PER_MINUTE", 100))

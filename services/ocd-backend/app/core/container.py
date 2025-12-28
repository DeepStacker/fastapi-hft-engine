"""
Dependency Injection Container - Centralized service management

Provides singleton instances and proper dependency injection for all services.
Eliminates ad-hoc service creation throughout the codebase.
"""
import logging
from typing import Optional
from functools import cached_property

from app.config.settings import settings

logger = logging.getLogger(__name__)


class ServiceContainer:
    """
    Centralized dependency injection container.
    
    Provides:
    - Singleton service instances
    - Lazy initialization
    - Proper error handling
    - Easy testing with mock injection
    
    Usage:
        from app.core.container import container
        
        # In FastAPI dependency:
        async def get_options(container: ServiceContainer = Depends(get_container)):
            return await container.options_service.get_live_data(...)
    """
    
    _instance: Optional["ServiceContainer"] = None
    _initialized: bool = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._redis_cache = None
        self._dhan_client = None
        self._options_service = None
        self._config_service = None
        self._historical_service = None
        self._screener_service = None
        self._calculator_service = None
        self._ticks_service = None
        
        self._initialized = True
        logger.info("ServiceContainer initialized")
    
    # ═══════════════════════════════════════════════════════════════════
    # Core Services (Stateless Singletons)
    # ═══════════════════════════════════════════════════════════════════
    
    @cached_property
    def bsm_service(self):
        """Black-Scholes Model service"""
        from app.services.bsm import BSMService
        return BSMService(settings.RISK_FREE_RATE)
    
    @cached_property
    def greeks_service(self):
        """Greeks calculation service"""
        from app.services.greeks import GreeksService
        return GreeksService(settings.RISK_FREE_RATE)
    
    @cached_property
    def reversal_service(self):
        """Reversal detection service"""
        from app.services.reversal import ReversalService
        return ReversalService(settings.RISK_FREE_RATE)
    
    # ═══════════════════════════════════════════════════════════════════
    # Infrastructure Services (Require Redis)
    # ═══════════════════════════════════════════════════════════════════
    
    @property
    def redis_cache(self):
        """Get Redis cache (may be None if Redis unavailable)"""
        return self._redis_cache
    
    def set_redis_cache(self, cache):
        """Set Redis cache instance (called during startup)"""
        self._redis_cache = cache
        logger.info("Redis cache injected into container")
    
    @property
    def dhan_client(self):
        """Get Dhan API client (lazily created)"""
        if self._dhan_client is None:
            from app.services.dhan_client import DhanClient
            self._dhan_client = DhanClient(cache=self._redis_cache)
        return self._dhan_client
    
    def set_dhan_client(self, client):
        """Override Dhan client (for testing)"""
        self._dhan_client = client
    
    # ═══════════════════════════════════════════════════════════════════
    # Business Services (Require Dependencies)
    # ═══════════════════════════════════════════════════════════════════
    
    @property
    def options_service(self):
        """Get Options service (created once, reused everywhere)"""
        if self._options_service is None:
            from app.services.options import OptionsService
            self._options_service = OptionsService(
                dhan_client=self.dhan_client,
                cache=self._redis_cache
            )
        return self._options_service
    
    @property
    def config_service(self):
        """Get Config service"""
        if self._config_service is None:
            from app.services.config_service import ConfigService
            self._config_service = ConfigService(cache=self._redis_cache)
        return self._config_service
    
    @property
    def historical_service(self):
        """Get Historical data service"""
        if self._historical_service is None:
            from app.services.historical import HistoricalService
            self._historical_service = HistoricalService(cache=self._redis_cache)
        return self._historical_service
    
    @property
    def screener_service(self):
        """Get Screener service"""
        if self._screener_service is None:
            from app.services.screener import ScreenerService
            self._screener_service = ScreenerService(
                options_service=self.options_service
            )
        return self._screener_service
    
    @property
    def calculator_service(self):
        """Get Calculator service"""
        if self._calculator_service is None:
            from app.services.calculators import CalculatorService
            self._calculator_service = CalculatorService()
        return self._calculator_service
    
    @property
    def ticks_service(self):
        """Get DhanTicks service"""
        if self._ticks_service is None:
            from app.services.dhan_ticks import DhanTicksService
            self._ticks_service = DhanTicksService()
        return self._ticks_service
    
    # ═══════════════════════════════════════════════════════════════════
    # Cleanup
    # ═══════════════════════════════════════════════════════════════════
    
    async def cleanup(self):
        """Clean up all services on shutdown"""
        if self._dhan_client:
            await self._dhan_client.close()
            self._dhan_client = None
        
        self._options_service = None
        self._config_service = None
        self._historical_service = None
        self._screener_service = None
        
        logger.info("ServiceContainer cleaned up")
    
    def reset(self):
        """Reset container (for testing)"""
        self._redis_cache = None
        self._dhan_client = None
        self._options_service = None
        self._config_service = None
        self._historical_service = None
        self._screener_service = None
        self._calculator_service = None
        self._ticks_service = None
        
        # Clear cached properties
        if 'bsm_service' in self.__dict__:
            del self.__dict__['bsm_service']
        if 'greeks_service' in self.__dict__:
            del self.__dict__['greeks_service']
        if 'reversal_service' in self.__dict__:
            del self.__dict__['reversal_service']


# Global singleton instance
container = ServiceContainer()


# ═══════════════════════════════════════════════════════════════════
# FastAPI Dependencies
# ═══════════════════════════════════════════════════════════════════

def get_container() -> ServiceContainer:
    """FastAPI dependency for getting the container"""
    return container


async def get_options_service_dep():
    """FastAPI dependency for OptionsService"""
    return container.options_service


async def get_dhan_client_dep():
    """FastAPI dependency for DhanClient"""
    return container.dhan_client


async def get_config_service_dep():
    """FastAPI dependency for ConfigService"""
    return container.config_service


async def get_historical_service_dep():
    """FastAPI dependency for HistoricalService"""
    return container.historical_service


async def get_screener_service_dep():
    """FastAPI dependency for ScreenerService"""
    return container.screener_service


async def get_calculator_service_dep():
    """FastAPI dependency for CalculatorService"""
    return container.calculator_service


async def get_ticks_service_dep():
    """FastAPI dependency for DhanTicksService"""
    return container.ticks_service

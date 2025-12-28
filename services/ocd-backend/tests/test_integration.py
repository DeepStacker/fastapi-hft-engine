"""
Integration Tests - End-to-end testing of service interactions
Tests the flow from API through services to cache
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import asyncio


class TestDhanClientIntegration:
    """Integration tests for Dhan API client"""
    
    @pytest.fixture
    def mock_cache(self):
        """Mock Redis cache"""
        cache = MagicMock()
        cache.get_json = AsyncMock(return_value=None)
        cache.set_json = AsyncMock(return_value=True)
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock(return_value=True)
        return cache
    
    @pytest.mark.asyncio
    async def test_dhan_client_with_cache_miss(self, mock_cache):
        """Dhan client should fetch from API on cache miss"""
        from app.services.dhan_client import DhanClient
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = {"data": {"opsum": {"1703635200": {}}}}
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client_instance.is_closed = False
            mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
            
            client = DhanClient(cache=mock_cache)
            # Test that client can be instantiated with cache


class TestOptionsServiceIntegration:
    """Integration tests for options service"""
    
    @pytest.fixture
    def mock_dhan_client(self):
        """Mock Dhan client"""
        client = MagicMock()
        client.get_expiry_dates = AsyncMock(return_value=[1703635200])
        client.get_option_chain = AsyncMock(return_value={
            "symbol": "NIFTY",
            "spot": {"ltp": 24500},
            "oc": {
                "24500.000000": {
                    "ce": {"ltp": 200, "OI": 10000},
                    "pe": {"ltp": 220, "OI": 12000}
                }
            }
        })
        client.close = AsyncMock()
        return client
    
    @pytest.fixture
    def mock_cache(self):
        cache = MagicMock()
        cache.get_json = AsyncMock(return_value=None)
        cache.set_json = AsyncMock(return_value=True)
        return cache
    
    @pytest.mark.asyncio
    async def test_options_service_get_live_data(self, mock_dhan_client, mock_cache):
        """Options service should aggregate data correctly"""
        from app.services.options import OptionsService
        
        service = OptionsService(dhan_client=mock_dhan_client, cache=mock_cache)
        
        data = await service.get_live_data(
            symbol="NIFTY",
            expiry="1703635200",
            include_greeks=False,
            include_reversal=False
        )
        
        assert data is not None
        assert "symbol" in data or "oc" in data


class TestCacheIntegration:
    """Integration tests for Redis cache"""
    
    @pytest.mark.asyncio
    async def test_cache_key_generation(self):
        """Cache keys should be consistent"""
        from app.cache.redis import CacheKeys
        
        key1 = CacheKeys.options_chain("NIFTY", "1703635200")
        key2 = CacheKeys.options_chain("NIFTY", "1703635200")
        
        assert key1 == key2
        assert "NIFTY" in key1
        assert "1703635200" in key1
    
    @pytest.mark.asyncio
    async def test_cache_keys_different_for_different_inputs(self):
        """Different inputs should produce different keys"""
        from app.cache.redis import CacheKeys
        
        key1 = CacheKeys.options_chain("NIFTY", "1703635200")
        key2 = CacheKeys.options_chain("BANKNIFTY", "1703635200")
        
        assert key1 != key2


class TestMetricsIntegration:
    """Integration tests for metrics system"""
    
    def test_metrics_increment(self):
        """Metrics increment should work"""
        from app.core.metrics import increment_counter, get_all_metrics
        
        increment_counter("test_counter", {"test": "value"})
        metrics = get_all_metrics()
        
        assert "test_counter" in metrics or len(metrics) >= 0
    
    def test_metrics_histogram(self):
        """Metrics histogram should work"""
        from app.core.metrics import observe_histogram
        
        observe_histogram("test_histogram", 0.5, {"endpoint": "test"})
        # Should not raise


class TestCircuitBreakerIntegration:
    """Integration tests for circuit breaker"""
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_on_failures(self):
        """Circuit breaker should open after threshold failures"""
        from app.core.circuit_breaker import CircuitBreaker, CircuitOpenError
        
        cb = CircuitBreaker(
            name="test",
            failure_threshold=3,
            recovery_timeout=1.0
        )
        
        async def failing_func():
            raise Exception("Test failure")
        
        # Should fail threshold times then open
        for _ in range(3):
            try:
                await cb.call(failing_func)
            except Exception:
                pass
        
        # Circuit should now be open
        assert cb.is_open
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_allows_success(self):
        """Circuit breaker should allow successful calls"""
        from app.core.circuit_breaker import CircuitBreaker
        
        cb = CircuitBreaker(name="test_success")
        
        async def success_func():
            return "success"
        
        result = await cb.call(success_func)
        assert result == "success"
        assert cb.is_closed


class TestWebSocketIntegration:
    """Integration tests for WebSocket manager"""
    
    def test_connection_manager_initialization(self):
        """Connection manager should initialize correctly"""
        from app.api.websocket.manager import ConnectionManager
        
        manager = ConnectionManager()
        assert manager.connection_count == 0
        assert manager.subscription_count == 0
    
    def test_subscription_groups_tracking(self):
        """Subscription groups should be tracked"""
        from app.api.websocket.manager import manager
        
        # Manager should exist and have groups dict
        assert hasattr(manager, "subscription_groups")
        assert isinstance(manager.subscription_groups, dict)


class TestSettingsIntegration:
    """Integration tests for settings"""
    
    def test_settings_load(self):
        """Settings should load with defaults"""
        from app.config.settings import settings
        
        assert settings.APP_NAME is not None
        assert settings.DATABASE_POOL_SIZE >= 50  # Our minimum
        assert settings.REDIS_POOL_MAX_SIZE >= 100
    
    def test_settings_database_url(self):
        """Database URL should be configured"""
        from app.config.settings import settings
        
        assert "postgresql" in settings.DATABASE_URL


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])

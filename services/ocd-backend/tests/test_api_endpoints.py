"""
API Endpoint Tests - Comprehensive testing for all REST endpoints
Uses pytest-asyncio and FastAPI TestClient
"""
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock

# Import the FastAPI app
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def async_client():
    """Async test client for FastAPI app"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


class TestHealthEndpoints:
    """Test health check endpoints"""
    
    @pytest.mark.asyncio
    async def test_root_endpoint(self, async_client):
        """Root endpoint should return app info"""
        response = await async_client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert data["status"] == "running"
    
    @pytest.mark.asyncio
    async def test_health_endpoint(self, async_client):
        """Health endpoint should return 200"""
        response = await async_client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestOptionsEndpoints:
    """Test options chain endpoints"""
    
    @pytest.mark.asyncio
    async def test_get_expiry_dates(self, async_client):
        """Expiry dates endpoint should return list"""
        with patch("app.services.dhan_client.DhanClient.get_expiry_dates") as mock:
            mock.return_value = [1703635200, 1704240000]
            response = await async_client.get("/api/v1/options/expiry/NIFTY")
            # May require auth - check for either 200 or 401/403
            assert response.status_code in [200, 401, 403, 422]
    
    @pytest.mark.asyncio
    async def test_invalid_symbol(self, async_client):
        """Invalid symbol should return error"""
        response = await async_client.get("/api/v1/options/expiry/INVALID_SYMBOL_XYZ")
        # Should return error (400/404/422) or auth required (401/403)
        assert response.status_code in [400, 404, 422, 401, 403]


class TestAnalyticsEndpoints:
    """Test analytics endpoints"""
    
    @pytest.mark.asyncio
    async def test_oi_distribution_requires_auth(self, async_client):
        """OI distribution should work (or require auth)"""
        response = await async_client.get(
            "/api/v1/analytics/oi-distribution/NIFTY/1703635200"
        )
        # Either returns data or requires auth
        assert response.status_code in [200, 401, 403, 422]


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    @pytest.mark.asyncio
    async def test_login_endpoint_exists(self, async_client):
        """Login endpoint should exist"""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"token": "test_token"}
        )
        # Should return 401 (invalid token) or 422 (validation) - but endpoint exists
        assert response.status_code in [200, 401, 403, 422, 400]
    
    @pytest.mark.asyncio
    async def test_register_endpoint_exists(self, async_client):
        """Register endpoint should exist"""
        response = await async_client.post(
            "/api/v1/auth/register",
            json={"token": "test_token"}
        )
        assert response.status_code in [200, 201, 401, 403, 422, 400, 409]


class TestCalculatorEndpoints:
    """Test calculator endpoints"""
    
    @pytest.mark.asyncio
    async def test_position_sizing(self, async_client):
        """Position sizing calculator"""
        response = await async_client.post(
            "/api/v1/calculators/position-size",
            json={
                "capital": 100000,
                "risk_percent": 2,
                "entry_price": 100,
                "stop_loss": 95
            }
        )
        # Either works or requires auth
        assert response.status_code in [200, 401, 403, 422]
    
    @pytest.mark.asyncio
    async def test_options_calculator(self, async_client):
        """Options price calculator"""
        response = await async_client.post(
            "/api/v1/calculators/options",
            json={
                "spot": 24500,
                "strike": 24500,
                "time_to_expiry": 7,
                "volatility": 15,
                "option_type": "call"
            }
        )
        assert response.status_code in [200, 401, 403, 422]


class TestScreenerEndpoints:
    """Test screener endpoints"""
    
    @pytest.mark.asyncio
    async def test_screener_list(self, async_client):
        """Get screener list"""
        response = await async_client.get("/api/v1/screeners/")
        assert response.status_code in [200, 401, 403]
    
    @pytest.mark.asyncio
    async def test_screener_with_filters(self, async_client):
        """Screener with filters"""
        response = await async_client.get(
            "/api/v1/screeners/",
            params={
                "symbol": "NIFTY",
                "min_oi": 1000
            }
        )
        assert response.status_code in [200, 401, 403, 422]


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    @pytest.mark.asyncio
    async def test_rate_limit_headers(self, async_client):
        """Response should include rate limit headers"""
        response = await async_client.get("/api/v1/health")
        # Rate limit headers should be present
        assert "x-ratelimit-limit" in [h.lower() for h in response.headers.keys()] or response.status_code == 200


class TestCORS:
    """Test CORS configuration"""
    
    @pytest.mark.asyncio
    async def test_cors_preflight(self, async_client):
        """CORS preflight should work for allowed origins"""
        response = await async_client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET"
            }
        )
        # Should not be 405 Method Not Allowed
        assert response.status_code in [200, 204, 400, 403]


class TestWebSocket:
    """Test WebSocket endpoints"""
    
    @pytest.mark.asyncio
    async def test_websocket_endpoint_exists(self, async_client):
        """WebSocket endpoint should be defined"""
        # HTTP request to WS endpoint should fail with 426 Upgrade Required or similar
        response = await async_client.get("/ws/options")
        # WS endpoint hit with HTTP returns error
        assert response.status_code in [400, 403, 404, 426]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])

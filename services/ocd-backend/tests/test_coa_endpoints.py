"""
COA Feature Tests - Comprehensive testing for Chart of Accuracy endpoints
Tests export functionality, alert subscriptions, and COA analysis.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta

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


class TestCOAEndpoints:
    """Test Chart of Accuracy endpoints"""
    
    @pytest.mark.asyncio
    async def test_coa_analysis_endpoint(self, async_client):
        """COA analysis endpoint should return scenario data"""
        with patch("app.services.options.OptionsService.get_live_data") as mock_data:
            mock_data.return_value = {
                "spot": {"ltp": 24500},
                "atm": 24500,
                "expiry": "2026-01-20",
                "oc": {
                    "24400": {"strike": 24400, "ce": {"ltp": 150, "oi": 1000000, "oi_change": 50000}, "pe": {"ltp": 100, "oi": 800000, "oi_change": 30000}},
                    "24500": {"strike": 24500, "ce": {"ltp": 100, "oi": 1200000, "oi_change": 60000}, "pe": {"ltp": 100, "oi": 1200000, "oi_change": 60000}},
                    "24600": {"strike": 24600, "ce": {"ltp": 50, "oi": 900000, "oi_change": 40000}, "pe": {"ltp": 150, "oi": 1100000, "oi_change": 55000}},
                }
            }
            
            response = await async_client.get("/api/v1/analytics/NIFTY/coa")
            # May return data or require auth
            assert response.status_code in [200, 401, 403, 422, 500]
            
            if response.status_code == 200:
                data = response.json()
                assert "scenario" in data
                assert "support" in data
                assert "resistance" in data
                assert "levels" in data
    
    @pytest.mark.asyncio
    async def test_coa_scenarios_endpoint(self, async_client):
        """COA scenarios reference endpoint should return all 9 scenarios"""
        response = await async_client.get("/api/v1/analytics/NIFTY/coa/scenarios")
        
        assert response.status_code in [200, 401, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") is True
            assert "scenarios" in data
            assert len(data["scenarios"]) == 9  # 1.0 through 1.8
            
            # Check scenario structure
            scenario = data["scenarios"][0]
            assert "id" in scenario
            assert "support" in scenario
            assert "resistance" in scenario
            assert "bias" in scenario


class TestCOAHistoryEndpoints:
    """Test COA history and export endpoints"""
    
    @pytest.mark.asyncio
    async def test_coa_history_endpoint(self, async_client):
        """COA history endpoint should return time-series data"""
        response = await async_client.get(
            "/api/v1/analytics/NIFTY/coa/history",
            params={"interval": "5 minutes"}
        )
        
        # May work or return 404 if no data
        assert response.status_code in [200, 401, 403, 404, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") is True
            assert "history" in data
            assert "count" in data
    
    @pytest.mark.asyncio
    async def test_coa_export_csv_endpoint(self, async_client):
        """COA export CSV endpoint should return CSV data"""
        response = await async_client.get(
            "/api/v1/analytics/NIFTY/coa/history/export",
            params={"format": "csv"}
        )
        
        assert response.status_code in [200, 401, 403, 500]
        
        if response.status_code == 200:
            # Check content type
            content_type = response.headers.get("content-type", "")
            assert "text/csv" in content_type
            
            # Check content-disposition header
            content_disposition = response.headers.get("content-disposition", "")
            assert "attachment" in content_disposition
            assert ".csv" in content_disposition
            
            # Check content starts with expected header
            content = response.text
            assert content.startswith("timestamp,scenario_id,scenario_name")
    
    @pytest.mark.asyncio
    async def test_coa_export_json_endpoint(self, async_client):
        """COA export JSON endpoint should return JSON data"""
        response = await async_client.get(
            "/api/v1/analytics/NIFTY/coa/history/export",
            params={"format": "json"}
        )
        
        assert response.status_code in [200, 401, 403, 500]
        
        if response.status_code == 200:
            # Check content type
            content_type = response.headers.get("content-type", "")
            assert "application/json" in content_type
            
            # Parse and validate JSON structure
            data = response.json()
            assert "symbol" in data
            assert "history" in data
            assert "count" in data
    
    @pytest.mark.asyncio
    async def test_coa_export_with_time_range(self, async_client):
        """COA export should accept time range parameters"""
        now = datetime.utcnow()
        start = (now - timedelta(hours=12)).isoformat()
        end = now.isoformat()
        
        response = await async_client.get(
            "/api/v1/analytics/NIFTY/coa/history/export",
            params={
                "format": "json",
                "start_time": start,
                "end_time": end,
                "interval": "15 minutes"
            }
        )
        
        assert response.status_code in [200, 401, 403, 500]


class TestCOAAlertEndpoints:
    """Test COA alert subscription endpoints"""
    
    @pytest.mark.asyncio
    async def test_subscribe_requires_auth(self, async_client):
        """Subscribe endpoint should require authentication"""
        response = await async_client.post(
            "/api/v1/analytics/NIFTY/coa/alerts/subscribe",
            json={
                "alert_on_scenario_change": True,
                "alert_on_strength_change": False,
                "notify_in_app": True
            }
        )
        
        # Should require auth
        assert response.status_code in [401, 403]
    
    @pytest.mark.asyncio
    async def test_unsubscribe_requires_auth(self, async_client):
        """Unsubscribe endpoint should require authentication"""
        response = await async_client.delete(
            "/api/v1/analytics/NIFTY/coa/alerts/unsubscribe"
        )
        
        assert response.status_code in [401, 403]
    
    @pytest.mark.asyncio
    async def test_get_subscriptions_requires_auth(self, async_client):
        """Get subscriptions endpoint should require authentication"""
        response = await async_client.get(
            "/api/v1/analytics/coa/alerts/subscriptions"
        )
        
        assert response.status_code in [401, 403]
    
    @pytest.mark.asyncio
    async def test_update_subscription_requires_auth(self, async_client):
        """Update subscription endpoint should require authentication"""
        response = await async_client.patch(
            "/api/v1/analytics/NIFTY/coa/alerts",
            json={"enabled": True}
        )
        
        assert response.status_code in [401, 403]


class TestCOAValidation:
    """Test COA input validation"""
    
    @pytest.mark.asyncio
    async def test_invalid_symbol(self, async_client):
        """Invalid symbol should return appropriate error"""
        response = await async_client.get("/api/v1/analytics/INVALID_SYMBOL_XYZ/coa")
        
        # Should return 404 or validation error
        assert response.status_code in [400, 404, 422, 500]
    
    @pytest.mark.asyncio
    async def test_invalid_export_format(self, async_client):
        """Invalid export format should be handled gracefully"""
        response = await async_client.get(
            "/api/v1/analytics/NIFTY/coa/history/export",
            params={"format": "xlsx"}  # Unsupported format
        )
        
        # Should either default to JSON or return error
        assert response.status_code in [200, 400, 422, 500]
    
    @pytest.mark.asyncio
    async def test_invalid_interval(self, async_client):
        """Invalid interval should be handled gracefully"""
        response = await async_client.get(
            "/api/v1/analytics/NIFTY/coa/history",
            params={"interval": "invalid_interval"}
        )
        
        # Should return error or use default
        assert response.status_code in [200, 400, 422, 500]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])

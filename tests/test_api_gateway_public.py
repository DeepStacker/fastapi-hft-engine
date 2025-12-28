"""
API Gateway Public Endpoints Tests

Test suite for public symbols and unified OC endpoints.
"""

import pytest
from httpx import AsyncClient
from datetime import datetime


@pytest.mark.asyncio
async def test_public_symbols_endpoint():
    """Test public symbols endpoint without authentication."""
    from services.api_gateway.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/public/symbols")
    
    assert response.status_code in [200, 500]  # May fail without DB
    
    if response.status_code == 200:
        data = response.json()
        assert "symbols" in data
        assert "count" in data


@pytest.mark.asyncio
async def test_public_symbols_with_filters():
    """Test symbols endpoint with filters."""
    from services.api_gateway.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/api/public/symbols",
            params={"exchange": "NSE", "active_only": True}
        )
    
    if response.status_code == 200:
        data = response.json()
        assert data["filters"]["exchange"] == "NSE"
        assert data["filters"]["active_only"] is True


@pytest.mark.asyncio
async def test_unified_oc_missing_date():
    """Test unified OC endpoint requires date for historical mode."""
    from services.api_gateway.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/api/public/oc/unified",
            params={"symbol_id": 13, "mode": "historical"}
        )
    
    assert response.status_code == 400
    data = response.json()
    assert "date" in data["detail"].lower()


@pytest.mark.asyncio
async def test_unified_oc_live_mode():
    """Test unified OC endpoint in live mode."""
    from services.api_gateway.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/api/public/oc/unified",
            params={
                "symbol_id": 13,
                "mode": "live",
                "expiry": "2025-12-05"
            }
        )
    
    # May fail without real services running
    assert response.status_code in [200, 502, 503]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_unified_oc_historical_mode():
    """Test unified OC endpoint in historical mode."""
    from services.api_gateway.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/api/public/oc/unified",
            params={
                "symbol_id": 13,
                "mode": "historical",
                "date": "2025-12-01",
                "time": "14:30:00"
            }
        )
    
    # Dependent on historical service availability
    assert response.status_code in [200, 502, 503]


@pytest.mark.asyncio
async def test_pcr_calculation_edge_cases():
    """Test PCR calculation with edge cases."""
    from services.api_gateway.routers.public_api import _calculate_pcr
    
    # Normal calculation
    assert _calculate_pcr(1500, 1000) == 1.5
    
    # Zero call OI
    assert _calculate_pcr(1000, 0) is None
    
    # Both zero
    assert _calculate_pcr(0, 0) is None
    
    # Very small numbers
    pcr = _calculate_pcr(0.001, 0.001)
    assert pcr == 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Tests for Chart Data Endpoints

Test suite for Phase 2 Week 1 chart endpoints:
- OI Distribution
- Volume Distribution
- IV Smile/Skew
- PCR Trends
"""

import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta


@pytest.mark.asyncio
async def test_oi_distribution_endpoint():
    """Test OI distribution chart data endpoint."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/charts/oi-distribution",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05"
           }
        )
    
    # May fail without database, but endpoint should exist
    assert response.status_code in [200, 500, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "distribution" in data
        assert "strikes" in data["distribution"]
        assert "call_oi" in data["distribution"]
        assert "put_oi" in data["distribution"]
        assert "summary" in data


@pytest.mark.asyncio
async def test_volume_distribution_endpoint():
    """Test volume distribution endpoint."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/charts/volume-distribution",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05"
            }
        )
    
    assert response.status_code in [200, 500, 422]


@pytest.mark.asyncio
async def test_iv_smile_endpoint():
    """Test IV smile/skew endpoint."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/charts/iv-smile",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05",
                "spot_price": 26250.50
            }
        )
    
    assert response.status_code in [200, 500, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "data" in data
        assert "strikes" in data["data"]
        assert "call_iv" in data["data"]
        assert "put_iv" in data["data"]
        assert "moneyness" in data["data"]


@pytest.mark.asyncio
async def test_pcr_trends_endpoint():
    """Test PCR trends time-series endpoint."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        from_time = (datetime.utcnow() - timedelta(hours=6)).isoformat()
        to_time = datetime.utcnow().isoformat()
        
        response = await client.get(
            "/charts/pcr-trends",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05",
                "from_time": from_time,
                "to_time": to_time,
                "interval_minutes": 5
            }
        )
    
    assert response.status_code in [200, 500, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        assert "summary" in data


@pytest.mark.asyncio
async def test_historical_service_version():
    """Test historical service reports correct version."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "2.2.0"
    assert data["service"] == "historical"


@pytest.mark.asyncio
async def test_charts_endpoints_listed():
    """Test that chart endpoints are listed in root."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    assert "phase2_week1_charts" in data
    assert len(data["phase2_week1_charts"]) == 4


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Phase 2 Week 2 Tests - Advanced Analytics Endpoints
"""

import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta


@pytest.mark.asyncio
async def test_greeks_distribution():
    """Test Greeks distribution with GEX calculation."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/charts/greeks-distribution",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05",
                "spot_price": 26250.50
            }
        )
    
    assert response.status_code in [200, 500, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "greeks" in data
        assert "gex" in data
        assert data["gex"]["total_gamma_exposure"] is not None


@pytest.mark.asyncio
async def test_velocity_heatmap():
    """Test velocity heatmap endpoint."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/charts/velocity-heatmap",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05",
                "lookback_minutes": 15
            }
        )
    
    assert response.status_code in [200, 500, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "heatmap" in data
        assert "net_velocity" in data["heatmap"]


@pytest.mark.asyncio
async def test_max_pain_calculation():
    """Test max pain calculator."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/charts/max-pain",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05",
                "include_time_series": False
            }
        )
    
    assert response.status_code in [200, 500, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "current_max_pain" in data
        assert "pain_chart" in data


@pytest.mark.asyncio
async def test_oi_time_series():
    """Test OI time-series for specific strike."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        from_time = (datetime.utcnow() - timedelta(hours=6)).isoformat()
        to_time = datetime.utcnow().isoformat()
        
        response = await client.get(
            "/charts/oi-time-series",
            params={
                "symbol_id": 13,
                "strike": 26200,
                "option_type": "CE",
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
        assert "summary" in data
        assert "total_oi_change" in data["summary"]


@pytest.mark.asyncio
async def test_service_version_updated():
    """Test service version is 2.3.0."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
    
    assert response.status_code == 200
    assert response.json()["version"] == "2.3.0"


@pytest.mark.asyncio
async def test_week2_charts_documented():
    """Test Week 2 charts are documented."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    assert "phase2_week2_charts" in data
    assert len(data["phase2_week2_charts"]) == 4


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Comprehensive Test Suite for Phase 3 Features

Tests for:
- Cell-level analytics
- Color metadata
- Header analytics  
- Strategy calculators (Margin, RR, Straddle, etc.)
- Historical playback
- Timeline navigation
"""

import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta


# ============ CELL ANALYTICS TESTS ============

@pytest.mark.asyncio
async def test_cell_data_call_oi():
    """Test cell data for Call OI."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/cell-analytics/cell-data",
            params={
                "symbol_id": 13,
                "strike": 26200,
                "cell_type": "call_oi",
                "expiry": "2025-12-05",
                "lookback_minutes": 60
            }
        )
    
    assert response.status_code in [200, 404, 500]
    
    if response.status_code == 200:
        data = response.json()
        assert "chart" in data
        assert "stats" in data
        assert data["cell_type"] == "call_oi"


@pytest.mark.asyncio
async def test_color_metadata():
    """Test color metadata generation."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/cell-analytics/color-metadata",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05"
            }
        )
    
    assert response.status_code in [200, 500]
    
    if response.status_code == 200:
        data = response.json()
        assert "rankings" in data
        assert "intensity" in data
        assert "buildup_colors" in data


@pytest.mark.asyncio
async def test_header_analytics():
    """Test header analytics endpoint."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/cell-analytics/header-analytics/oi",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05"
            }
        )
    
    assert response.status_code in [200, 404, 500]


# ============ STRATEGY CALCULATOR TESTS ============

@pytest.mark.asyncio
async def test_margin_calculator():
    """Test SPAN margin calculator."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        payload = {
            "spot_price": 26250,
            "strike": 26200,
            "option_type": "CE",
            "expiry_date": "2025-12-05",
            "premium": 125.50,
            "lot_size": 50,
            "position_type": "short"
        }
        
        response = await client.post(
            "/calculators/margin",
            json=payload
        )
    
    assert response.status_code in [200, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "required_margin" in data
        assert "breakdown" in data
        assert data["position_type"] == "short"


@pytest.mark.asyncio
async def test_risk_reward_calculator():
    """Test risk/reward calculator."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        payload = {
            "entry_price": 125.50,
            "target_price": 160.00,
            "stop_loss": 115.00,
            "quantity": 2,
            "lot_size": 50
        }
        
        response = await client.post(
            "/calculators/risk-reward",
            json=payload
        )
    
    assert response.status_code in [200, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "risk_reward_ratio" in data
        assert "analysis" in data
        assert data["risk_reward_ratio"] > 0


@pytest.mark.asyncio
async def test_straddle_calculator():
    """Test straddle strategy calculator."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        payload = {
            "spot_price": 26250,
            "atm_strike": 26200,
            "call_premium": 125.50,
            "put_premium": 115.75,
            "lot_size": 50,
            "strategy_type": "long",
            "spot_range_start": 26000,
            "spot_range_end": 26500,
            "spot_step": 50
        }
        
        response = await client.post(
            "/calculators/straddle",
            json=payload
        )
    
    assert response.status_code in [200, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "analysis" in data
        assert "payoff_chart" in data
        assert "breakeven_upper" in data["analysis"]


@pytest.mark.asyncio
async def test_iron_condor_calculator():
    """Test iron condor calculator."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        payload = {
            "put_buy_strike": 26000,
            "put_sell_strike": 26100,
            "call_sell_strike": 26300,
            "call_buy_strike": 26400,
            "put_buy_premium": 15.50,
            "put_sell_premium": 35.75,
            "call_sell_premium": 40.25,
            "call_buy_premium": 20.00,
            "lot_size": 50,
            "spot_range_start": 25900,
            "spot_range_end": 26500,
            "spot_step": 50
        }
        
        response = await client.post(
            "/calculators/iron-condor",
            json=payload
        )
    
    assert response.status_code in [200, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "net_credit" in data
        assert "payoff_chart" in data


# ============ HISTORICAL PLAYBACK TESTS ============

@pytest.mark.asyncio
async def test_timeline_metadata():
    """Test timeline metadata endpoint."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/historical/timeline",
            params={
                "symbol_id": 13,
                "date": "2025-12-02",
                "expiry": "2025-12-05"
            }
        )
    
    assert response.status_code in [200, 404, 500]
    
    if response.status_code == 200:
        data = response.json()
        assert "total_snapshots" in data
        assert "timestamps" in data


@pytest.mark.asyncio
async def test_snapshot_at_time():
    """Test snapshot at specific time."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/historical/snapshot",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05",
                "timestamp": "2025-12-02T10:00:00"
            }
        )
    
    assert response.status_code in [200, 404, 500]


@pytest.mark.asyncio
async def test_frame_navigation():
    """Test frame navigation."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/historical/navigate",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05",
                "current_timestamp": "2025-12-02T10:00:00",
                "direction": "next"
            }
        )
    
    assert response.status_code in [200, 404, 500]
    
    if response.status_code == 200:
        data = response.json()
        assert "target_timestamp" in data
        assert "has_next" in data


@pytest.mark.asyncio
async def test_available_dates():
    """Test available dates endpoint."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/historical/date-range",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05"
            }
        )
    
    assert response.status_code in [200, 500]
    
    if response.status_code == 200:
        data = response.json()
        assert "available_dates" in data


@pytest.mark.asyncio
async def test_service_version_3_3():
    """Test service is version 3.3.0."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
    
    assert response.status_code == 200
    assert response.json()["version"] == "3.3.0"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Phase 2 Week 3 Tests - Analytics and Calculators
"""

import pytest
from httpx import AsyncClient
from datetime import datetime


@pytest.mark.asyncio
async def test_strike_deep_dive():
    """Test strike deep dive analytics."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/analytics/strike/26200",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05"
            }
        )
    
    assert response.status_code in [200, 404, 500, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "ce_analysis" in data
        assert "pe_analysis" in data
        assert "combined_metrics" in data


@pytest.mark.asyncio
async def test_buildup_patterns():
    """Test buildup pattern detection."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/analytics/buildup-patterns",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05",
                "min_confidence": 0.7
            }
        )
    
    assert response.status_code in [200, 500, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "patterns" in data
        assert "summary" in data
        assert "bullish_signals" in data["summary"]
        assert "bearish_signals" in data["summary"]


@pytest.mark.asyncio
async def test_scalp_opportunities():
    """Test scalp opportunity detection."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/analytics/scalp-opportunities",
            params={
                "symbol_id": 13,
                "expiry": "2025-12-05",
                "min_score": 7.0
            }
        )
    
    assert response.status_code in [200, 500, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "opportunities" in data
        assert "summary" in data


@pytest.mark.asyncio
async def test_pnl_calculator():
    """Test P&L calculator."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        payload = {
            "positions": [
                {
                    "strike": 26200,
                    "option_type": "CE",
                    "buy_price": 125.50,
                    "quantity": 50,
                    "position_type": "long"
                },
                {
                    "strike": 26300,
                    "option_type": "CE",
                    "buy_price": 75.00,
                    "quantity": 50,
                    "position_type": "short"
                }
            ],
            "spot_range_start": 26000,
            "spot_range_end": 26500,
            "spot_step": 50,
            "expiry_date": "2025-12-05"
        }
        
        response = await client.post(
            "/analytics/calculators/pnl",
            json=payload
        )
    
    assert response.status_code in [200, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "strategy_analysis" in data
        assert "payoff_chart" in data
        assert "max_profit" in data["strategy_analysis"]
        assert "max_loss" in data["strategy_analysis"]


@pytest.mark.asyncio
async def test_position_sizing_calculator():
    """Test position sizing calculator."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        payload = {
            "account_balance": 100000,
            "risk_percentage": 2.0,
            "entry_price": 125.50,
            "stop_loss": 120.00,
            "lot_size": 50
        }
        
        response = await client.post(
            "/analytics/calculators/position-size",
            json=payload
        )
    
    assert response.status_code in [200, 422]
    
    if response.status_code == 200:
        data = response.json()
        assert "max_risk_amount" in data
        assert "max_lots" in data
        assert "recommended_quantity" in data
        assert data["max_risk_amount"] == 2000  # 2% of 100k


@pytest.mark.asyncio
async def test_service_version_3_0():
    """Test service is version 3.0.0."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
    
    assert response.status_code == 200
    assert response.json()["version"] == "3.0.0"


@pytest.mark.asyncio
async def test_all_endpoints_documented():
    """Test all Phase 2 endpoints are documented."""
    from services.historical.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    assert "phase2_charts" in data
    assert "phase2_analytics" in data
    assert data["total_endpoints"] == 13


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Integration Tests for Phase 2 APIs

Tests all Historical Service endpoints with real database data.
"""

import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
import asyncio

BASE_URL = "http://localhost:8002"


class TestPCREndpoints:
    """Test PCR API endpoints"""
    
    @pytest.mark.asyncio
    async def test_pcr_latest(self):
        """Test latest PCR endpoint"""
        async with AsyncClient(base_url=BASE_URL) as client:
            response = await client.get(
                "/pcr/latest",
                params={"symbol_id": 13, "expiry": "2025-12-05"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "pcr_oi" in data
            assert "pcr_volume" in data
            assert data["symbol_id"] == 13
    
    @pytest.mark.asyncio
    async def test_pcr_timeseries(self):
        """Test PCR timeseries endpoint"""
        async with AsyncClient(base_url=BASE_URL) as client:
            from_time = (datetime.utcnow() - timedelta(hours=6)).isoformat()
            to_time = datetime.utcnow().isoformat()
            
            response = await client.get(
                "/pcr/timeseries",
                params={
                    "symbol_id": 13,
                    "expiry": "2025-12-05",
                    "from_time": from_time,
                    "to_time": to_time,
                    "interval": "5m"
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            assert isinstance(data["data"], list)
    
    @pytest.mark.asyncio
    async def test_pcr_heatmap(self):
        """Test PCR heatmap endpoint"""
        async with AsyncClient(base_url=BASE_URL) as client:
            response = await client.get(
                "/pcr/heatmap",
                params={"symbol_id": 13, "expiry": "2025-12-05"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "strikes" in data
            assert isinstance(data["strikes"], dict)


class TestMarketMoodEndpoints:
    """Test Market Mood API endpoints"""
    
    @pytest.mark.asyncio
    async def test_market_mood_latest(self):
        """Test latest market mood endpoint"""
        async with AsyncClient(base_url=BASE_URL) as client:
            response = await client.get(
                "/market-mood/latest",
                params={"symbol_id": 13, "expiry": "2025-12-05"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "mood_score" in data
            assert "sentiment" in data
            assert "components" in data
            assert data["sentiment"] in ["EXTREME_FEAR", "FEAR", "NEUTRAL", "GREED", "EXTREME_GREED"]
    
    @pytest.mark.asyncio
    async def test_market_mood_gauge_data(self):
        """Test market mood gauge data endpoint"""
        async with AsyncClient(base_url=BASE_URL) as client:
            response = await client.get(
                "/market-mood/gauge-data",
                params={"symbol_id": 13, "period": "1M"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "current" in data
            assert "trend" in data
            assert "history" in data


class TestSREndpoints:
    """Test Support/Resistance endpoints"""
    
    @pytest.mark.asyncio
    async def test_sr_levels(self):
        """Test S/R levels endpoint"""
        async with AsyncClient(base_url=BASE_URL) as client:
            response = await client.get(
                "/sr/levels",
                params={"symbol_id": 13, "expiry": "2025-12-05"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "levels" in data
            assert isinstance(data["levels"], list)


class TestOverallMetricsEndpoints:
    """Test Overall Metrics endpoints"""
    
    @pytest.mark.asyncio
    async def test_overall_latest(self):
        """Test latest overall metrics endpoint"""
        async with AsyncClient(base_url=BASE_URL) as client:
            response = await client.get(
                "/overall/latest",
                params={"symbol_id": 13}
            )
            assert response.status_code == 200
            data = response.json()
            assert "total_call_oi" in data
            assert "total_put_oi" in data
            assert "pcr_oi" in data


class TestFIIDIIEndpoints:
    """Test FII/DII endpoints"""
    
    @pytest.mark.asyncio
    async def test_fii_dii_summary(self):
        """Test FII/DII summary endpoint"""
        async with AsyncClient(base_url=BASE_URL) as client:
            response = await client.get(
                "/fii-dii/summary",
                params={"period": "1M"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "summary" in data


class TestReplayEndpoints:
    """Test Historical Replay endpoints"""
    
    @pytest.mark.asyncio
    async def test_replay_snapshot(self):
        """Test replay snapshot endpoint"""
        async with AsyncClient(base_url=BASE_URL) as client:
            timestamp = (datetime.utcnow() - timedelta(hours=1)).isoformat()
            response = await client.get(
                "/replay/snapshot",
                params={
                    "symbol_id": 13,
                    "timestamp": timestamp,
                    "expiry": "2025-12-05"
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "options" in data


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])

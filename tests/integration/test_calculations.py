"""
Integration Tests for Calculations Service

Tests all calculator endpoints.
"""

import pytest
from httpx import AsyncClient
from datetime import date, timedelta

BASE_URL = "http://localhost:8004"


class TestOptionPricing:
    """Test option pricing endpoints"""
    
    @pytest.mark.asyncio
    async def test_black_scholes_call(self):
        """Test Black-Scholes call option pricing"""
        async with AsyncClient(base_url=BASE_URL) as client:
            payload = {
                "spot": 23450.0,
                "strike": 23500.0,
                "expiry_date": str((date.today() + timedelta(days=7)).isoformat()),
                "risk_free_rate": 0.05,
                "volatility": 0.15,
                "option_type": "CE",
                "model": "black_scholes"
            }
            response = await client.post("/option-price", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "theoretical_price" in data
            assert "intrinsic_value" in data
            assert "time_value" in data
            assert data["theoretical_price"] > 0
    
    @pytest.mark.asyncio
    async def test_binomial_put(self):
        """Test Binomial put option pricing"""
        async with AsyncClient(base_url=BASE_URL) as client:
            payload = {
                "spot": 23450.0,
                "strike": 23400.0,
                "expiry_date": str((date.today() + timedelta(days=7)).isoformat()),
                "risk_free_rate": 0.05,
                "volatility": 0.15,
                "option_type": "PE",
                "model": "binomial"
            }
            response = await client.post("/option-price", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["theoretical_price"] > 0


class TestIVSolver:
    """Test IV solver endpoints"""
    
    @pytest.mark.asyncio
    async def test_iv_solver_call(self):
        """Test IV solver for call option"""
        async with AsyncClient(base_url=BASE_URL) as client:
            payload = {
                "spot": 23450.0,
                "strike": 23500.0,
                "expiry_date": str((date.today() + timedelta(days=7)).isoformat()),
                "risk_free_rate": 0.05,
                "market_price": 150.0,
                "option_type": "CE"
            }
            response = await client.post("/implied-volatility", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "implied_volatility" in data
            assert "convergence_status" in data
            if data["convergence_status"] == "converged":
                assert data["implied_volatility"] > 0


class TestGreeks:
    """Test Greeks calculator endpoints"""
    
    @pytest.mark.asyncio
    async def test_greeks_calculation(self):
        """Test Greeks calculation"""
        async with AsyncClient(base_url=BASE_URL) as client:
            payload = {
                "spot": 23450.0,
                "strike": 23500.0,
                "expiry_date": str((date.today() + timedelta(days=7)).isoformat()),
                "risk_free_rate": 0.05,
                "volatility": 0.15,
                "option_type": "CE"
            }
            response = await client.post("/greeks", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert all(k in data for k in ["delta", "gamma", "theta", "vega", "rho"])
            # Delta for call should be between 0 and 1
            assert 0 <= data["delta"] <= 1
    
    @pytest.mark.asyncio
    async def test_portfolio_greeks(self):
        """Test portfolio Greeks calculation"""
        async with AsyncClient(base_url=BASE_URL) as client:
            payload = {
                "spot": 23450.0,
                "risk_free_rate": 0.05,
                "positions": [
                    {
                        "strike": 23500.0,
                        "expiry_date": str((date.today() + timedelta(days=7)).isoformat()),
                        "volatility": 0.15,
                        "option_type": "CE",
                        "quantity": 1
                    },
                    {
                        "strike": 23400.0,
                        "expiry_date": str((date.today() + timedelta(days=7)).isoformat()),
                        "volatility": 0.15,
                        "option_type": "PE",
                        "quantity": -1
                    }
                ]
            }
            response = await client.post("/greeks/portfolio", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "total_delta" in data
            assert "positions_count" in data
            assert data["positions_count"] == 2


class TestFinancialCalculators:
    """Test financial calculator endpoints"""
    
    @pytest.mark.asyncio
    async def test_lumpsum_calculator(self):
        """Test lumpsum calculator"""
        async with AsyncClient(base_url=BASE_URL) as client:
            response = await client.get(
                "/lumpsum",
                params={
                    "principal": 100000,
                    "annual_rate": 0.12,
                    "time_years": 5
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "future_value" in data
            assert data["future_value"] > data["principal"]
    
    @pytest.mark.asyncio
    async def test_sip_calculator(self):
        """Test SIP calculator"""
        async with AsyncClient(base_url=BASE_URL) as client:
            response = await client.get(
                "/sip",
                params={
                    "monthly_investment": 10000,
                    "annual_rate": 0.12,
                    "time_years": 10
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "future_value" in data
            assert "wealth_gained" in data
            assert data["future_value"] > data["invested_amount"]
    
    @pytest.mark.asyncio
    async def test_emi_calculator(self):
        """Test EMI calculator"""
        async with AsyncClient(base_url=BASE_URL) as client:
            response = await client.get(
                "/emi",
                params={
                    "loan_amount": 1000000,
                    "annual_rate": 0.09,
                    "tenure_months": 60
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "emi" in data
            assert "total_interest" in data
            assert data["emi"] > 0


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])

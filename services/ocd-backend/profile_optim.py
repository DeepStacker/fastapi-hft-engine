import time
import asyncio
from app.services.leg_optimizer import LegOptimizer, StrategyType, RiskProfile
from core.analytics.greeks import GreeksCalculator

async def profile_optimizer():
    optimizer = LegOptimizer()
    greeks_calc = GreeksCalculator()
    
    # Mock option chain (NIFTY approx 22000)
    oc = []
    spot = 22000
    for strike in range(21000, 23000, 50):
        oc.append({
            "strike": strike,
            "option_type": "CE",
            "ltp": 200 + (22000 - strike if strike < 22000 else 0),
            "oi": 100000,
            "iv": 15,
            "delta": 0.5,
            "gamma": 0.001,
            "theta": -5,
            "vega": 10
        })
        oc.append({
            "strike": strike,
            "option_type": "PE",
            "ltp": 200 + (strike - 22000 if strike > 22000 else 0),
            "oi": 100000,
            "iv": 15,
            "delta": -0.5,
            "gamma": 0.001,
            "theta": -5,
            "vega": 10
        })
        
    start = time.time()
    print("Starting optimization...")
    results = optimizer.optimize(
        strategy_type=StrategyType.IRON_CONDOR,
        option_chain=oc,
        spot_price=spot,
        atm_strike=22000,
        expiry="2024-03-28",
        lot_size=50,
        risk_profile=RiskProfile.MODERATE,
        max_capital=100000,
        step_size=50
    )
    elapsed = time.time() - start
    print(f"Optimization took {elapsed:.4f}s")
    print(f"Found {len(results)} strategies")
    
    # Test Greeks Calculation
    print("Testing Greeks Calculation...")
    start_greeks = time.time()
    for _ in range(10): # Test 10 times
        greeks = greeks_calc.calculate_all_greeks(
            S=22000,
            K=22100,
            T=0.01,
            sigma=0.15,
            option_type="call"
        )
    elapsed_greeks = time.time() - start_greeks
    print(f"10 Greek calculations took {elapsed_greeks:.4f}s")
    print(f"Sample delta: {greeks.delta}")

if __name__ == "__main__":
    asyncio.run(profile_optimizer())

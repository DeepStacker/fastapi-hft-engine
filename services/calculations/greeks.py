"""
Greeks Calculator (Shim)
Delegates to core.analytics.greeks.
"""
from typing import Dict, List
from datetime import date
from core.analytics.greeks import GreeksCalculator as CoreGreeksCalculator
from services.calculations.option_pricing import OptionPricer

class GreeksCalculator:
    """
    Shim for backward compatibility.
    """
    def __init__(self):
        self.core = CoreGreeksCalculator()
        self.pricer = OptionPricer()
        
    def calculate_greeks(
        self, spot: float, strike: float, expiry_date: date,
        risk_free_rate: float, volatility: float, option_type: str
    ) -> Dict[str, float]:
        # Update rate if changed
        if risk_free_rate != self.core.r:
            self.core.r = risk_free_rate
            
        T = self.pricer._calculate_time_to_expiry(expiry_date)
        
        greeks = self.core.calculate_all_greeks(spot, strike, T, volatility, option_type)
        
        return {
            "delta": greeks.delta, "gamma": greeks.gamma,
            "theta": greeks.theta, "vega": greeks.vega, "rho": greeks.rho
        }

    def calculate_portfolio_greeks(self, positions: List[Dict], spot: float, risk_free_rate: float) -> Dict[str, float]:
        # Use core portfolio calc, adapting input format
        if risk_free_rate != self.core.r:
             self.core.r = risk_free_rate
             
        core_positions = []
        for p in positions:
            T = self.pricer._calculate_time_to_expiry(p["expiry_date"])
            core_positions.append({
                "strike": p["strike"], "T": T, "sigma": p["volatility"],
                "option_type": p["option_type"], "quantity": p["quantity"]
            })
            
        result = self.core.calculate_portfolio_greeks(core_positions, spot)
        result["positions_count"] = len(positions)
        return result

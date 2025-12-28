"""
Implied Volatility Solver

Uses Newton-Raphson method to solve for implied volatility.
"""

import math
from datetime import date
from typing import Optional, Dict
from scipy.stats import norm
from services.calculations.option_pricing import OptionPricer


class IVSolver:
    """
    Implied Volatility calculator using Newton-Raphson method
    """
    
    def __init__(self, max_iterations: int = 100, tolerance: float = 0.0001):
        self.max_iterations = max_iterations
        self.tolerance = tolerance
        self.pricer = OptionPricer()
    
    def _vega(self, spot: float, strike: float, time_to_expiry: float, risk_free_rate: float, volatility: float) -> float:
        """
        Calculate Vega (derivative of option price with respect to volatility)
        """
        if time_to_expiry <= 0 or volatility <= 0:
            return 0.0
        
        d1 = (math.log(spot / strike) + (risk_free_rate + 0.5 * volatility ** 2) * time_to_expiry) / \
             (volatility * math.sqrt(time_to_expiry))
        
        vega = spot * norm.pdf(d1) * math.sqrt(time_to_expiry)
        return vega
    
    def newton_raphson(
        self,
        spot: float,
        strike: float,
        expiry_date: date,
        risk_free_rate: float,
        market_price: float,
        option_type: str,
        initial_guess: float = 0.3
    ) -> Dict[str, any]:
        """
        Solve for implied volatility using Newton-Raphson method
        
        Args:
            spot: Current underlying price
            strike: Strike price
            expiry_date: Expiry date
            risk_free_rate: Risk-free rate (decimal)
            market_price: Observed market price of option
            option_type: "CE" or "PE"
            initial_guess: Starting volatility guess (default: 0.3 = 30%)
        
        Returns:
            Dict with implied_volatility, iterations, convergence_status, error
        """
        time_to_expiry = self.pricer._calculate_time_to_expiry(expiry_date)
        
        if time_to_expiry <= 0:
            return {
                "implied_volatility": None,
                "iterations": 0,
                "convergence_status": "failed",
                "error": "Option has expired"
            }
        
        # Check if option is too far OTM or ITM
        intrinsic = max(spot - strike, 0) if option_type == "CE" else max(strike - spot, 0)
        if market_price < intrinsic:
            return {
                "implied_volatility": None,
                "iterations": 0,
                "convergence_status": "failed",
                "error": "Market price below intrinsic value"
            }
        
        volatility = initial_guess
        
        for iteration in range(self.max_iterations):
            # Calculate option price at current volatility
            pricing = self.pricer.black_scholes(
                spot, strike, time_to_expiry, risk_free_rate, volatility, option_type
            )
            calculated_price = pricing["theoretical_price"]
            
            # Calculate price difference
            price_diff = calculated_price - market_price
            
            # Check convergence
            if abs(price_diff) < self.tolerance:
                return {
                    "implied_volatility": round(volatility, 4),
                    "iterations": iteration + 1,
                    "convergence_status": "converged",
                    "error": None,
                    "final_price_diff": round(price_diff, 4)
                }
            
            # Calculate vega
            vega = self._vega(spot, strike, time_to_expiry, risk_free_rate, volatility)
            
            if abs(vega) < 1e-10:
                return {
                    "implied_volatility": None,
                    "iterations": iteration + 1,
                    "convergence_status": "failed",
                    "error": "Vega too small, cannot converge"
                }
            
            # Newton-Raphson update
            volatility = volatility - price_diff / vega
            
            # Ensure volatility stays positive
            volatility = max(volatility, 0.001)
            volatility = min(volatility, 5.0)  # Cap at 500%
        
        # Did not converge within max iterations
        return {
            "implied_volatility": round(volatility, 4),
            "iterations": self.max_iterations,
            "convergence_status": "max_iterations_reached",
            "error": "Did not converge within maximum iterations"
        }

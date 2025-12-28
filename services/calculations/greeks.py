"""
Greeks Calculator

Calculates option Greeks: Delta, Gamma, Theta, Vega, Rho
"""

import math
from datetime import date
from typing import Dict, List
from scipy.stats import norm
from services.calculations.option_pricing import OptionPricer


class GreeksCalculator:
    """
    Calculate option Greeks using Black-Scholes formulas
    """
    
    def __init__(self):
        self.pricer = OptionPricer()
    
    def calculate_greeks(
        self,
        spot: float,
        strike: float,
        expiry_date: date,
        risk_free_rate: float,
        volatility: float,
        option_type: str
    ) -> Dict[str, float]:
        """
        Calculate all Greeks for an option
        
        Args:
            spot: Current price
            strike: Strike price
            expiry_date: Expiry date
            risk_free_rate: Risk-free rate (decimal)
            volatility: Volatility (decimal)
            option_type: "CE" or "PE"
        
        Returns:
            Dict with delta, gamma, theta, vega, rho
        """
        time_to_expiry = self.pricer._calculate_time_to_expiry(expiry_date)
        
        if time_to_expiry <= 0 or volatility <= 0:
            return {
                "delta": 0.0,
                "gamma": 0.0,
                "theta": 0.0,
                "vega": 0.0,
                "rho": 0.0
            }
        
        # Calculate d1 and d2
        d1 = (math.log(spot / strike) + (risk_free_rate + 0.5 * volatility ** 2) * time_to_expiry) / \
             (volatility * math.sqrt(time_to_expiry))
        d2 = d1 - volatility * math.sqrt(time_to_expiry)
        
        # Delta
        if option_type == "CE":
            delta = norm.cdf(d1)
        else:  # PE
            delta = norm.cdf(d1) - 1
        
        # Gamma (same for calls and puts)
        gamma = norm.pdf(d1) / (spot * volatility * math.sqrt(time_to_expiry))
        
        # Theta (daily theta)
        if option_type == "CE":
            theta = (
                -spot * norm.pdf(d1) * volatility / (2 * math.sqrt(time_to_expiry))
                - risk_free_rate * strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2)
            ) / 365  # Convert to daily
        else:  # PE
            theta = (
                -spot * norm.pdf(d1) * volatility / (2 * math.sqrt(time_to_expiry))
                + risk_free_rate * strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2)
            ) / 365
        
        # Vega (per 1% change in volatility)
        vega = spot * norm.pdf(d1) * math.sqrt(time_to_expiry) / 100
        
        # Rho (per 1% change in interest rate)
        if option_type == "CE":
            rho = strike * time_to_expiry * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2) / 100
        else:  # PE
            rho = -strike * time_to_expiry * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2) / 100
        
        return {
            "delta": round(delta, 4),
            "gamma": round(gamma, 6),
            "theta": round(theta, 4),
            "vega": round(vega, 4),
            "rho": round(rho, 4)
        }
    
    def calculate_portfolio_greeks(
        self,
        positions: List[Dict],
        spot: float,
        risk_free_rate: float
    ) -> Dict[str, float]:
        """
        Calculate portfolio-level Greeks
        
        Args:
            positions: List of position dicts with:
                - strike: float
                - expiry_date: date
                - volatility: float
                - option_type: str
                - quantity: int (positive for long, negative for short)
            spot: Current underlying price
            risk_free_rate: Risk-free rate
        
        Returns:
            Dict with total_delta, total_gamma, total_theta, total_vega, total_rho
        """
        total_delta = 0.0
        total_gamma = 0.0
        total_theta = 0.0
        total_vega = 0.0
        total_rho = 0.0
        
        for position in positions:
            greeks = self.calculate_greeks(
                spot=spot,
                strike=position["strike"],
                expiry_date=position["expiry_date"],
                risk_free_rate=risk_free_rate,
                volatility=position["volatility"],
                option_type=position["option_type"]
            )
            
            quantity = position["quantity"]
            
            total_delta += greeks["delta"] * quantity
            total_gamma += greeks["gamma"] * quantity
            total_theta += greeks["theta"] * quantity
            total_vega += greeks["vega"] * quantity
            total_rho += greeks["rho"] * quantity
        
        return {
            "total_delta": round(total_delta, 4),
            "total_gamma": round(total_gamma, 6),
            "total_theta": round(total_theta, 4),
            "total_vega": round(total_vega, 4),
            "total_rho": round(total_rho, 4),
            "positions_count": len(positions)
        }

"""
Option Pricing Calculators

Implements Black-Scholes and Binomial Tree models for option pricing.
"""

import math
from datetime import datetime, date
from typing import Literal, Dict
from scipy.stats import norm
import numpy as np


class OptionPricer:
    """
    Option pricing using Black-Scholes and Binomial Tree models
    """
    
    @staticmethod
    def _calculate_time_to_expiry(expiry_date: date, current_date: date = None) -> float:
        """Calculate time to expiry in years"""
        if current_date is None:
            current_date = datetime.now().date()
        
        days_to_expiry = (expiry_date - current_date).days
        return max(days_to_expiry / 365.0, 0.001)  # Minimum 0.001 to avoid division by zero
    
    @staticmethod
    def black_scholes(
        spot: float,
        strike: float,
        time_to_expiry: float,
        risk_free_rate: float,
        volatility: float,
        option_type: Literal["CE", "PE"]
    ) -> Dict[str, float]:
        """
        Black-Scholes option pricing model
        
        Args:
            spot: Current underlying price
            strike: Strike price
            time_to_expiry: Time to expiry in years
            risk_free_rate: Risk-free interest rate (annual, as decimal: 0.05 = 5%)
            volatility: Implied volatility (as decimal: 0.20 = 20%)
            option_type: "CE" for Call, "PE" for Put
        
        Returns:
            Dict with theoretical_price, intrinsic_value, time_value
        """
        if time_to_expiry <= 0 or volatility <= 0:
            # Handle edge cases
            intrinsic = max(spot - strike, 0) if option_type == "CE" else max(strike - spot, 0)
            return {
                "theoretical_price": intrinsic,
                "intrinsic_value": intrinsic,
                "time_value": 0.0
            }
        
        # Calculate d1 and d2
        d1 = (math.log(spot / strike) + (risk_free_rate + 0.5 * volatility ** 2) * time_to_expiry) / \
             (volatility * math.sqrt(time_to_expiry))
        d2 = d1 - volatility * math.sqrt(time_to_expiry)
        
        # Calculate option price
        if option_type == "CE":
            price = spot * norm.cdf(d1) - strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2)
            intrinsic = max(spot - strike, 0)
        else:  # PE
            price = strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2) - spot * norm.cdf(-d1)
            intrinsic = max(strike - spot, 0)
        
        time_value = max(price - intrinsic, 0)
        
        return {
            "theoretical_price": round(price, 2),
            "intrinsic_value": round(intrinsic, 2),
            "time_value": round(time_value, 2)
        }
    
    @staticmethod
    def binomial_tree(
        spot: float,
        strike: float,
        time_to_expiry: float,
        risk_free_rate: float,
        volatility: float,
        option_type: Literal["CE", "PE"],
        steps: int = 100
    ) -> Dict[str, float]:
        """
        Binomial Tree option pricing (supports American options)
        
        Args:
            spot: Current underlying price
            strike: Strike price
            time_to_expiry: Time to expiry in years
            risk_free_rate: Risk-free rate
            volatility: Volatility
            option_type: "CE" or "PE"
            steps: Number of time steps in tree
        
        Returns:
            Dict with theoretical_price, intrinsic_value, time_value
        """
        dt = time_to_expiry / steps
        u = math.exp(volatility * math.sqrt(dt))  # Up factor
        d = 1 / u  # Down factor
        p = (math.exp(risk_free_rate * dt) - d) / (u - d)  # Risk-neutral probability
        
        # Initialize asset prices at maturity
        asset_prices = np.zeros(steps + 1)
        for i in range(steps + 1):
            asset_prices[i] = spot * (u ** (steps - i)) * (d ** i)
        
        # Initialize option values at maturity
        option_values = np.zeros(steps + 1)
        for i in range(steps + 1):
            if option_type == "CE":
                option_values[i] = max(asset_prices[i] - strike, 0)
            else:
                option_values[i] = max(strike - asset_prices[i], 0)
        
        # Backward induction
        for step in range(steps - 1, -1, -1):
            for i in range(step + 1):
                # Calculate option value
                hold_value = math.exp(-risk_free_rate * dt) * (p * option_values[i] + (1 - p) * option_values[i + 1])
                
                # For American options, check early exercise
                asset_price = spot * (u ** (step - i)) * (d ** i)
                if option_type == "CE":
                    exercise_value = max(asset_price - strike, 0)
                else:
                    exercise_value = max(strike - asset_price, 0)
                
                option_values[i] = max(hold_value, exercise_value)
        
        price = option_values[0]
        intrinsic = max(spot - strike, 0) if option_type == "CE" else max(strike - spot, 0)
        time_value = max(price - intrinsic, 0)
        
        return {
            "theoretical_price": round(price, 2),
            "intrinsic_value": round(intrinsic, 2),
            "time_value": round(time_value, 2)
        }
    
    def calculate_option_price(
        self,
        spot: float,
        strike: float,
        expiry_date: date,
        risk_free_rate: float,
        volatility: float,
        option_type: Literal["CE", "PE"],
        model: Literal["black_scholes", "binomial"] = "black_scholes"
    ) -> Dict[str, float]:
        """
        Main method to calculate option price
        
        Args:
            spot: Current price
            strike: Strike price
            expiry_date: Expiry date
            risk_free_rate: Risk-free rate (annual, decimal)
            volatility: Volatility (decimal)
            option_type: "CE" or "PE"
            model: "black_scholes" or "binomial"
        
        Returns:
            Dict with pricing results
        """
        time_to_expiry = self._calculate_time_to_expiry(expiry_date)
        
        if model == "black_scholes":
            return self.black_scholes(spot, strike, time_to_expiry, risk_free_rate, volatility, option_type)
        else:
            return self.binomial_tree(spot, strike, time_to_expiry, risk_free_rate, volatility, option_type)

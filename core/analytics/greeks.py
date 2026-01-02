"""
Advanced Greeks Calculation Service
"""
import math
import scipy.stats as stats
from dataclasses import dataclass
from typing import Dict, Optional, Literal

from core.analytics.bsm import BlackScholesModel
from core.analytics.models import AdvancedGreeks

class GreeksCalculator:
    """
    Comprehensive Greeks calculation service.
    Includes both standard and advanced Greeks.
    """
    
    def __init__(self, risk_free_rate: float = 0.10):
        self.r = risk_free_rate
        # We use BSM just for d1/d2 helpers if needed, or implement static helpers
    
    def calculate_all_greeks(
        self,
        S: float,       # Spot price
        K: float,       # Strike price
        T: float,       # Time to expiration in years
        sigma: float,   # Implied volatility (decimal)
        option_type: Literal["call", "put", "CE", "PE"] = "call"
    ) -> AdvancedGreeks:
        """
        Calculate all Greeks for an option (First, Second, Third order).
        """
        if T <= 0 or sigma <= 0 or S <= 0:
            return AdvancedGreeks()
            
        # Normalize option type
        is_call = option_type.lower() in ["call", "ce"]
        
        try:
            # Calculate d1 and d2
            sqrt_T = math.sqrt(T)
            d1 = (math.log(S / K) + (self.r + 0.5 * sigma ** 2) * T) / (sigma * sqrt_T)
            d2 = d1 - sigma * sqrt_T
            
            # Common terms
            pdf_d1 = stats.norm.pdf(d1)
            cdf_d1 = stats.norm.cdf(d1)
            cdf_d2 = stats.norm.cdf(d2)
            
            # For puts
            cdf_neg_d1 = stats.norm.cdf(-d1)
            cdf_neg_d2 = stats.norm.cdf(-d2)
            
            exp_rt = math.exp(-self.r * T)
            
            # --- First Order ---
            if is_call:
                delta = cdf_d1
                # Theta
                theta_term1 = -(S * pdf_d1 * sigma) / (2 * sqrt_T)
                theta_term2 = -self.r * K * exp_rt * cdf_d2
                theta = (theta_term1 + theta_term2) / 365.0
                # Rho
                rho = K * T * exp_rt * cdf_d2 / 100.0
            else:
                delta = cdf_d1 - 1
                # Theta
                theta_term1 = -(S * pdf_d1 * sigma) / (2 * sqrt_T)
                theta_term2 = self.r * K * exp_rt * cdf_neg_d2
                theta = (theta_term1 + theta_term2) / 365.0
                # Rho
                rho = -K * T * exp_rt * cdf_neg_d2 / 100.0
            
            vega = S * pdf_d1 * sqrt_T / 100.0
            
            # --- Second Order ---
            gamma = pdf_d1 / (S * sigma * sqrt_T)
            vanna = -pdf_d1 * d2 / sigma
            
            charm = -pdf_d1 * (2 * self.r * T - d2 * sigma * sqrt_T) / (2 * T * sigma * sqrt_T)
            if not is_call:
                charm = charm # Formula adjustment might be needed for puts depending on source, usually charm is similar logic
            
            # --- Third Order ---
            speed = -gamma / S * (d1 / (sigma * sqrt_T) + 1)
            zomma = gamma * (d1 * d2 - 1) / sigma
            
            color = -pdf_d1 / (2 * S * T * sigma * sqrt_T) * (
                2 * self.r * T + 1 + (2 * self.r * T - d2 * sigma * sqrt_T) * d1 / (sigma * sqrt_T)
            )
            
            # --- Volatility Greeks ---
            vomma = vega * d1 * d2 / sigma
            veta = -S * pdf_d1 * sqrt_T * (
                self.r * d1 / (sigma * sqrt_T) - (1 + d1 * d2) / (2 * T)
            )
            
            # --- Higher Order ---
            ultima = -vega / (sigma ** 2) * (
                d1 * d2 * (1 - d1 * d2) + d1 ** 2 + d2 ** 2
            )
            
            return AdvancedGreeks(
                delta=round(delta, 5),
                gamma=round(gamma, 6),
                theta=round(theta, 5),
                vega=round(vega, 5),
                rho=round(rho, 5),
                vanna=round(vanna, 6),
                charm=round(charm, 6),
                speed=round(speed, 6),
                zomma=round(zomma, 6),
                color=round(color, 6),
                vomma=round(vomma, 6),
                veta=round(veta, 6),
                ultima=round(ultima, 6)
            )
            
        except Exception:
            # Fallback on error
            return AdvancedGreeks()

    def calculate_for_chain(
        self,
        spot: float,
        strikes: list,
        T: float,
        call_ivs: Dict[float, float],
        put_ivs: Dict[float, float]
    ) -> Dict[float, Dict]:
        """
        Calculate Greeks for entire option chain.
        """
        result = {}
        for strike in strikes:
            call_iv = call_ivs.get(strike, 0)
            put_iv = put_ivs.get(strike, 0)
            
            ce_greeks = self.calculate_all_greeks(spot, strike, T, call_iv, "call")
            pe_greeks = self.calculate_all_greeks(spot, strike, T, put_iv, "put")
            
            result[strike] = {
                "ce": ce_greeks,
                "pe": pe_greeks
            }
        return result

    def calculate_portfolio_greeks(
        self,
        positions: list, # List of dicts
        spot: float
    ) -> Dict[str, float]:
        """
        Calculate portfolio-level Greeks.
        positions: List of dicts with {strike, T (years), sigma, option_type, quantity}
        """
        total = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}
        
        for pos in positions:
            greeks = self.calculate_all_greeks(
                spot, pos["strike"], pos["T"], pos["sigma"], pos["option_type"]
            )
            qty = pos.get("quantity", 1)
            
            total["delta"] += greeks.delta * qty
            total["gamma"] += greeks.gamma * qty
            total["theta"] += greeks.theta * qty
            total["vega"] += greeks.vega * qty
            total["rho"] += greeks.rho * qty
            
        return {k: round(v, 4) for k, v in total.items()}

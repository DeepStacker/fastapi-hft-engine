"""
Greeks Service
Calculates all option Greeks including advanced Greeks
"""
import math
from typing import Dict, Optional
from dataclasses import dataclass

import scipy.stats as stats
import numpy as np

from app.services.bsm import BSMService


@dataclass
class AdvancedGreeks:
    """All Greeks including advanced ones"""
    # First order
    delta: float
    vega: float
    theta: float
    rho: float
    
    # Second order
    gamma: float
    vanna: float  # dDelta/dIV
    charm: float  # dDelta/dTime (delta decay)
    
    # Third order
    speed: float  # dGamma/dSpot
    zomma: float  # dGamma/dIV
    color: float  # dGamma/dTime
    
    # Volatility Greeks
    vomma: float  # dVega/dIV (volga)
    veta: float   # dVega/dTime
    
    # Higher order
    ultima: float  # dVomma/dIV


class GreeksService:
    """
    Comprehensive Greeks calculation service.
    Includes both standard and advanced Greeks.
    Delegates core BSM calculations to BSMService to avoid code duplication.
    """
    
    def __init__(self, risk_free_rate: float = 0.10):
        self.r = risk_free_rate
        self.bsm = BSMService(risk_free_rate)
    
    # NOTE: _d1 and _d2 removed - using BSMService._d1 and BSMService._d2 instead
    
    def calculate_all_greeks(
        self,
        S: float,
        K: float,
        T: float,
        sigma: float,
        option_type: str = "call"
    ) -> AdvancedGreeks:
        """
        Calculate all Greeks for an option.
        
        Args:
            S: Spot price
            K: Strike price
            T: Time to expiration in years
            sigma: Implied volatility (as decimal)
            option_type: 'call' or 'put'
            
        Returns:
            AdvancedGreeks dataclass with all calculated values
        """
        if T <= 0 or sigma <= 0 or S <= 0:
            return self._get_zero_greeks()
        
        # Use BSMService methods instead of duplicated local methods
        d1 = BSMService._d1(S, K, T, self.r, sigma)
        d2 = BSMService._d2(S, K, T, self.r, sigma)
        
        sqrt_T = math.sqrt(T)
        pdf_d1 = stats.norm.pdf(d1)
        cdf_d1 = stats.norm.cdf(d1)
        cdf_d2 = stats.norm.cdf(d2)
        
        is_call = option_type.lower() == "call"
        
        # First order Greeks
        if is_call:
            delta = cdf_d1
        else:
            delta = cdf_d1 - 1
        
        vega = S * pdf_d1 * sqrt_T / 100
        
        theta_term1 = -(S * pdf_d1 * sigma) / (2 * sqrt_T)
        if is_call:
            theta_term2 = -self.r * K * math.exp(-self.r * T) * cdf_d2
        else:
            theta_term2 = self.r * K * math.exp(-self.r * T) * stats.norm.cdf(-d2)
        theta = (theta_term1 + theta_term2) / 365
        
        if is_call:
            rho = K * T * math.exp(-self.r * T) * cdf_d2 / 100
        else:
            rho = -K * T * math.exp(-self.r * T) * stats.norm.cdf(-d2) / 100
        
        # Second order Greeks
        gamma = pdf_d1 / (S * sigma * sqrt_T)
        
        vanna = -pdf_d1 * d2 / sigma
        
        charm = -pdf_d1 * (
            2 * self.r * T - d2 * sigma * sqrt_T
        ) / (2 * T * sigma * sqrt_T)
        if not is_call:
            charm = charm
        
        # Third order Greeks
        speed = -gamma / S * (d1 / (sigma * sqrt_T) + 1)
        
        zomma = gamma * (d1 * d2 - 1) / sigma
        
        color = -pdf_d1 / (2 * S * T * sigma * sqrt_T) * (
            2 * self.r * T + 1 + (2 * self.r * T - d2 * sigma * sqrt_T) * d1 / (sigma * sqrt_T)
        )
        
        # Volatility Greeks
        vomma = vega * d1 * d2 / sigma
        
        veta = -S * pdf_d1 * sqrt_T * (
            self.r * d1 / (sigma * sqrt_T) - (1 + d1 * d2) / (2 * T)
        )
        
        # Ultima
        ultima = -vega / (sigma ** 2) * (
            d1 * d2 * (1 - d1 * d2) + d1 ** 2 + d2 ** 2
        )
        
        return AdvancedGreeks(
            delta=round(delta, 6),
            vega=round(vega, 6),
            theta=round(theta, 6),
            rho=round(rho, 6),
            gamma=round(gamma, 6),
            vanna=round(vanna, 6),
            charm=round(charm, 6),
            speed=round(speed, 6),
            zomma=round(zomma, 6),
            color=round(color, 6),
            vomma=round(vomma, 6),
            veta=round(veta, 6),
            ultima=round(ultima, 6),
        )
    
    def _get_zero_greeks(self) -> AdvancedGreeks:
        """Return zero values for all Greeks"""
        return AdvancedGreeks(
            delta=0, vega=0, theta=0, rho=0,
            gamma=0, vanna=0, charm=0,
            speed=0, zomma=0, color=0,
            vomma=0, veta=0, ultima=0
        )
    
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
        
        Args:
            spot: Spot price
            strikes: List of strike prices
            T: Time to expiration in years
            call_ivs: Dictionary of strike -> call IV
            put_ivs: Dictionary of strike -> put IV
            
        Returns:
            Dictionary of strike -> {ce_greeks, pe_greeks}
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


# Singleton instance
greeks_service = GreeksService()

"""
Black-Scholes Model Service
Implements option pricing and related calculations
"""
import math
from typing import Dict, Optional, Tuple
from dataclasses import dataclass

import scipy.stats as stats
import numpy as np

from app.config.settings import settings


@dataclass
class BSMResult:
    """Result container for BSM calculations"""
    price: float
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: float


class BSMService:
    """
    Black-Scholes Model calculations for European options.
    Provides theoretical pricing and Greeks calculations.
    """
    
    def __init__(self, risk_free_rate: Optional[float] = None):
        self.r = risk_free_rate or settings.DEFAULT_RISK_FREE_RATE
    
    @staticmethod
    def _d1(S: float, K: float, T: float, r: float, sigma: float) -> float:
        """Calculate d1 parameter"""
        if T <= 0 or sigma <= 0:
            return 0.0
        return (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    
    @staticmethod
    def _d2(S: float, K: float, T: float, r: float, sigma: float) -> float:
        """Calculate d2 parameter"""
        if T <= 0 or sigma <= 0:
            return 0.0
        return BSMService._d1(S, K, T, r, sigma) - sigma * math.sqrt(T)
    
    def price(
        self,
        S: float,
        K: float,
        T: float,
        sigma: float,
        option_type: str = "call"
    ) -> float:
        """
        Calculate theoretical option price using Black-Scholes model.
        
        Args:
            S: Spot price
            K: Strike price
            T: Time to expiration in years
            sigma: Implied volatility (as decimal, e.g., 0.20 for 20%)
            option_type: 'call' or 'put'
            
        Returns:
            Theoretical option price
        """
        if T <= 0:
            # At expiration
            if option_type.lower() == "call":
                return max(0, S - K)
            return max(0, K - S)
        
        if sigma <= 0:
            return 0.0
        
        d1 = self._d1(S, K, T, self.r, sigma)
        d2 = self._d2(S, K, T, self.r, sigma)
        
        if option_type.lower() == "call":
            price = S * stats.norm.cdf(d1) - K * math.exp(-self.r * T) * stats.norm.cdf(d2)
        else:
            price = K * math.exp(-self.r * T) * stats.norm.cdf(-d2) - S * stats.norm.cdf(-d1)
        
        return max(0, price)
    
    def delta(
        self,
        S: float,
        K: float,
        T: float,
        sigma: float,
        option_type: str = "call"
    ) -> float:
        """Calculate option delta"""
        if T <= 0 or sigma <= 0:
            if option_type.lower() == "call":
                return 1.0 if S > K else 0.0
            return -1.0 if S < K else 0.0
        
        d1 = self._d1(S, K, T, self.r, sigma)
        
        if option_type.lower() == "call":
            return stats.norm.cdf(d1)
        return stats.norm.cdf(d1) - 1
    
    def gamma(
        self,
        S: float,
        K: float,
        T: float,
        sigma: float
    ) -> float:
        """Calculate option gamma (same for calls and puts)"""
        if T <= 0 or sigma <= 0 or S <= 0:
            return 0.0
        
        d1 = self._d1(S, K, T, self.r, sigma)
        return stats.norm.pdf(d1) / (S * sigma * math.sqrt(T))
    
    def theta(
        self,
        S: float,
        K: float,
        T: float,
        sigma: float,
        option_type: str = "call"
    ) -> float:
        """Calculate option theta (time decay per day)"""
        if T <= 0 or sigma <= 0:
            return 0.0
        
        d1 = self._d1(S, K, T, self.r, sigma)
        d2 = self._d2(S, K, T, self.r, sigma)
        
        term1 = -(S * stats.norm.pdf(d1) * sigma) / (2 * math.sqrt(T))
        
        if option_type.lower() == "call":
            term2 = -self.r * K * math.exp(-self.r * T) * stats.norm.cdf(d2)
        else:
            term2 = self.r * K * math.exp(-self.r * T) * stats.norm.cdf(-d2)
        
        # Return daily theta
        return (term1 + term2) / 365
    
    def vega(
        self,
        S: float,
        K: float,
        T: float,
        sigma: float
    ) -> float:
        """Calculate option vega (same for calls and puts)"""
        if T <= 0 or sigma <= 0:
            return 0.0
        
        d1 = self._d1(S, K, T, self.r, sigma)
        return S * stats.norm.pdf(d1) * math.sqrt(T) / 100  # Per 1% change in IV
    
    def rho(
        self,
        S: float,
        K: float,
        T: float,
        sigma: float,
        option_type: str = "call"
    ) -> float:
        """Calculate option rho"""
        if T <= 0 or sigma <= 0:
            return 0.0
        
        d2 = self._d2(S, K, T, self.r, sigma)
        
        if option_type.lower() == "call":
            return K * T * math.exp(-self.r * T) * stats.norm.cdf(d2) / 100
        return -K * T * math.exp(-self.r * T) * stats.norm.cdf(-d2) / 100
    
    def calculate_all(
        self,
        S: float,
        K: float,
        T: float,
        sigma: float,
        option_type: str = "call"
    ) -> BSMResult:
        """Calculate price and all Greeks at once"""
        return BSMResult(
            price=self.price(S, K, T, sigma, option_type),
            delta=self.delta(S, K, T, sigma, option_type),
            gamma=self.gamma(S, K, T, sigma),
            theta=self.theta(S, K, T, sigma, option_type),
            vega=self.vega(S, K, T, sigma),
            rho=self.rho(S, K, T, sigma, option_type),
        )
    
    def implied_volatility(
        self,
        market_price: float,
        S: float,
        K: float,
        T: float,
        option_type: str = "call",
        precision: float = 0.0001,
        max_iterations: int = 100
    ) -> Optional[float]:
        """
        Calculate implied volatility using Newton-Raphson method.
        
        Args:
            market_price: Current market price of the option
            S: Spot price
            K: Strike price
            T: Time to expiration in years
            option_type: 'call' or 'put'
            precision: Convergence threshold
            max_iterations: Maximum iterations
            
        Returns:
            Implied volatility or None if not found
        """
        if T <= 0 or market_price <= 0:
            return None
        
        sigma = 0.3  # Initial guess
        
        for _ in range(max_iterations):
            price = self.price(S, K, T, sigma, option_type)
            vega = self.vega(S, K, T, sigma) * 100  # Undo the /100 scaling
            
            if vega < 1e-10:
                return None
            
            diff = market_price - price
            
            if abs(diff) < precision:
                return sigma
            
            sigma += diff / vega
            
            # Keep sigma in reasonable bounds
            sigma = max(0.001, min(5.0, sigma))
        
        return sigma if abs(market_price - self.price(S, K, T, sigma, option_type)) < 1 else None
    
    def expected_price_range(
        self,
        S: float,
        iv: float,
        T_days: int,
        confidence: float = 0.68
    ) -> Tuple[float, float]:
        """
        Calculate expected price range based on IV.
        
        Args:
            S: Spot price
            iv: Implied volatility (as decimal)
            T_days: Days to expiration
            confidence: Confidence level (0.68 = 1 std dev)
            
        Returns:
            Tuple of (lower_bound, upper_bound)
        """
        if T_days <= 0:
            return (S, S)
        
        T = T_days / 365
        z = stats.norm.ppf((1 + confidence) / 2)
        move = S * iv * math.sqrt(T) * z
        
        return (S - move, S + move)
    
    def weekly_theta_decay(self, T_days: int) -> float:
        """Calculate approximate weekly theta decay factor"""
        if T_days <= 0:
            return 1.0
        return 1 / math.sqrt(T_days / 7)


# Singleton instance
bsm_service = BSMService()

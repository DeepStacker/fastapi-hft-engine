"""
Black-Scholes Model Service - Re-export from core

This module re-exports the BSM implementation from core.analytics.
For backward compatibility with existing imports.
"""
from core.analytics.bsm import BlackScholesModel as BSMCore
from dataclasses import dataclass
from typing import Optional


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
    Wrapper around core BSM for backward compatibility.
    Maintains same interface as original ocd-backend BSMService.
    """
    
    def __init__(self, risk_free_rate: Optional[float] = None):
        from app.config.settings import settings
        self._core = BSMCore(
            risk_free_rate=risk_free_rate or settings.DEFAULT_RISK_FREE_RATE
        )
        self.r = self._core.risk_free_rate
    
    def price(self, S: float, K: float, T: float, sigma: float, option_type: str = "call") -> float:
        """Calculate theoretical option price"""
        opt_type = "CE" if option_type.lower() == "call" else "PE"
        result = self._core.calculate(S, K, T, sigma, opt_type)
        return result['theoretical_price']
    
    def delta(self, S: float, K: float, T: float, sigma: float, option_type: str = "call") -> float:
        opt_type = "CE" if option_type.lower() == "call" else "PE"
        greeks = self._core.calculate_greeks(S, K, T, sigma, opt_type)
        return greeks.delta
    
    def gamma(self, S: float, K: float, T: float, sigma: float) -> float:
        greeks = self._core.calculate_greeks(S, K, T, sigma, "CE")
        return greeks.gamma
    
    def theta(self, S: float, K: float, T: float, sigma: float, option_type: str = "call") -> float:
        opt_type = "CE" if option_type.lower() == "call" else "PE"
        greeks = self._core.calculate_greeks(S, K, T, sigma, opt_type)
        return greeks.theta
    
    def vega(self, S: float, K: float, T: float, sigma: float) -> float:
        greeks = self._core.calculate_greeks(S, K, T, sigma, "CE")
        return greeks.vega
    
    def rho(self, S: float, K: float, T: float, sigma: float, option_type: str = "call") -> float:
        opt_type = "CE" if option_type.lower() == "call" else "PE"
        greeks = self._core.calculate_greeks(S, K, T, sigma, opt_type)
        return greeks.rho
    
    def calculate_all(self, S: float, K: float, T: float, sigma: float, option_type: str = "call") -> BSMResult:
        """Calculate price and all Greeks at once"""
        return BSMResult(
            price=self.price(S, K, T, sigma, option_type),
            delta=self.delta(S, K, T, sigma, option_type),
            gamma=self.gamma(S, K, T, sigma),
            theta=self.theta(S, K, T, sigma, option_type),
            vega=self.vega(S, K, T, sigma),
            rho=self.rho(S, K, T, sigma, option_type),
        )
    
    def implied_volatility(self, market_price: float, S: float, K: float, T: float, 
                           option_type: str = "call", **kwargs) -> Optional[float]:
        opt_type = "CE" if option_type.lower() == "call" else "PE"
        iv = self._core.calculate_iv(market_price, S, K, T, opt_type)
        return iv / 100.0 if iv > 0 else None  # Convert from percentage to decimal

    def expected_price_range(self, S: float, sigma: float, T_days: int, confidence: float = 0.68) -> tuple:
        """
        Calculate expected price range based on volatility.
        range = S +/- (S * sigma * sqrt(T) * z_score)
        """
        import math
        from scipy.stats import norm
        
        T_years = max(T_days, 1) / 365.0
        z_score = norm.ppf((1 + confidence) / 2)
        
        implied_move = S * sigma * math.sqrt(T_years) * z_score
        
        return (round(S - implied_move, 2), round(S + implied_move, 2))

    def weekly_theta_decay(self, T_days: int) -> float:
        """
        Return a 'decay score' or multiplier based on days to expiry.
        Higher score = accelerated decay (Theta Risk).
        """
        if T_days <= 7:
            return 1.0  # Maximum decay risk
        elif T_days <= 14:
            return 0.7
        elif T_days <= 30:
            return 0.4
        else:
            return 0.1
            
    @staticmethod
    def _d1(S: float, K: float, T: float, r: float, sigma: float) -> float:
        """Calculate d1 term standard formula"""
        import math
        if sigma <= 0 or T <= 0:
            return 0
        return (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))

    @staticmethod
    def _d2(S: float, K: float, T: float, r: float, sigma: float) -> float:
        """Calculate d2 term standard formula"""
        import math
        if sigma <= 0 or T <= 0:
            return 0
        return BSMService._d1(S, K, T, r, sigma) - sigma * math.sqrt(T)


# Singleton instance
bsm_service = BSMService()

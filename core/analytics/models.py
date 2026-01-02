"""
Analytics Data Models
"""
from dataclasses import dataclass
from typing import Optional

@dataclass
class OptionGreeks:
    """
    Standard Option Greeks
    """
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    rho: float = 0.0

@dataclass
class AdvancedGreeks(OptionGreeks):
    """
    Advanced Option Greeks (Second and Third Order)
    """
    # Second order (extended)
    vanna: float = 0.0  # dDelta/dIV
    charm: float = 0.0  # dDelta/dTime (delta decay)
    
    # Third order
    speed: float = 0.0  # dGamma/dSpot
    zomma: float = 0.0  # dGamma/dIV
    color: float = 0.0  # dGamma/dTime
    
    # Volatility Greeks
    vomma: float = 0.0  # dVega/dIV (volga)
    veta: float = 0.0   # dVega/dTime
    
    # Higher order
    ultima: float = 0.0  # dVomma/dIV

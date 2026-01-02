"""
Black-Scholes-Merton Approximation Utilities
Used for quick estimation of IV and Greeks when exact values are not available.
"""
import math

def calculate_iv_approximation(
    ltp: float, 
    spot_price: float, 
    strike: float, 
    dte: float, 
    option_type: str
) -> float:
    """
    Calculate approximate IV using Brenner-Subrahmanyam formula.
    This is a quick estimation, not exact Black-Scholes inversion.
    
    Returns IV as a percentage (e.g., 15.0 for 15%)
    """
    if ltp <= 0 or spot_price <= 0 or dte <= 0:
        return 12.0  # Default IV when calculation not possible
    
    try:
        # Time to expiry in years
        t = max(dte / 365.0, 1/365.0)  # Minimum 1 day
        
        # Approximate IV using modified Brenner formula
        # For ATM options: IV ≈ (Premium / Spot) * sqrt(2π / T)
        moneyness = strike / spot_price
        
        # Adjust for ITM/OTM
        if option_type.upper() == "CE":
            intrinsic = max(0, spot_price - strike)
        else:
            intrinsic = max(0, strike - spot_price)
        
        time_value = max(0.01, ltp - intrinsic)
        
        # Brenner-Subrahmanyam approximation
        iv = (time_value / spot_price) * math.sqrt(2 * math.pi / t) * 100
        
        # Apply moneyness adjustment
        if moneyness < 0.95 or moneyness > 1.05:
            # Far from ATM, adjust for volatility smile
            skew_factor = 1.0 + abs(1 - moneyness) * 0.3
            iv *= skew_factor
        
        # Clamp to reasonable range (5% to 100%)
        return max(5.0, min(100.0, iv))
        
    except Exception:
        return 12.0  # Default on error


def calculate_delta_approximation(
    spot_price: float,
    strike: float,
    option_type: str,
    dte: float,
    iv: float
) -> float:
    """
    Calculate approximate Delta using log-normal distribution approximation.
    
    Returns delta (e.g., 0.55 for CE ITM, -0.55 for PE ITM)
    """
    if spot_price <= 0 or strike <= 0 or dte <= 0 or iv <= 0:
        # Return simple moneyness-based delta
        if option_type.upper() == "CE":
            return 0.5 if spot_price >= strike else 0.3
        else:
            return -0.5 if strike >= spot_price else -0.3
    
    try:
        # Time to expiry in years
        t = max(dte / 365.0, 1/365.0)
        sigma = iv / 100.0  # Convert percentage to decimal
        
        # Calculate d1
        d1 = (math.log(spot_price / strike) + (0.065 + 0.5 * sigma * sigma) * t) / (sigma * math.sqrt(t))
        
        # Approximate N(d1) using error function
        # N(x) ≈ 0.5 * (1 + erf(x / sqrt(2)))
        nd1 = 0.5 * (1 + math.erf(d1 / math.sqrt(2)))
        
        if option_type.upper() == "CE":
            return round(nd1, 4)
        else:
            return round(nd1 - 1, 4)  # PE delta = N(d1) - 1
            
    except Exception:
        if option_type.upper() == "CE":
            return 0.5
        else:
            return -0.5

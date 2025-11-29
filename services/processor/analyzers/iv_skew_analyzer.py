"""
IV Skew Analyzer

Detects:
- Volatility Skew (Put IV vs Call IV)
- Smile/Smirk patterns
- Tail risk pricing
"""
from typing import Dict, List
from core.logging.logger import get_logger

logger = get_logger("iv-skew")


class IVSkewAnalyzer:
    """
    Analyze Implied Volatility Skew
    
    Skew = OTM Put IV - OTM Call IV
    
    Normal Market:
    - Put Skew > Call Skew (Smirk) due to crash protection demand
    
    Signals:
    - Flat Skew: Complacency (Bullish/Neutral)
    - Steep Skew: Fear (Bearish)
    - Inverted Skew (Call > Put): FOMO (Bullish Extreme)
    """
    
    def analyze(
        self,
        options: List,  # List of CleanedOptionData
        spot_price: float,
        atm_iv: float
    ) -> Dict:
        """
        Analyze IV Skew
        
        Args:
            options: List of CleanedOptionData
            spot_price: Current spot price
            atm_iv: ATM Implied Volatility
            
        Returns:
            Analysis result dict
        """
        # Define OTM thresholds (e.g., 5% OTM)
        otm_threshold = 0.05
        
        put_strike_target = spot_price * (1 - otm_threshold)
        call_strike_target = spot_price * (1 + otm_threshold)
        
        # Find closest strikes
        otm_put = min(
            (o for o in options if o.option_type == 'PE' and o.iv),
            key=lambda x: abs(x.strike - put_strike_target),
            default=None
        )
        
        otm_call = min(
            (o for o in options if o.option_type == 'CE' and o.iv),
            key=lambda x: abs(x.strike - call_strike_target),
            default=None
        )
        
        if not otm_put or not otm_call:
            return {}
            
        put_iv = otm_put.iv
        call_iv = otm_call.iv
        
        # Calculate Skew
        skew = put_iv - call_iv
        
        # Generate signals
        signal = 'NORMAL_SKEW'
        sentiment = 'NEUTRAL'
        
        if skew > 5.0:
            signal = 'HIGH_FEAR'
            sentiment = 'BEARISH'
        elif skew < -1.0:
            signal = 'CALL_FOMO'
            sentiment = 'BULLISH_EXTREME'
        elif skew < 1.0:
            signal = 'COMPLACENCY'
            sentiment = 'BULLISH'
            
        result = {
            'atm_iv': round(atm_iv, 2),
            'otm_put_iv': round(put_iv, 2),
            'otm_call_iv': round(call_iv, 2),
            'skew': round(skew, 2),
            'put_strike': otm_put.strike,
            'call_strike': otm_call.strike,
            'signal': signal,
            'sentiment': sentiment
        }
        
        logger.debug(
            f"IV Skew: Put IV={put_iv:.2f}, Call IV={call_iv:.2f}, "
            f"Skew={skew:.2f}, Signal={signal}"
        )
        
        return result

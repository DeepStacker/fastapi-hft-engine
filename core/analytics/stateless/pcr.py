"""
Stateless PCR (Put-Call Ratio) calculation utility.

Single source of truth for all PCR calculations.
No database access required - pure calculation.
"""

from typing import Optional, Dict, Any


def calculate_pcr(put_value: float, call_value: float) -> Optional[float]:
    """
    Calculate Put-Call Ratio.
    
    Args:
        put_value: Put OI or Volume
        call_value: Call OI or Volume
        
    Returns:
        PCR ratio (put/call) or None if call_value is 0
        
    Example:
        >>> calculate_pcr(1500, 1000)
        1.5
        >>> calculate_pcr(700, 1000)
        0.7
    """
    if call_value and call_value > 0:
        return round(put_value / call_value, 4)
    return None


def calculate_pcr_detailed(
    total_call_oi: int,
    total_put_oi: int,
    total_call_vol: int,
    total_put_vol: int
) -> Dict[str, Any]:
    """
    Calculate detailed PCR with market interpretation.
    
    Args:
        total_call_oi: Total Call Open Interest
        total_put_oi: Total Put Open Interest
        total_call_vol: Total Call Volume
        total_put_vol: Total Put Volume
        
    Returns:
        Dict containing:
        - pcr_oi: OI-based PCR
        - pcr_volume: Volume-based PCR
        - signal: Market signal (BULLISH/BEARISH/NEUTRAL/OVERSOLD/OVERBOUGHT)
        - sentiment: Market sentiment description
        - total_call_oi: Input call OI
        - total_put_oi: Input put OI
        
    Interpretation:
        - PCR > 1.5: OVERSOLD (extreme bearish, reversal possible)
        - PCR > 1.0: BEARISH (more puts than calls)
        - PCR 0.7-1.0: NEUTRAL
        - PCR < 0.7: BULLISH (more calls than puts)
        - PCR < 0.5: OVERBOUGHT (extreme bullish, reversal possible)
    """
    # Calculate ratios
    oi_pcr = calculate_pcr(total_put_oi, total_call_oi) or 0
    vol_pcr = calculate_pcr(total_put_vol, total_call_vol) or 0
    
    # Determine market signal and sentiment
    if oi_pcr > 1.5:
        signal = 'OVERSOLD_REVERSAL_POSSIBLE'
        sentiment = 'BEARISH_EXTREME'
    elif oi_pcr > 1.0:
        signal = 'BEARISH_TREND'
        sentiment = 'BEARISH'
    elif oi_pcr < 0.5:
        signal = 'OVERBOUGHT_REVERSAL_POSSIBLE'
        sentiment = 'BULLISH_EXTREME'
    elif oi_pcr < 0.7:
        signal = 'BULLISH_TREND'
        sentiment = 'BULLISH'
    else:
        signal = 'NEUTRAL'
        sentiment = 'NEUTRAL'
    
    return {
        'pcr_oi': oi_pcr,
        'pcr_volume': vol_pcr,
        'total_call_oi': total_call_oi,
        'total_put_oi': total_put_oi,
        'signal': signal,
        'sentiment': sentiment
    }

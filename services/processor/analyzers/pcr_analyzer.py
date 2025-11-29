"""
Put-Call Ratio (PCR) Analyzer

Detects:
- Market sentiment (Bullish/Bearish)
- Overbought/Oversold conditions
- Reversal signals
"""
from typing import Dict
from core.logging.logger import get_logger

logger = get_logger("pcr-analyzer")


class PCRAnalyzer:
    """
    Analyze Put-Call Ratios (Volume and OI)
    
    PCR = Total Put / Total Call
    
    Interpretation:
    - PCR > 1.0: Bearish sentiment (more puts)
    - PCR < 0.7: Bullish sentiment (more calls)
    - PCR > 1.5: Oversold (potential bullish reversal)
    - PCR < 0.5: Overbought (potential bearish reversal)
    """
    
    def analyze(
        self,
        total_call_oi: int,
        total_put_oi: int,
        total_call_vol: int,
        total_put_vol: int
    ) -> Dict:
        """
        Analyze PCR metrics
        
        Args:
            total_call_oi: Total Call Open Interest
            total_put_oi: Total Put Open Interest
            total_call_vol: Total Call Volume
            total_put_vol: Total Put Volume
            
        Returns:
            Analysis result dict
        """
        # Calculate OI PCR
        oi_pcr = total_put_oi / total_call_oi if total_call_oi > 0 else 0
        
        # Calculate Volume PCR
        vol_pcr = total_put_vol / total_call_vol if total_call_vol > 0 else 0
        
        # Generate signals based on OI PCR (more stable than volume)
        signal = 'NEUTRAL'
        sentiment = 'NEUTRAL'
        
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
            
        result = {
            'oi_pcr': round(oi_pcr, 4),
            'volume_pcr': round(vol_pcr, 4),
            'total_call_oi': total_call_oi,
            'total_put_oi': total_put_oi,
            'signal': signal,
            'sentiment': sentiment
        }
        
        logger.debug(
            f"PCR Analysis: OI PCR={oi_pcr:.2f}, Vol PCR={vol_pcr:.2f}, "
            f"Signal={signal}"
        )
        
        return result

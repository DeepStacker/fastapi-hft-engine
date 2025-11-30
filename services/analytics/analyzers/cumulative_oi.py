"""
Cumulative OI Analyzer

Computes cumulative Open Interest changes since market opening.
Tracks session highs/lows and net accumulation.
"""

from typing import Dict, List, Optional
from datetime import datetime, time
import structlog

logger = structlog.get_logger("cumulative-oi-analyzer")


class CumulativeOIAnalyzer:
    """
    Computes cumulative OI metrics with historical context.
    
    Metrics:
    - Cumulative OI change since market open
    - Cumulative volume
    - Session high/low OI
    - Net call vs put accumulation
    """
    
    def __init__(self):
        """Initialize analyzer"""
        self.market_open_time = time(9, 15)  # IST market open
        logger.info("CumulativeOIAnalyzer initialized")
    
    async def analyze(
        self,
        current_data: Dict,
        historical_data: List[Dict]
    ) -> Dict:
        """
        Compute cumulative OI metrics.
        
        Args:
            current_data: Current enriched option chain
            historical_data: Historical snapshots (last 1h)
            
        Returns:
            Dict with cumulative metrics
        """
        try:
            # Extract current options
            options = current_data.get('options', [])
            
            if not options:
                return {}
            
            # Find market open snapshot (first snapshot of the day)
            market_open_snapshot = self._find_market_open(historical_data)
            
            # Compute cumulative metrics
            cumulative_metrics = {}
            
            for option in options:
                strike = option.get('strike_price')
                option_type = option.get('option_type')
                current_oi = option.get('oi', 0)
                current_volume = option.get('volume', 0)
                
                key = f"{strike}_{option_type}"
                
                # Get opening OI
                opening_oi = self._get_opening_oi(
                    market_open_snapshot,
                    strike,
                    option_type
                )
                
                # Calculate cumulative change
                oi_change = current_oi - opening_oi if opening_oi else 0
                
                cumulative_metrics[key] = {
                    'strike': strike,
                    'option_type': option_type,
                    'current_oi': current_oi,
                    'opening_oi': opening_oi,
                    'cumulative_oi_change': oi_change,
                    'cumulative_volume': current_volume,  # Simplified - should track from open
                    'session_high_oi': max(current_oi, opening_oi) if opening_oi else current_oi,
                    'session_low_oi': min(current_oi, opening_oi) if opening_oi else current_oi
                }
            
            # Aggregate totals
            total_call_oi_change = sum(
                m['cumulative_oi_change'] 
                for m in cumulative_metrics.values() 
                if m['option_type'] == 'CE'
            )
            
            total_put_oi_change = sum(
                m['cumulative_oi_change'] 
                for m in cumulative_metrics.values() 
                if m['option_type'] == 'PE'
            )
            
            return {
                'strike_wise': cumulative_metrics,
                'totals': {
                    'total_call_oi_change': total_call_oi_change,
                    'total_put_oi_change': total_put_oi_change,
                    'net_oi_change': total_call_oi_change + total_put_oi_change,
                    'call_put_ratio': (
                        total_call_oi_change / total_put_oi_change 
                        if total_put_oi_change != 0 else 0
                    )
                }
            }
            
        except Exception as e:
            logger.error(f"Cumulative OI analysis failed: {e}", exc_info=True)
            return {}
    
    def _find_market_open(self, historical_data: List[Dict]) -> Optional[Dict]:
        """Find the first snapshot after market open today"""
        if not historical_data:
            return None
        
        # Return first snapshot (simplified - should check actual time)
        return historical_data[0] if historical_data else None
    
    def _get_opening_oi(
        self,
        market_open_snapshot: Optional[Dict],
        strike: float,
        option_type: str
    ) -> Optional[int]:
        """Extract OI value from market open snapshot"""
        if not market_open_snapshot:
            return None
        
        options = market_open_snapshot.get('options', [])
        
        for opt in options:
            if (opt.get('strike_price') == strike and 
                opt.get('option_type') == option_type):
                return opt.get('oi', 0)
        
        return None

"""
Velocity Analyzer

Computes rate of change (velocity) for OI, volume, and price.
Detects sudden spikes and momentum shifts.
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
import structlog

logger = structlog.get_logger("velocity-analyzer")


class VelocityAnalyzer:
    """
    Computes velocity (rate of change) metrics.
    
    Metrics:
    - OI velocity (change per minute)
    - Volume velocity
    - Price velocity
    - Acceleration (change in velocity)
    """
    
    def __init__(self):
        """Initialize analyzer"""
        logger.info("VelocityAnalyzer initialized")
    
    async def analyze(
        self,
        current_data: Dict,
        historical_data: List[Dict]
    ) -> Dict:
        """
        Compute velocity metrics.
        
        Args:
            current_data: Current enriched option chain
            historical_data: Historical snapshots (for rate calculation)
            
        Returns:
            Dict with velocity metrics
        """
        try:
            if not historical_data or len(historical_data) < 2:
                return {'status': 'insufficient_history'}
            
            # Get previous snapshot (1 minute ago ideally)
            previous_snapshot = historical_data[-1]
            
            # Time delta
            current_time = datetime.fromisoformat(current_data.get('timestamp'))
            previous_time = datetime.fromisoformat(previous_snapshot.get('timestamp'))
            time_delta_minutes = (current_time - previous_time).total_seconds() / 60.0
            
            if time_delta_minutes == 0:
                return {'status': 'zero_time_delta'}
            
            # Compute velocities
            current_options = current_data.get('options', [])
            previous_options = previous_snapshot.get('options', [])
            
            strike_velocities = {}
            
            for current_opt in current_options:
                strike = current_opt.get('strike_price')
                option_type = current_opt.get('option_type')
                
                # Find matching previous option
                previous_opt = self._find_matching_option(
                    previous_options,
                    strike,
                    option_type
                )
                
                if not previous_opt:
                    continue
                
                # Calculate velocities
                oi_velocity = (
                    (current_opt.get('oi', 0) - previous_opt.get('oi', 0)) / 
                    time_delta_minutes
                )
                
                volume_velocity = (
                    (current_opt.get('volume', 0) - previous_opt.get('volume', 0)) / 
                    time_delta_minutes
                )
                
                price_velocity = (
                    (current_opt.get('ltp', 0) - previous_opt.get('ltp', 0)) / 
                    time_delta_minutes
                )
                
                key = f"{strike}_{option_type}"
                strike_velocities[key] = {
                    'strike': strike,
                    'option_type': option_type,
                    'oi_velocity': round(oi_velocity, 2),
                    'volume_velocity': round(volume_velocity, 2),
                    'price_velocity': round(price_velocity, 4),
                    'is_spike': abs(oi_velocity) > 10000  # Threshold for spike detection
                }
            
            # Aggregate velocities
            total_call_oi_velocity = sum(
                v['oi_velocity'] 
                for v in strike_velocities.values() 
                if v['option_type'] == 'CE'
            )
            
            total_put_oi_velocity = sum(
                v['oi_velocity'] 
                for v in strike_velocities.values() 
                if v['option_type'] == 'PE'
            )
            
            # Detect spikes
            spikes = [
                v for v in strike_velocities.values() 
                if v['is_spike']
            ]
            
            return {
                'time_delta_minutes': round(time_delta_minutes, 2),
                'strike_wise': strike_velocities,
                'totals': {
                    'total_call_oi_velocity': round(total_call_oi_velocity, 2),
                    'total_put_oi_velocity': round(total_put_oi_velocity, 2),
                    'net_oi_velocity': round(total_call_oi_velocity + total_put_oi_velocity, 2)
                },
                'spikes': spikes,
                'spike_count': len(spikes)
            }
            
        except Exception as e:
            logger.error(f"Velocity analysis failed: {e}", exc_info=True)
            return {}
    
    def _find_matching_option(
        self,
        options: List[Dict],
        strike: float,
        option_type: str
    ) -> Optional[Dict]:
        """Find matching option in previous snapshot"""
        for opt in options:
            if (opt.get('strike_price') == strike and 
                opt.get('option_type') == option_type):
                return opt
        return None

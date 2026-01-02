"""
Profile Calculation Service
Server-side calculation of chart profiles (OI, Volume, OI Change, Reversal, etc.)
Mirrors frontend logic from TradingChart.jsx for consistency

Refactored to use modular calculators in app/services/profiles/
"""
import logging
from typing import Dict, Any, List, Optional
from app.services.profiles.base import BaseProfileCalculator
from app.services.profiles.oi import oi_calculator
from app.services.profiles.volume import volume_calculator
from app.services.profiles.oi_change import oi_change_calculator
from app.services.profiles.reversal import reversal_calculator
from app.services.profiles.gex import gex_calculator
from app.services.profiles.pcr import pcr_calculator

logger = logging.getLogger(__name__)


# Export ProfileDataPoint for backward compatibility if needed
from app.services.profiles.base import ProfileDataPoint


class ProfileService:
    """
    Calculates chart profiles server-side.
    Orchestrates specialized calculators for each profile type.
    """
    
    def __init__(self):
        self.base_calculator = BaseProfileCalculator()
    
    def calculate_profiles(
        self,
        oc: Dict[str, Any],
        spot_price: float,
        atm_strike: float,
        include_profiles: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Calculate all requested profiles.
        
        Args:
            oc: Option chain data (strike -> {ce, pe})
            spot_price: Current spot price
            atm_strike: ATM strike
            include_profiles: List of profile types to include (default: all)
            
        Returns:
            Dict with profile data for each requested profile type
        """
        if not oc or not spot_price:
            return {}
        
        default_profiles = ['oi', 'volume', 'oi_change', 'reversal', 'gex', 'pcr']
        profiles_to_calculate = include_profiles or default_profiles
        
        # Pre-compute global stats (single pass - performance optimization)
        global_stats = self.base_calculator.compute_global_stats(oc)
        
        result = {}
        
        for profile_type in profiles_to_calculate:
            try:
                if profile_type == 'oi':
                    result['oi'] = oi_calculator.calculate(oc, spot_price, global_stats)
                elif profile_type == 'volume':
                    result['volume'] = volume_calculator.calculate(oc, spot_price, global_stats)
                elif profile_type == 'oi_change':
                    result['oi_change'] = oi_change_calculator.calculate(oc, spot_price, global_stats)
                elif profile_type == 'reversal':
                    result['reversal'] = reversal_calculator.calculate(oc, spot_price, global_stats)
                elif profile_type == 'gex':
                    result['gex'] = gex_calculator.calculate(oc, spot_price, global_stats)
                elif profile_type == 'pcr':
                    result['pcr'] = pcr_calculator.calculate(oc, spot_price, global_stats)
            except Exception as e:
                logger.warning(f"Error calculating {profile_type} profile: {e}")
                continue
        
        # Ensure all values are JSON serializable (convert numpy types)
        return self.base_calculator.sanitize_for_json(result)


# Singleton instance
profile_service = ProfileService()

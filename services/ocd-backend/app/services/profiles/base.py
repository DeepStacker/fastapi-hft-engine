"""
Profile Calculation Base Module

Contains shared utilities and base classes for profile calculations.
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ProfileDataPoint:
    """Single data point for profile visualization"""
    strike: float
    total: float
    ce_val: float
    pe_val: float
    opacity: float = 0.8
    single_val: Optional[float] = None
    is_cluster: bool = False
    cluster_count: int = 1
    confidence_tier: int = 2


class BaseProfileCalculator:
    """
    Base class for profile calculations with shared utilities.
    
    STABILITY IMPROVEMENTS:
    - Higher micro-volume threshold (500 vs 100)
    - Significance filtering (5% of max to show)
    - Hysteresis for dominance (65% to become, 55% to lose)
    - Minimum total threshold to filter noise
    """
    
    MICRO_VOLUME_THRESHOLD = 500
    SIGNIFICANCE_THRESHOLD = 0.05
    DOMINANCE_ENTRY_THRESHOLD = 0.65
    DOMINANCE_EXIT_THRESHOLD = 0.55
    MIN_TOTAL_THRESHOLD = 0.02
    
    def sanitize_for_json(self, obj: Any) -> Any:
        """Convert numpy types to Python native types for JSON serialization"""
        if isinstance(obj, dict):
            return {k: self.sanitize_for_json(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self.sanitize_for_json(item) for item in obj]
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.bool_):
            return bool(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        else:
            return obj
    
    def compute_global_stats(self, oc: Dict[str, Any]) -> Dict[str, float]:
        """Single-pass computation of global statistics"""
        max_ce_oi = max_pe_oi = max_ce_vol = max_pe_vol = 0
        total_ce_oi = total_pe_oi = iv_sum = count = 0
        
        for strike_data in oc.values():
            ce = strike_data.get('ce', {})
            pe = strike_data.get('pe', {})
            
            ce_oi = ce.get('OI', ce.get('oi', 0)) or 0
            pe_oi = pe.get('OI', pe.get('oi', 0)) or 0
            ce_vol = ce.get('volume', ce.get('vol', 0)) or 0
            pe_vol = pe.get('volume', pe.get('vol', 0)) or 0
            ce_iv = ce.get('iv', 0) or 0
            pe_iv = pe.get('iv', 0) or 0
            
            max_ce_oi = max(max_ce_oi, ce_oi)
            max_pe_oi = max(max_pe_oi, pe_oi)
            max_ce_vol = max(max_ce_vol, ce_vol)
            max_pe_vol = max(max_pe_vol, pe_vol)
            total_ce_oi += ce_oi
            total_pe_oi += pe_oi
            iv_sum += ce_iv + pe_iv
            count += 1
        
        avg_iv = iv_sum / (count * 2) if count > 0 else 15
        max_vol = max(max_ce_vol, max_pe_vol, 1)
        max_oi = max(max_ce_oi, max_pe_oi, 1)
        total_oi = total_ce_oi + total_pe_oi
        
        return {
            'max_ce_oi': max_ce_oi, 'max_pe_oi': max_pe_oi,
            'max_vol': max_vol, 'max_oi': max_oi,
            'total_ce_oi': total_ce_oi, 'total_pe_oi': total_pe_oi,
            'total_oi': total_oi, 'avg_iv': avg_iv,
            'min_significant_oi': max_oi * self.SIGNIFICANCE_THRESHOLD,
            'min_significant_vol': max_vol * self.SIGNIFICANCE_THRESHOLD,
            'min_total_for_display': total_oi * self.MIN_TOTAL_THRESHOLD,
            'count': count
        }
    
    def get_atm_proximity(self, strike: float, spot: float) -> float:
        """Calculate ATM proximity factor (exponential decay)"""
        dist = abs(strike - spot)
        strike_step = 50
        steps_away = dist / strike_step
        return max(0.3, pow(0.85, steps_away))
    
    def apply_smart_dominance(
        self, ce_raw: float, pe_raw: float, atm_proximity: float, min_total: float = 0
    ) -> Tuple[float, float, float, float, bool]:
        """Apply smart dominance logic with hysteresis"""
        abs_ce = abs(ce_raw)
        abs_pe = abs(pe_raw)
        total = abs_ce + abs_pe
        
        if total < min_total:
            return 0, 0, 0, 0, False
        if total == 0:
            return 0, 0, 0, 0.3, False
        
        dominance_ratio = max(abs_ce, abs_pe) / total
        is_dominant = dominance_ratio >= self.DOMINANCE_ENTRY_THRESHOLD
        is_clear_winner = dominance_ratio >= 0.70
        
        ce_display = abs_ce * atm_proximity
        pe_display = abs_pe * atm_proximity
        
        if is_dominant:
            if abs_ce > abs_pe:
                ce_display, pe_display = total * atm_proximity, 0
            else:
                ce_display, pe_display = 0, total * atm_proximity
        
        if is_clear_winner:
            opacity = 0.95 + (0.1 if atm_proximity > 0.8 else 0)
        elif is_dominant:
            opacity = 0.75
        else:
            opacity = 0.4
        
        return ce_display, pe_display, total * atm_proximity, opacity, is_dominant

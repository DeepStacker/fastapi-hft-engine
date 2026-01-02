"""OI (Open Interest) Profile Calculator"""
from typing import Dict, Any
from app.services.profiles.base import BaseProfileCalculator


class OIProfileCalculator(BaseProfileCalculator):
    """Smart OI Profile with Volume + ATM Proximity weighting + Noise Filtering"""
    
    def calculate(self, oc: Dict[str, Any], spot: float, stats: Dict[str, float]) -> Dict[str, Any]:
        data_points = []
        max_val = 0
        min_total = stats.get('min_total_for_display', 0)
        
        for strike_str, strike_data in oc.items():
            try:
                strike = float(strike_str)
                ce = strike_data.get('ce', {})
                pe = strike_data.get('pe', {})
                
                ce_oi = ce.get('OI', ce.get('oi', 0)) or 0
                pe_oi = pe.get('OI', pe.get('oi', 0)) or 0
                ce_vol = ce.get('volume', ce.get('vol', 0)) or 0
                pe_vol = pe.get('volume', pe.get('vol', 0)) or 0
                
                total_oi = ce_oi + pe_oi
                if total_oi < stats.get('min_significant_oi', 0):
                    continue
                
                ce_mult = (1 + (ce_vol / stats['max_vol'])) if ce_vol > self.MICRO_VOLUME_THRESHOLD else 0.3
                pe_mult = (1 + (pe_vol / stats['max_vol'])) if pe_vol > self.MICRO_VOLUME_THRESHOLD else 0.3
                
                ce_smart = ce_oi * ce_mult
                pe_smart = pe_oi * pe_mult
                atm_prox = self.get_atm_proximity(strike, spot)
                
                ce_val, pe_val, total, opacity, is_dominant = self.apply_smart_dominance(
                    ce_smart, pe_smart, atm_prox, min_total
                )
                
                if total == 0:
                    continue
                
                max_val = max(max_val, max(ce_val, pe_val))
                
                data_points.append({
                    'strike': strike, 'ce_val': ce_val, 'pe_val': pe_val,
                    'total': total, 'opacity': opacity, 'is_dominant': is_dominant
                })
            except Exception:
                continue
        
        return {
            'data_points': data_points, 'max_val': max_val,
            'name': 'Smart OI (Liquidity)', 'ce_label': 'CE Liq', 'pe_label': 'PE Liq'
        }


oi_calculator = OIProfileCalculator()

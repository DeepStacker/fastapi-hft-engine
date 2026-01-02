"""OI Change Profile Calculator"""
from typing import Dict, Any
from app.services.profiles.base import BaseProfileCalculator


class OIChangeProfileCalculator(BaseProfileCalculator):
    """Smart OI Change (Flow) Profile with Noise Filtering"""
    
    def calculate(self, oc: Dict[str, Any], spot: float, stats: Dict[str, float]) -> Dict[str, Any]:
        data_points = []
        max_val = 0
        min_total = stats.get('min_total_for_display', 0)
        
        for strike_str, strike_data in oc.items():
            try:
                strike = float(strike_str)
                ce = strike_data.get('ce', {})
                pe = strike_data.get('pe', {})
                
                ce_vol = ce.get('volume', ce.get('vol', 0)) or 0
                pe_vol = pe.get('volume', pe.get('vol', 0)) or 0
                ce_chng = ce.get('oichng', 0) or 0
                pe_chng = pe.get('oichng', 0) or 0
                
                if abs(ce_chng) < 100 and abs(pe_chng) < 100:
                    continue
                
                ce_smart = ce_chng * (1 + (ce_vol / stats['max_vol']))
                pe_smart = pe_chng * (1 + (pe_vol / stats['max_vol']))
                atm_prox = self.get_atm_proximity(strike, spot)
                
                ce_val, pe_val, total, opacity, is_dominant = self.apply_smart_dominance(
                    abs(ce_smart), abs(pe_smart), atm_prox, min_total
                )
                
                if total == 0:
                    continue
                
                if ce_smart < 0:
                    ce_val = -ce_val
                if pe_smart < 0:
                    pe_val = -pe_val
                
                max_val = max(max_val, max(abs(ce_val), abs(pe_val)))
                
                data_points.append({
                    'strike': strike, 'ce_val': ce_val, 'pe_val': pe_val,
                    'total': total, 'opacity': opacity, 'is_dominant': is_dominant,
                    'ce_unwinding': ce_smart < 0, 'pe_unwinding': pe_smart < 0
                })
            except Exception:
                continue
        
        return {
            'data_points': data_points, 'max_val': max_val,
            'name': 'Smart Flow (Vol. Wgt)', 'ce_label': 'CE Flow', 'pe_label': 'PE Flow',
            'show_sign': True
        }


oi_change_calculator = OIChangeProfileCalculator()

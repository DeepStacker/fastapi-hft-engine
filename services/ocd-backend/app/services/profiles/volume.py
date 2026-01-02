"""Volume Profile Calculator"""
from typing import Dict, Any
from app.services.profiles.base import BaseProfileCalculator


class VolumeProfileCalculator(BaseProfileCalculator):
    """Smart Volume Profile with IV weighting + Noise Filtering"""
    
    def calculate(self, oc: Dict[str, Any], spot: float, stats: Dict[str, float]) -> Dict[str, Any]:
        data_points = []
        max_val = 0
        avg_iv = stats['avg_iv'] if stats['avg_iv'] > 0 else 1
        min_total = stats.get('min_total_for_display', 0)
        
        for strike_str, strike_data in oc.items():
            try:
                strike = float(strike_str)
                ce = strike_data.get('ce', {})
                pe = strike_data.get('pe', {})
                
                ce_vol = ce.get('volume', ce.get('vol', 0)) or 0
                pe_vol = pe.get('volume', pe.get('vol', 0)) or 0
                ce_iv = ce.get('iv', 0) or 0
                pe_iv = pe.get('iv', 0) or 0
                
                if ce_vol < self.MICRO_VOLUME_THRESHOLD and pe_vol < self.MICRO_VOLUME_THRESHOLD:
                    continue
                
                ce_smart = ce_vol * (ce_iv / avg_iv) if ce_iv > 0 else ce_vol
                pe_smart = pe_vol * (pe_iv / avg_iv) if pe_iv > 0 else pe_vol
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
            'name': 'Smart Volume (Conviction)', 'ce_label': 'CE Conv', 'pe_label': 'PE Conv'
        }


volume_calculator = VolumeProfileCalculator()

"""GEX (Gamma Exposure) Profile Calculator"""
from typing import Dict, Any
from app.services.profiles.base import BaseProfileCalculator


class GEXProfileCalculator(BaseProfileCalculator):
    """GEX (Gamma Exposure) Profile with Noise Filtering"""
    
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
                
                if ce_oi + pe_oi < stats.get('min_significant_oi', 0):
                    continue
                
                ce_gamma = (ce.get('optgeeks', {}) or {}).get('gamma', 0) or 0
                pe_gamma = (pe.get('optgeeks', {}) or {}).get('gamma', 0) or 0
                ce_delta = (ce.get('optgeeks', {}) or {}).get('delta', 0) or 0
                pe_delta = (pe.get('optgeeks', {}) or {}).get('delta', 0) or 0
                
                ce_risk = (ce_oi * abs(ce_delta)) + (ce_oi * abs(ce_gamma) * spot * 0.01)
                pe_risk = (pe_oi * abs(pe_delta)) + (pe_oi * abs(pe_gamma) * spot * 0.01)
                
                atm_prox = self.get_atm_proximity(strike, spot)
                
                ce_val, pe_val, total, opacity, is_dominant = self.apply_smart_dominance(
                    ce_risk, pe_risk, atm_prox, min_total
                )
                
                if total == 0:
                    continue
                
                max_val = max(max_val, max(ce_val, pe_val))
                
                data_points.append({
                    'strike': strike, 'ce_val': ce_val, 'pe_val': pe_val,
                    'total': total, 'opacity': opacity, 'is_dominant': is_dominant,
                    'net_risk': ce_risk - pe_risk
                })
            except Exception:
                continue
        
        return {
            'data_points': data_points, 'max_val': max_val,
            'name': 'Smart Exposure (Risk)', 'ce_label': 'CE Risk', 'pe_label': 'PE Risk',
            'show_net': True
        }


gex_calculator = GEXProfileCalculator()

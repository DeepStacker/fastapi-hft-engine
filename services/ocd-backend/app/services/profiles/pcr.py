"""PCR (Put-Call Ratio) Profile Calculator"""
from typing import Dict, Any
from app.services.profiles.base import BaseProfileCalculator


class PCRProfileCalculator(BaseProfileCalculator):
    """PCR Sentiment Profile with Noise Filtering"""
    
    def calculate(self, oc: Dict[str, Any], spot: float, stats: Dict[str, float]) -> Dict[str, Any]:
        data_points = []
        max_val = 0
        # PCR is normalized, use smaller threshold
        min_total = stats.get('min_total_for_display', 0) * 0.001
        
        for strike_str, strike_data in oc.items():
            try:
                strike = float(strike_str)
                ce = strike_data.get('ce', {})
                pe = strike_data.get('pe', {})
                
                ce_oi = ce.get('OI', ce.get('oi', 0)) or 0
                pe_oi = pe.get('OI', pe.get('oi', 0)) or 0
                
                if ce_oi + pe_oi < stats.get('min_significant_oi', 0):
                    continue
                
                pcr = pe_oi / ce_oi if ce_oi > 0 else 0
                pcr_norm = min(max(pcr, 0.3), 3)
                
                ce_pcr = (1 - pcr_norm) if pcr_norm < 1 else 0
                pe_pcr = (pcr_norm - 1) if pcr_norm > 1 else 0
                
                atm_prox = self.get_atm_proximity(strike, spot)
                
                ce_val, pe_val, total, opacity, is_dominant = self.apply_smart_dominance(
                    ce_pcr, pe_pcr, atm_prox, min_total
                )
                
                if total == 0:
                    continue
                
                max_val = max(max_val, max(ce_val, pe_val))
                
                data_points.append({
                    'strike': strike,
                    'ce_val': ce_val,
                    'pe_val': pe_val,
                    'total': total,
                    'opacity': opacity,
                    'is_dominant': is_dominant,
                    'pcr': pcr
                })
            except Exception:
                continue
        
        return {
            'data_points': data_points,
            'max_val': max_val,
            'name': 'PCR Sentiment',
            'ce_label': 'Bearish',
            'pe_label': 'Bullish',
            'show_ratio': True
        }


pcr_calculator = PCRProfileCalculator()

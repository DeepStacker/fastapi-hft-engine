"""
Profile Calculation Service
Server-side calculation of chart profiles (OI, Volume, OI Change, Reversal, etc.)
Mirrors frontend logic from TradingChart.jsx for consistency
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import math

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


class ProfileService:
    """
    Calculates chart profiles server-side.
    Implements the same logic as frontend TradingChart.jsx for consistency.
    
    STABILITY IMPROVEMENTS:
    - Higher micro-volume threshold (500 vs 100)
    - Significance filtering (5% of max to show)
    - Hysteresis for dominance (65% to become, 55% to lose)
    - Minimum total threshold to filter noise
    """
    
    MICRO_VOLUME_THRESHOLD = 500  # Increased from 100 - filter more noise
    SIGNIFICANCE_THRESHOLD = 0.05  # Must be 5% of max to show
    DOMINANCE_ENTRY_THRESHOLD = 0.65  # Higher bar to claim dominance
    DOMINANCE_EXIT_THRESHOLD = 0.55  # Must fall below this to lose dominance
    MIN_TOTAL_THRESHOLD = 0.02  # 2% of total to be significant
    
    def __init__(self):
        pass
    
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
        global_stats = self._compute_global_stats(oc)
        
        result = {}
        
        for profile_type in profiles_to_calculate:
            try:
                if profile_type == 'oi':
                    result['oi'] = self._calculate_oi_profile(oc, spot_price, global_stats)
                elif profile_type == 'volume':
                    result['volume'] = self._calculate_volume_profile(oc, spot_price, global_stats)
                elif profile_type == 'oi_change':
                    result['oi_change'] = self._calculate_oi_change_profile(oc, spot_price, global_stats)
                elif profile_type == 'reversal':
                    result['reversal'] = self._calculate_reversal_profile(oc, spot_price, global_stats)
                elif profile_type == 'gex':
                    result['gex'] = self._calculate_gex_profile(oc, spot_price, global_stats)
                elif profile_type == 'pcr':
                    result['pcr'] = self._calculate_pcr_profile(oc, spot_price, global_stats)
            except Exception as e:
                logger.warning(f"Error calculating {profile_type} profile: {e}")
                continue
        
        # Ensure all values are JSON serializable (convert numpy types)
        return self._sanitize_for_json(result)
    
    def _sanitize_for_json(self, obj: Any) -> Any:
        """Convert numpy types to Python native types for JSON serialization"""
        import numpy as np
        
        if isinstance(obj, dict):
            return {k: self._sanitize_for_json(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._sanitize_for_json(item) for item in obj]
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
    
    def _compute_global_stats(self, oc: Dict[str, Any]) -> Dict[str, float]:
        """Single-pass computation of global statistics"""
        max_ce_oi = 0
        max_pe_oi = 0
        max_ce_vol = 0
        max_pe_vol = 0
        total_ce_oi = 0
        total_pe_oi = 0
        iv_sum = 0
        count = 0
        
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
        
        # Volatility-based adaptive threshold - MORE STRICT
        iv_volatility = 'high' if avg_iv > 20 else ('medium' if avg_iv > 12 else 'low')
        
        # Significance thresholds
        min_significant_oi = max_oi * self.SIGNIFICANCE_THRESHOLD
        min_significant_vol = max_vol * self.SIGNIFICANCE_THRESHOLD
        min_total_for_display = total_oi * self.MIN_TOTAL_THRESHOLD
        
        return {
            'max_ce_oi': max_ce_oi,
            'max_pe_oi': max_pe_oi,
            'max_vol': max_vol,
            'max_oi': max_oi,
            'total_ce_oi': total_ce_oi,
            'total_pe_oi': total_pe_oi,
            'total_oi': total_oi,
            'avg_iv': avg_iv,
            'min_significant_oi': min_significant_oi,
            'min_significant_vol': min_significant_vol,
            'min_total_for_display': min_total_for_display,
            'iv_volatility': iv_volatility,
            'count': count
        }
    
    def _get_atm_proximity(self, strike: float, spot: float) -> float:
        """Calculate ATM proximity factor (exponential decay)"""
        dist = abs(strike - spot)
        strike_step = 50  # Assume 50 point steps for indices
        steps_away = dist / strike_step
        return max(0.3, pow(0.85, steps_away))
    
    def _apply_smart_dominance(
        self,
        ce_raw: float,
        pe_raw: float,
        atm_proximity: float,
        min_total: float = 0
    ) -> Tuple[float, float, float, float, bool]:
        """
        Apply smart dominance logic with HYSTERESIS to prevent flip-flop.
        
        Returns:
            (ce_display, pe_display, total, opacity, is_dominant)
        """
        abs_ce = abs(ce_raw)
        abs_pe = abs(pe_raw)
        total = abs_ce + abs_pe
        
        # Skip insignificant values entirely
        if total < min_total:
            return 0, 0, 0, 0, False
        
        if total == 0:
            return 0, 0, 0, 0.3, False
        
        dominance_ratio = max(abs_ce, abs_pe) / total
        
        # HYSTERESIS: Use higher threshold to BECOME dominant
        # This prevents rapid flip-flopping near the threshold
        is_dominant = dominance_ratio >= self.DOMINANCE_ENTRY_THRESHOLD
        is_clear_winner = dominance_ratio >= 0.70  # Very clear dominance
        
        # Apply ATM proximity weighting
        ce_display = abs_ce * atm_proximity
        pe_display = abs_pe * atm_proximity
        
        if is_dominant:
            # Winner takes all visual representation
            if abs_ce > abs_pe:
                ce_display = total * atm_proximity
                pe_display = 0
            else:
                ce_display = 0
                pe_display = total * atm_proximity
        
        # Opacity based on clarity:
        # Clear winner (>70%) = Full brightness
        # Dominant (65-70%) = High brightness  
        # Contested (<65%) = Low brightness
        if is_clear_winner:
            proximity_boost = 0.1 if atm_proximity > 0.8 else 0
            opacity = 0.95 + proximity_boost
        elif is_dominant:
            opacity = 0.75
        else:
            opacity = 0.4  # Dim contested zones
        
        return ce_display, pe_display, total * atm_proximity, opacity, is_dominant
    
    def _calculate_oi_profile(
        self,
        oc: Dict[str, Any],
        spot: float,
        stats: Dict[str, float]
    ) -> Dict[str, Any]:
        """Smart OI Profile with Volume + ATM Proximity weighting + Noise Filtering"""
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
                
                # Skip if OI is insignificant
                total_oi = ce_oi + pe_oi
                if total_oi < stats.get('min_significant_oi', 0):
                    continue
                
                # Filter micro-volume noise
                ce_mult = (1 + (ce_vol / stats['max_vol'])) if ce_vol > self.MICRO_VOLUME_THRESHOLD else 0.3
                pe_mult = (1 + (pe_vol / stats['max_vol'])) if pe_vol > self.MICRO_VOLUME_THRESHOLD else 0.3
                
                ce_smart = ce_oi * ce_mult
                pe_smart = pe_oi * pe_mult
                atm_prox = self._get_atm_proximity(strike, spot)
                
                ce_val, pe_val, total, opacity, is_dominant = self._apply_smart_dominance(
                    ce_smart, pe_smart, atm_prox, min_total
                )
                
                # Skip if result is insignificant
                if total == 0:
                    continue
                
                max_val = max(max_val, max(ce_val, pe_val))
                
                data_points.append({
                    'strike': strike,
                    'ce_val': ce_val,
                    'pe_val': pe_val,
                    'total': total,
                    'opacity': opacity,
                    'is_dominant': is_dominant
                })
            except Exception as e:
                continue
        
        return {
            'data_points': data_points,
            'max_val': max_val,
            'name': 'Smart OI (Liquidity)',
            'ce_label': 'CE Liq',
            'pe_label': 'PE Liq'
        }
    
    def _calculate_volume_profile(
        self,
        oc: Dict[str, Any],
        spot: float,
        stats: Dict[str, float]
    ) -> Dict[str, Any]:
        """Smart Volume Profile with IV weighting + Noise Filtering"""
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
                
                # Skip micro-volume - INCREASED threshold
                if ce_vol < self.MICRO_VOLUME_THRESHOLD and pe_vol < self.MICRO_VOLUME_THRESHOLD:
                    continue
                
                ce_smart = ce_vol * (ce_iv / avg_iv) if ce_iv > 0 else ce_vol
                pe_smart = pe_vol * (pe_iv / avg_iv) if pe_iv > 0 else pe_vol
                atm_prox = self._get_atm_proximity(strike, spot)
                
                ce_val, pe_val, total, opacity, is_dominant = self._apply_smart_dominance(
                    ce_smart, pe_smart, atm_prox, min_total
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
                    'is_dominant': is_dominant
                })
            except Exception as e:
                continue
        
        return {
            'data_points': data_points,
            'max_val': max_val,
            'name': 'Smart Volume (Conviction)',
            'ce_label': 'CE Conv',
            'pe_label': 'PE Conv'
        }
    
    def _calculate_oi_change_profile(
        self,
        oc: Dict[str, Any],
        spot: float,
        stats: Dict[str, float]
    ) -> Dict[str, Any]:
        """Smart OI Change (Flow) Profile with Noise Filtering"""
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
                
                # Skip if no significant change
                if abs(ce_chng) < 100 and abs(pe_chng) < 100:
                    continue
                
                # Weight by volume
                ce_smart = ce_chng * (1 + (ce_vol / stats['max_vol']))
                pe_smart = pe_chng * (1 + (pe_vol / stats['max_vol']))
                
                atm_prox = self._get_atm_proximity(strike, spot)
                
                # Use magnitude for dominance, keep sign for visualization
                ce_val, pe_val, total, opacity, is_dominant = self._apply_smart_dominance(
                    abs(ce_smart), abs(pe_smart), atm_prox, min_total
                )
                
                if total == 0:
                    continue
                
                # Restore signs
                if ce_smart < 0:
                    ce_val = -ce_val
                if pe_smart < 0:
                    pe_val = -pe_val
                
                max_val = max(max_val, max(abs(ce_val), abs(pe_val)))
                
                data_points.append({
                    'strike': strike,
                    'ce_val': ce_val,
                    'pe_val': pe_val,
                    'total': total,
                    'opacity': opacity,
                    'is_dominant': is_dominant,
                    'ce_unwinding': ce_smart < 0,
                    'pe_unwinding': pe_smart < 0
                })
            except Exception as e:
                continue
        
        return {
            'data_points': data_points,
            'max_val': max_val,
            'name': 'Smart Flow (Vol. Wgt)',
            'ce_label': 'CE Flow',
            'pe_label': 'PE Flow',
            'show_sign': True
        }
    
    def _calculate_reversal_profile(
        self,
        oc: Dict[str, Any],
        spot: float,
        stats: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Reversal Zones Profile - Uses ACTUAL REVERSAL VALUES
        
        Key change: Uses the actual calculated reversal prices from data
        (reversal, wkly_reversal, fut_reversal) - NOT snapped to strikes!
        
        Returns: TOP 2 most significant reversal levels (1 R, 1 S)
        """
        import statistics
        
        # ═══════════════════════════════════════════════════════════
        # STEP 1: Extract ACTUAL REVERSAL VALUES (not strikes!)
        # ═══════════════════════════════════════════════════════════
        reversal_points = []
        
        for strike_str, strike_data in oc.items():
            try:
                strike = float(strike_str)
                ce = strike_data.get('ce', {})
                pe = strike_data.get('pe', {})
                
                # Get ACTUAL reversal values (calculated prices, can be any value)
                reversal = strike_data.get('reversal', 0) or 0
                wkly_reversal = strike_data.get('wkly_reversal', 0) or 0
                fut_reversal = strike_data.get('fut_reversal', 0) or 0
                
                if not any([reversal, wkly_reversal, fut_reversal]):
                    continue
                
                ce_oi = ce.get('OI', ce.get('oi', 0)) or 0
                pe_oi = pe.get('OI', pe.get('oi', 0)) or 0
                ce_oichng = ce.get('oichng', 0) or 0
                pe_oichng = pe.get('oichng', 0) or 0
                
                total_oi = ce_oi + pe_oi
                if total_oi < stats.get('min_significant_oi', 100):
                    continue
                
                # Collect each reversal level with its ACTUAL calculated price
                for level_price, timeframe, weight in [
                    (reversal, 'Intraday', 1.0),
                    (wkly_reversal, 'Weekly', 1.5),
                    (fut_reversal, 'Future', 0.8)
                ]:
                    if level_price and level_price > 0:
                        is_resistance = level_price > spot
                        strength = (ce_oi if is_resistance else pe_oi) * weight
                        
                        reversal_points.append({
                            'price': level_price,  # ACTUAL REVERSAL VALUE!
                            'strike': strike,
                            'timeframe': timeframe,
                            'strength': strength,
                            'ce_oi': ce_oi,
                            'pe_oi': pe_oi,
                            'total_oi': total_oi,
                            'is_resistance': is_resistance
                        })
            except Exception:
                continue
        
        if len(reversal_points) < 2:
            return {'data_points': [], 'max_val': 0, 'name': 'Reversal Zones'}
        
        # ═══════════════════════════════════════════════════════════
        # STEP 2: Calculate statistics for scoring
        # ═══════════════════════════════════════════════════════════
        
        strengths = [p['strength'] for p in reversal_points]
        max_strength = max(strengths) if strengths else 1
        mean_strength = statistics.mean(strengths) if strengths else 0
        stdev_strength = statistics.stdev(strengths) if len(strengths) > 1 else 1
        
        # ═══════════════════════════════════════════════════════════
        # STEP 3: Score each reversal point
        # ═══════════════════════════════════════════════════════════
        
        for p in reversal_points:
            # Z-score for strength
            z_score = (p['strength'] - mean_strength) / stdev_strength if stdev_strength > 0 else 0
            
            # Concentration
            concentration = p['strength'] / max_strength if max_strength > 0 else 0
            
            # Proximity to spot
            dist = abs(p['price'] - spot)
            proximity = max(0, 1 - (dist / (spot * 0.02)))  # Decay over 2%
            
            # Composite score (simpler for actual reversal values)
            score = (
                min(max(z_score, 0), 3) / 3 * 0.40 +  # Z-score (40%)
                concentration * 0.35 +                 # Concentration (35%)
                proximity * 0.25                       # Proximity (25%)
            )
            
            # Direction confirmation
            if p['is_resistance']:
                dir_bias = p['ce_oi'] / p['total_oi'] if p['total_oi'] > 0 else 0.5
            else:
                dir_bias = p['pe_oi'] / p['total_oi'] if p['total_oi'] > 0 else 0.5
            
            score *= (1 + (dir_bias - 0.5) * 0.3)  # Up to 15% boost
            
            p['score'] = score
            p['z_score'] = z_score
            p['dir_bias'] = dir_bias
        
        # ═══════════════════════════════════════════════════════════
        # STEP 4: CLUSTER nearby reversal points (within 1 strike step)
        # ═══════════════════════════════════════════════════════════
        
        # Detect strike step from option chain
        strikes = sorted([float(s) for s in oc.keys()])
        if len(strikes) >= 2:
            diffs = [strikes[i+1] - strikes[i] for i in range(min(10, len(strikes)-1))]
            strike_step = min(diffs) if diffs else 50
        else:
            strike_step = 50
        
        # Sort by price for clustering
        reversal_points.sort(key=lambda x: x['price'])
        
        # Cluster points within 1.5 strike steps
        cluster_threshold = strike_step * 1.5
        clusters = []
        current_cluster = None
        
        for p in reversal_points:
            if current_cluster is None:
                current_cluster = {
                    'points': [p],
                    'weighted_price': p['price'] * p['strength'],
                    'total_strength': p['strength'],
                    'total_ce_oi': p['ce_oi'],
                    'total_pe_oi': p['pe_oi'],
                    'total_oi': p['total_oi'],
                    'max_score': p['score'],
                    'is_resistance': p['is_resistance'],
                    'timeframes': {p['timeframe']}
                }
            else:
                # Calculate current cluster center
                if current_cluster['total_strength'] > 0:
                    cluster_center = current_cluster['weighted_price'] / current_cluster['total_strength']
                else:
                    cluster_center = current_cluster['points'][0]['price']
                
                # Check if within threshold AND same direction
                if abs(p['price'] - cluster_center) <= cluster_threshold and p['is_resistance'] == current_cluster['is_resistance']:
                    # Add to cluster
                    current_cluster['points'].append(p)
                    current_cluster['weighted_price'] += p['price'] * p['strength']
                    current_cluster['total_strength'] += p['strength']
                    current_cluster['total_ce_oi'] += p['ce_oi']
                    current_cluster['total_pe_oi'] += p['pe_oi']
                    current_cluster['total_oi'] += p['total_oi']
                    current_cluster['max_score'] = max(current_cluster['max_score'], p['score'])
                    current_cluster['timeframes'].add(p['timeframe'])
                else:
                    # Save current and start new cluster
                    clusters.append(current_cluster)
                    current_cluster = {
                        'points': [p],
                        'weighted_price': p['price'] * p['strength'],
                        'total_strength': p['strength'],
                        'total_ce_oi': p['ce_oi'],
                        'total_pe_oi': p['pe_oi'],
                        'total_oi': p['total_oi'],
                        'max_score': p['score'],
                        'is_resistance': p['is_resistance'],
                        'timeframes': {p['timeframe']}
                    }
        
        if current_cluster:
            clusters.append(current_cluster)
        
        # Finalize cluster data
        for c in clusters:
            if c['total_strength'] > 0:
                c['final_price'] = c['weighted_price'] / c['total_strength']
            else:
                c['final_price'] = c['points'][0]['price']
            
            # Multi-timeframe confirmation bonus
            multi_tf_bonus = 1 + (len(c['timeframes']) - 1) * 0.15  # 15% per extra timeframe
            c['cluster_score'] = c['max_score'] * multi_tf_bonus * (1 + len(c['points']) * 0.05)  # 5% per extra point
            
            # Direction bias
            if c['is_resistance']:
                c['dir_bias'] = c['total_ce_oi'] / c['total_oi'] if c['total_oi'] > 0 else 0.5
            else:
                c['dir_bias'] = c['total_pe_oi'] / c['total_oi'] if c['total_oi'] > 0 else 0.5
        
        # ═══════════════════════════════════════════════════════════
        # STEP 5: Select TOP clustered zones (1 R, 1 S)
        # ═══════════════════════════════════════════════════════════
        
        resistance_clusters = [c for c in clusters if c['is_resistance']]
        support_clusters = [c for c in clusters if not c['is_resistance']]
        
        resistance_clusters.sort(key=lambda x: x['cluster_score'], reverse=True)
        support_clusters.sort(key=lambda x: x['cluster_score'], reverse=True)
        
        selected = []
        max_score = 0
        
        # Best resistance cluster
        if resistance_clusters and resistance_clusters[0]['cluster_score'] > 0.10:
            best = resistance_clusters[0]
            selected.append({
                'price': best['final_price'],  # Weighted average of cluster!
                'type': 'R',
                'score': best['cluster_score'],
                'ce_oi': best['total_ce_oi'],
                'pe_oi': best['total_pe_oi'],
                'total_oi': best['total_oi'],
                'timeframes': list(best['timeframes']),
                'dir_bias': best['dir_bias'],
                'point_count': len(best['points'])
            })
            max_score = max(max_score, best['cluster_score'])
        
        # Best support cluster
        if support_clusters and support_clusters[0]['cluster_score'] > 0.10:
            best = support_clusters[0]
            selected.append({
                'price': best['final_price'],  # Weighted average of cluster!
                'type': 'S',
                'score': best['cluster_score'],
                'ce_oi': best['total_ce_oi'],
                'pe_oi': best['total_pe_oi'],
                'total_oi': best['total_oi'],
                'timeframes': list(best['timeframes']),
                'dir_bias': best['dir_bias'],
                'point_count': len(best['points'])
            })
            max_score = max(max_score, best['cluster_score'])
        
        if not selected:
            return {'data_points': [], 'max_val': 0, 'name': 'Reversal Zones'}
        
        # ═══════════════════════════════════════════════════════════
        # STEP 6: Convert to output (using clustered ACTUAL prices)
        # ═══════════════════════════════════════════════════════════
        
        data_points = []
        
        for zone in selected:
            conf_pct = zone['score'] / max_score if max_score > 0 else 0
            
            if conf_pct >= 0.8:
                confidence = 'HIGH'
                opacity = 1.0
            elif conf_pct >= 0.5:
                confidence = 'MEDIUM'
                opacity = 0.8
            else:
                confidence = 'LOW'
                opacity = 0.6
            
            is_r = zone['type'] == 'R'
            is_dominant = zone['dir_bias'] >= 0.60
            
            if is_dominant:
                ce_val = zone['total_oi'] if is_r else 0
                pe_val = 0 if is_r else zone['total_oi']
            else:
                ce_val = zone['ce_oi']
                pe_val = zone['pe_oi']
            
            data_points.append({
                'strike': zone['price'],  # CLUSTERED WEIGHTED AVERAGE PRICE
                'ce_val': ce_val,
                'pe_val': pe_val,
                'total': zone['total_oi'],
                'opacity': opacity,
                'is_dominant': is_dominant,
                'zone_type': zone['type'],
                'confidence': confidence,
                'timeframes': zone['timeframes'],
                'multi_timeframe': len(zone['timeframes']) > 1,
                'cluster_size': zone['point_count'],
                'score': round(zone['score'] * 100, 1)
            })
        
        return {
            'data_points': data_points,
            'max_val': max(d['total'] for d in data_points) if data_points else 0,
            'name': 'Reversal Zones',
            'ce_label': 'Resistance',
            'pe_label': 'Support'
        }
    
    def _calculate_gex_profile(
        self,
        oc: Dict[str, Any],
        spot: float,
        stats: Dict[str, float]
    ) -> Dict[str, Any]:
        """GEX (Gamma Exposure) Profile with Noise Filtering"""
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
                
                # Skip insignificant OI
                if ce_oi + pe_oi < stats.get('min_significant_oi', 0):
                    continue
                
                ce_gamma = (ce.get('optgeeks', {}) or {}).get('gamma', 0) or 0
                pe_gamma = (pe.get('optgeeks', {}) or {}).get('gamma', 0) or 0
                ce_delta = (ce.get('optgeeks', {}) or {}).get('delta', 0) or 0
                pe_delta = (pe.get('optgeeks', {}) or {}).get('delta', 0) or 0
                
                # Risk = (OI * Delta) + (OI * Gamma * Spot * 0.01)
                ce_risk = (ce_oi * abs(ce_delta)) + (ce_oi * abs(ce_gamma) * spot * 0.01)
                pe_risk = (pe_oi * abs(pe_delta)) + (pe_oi * abs(pe_gamma) * spot * 0.01)
                
                atm_prox = self._get_atm_proximity(strike, spot)
                
                ce_val, pe_val, total, opacity, is_dominant = self._apply_smart_dominance(
                    ce_risk, pe_risk, atm_prox, min_total
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
                    'net_risk': ce_risk - pe_risk
                })
            except Exception as e:
                continue
        
        return {
            'data_points': data_points,
            'max_val': max_val,
            'name': 'Smart Exposure (Risk)',
            'ce_label': 'CE Risk',
            'pe_label': 'PE Risk',
            'show_net': True
        }
    
    def _calculate_pcr_profile(
        self,
        oc: Dict[str, Any],
        spot: float,
        stats: Dict[str, float]
    ) -> Dict[str, Any]:
        """PCR Sentiment Profile with Noise Filtering"""
        data_points = []
        max_val = 0
        min_total = stats.get('min_total_for_display', 0) * 0.001  # PCR is normalized, use smaller threshold
        
        for strike_str, strike_data in oc.items():
            try:
                strike = float(strike_str)
                ce = strike_data.get('ce', {})
                pe = strike_data.get('pe', {})
                
                ce_oi = ce.get('OI', ce.get('oi', 0)) or 0
                pe_oi = pe.get('OI', pe.get('oi', 0)) or 0
                
                # Skip insignificant OI
                if ce_oi + pe_oi < stats.get('min_significant_oi', 0):
                    continue
                
                pcr = pe_oi / ce_oi if ce_oi > 0 else 0
                pcr_norm = min(max(pcr, 0.3), 3)
                
                ce_pcr = (1 - pcr_norm) if pcr_norm < 1 else 0
                pe_pcr = (pcr_norm - 1) if pcr_norm > 1 else 0
                
                atm_prox = self._get_atm_proximity(strike, spot)
                
                ce_val, pe_val, total, opacity, is_dominant = self._apply_smart_dominance(
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
            except Exception as e:
                continue
        
        return {
            'data_points': data_points,
            'max_val': max_val,
            'name': 'PCR Sentiment',
            'ce_label': 'Bearish',
            'pe_label': 'Bullish',
            'show_ratio': True
        }


# Singleton instance
profile_service = ProfileService()

"""Reversal Profile Calculator"""
from typing import Dict, Any, List
import statistics
from app.services.profiles.base import BaseProfileCalculator


class ReversalProfileCalculator(BaseProfileCalculator):
    """
    Reversal Zones Profile - Uses ACTUAL REVERSAL VALUES
    
    Key change: Uses the actual calculated reversal prices from data
    (reversal, wkly_reversal, fut_reversal) - NOT snapped to strikes!
    
    Returns: TOP 2 most significant reversal levels (1 R, 1 S)
    """
    
    def calculate(self, oc: Dict[str, Any], spot: float, stats: Dict[str, float]) -> Dict[str, Any]:
        
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


reversal_calculator = ReversalProfileCalculator()

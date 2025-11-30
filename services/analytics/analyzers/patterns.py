"""
Pattern Detector

Detects unusual patterns and trading opportunities in option chain data.
Generates trading signals for scalping, swings, and hedging.
"""

from typing import Dict, List, Optional
from datetime import datetime
import structlog

logger = structlog.get_logger("pattern-detector")


class PatternDetector:
    """
    Detect patterns and anomalies in option chain data.
    
    Patterns:
    - Unusual OI buildup
    - Call/Put ratio extremes
    - Large single-strike accumulation
    - Spread opportunities
    - IV expansion/contraction
    - Volume-OI divergence
    """
    
    def __init__(self):
        logger.info("PatternDetector initialized")
        
        # Thresholds
        self.oi_buildup_threshold = 2.0  # 2σ above mean
        self.pcr_extreme_low = 0.7  # Bullish extreme
        self.pcr_extreme_high = 1.3  # Bearish extreme
        self.volume_oi_divergence_threshold = 2.0  # Volume >> OI change
        self.iv_spike_threshold = 1.5  # 50% above average
    
    async def analyze(self, current_data: Dict, historical_data: List[Dict]) -> List[Dict]:
        """
        Detect patterns and generate signals.
        
        Args:
            current_data: Current enriched option chain
            historical_data: Historical snapshots for comparison
            
        Returns:
            List of detected patterns with confidence scores
        """
        try:
            patterns = []
            options = current_data.get('options', [])
            spot_price = current_data.get('spot_price', 0)
            
            if not options:
                return []
            
            # 1. Unusual OI buildup
            oi_patterns = self.detect_unusual_oi_buildup(options, historical_data)
            patterns.extend(oi_patterns)
            
            # 2. PCR extremes
            pcr_patterns = self.detect_pcr_extremes(current_data)
            patterns.extend(pcr_patterns)
            
            # 3. Large single-strike accumulation
            accumulation_patterns = self.detect_large_accumulation(options, spot_price)
            patterns.extend(accumulation_patterns)
            
            # 4. Spread opportunities
            spread_patterns = self.detect_spread_opportunities(options, spot_price)
            patterns.extend(spread_patterns)
            
            # 5. Volume-OI divergence
            divergence_patterns = self.detect_volume_oi_divergence(options)
            patterns.extend(divergence_patterns)
            
            # 6. IV anomalies
            iv_patterns = self.detect_iv_anomalies(options, historical_data)
            patterns.extend(iv_patterns)
            
            # Sort by confidence
            patterns_sorted = sorted(patterns, key=lambda x: x.get('confidence', 0), reverse=True)
            
            logger.info(f"Detected {len(patterns_sorted)} patterns")
            return patterns_sorted
            
        except Exception as e:
            logger.error(f"Pattern detection failed: {e}", exc_info=True)
            return []
    
    def detect_unusual_oi_buildup(
        self,
        options: List[Dict],
        historical_data: List[Dict]
    ) -> List[Dict]:
        """
        Detect unusual OI buildup compared to historical average.
        
        Args:
            options: Current options
            historical_data: Historical snapshots
            
        Returns:
            List of OI buildup patterns
        """
        patterns = []
        
        try:
            if not historical_data:
                return []
            
            # Calculate average OI per strike from history
            historical_oi = {}
            for snapshot in historical_data:
                for opt in snapshot.get('options', []):
                    key = (opt.get('strike_price'), opt.get('option_type'))
                    if key not in historical_oi:
                        historical_oi[key] = []
                    historical_oi[key].append(opt.get('oi', 0))
            
            # Calculate mean and std dev
            oi_stats = {}
            for key, values in historical_oi.items():
                if len(values) >= 3:  # Minimum data points
                    mean = sum(values) / len(values)
                    variance = sum((x - mean) ** 2 for x in values) / len(values)
                    std_dev = variance ** 0.5
                    oi_stats[key] = {'mean': mean, 'std_dev': std_dev}
            
            # Check current OI against historical
            for opt in options:
                key = (opt.get('strike_price'), opt.get('option_type'))
                current_oi = opt.get('oi', 0)
                
                if key in oi_stats:
                    stats = oi_stats[key]
                    mean = stats['mean']
                    std_dev = stats['std_dev']
                    
                    if std_dev > 0:
                        z_score = (current_oi - mean) / std_dev
                        
                        # Unusual if > 2σ above mean
                        if z_score > self.oi_buildup_threshold:
                            patterns.append({
                                'type': 'unusual_oi_buildup',
                                'strike': opt.get('strike_price'),
                                'option_type': opt.get('option_type'),
                                'current_oi': current_oi,
                                'historical_avg': round(mean, 0),
                                'z_score': round(z_score, 2),
                                'confidence': min(95, 50 + (z_score * 10)),
                                'signal': 'bullish' if opt.get('option_type') == 'CE' else 'bearish',
                                'description': f"OI {z_score:.1f}σ above average at {opt.get('strike_price')} {opt.get('option_type')}"
                            })
            
        except Exception as e:
            logger.error(f"OI buildup detection error: {e}")
        
        return patterns
    
    def detect_pcr_extremes(self, current_data: Dict) -> List[Dict]:
        """
        Detect extreme Put-Call ratios.
        
        Args:
            current_data: Current data with PCR
            
        Returns:
            List of PCR extreme patterns
        """
        patterns = []
        
        try:
            pcr = current_data.get('pcr_oi', 0)
            
            if pcr == 0:
                return []
            
            # Low PCR = Bullish (more calls)
            if pcr < self.pcr_extreme_low:
                confidence = min(90, 50 + ((self.pcr_extreme_low - pcr) * 100))
                patterns.append({
                    'type': 'pcr_extreme',
                    'pcr': round(pcr, 3),
                    'extreme_type': 'low',
                    'confidence': round(confidence, 0),
                    'signal': 'bullish',
                    'description': f"Very low PCR ({pcr:.3f}) suggests bullish sentiment"
                })
            
            # High PCR = Bearish (more puts)
            elif pcr > self.pcr_extreme_high:
                confidence = min(90, 50 + ((pcr - self.pcr_extreme_high) * 100))
                patterns.append({
                    'type': 'pcr_extreme',
                    'pcr': round(pcr, 3),
                    'extreme_type': 'high',
                    'confidence': round(confidence, 0),
                    'signal': 'bearish',
                    'description': f"Very high PCR ({pcr:.3f}) suggests bearish sentiment"
                })
            
        except Exception as e:
            logger.error(f"PCR extreme detection error: {e}")
        
        return patterns
    
    def detect_large_accumulation(
        self,
        options: List[Dict],
        spot_price: float
    ) -> List[Dict]:
        """
        Detect large OI accumulation at single strikes.
        
        Args:
            options: Option contracts
            spot_price: Current spot
            
        Returns:
            List of accumulation patterns
        """
        patterns = []
        
        try:
            # Find strikes with top 5% OI
            all_oi = sorted([opt.get('oi', 0) for opt in options], reverse=True)
            if not all_oi:
                return []
            
            top_5_pct_threshold = all_oi[max(0, len(all_oi) // 20)]
            
            for opt in options:
                oi = opt.get('oi', 0)
                strike = opt.get('strike_price', 0)
                
                if oi >= top_5_pct_threshold and oi > 0:
                    # Calculate distance from spot
                    distance_pct = abs(strike - spot_price) / spot_price * 100
                    
                    # Strong accumulation if within 5% of spot
                    if distance_pct <= 5:
                        patterns.append({
                            'type': 'large_accumulation',
                            'strike': strike,
                            'option_type': opt.get('option_type'),
                            'oi': oi,
                            'distance_from_spot_pct': round(distance_pct, 2),
                            'confidence': min(90, 70 - (distance_pct * 5)),
                            'signal': 'neutral',  # Could be hedging
                            'description': f"Large OI ({oi:,}) at {strike} ({distance_pct:.1f}% from spot)"
                        })
            
        except Exception as e:
            logger.error(f"Accumulation detection error: {e}")
        
        return patterns
    
    def detect_spread_opportunities(
        self,
        options: List[Dict],
        spot_price: float
    ) -> List[Dict]:
        """
        Detect potential spread trading opportunities.
        
        Args:
            options: Option contracts
            spot_price: Current spot
            
        Returns:
            List of spread opportunities
        """
        patterns = []
        
        try:
            # Check if we have options data
            if not options:
                return []

            # Prepare data: separate calls and puts, sort by strike
            ce_data = sorted([opt for opt in options if opt.get('option_type') == 'CE'], key=lambda x: x.get('strike_price', 0))
            pe_data = sorted([opt for opt in options if opt.get('option_type') == 'PE'], key=lambda x: x.get('strike_price', 0))
            
            # Get unique sorted strikes
            strikes = sorted(list(set([opt.get('strike_price') for opt in options])))

            if not strikes or not ce_data or not pe_data:
                return []
        
            # Detect spread opportunities (straddles, strangles, verticals, iron condor)
            spreads = []
            
            # Find ATM and near-ATM strikes
            atm_strike = min(strikes, key=lambda x: abs(x - spot_price))
            
            # Find index of ATM strike in sorted CE/PE data
            atm_ce_idx = -1
            for i, opt in enumerate(ce_data):
                if opt.get('strike_price') == atm_strike:
                    atm_ce_idx = i
                    break
            
            atm_pe_idx = -1
            for i, opt in enumerate(pe_data):
                if opt.get('strike_price') == atm_strike:
                    atm_pe_idx = i
                    break

            if atm_ce_idx == -1 or atm_pe_idx == -1:
                return [] # Cannot find ATM options for both CE and PE

            # 1. Straddle (ATM call + ATM put, high IV)
            if atm_ce_idx < len(ce_data) and atm_pe_idx < len(pe_data):
                ce_iv = ce_data[atm_ce_idx].get('iv', 0)
                pe_iv = pe_data[atm_pe_idx].get('iv', 0)
                avg_iv = (ce_iv + pe_iv) / 2 if ce_iv and pe_iv else 0
                
                if avg_iv > 30:  # High IV threshold
                    spreads.append({
                        'type': 'long_straddle',
                        'strikes': [atm_strike],
                        'iv': round(avg_iv, 2),
                        'premium': ce_data[atm_ce_idx].get('ltp', 0) + pe_data[atm_pe_idx].get('ltp', 0),
                        'signal': 'volatility_play',
                        'description': f'High IV straddle at {atm_strike} (IV: {avg_iv:.1f}%)'
                    })
            
            # 2. Strangle (OTM call + OTM put)
            # Assuming strikes are somewhat evenly spaced, use relative indices
            # For strangle, we need OTM call (higher strike) and OTM put (lower strike)
            # Let's find strikes relative to ATM
            otm_call_strike_idx = atm_ce_idx + 2 # Two strikes higher than ATM CE
            otm_put_strike_idx = atm_pe_idx - 2 # Two strikes lower than ATM PE

            if otm_call_strike_idx < len(ce_data) and otm_put_strike_idx >= 0:
                otm_call_strike = ce_data[otm_call_strike_idx].get('strike_price')
                otm_put_strike = pe_data[otm_put_strike_idx].get('strike_price')
                
                otm_call_iv = ce_data[otm_call_strike_idx].get('iv', 0)
                otm_put_iv = pe_data[otm_put_strike_idx].get('iv', 0)
                avg_strangle_iv = (otm_call_iv + otm_put_iv) / 2 if otm_call_iv and otm_put_iv else 0
                
                if avg_strangle_iv > 28:
                    spreads.append({
                        'type': 'long_strangle',
                        'strikes': [otm_put_strike, otm_call_strike],
                        'iv': round(avg_strangle_iv, 2),
                        'premium': (ce_data[otm_call_strike_idx].get('ltp', 0) + 
                                   pe_data[otm_put_strike_idx].get('ltp', 0)),
                        'signal': 'large_move_expected',
                        'description': f'Strangle {otm_put_strike}P/{otm_call_strike}C'
                    })
            
            # 3. Bull Call Spread (buy lower strike call, sell higher strike call)
            # Buy ATM CE, Sell 2 strikes higher CE
            if atm_ce_idx + 2 < len(ce_data):
                lower_strike = ce_data[atm_ce_idx].get('strike_price')
                higher_strike = ce_data[atm_ce_idx + 2].get('strike_price')
                
                lower_premium = ce_data[atm_ce_idx].get('ltp', 0)
                higher_premium = ce_data[atm_ce_idx + 2].get('ltp', 0)
                net_debit = lower_premium - higher_premium
                
                if net_debit > 0 and higher_premium > 0:
                    max_profit = (higher_strike - lower_strike) - net_debit
                    spreads.append({
                        'type': 'bull_call_spread',
                        'strikes': [lower_strike, higher_strike],
                        'net_debit': round(net_debit, 2),
                        'max_profit': round(max_profit, 2),
                        'signal': 'bullish',
                        'description': f'Bull call spread {lower_strike}/{higher_strike}'
                    })
            
            # 4. Bear Put Spread (buy higher strike put, sell lower strike put)
            # Buy ATM PE, Sell 2 strikes lower PE
            if atm_pe_idx - 2 >= 0:
                higher_strike = pe_data[atm_pe_idx].get('strike_price')
                lower_strike = pe_data[atm_pe_idx - 2].get('strike_price')
                
                higher_premium = pe_data[atm_pe_idx].get('ltp', 0)
                lower_premium = pe_data[atm_pe_idx - 2].get('ltp', 0)
                net_debit = higher_premium - lower_premium
                
                if net_debit > 0 and lower_premium > 0:
                    max_profit = (higher_strike - lower_strike) - net_debit
                    spreads.append({
                        'type': 'bear_put_spread',
                        'strikes': [lower_strike, higher_strike],
                        'net_debit': round(net_debit, 2),
                        'max_profit': round(max_profit, 2),
                        'signal': 'bearish',
                        'description': f'Bear put spread {lower_strike}/{higher_strike}'
                    })
            
            # 5. Iron Condor (sell OTM call + put, buy further OTM call + put)
            # Sell 2 strikes OTM CE, Buy 3 strikes OTM CE
            # Sell 2 strikes OTM PE, Buy 3 strikes OTM PE
            if atm_ce_idx + 3 < len(ce_data) and atm_pe_idx - 3 >= 0:
                # Short strikes (closer to ATM)
                short_call_opt = ce_data[atm_ce_idx + 2]
                short_put_opt = pe_data[atm_pe_idx - 2]
                
                # Long strikes (further OTM)
                long_call_opt = ce_data[atm_ce_idx + 3]
                long_put_opt = pe_data[atm_pe_idx - 3]
                
                # Get strike prices
                short_call = short_call_opt.get('strike_price')
                short_put = short_put_opt.get('strike_price')
                long_call = long_call_opt.get('strike_price')
                long_put = long_put_opt.get('strike_price')

                # Calculate net credit
                short_call_premium = short_call_opt.get('ltp', 0)
                short_put_premium = short_put_opt.get('ltp', 0)
                long_call_premium = long_call_opt.get('ltp', 0)
                long_put_premium = long_put_opt.get('ltp', 0)
                
                net_credit = (short_call_premium + short_put_premium - 
                             long_call_premium - long_put_premium)
                
                if net_credit > 0:
                    spreads.append({
                        'type': 'iron_condor',
                        'strikes': [long_put, short_put, short_call, long_call],
                        'net_credit': round(net_credit, 2),
                        'max_profit': round(net_credit, 2),
                        'signal': 'range_bound',
                        'description': f'Iron condor {long_put}/{short_put}/{short_call}/{long_call}'
                    })
            
            if spreads:
                patterns.append({
                    'type': 'spread_opportunity',
                    'strike': atm_strike,
                    'option_type': None,
                    'confidence': 75,
                    'signal': 'neutral',
                    'description': f'Found {len(spreads)} spread opportunities',
                    'spreads': spreads
                })
            
        except Exception as e:
            logger.error(f"Spread detection error: {e}")
        
        return patterns
    
    def detect_volume_oi_divergence(self, options: List[Dict]) -> List[Dict]:
        """
        Detect when volume significantly exceeds OI change.
        
        Suggests short-term trading vs long-term positioning.
        
        Args:
            options: Option contracts
            
        Returns:
            List of divergence patterns
        """
        patterns = []
        
        try:
            for opt in options:
                volume = opt.get('volume', 0)
                oi_change = abs(opt.get('oi_change', 0))
                
                if oi_change > 0 and volume > 0:
                    ratio = volume / oi_change
                    
                    # Volume >> OI change suggests intraday trading
                    if ratio > self.volume_oi_divergence_threshold:
                        patterns.append({
                            'type': 'volume_oi_divergence',
                            'strike': opt.get('strike_price'),
                            'option_type': opt.get('option_type'),
                            'volume': volume,
                            'oi_change': oi_change,
                            'ratio': round(ratio, 2),
                            'confidence': min(85, 50 + (ratio * 10)),
                            'signal': 'scalping_opportunity',
                            'description': f"High volume/OI ratio ({ratio:.1f}x) suggests active trading"
                        })
            
        except Exception as e:
            logger.error(f"Divergence detection error: {e}")
        
        return patterns
    
    def detect_iv_anomalies(
        self,
        options: List[Dict],
        historical_data: List[Dict]
    ) -> List[Dict]:
        """
        Detect unusual IV spikes or drops.
        
        Args:
            options: Current options
            historical_data: Historical snapshots
            
        Returns:
            List of IV anomaly patterns
        """
        patterns = []
        
        try:
            if not historical_data:
                return []
            
            # Calculate historical average IV
            historical_iv = {}
            for snapshot in historical_data:
                for opt in snapshot.get('options', []):
                    key = (opt.get('strike_price'), opt.get('option_type'))
                    if key not in historical_iv:
                        historical_iv[key] = []
                    if opt.get('iv'):
                        historical_iv[key].append(opt.get('iv'))
            
            # Check current IV against historical
            for opt in options:
                key = (opt.get('strike_price'), opt.get('option_type'))
                current_iv = opt.get('iv', 0)
                
                if key in historical_iv and historical_iv[key]:
                    avg_iv = sum(historical_iv[key]) / len(historical_iv[key])
                    
                    if avg_iv > 0:
                        iv_ratio = current_iv / avg_iv
                        
                        # Spike if > 1.5x average
                        if iv_ratio > self.iv_spike_threshold:
                            patterns.append({
                                'type': 'iv_spike',
                                'strike': opt.get('strike_price'),
                                'option_type': opt.get('option_type'),
                                'current_iv': round(current_iv, 2),
                                'historical_avg': round(avg_iv, 2),
                                'spike_ratio': round(iv_ratio, 2),
                                'confidence': min(90, 50 + ((iv_ratio - 1) * 50)),
                                'signal': 'volatility_expansion',
                                'description': f"IV spike ({iv_ratio:.1f}x avg) at {opt.get('strike_price')}"
                            })
            
        except Exception as e:
            logger.error(f"IV anomaly detection error: {e}")
        
        return patterns

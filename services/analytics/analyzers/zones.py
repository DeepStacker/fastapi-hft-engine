"""
Support/Resistance Zones Analyzer

Detects key price levels based on OI concentration and max pain.
Identifies support/resistance zones for trading decisions.
"""

from typing import Dict, List, Optional
from datetime import datetime
import structlog

logger = structlog.get_logger("zones-analyzer")


class SupportResistanceAnalyzer:
    """
    Detect support/resistance zones from OI distribution.
    
    Methods:
    - Max pain calculation
    - OI concentration zones
    - Historical pivot points
    - Dynamic support/resistance levels
    """
    
    def __init__(self):
        logger.info("SupportResistanceAnalyzer initialized")
        self.oi_threshold_percentile = 75  # Top 25% OI strikes
        self.zone_proximity = 50  # Points to group strikes into zones
    
    async def analyze(self, current_data: Dict, historical_data: List[Dict]) -> Dict:
        """
        Detect zones and key levels.
        
        Args:
            current_data: Current enriched option chain
            historical_data: Historical snapshots
            
        Returns:
            Dict with zones, max pain, and support/resistance levels
        """
        try:
            options = current_data.get('options', [])
            spot_price = current_data.get('spot_price', 0)
            
            if not options or not spot_price:
                return {'status': 'insufficient_data'}
            
            # 1. Calculate max pain
            max_pain = self.calculate_max_pain(options)
            
            # 2. Find OI concentration zones
            oi_zones = self.find_oi_concentration_zones(options, spot_price)
            
            # 3. Identify support/resistance levels
            support_levels = self.identify_support_levels(options, spot_price, oi_zones)
            resistance_levels = self.identify_resistance_levels(options, spot_price, oi_zones)
            
            # 4. Calculate zone strengths
            zones_with_strength = self.calculate_zone_strengths(
                support_levels + resistance_levels,
                options
            )
            
            # 5. Historical pivot points (if data available)
            pivots = self.calculate_pivots(historical_data) if historical_data else {}
            
            return {
                'max_pain': max_pain,
                'spot_price': spot_price,
                'support_levels': support_levels,
                'resistance_levels': resistance_levels,
                'oi_zones': oi_zones,
                'zones_with_strength': zones_with_strength,
                'pivots': pivots,
                'analysis_timestamp': current_data.get('timestamp')
            }
            
        except Exception as e:
            logger.error(f"Zone analysis failed: {e}", exc_info=True)
            return {'status': 'error', 'error': str(e)}
    
    def calculate_max_pain(self, options: List[Dict]) -> float:
        """
        Calculate max pain strike price.
        
        Max pain is where option sellers (writers) face maximum loss.
        Found by minimizing total option value at expiration.
        
        Args:
            options: List of option contracts
            
        Returns:
            Max pain strike price
        """
        try:
            # Get unique strikes
            strikes = sorted(set(opt.get('strike_price', 0) for opt in options if opt.get('strike_price')))
            
            if not strikes:
                return 0
            
            # Calculate pain for each strike
            min_pain = float('inf')
            max_pain_strike = strikes[0]
            
            for strike in strikes:
                pain = 0
                
                # Calculate intrinsic value for all options if spot = strike
                for opt in options:
                    opt_strike = opt.get('strike_price', 0)
                    oi = opt.get('oi', 0)
                    opt_type = opt.get('option_type', '')
                    
                    if opt_type == 'CE' and strike > opt_strike:
                        # Call is ITM
                        pain += (strike - opt_strike) * oi
                    elif opt_type == 'PE' and strike < opt_strike:
                        # Put is ITM
                        pain += (opt_strike - strike) * oi
                
                if pain < min_pain:
                    min_pain = pain
                    max_pain_strike = strike
            
            logger.debug(f"Max pain calculated: {max_pain_strike}")
            return float(max_pain_strike)
            
        except Exception as e:
            logger.error(f"Max pain calculation error: {e}")
            return 0
    
    def find_oi_concentration_zones(
        self,
        options: List[Dict],
        spot_price: float
    ) -> List[Dict]:
        """
        Find strikes with high OI concentration.
        
        Args:
            options: Option contracts
            spot_price: Current spot price
            
        Returns:
            List of high OI zones
        """
        try:
            # Calculate OI threshold (top 25%)
            all_oi = [opt.get('oi', 0) for opt in options if opt.get('oi')]
            if not all_oi:
                return []
            
            all_oi_sorted = sorted(all_oi, reverse=True)
            threshold_index = len(all_oi_sorted) // 4
            oi_threshold = all_oi_sorted[threshold_index] if threshold_index < len(all_oi_sorted) else all_oi_sorted[-1]
            
            # Find high OI strikes
            high_oi_strikes = []
            for opt in options:
                oi = opt.get('oi', 0)
                if oi >= oi_threshold:
                    high_oi_strikes.append({
                        'strike': opt.get('strike_price'),
                        'oi': oi,
                        'option_type': opt.get('option_type'),
                        'distance_from_spot': abs(opt.get('strike_price', 0) - spot_price)
                    })
            
            # Group nearby strikes into zones
            zones = self.group_strikes_into_zones(high_oi_strikes)
            
            return zones
            
        except Exception as e:
            logger.error(f"OI concentration error: {e}")
            return []
    
    def group_strikes_into_zones(self, strikes: List[Dict]) -> List[Dict]:
        """Group nearby strikes into zones"""
        if not strikes:
            return []
        
        # Sort by strike price
        strikes_sorted = sorted(strikes, key=lambda x: x['strike'])
        
        zones = []
        current_zone = [strikes_sorted[0]]
        
        for i in range(1, len(strikes_sorted)):
            strike = strikes_sorted[i]
            prev_strike = current_zone[-1]
            
            # If within proximity, add to current zone
            if abs(strike['strike'] - prev_strike['strike']) <= self.zone_proximity:
                current_zone.append(strike)
            else:
                # Save current zone and start new one
                zones.append(self.create_zone_summary(current_zone))
                current_zone = [strike]
        
        # Add last zone
        if current_zone:
            zones.append(self.create_zone_summary(current_zone))
        
        return zones
    
    def create_zone_summary(self, zone_strikes: List[Dict]) -> Dict:
        """Create summary for a zone"""
        total_oi = sum(s['oi'] for s in zone_strikes)
        avg_strike = sum(s['strike'] for s in zone_strikes) / len(zone_strikes)
        
        return {
            'center_strike': round(avg_strike, 2),
            'lower_bound': min(s['strike'] for s in zone_strikes),
            'upper_bound': max(s['strike'] for s in zone_strikes),
            'total_oi': total_oi,
            'strike_count': len(zone_strikes)
        }
    
    def identify_support_levels(
        self,
        options: List[Dict],
        spot_price: float,
        oi_zones: List[Dict]
    ) -> List[float]:
        """
        Identify support levels (below spot price).
        
        Args:
            options: Option contracts
            spot_price: Current spot
            oi_zones: OI concentration zones
            
        Returns:
            List of support strike prices
        """
        support_levels = []
        
        # Support from OI zones below spot
        for zone in oi_zones:
            if zone['center_strike'] < spot_price:
                support_levels.append(zone['center_strike'])
        
        # Support from high PUT OI
        put_strikes = [
            opt.get('strike_price')
            for opt in options
            if opt.get('option_type') == 'PE' 
            and opt.get('oi', 0) > 0
            and opt.get('strike_price', 0) < spot_price
        ]
        
        # Take top 3 by OI
        put_strikes_sorted = sorted(
            [(s, next((o.get('oi') for o in options if o.get('strike_price') == s), 0)) 
             for s in set(put_strikes)],
            key=lambda x: x[1],
            reverse=True
        )[:3]
        
        support_levels.extend([s[0] for s in put_strikes_sorted])
        
        # Remove duplicates and sort
        return sorted(list(set(support_levels)), reverse=True)
    
    def identify_resistance_levels(
        self,
        options: List[Dict],
        spot_price: float,
        oi_zones: List[Dict]
    ) -> List[float]:
        """
        Identify resistance levels (above spot price).
        
        Args:
            options: Option contracts
            spot_price: Current spot
            oi_zones: OI concentration zones
            
        Returns:
            List of resistance strike prices
        """
        resistance_levels = []
        
        # Resistance from OI zones above spot
        for zone in oi_zones:
            if zone['center_strike'] > spot_price:
                resistance_levels.append(zone['center_strike'])
        
        # Resistance from high CALL OI
        call_strikes = [
            opt.get('strike_price')
            for opt in options
            if opt.get('option_type') == 'CE'
            and opt.get('oi', 0) > 0
            and opt.get('strike_price', 0) > spot_price
        ]
        
        # Take top 3 by OI
        call_strikes_sorted = sorted(
            [(s, next((o.get('oi') for o in options if o.get('strike_price') == s), 0))
             for s in set(call_strikes)],
            key=lambda x: x[1],
            reverse=True
        )[:3]
        
        resistance_levels.extend([s[0] for s in call_strikes_sorted])
        
        # Remove duplicates and sort
        return sorted(list(set(resistance_levels)))
    
    def calculate_zone_strengths(
        self,
        levels: List[float],
        options: List[Dict]
    ) -> List[Dict]:
        """
        Calculate strength score for each level.
        
        Strength based on:
        - Total OI at level
        - Number of strikes in zone
        - Distance from spot
        
        Args:
            levels: Support/resistance levels
            options: Option contracts
            
        Returns:
            Levels with strength scores
        """
        levels_with_strength = []
        
        for level in levels:
            # Find OI at this level (nearby strikes)
            nearby_oi = sum(
                opt.get('oi', 0)
                for opt in options
                if abs(opt.get('strike_price', 0) - level) <= self.zone_proximity
            )
            
            # Score 0-100
            max_oi = max((opt.get('oi', 0) for opt in options), default=1)
            strength = min(100, (nearby_oi / max_oi) * 100) if max_oi > 0 else 0
            
            levels_with_strength.append({
                'level': level,
                'strength': round(strength, 2),
                'oi_concentration': nearby_oi
            })
        
        return sorted(levels_with_strength, key=lambda x: x['strength'], reverse=True)
    
    def calculate_pivots(self, historical_data: List[Dict]) -> Dict:
        """
        Calculate pivot points from historical high/low.
        
        Args:
            historical_data: Historical snapshots
            
        Returns:
            Pivot levels
        """
        try:
            if not historical_data:
                return {}
            
            # Extract spot prices
            spot_prices = [
                h.get('spot_price', 0)
                for h in historical_data
                if h.get('spot_price')
            ]
            
            if not spot_prices:
                return {}
            
            high = max(spot_prices)
            low = min(spot_prices)
            close = spot_prices[-1]  # Most recent
            
            # Standard pivot calculation
            pivot = (high + low + close) / 3
            r1 = (2 * pivot) - low
            s1 = (2 * pivot) - high
            r2 = pivot + (high - low)
            s2 = pivot - (high - low)
            
            return {
                'pivot': round(pivot, 2),
                'r1': round(r1, 2),
                'r2': round(r2, 2),
                's1': round(s1, 2),
                's2': round(s2, 2),
                'high': round(high, 2),
                'low': round(low, 2)
            }
            
        except Exception as e:
            logger.error(f"Pivot calculation error: {e}")
            return {}


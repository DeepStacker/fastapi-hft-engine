"""
Gamma Exposure Analyzer

Detects:
- Gamma squeeze zones
- Dealer hedging levels
- Market regime (explosive vs range-bound)
"""
from typing import Dict, List, Optional
from core.logging.logger import get_logger

logger = get_logger("gamma-exposure")


class GammaExposureAnalyzer:
    """
    Calculate Gamma Exposure (GEX) to identify:
    - Strikes where dealer hedging creates explosive price moves
    - Zero-gamma strike (flip point)
    - Overall market regime
    
    How it works:
    - Dealers are typically SHORT gamma (sold options to retail)
    - When spot approaches high-gamma strikes, dealers must hedge
    - This creates feedback loops that can pin or squeeze price
    """
    
    def __init__(self, lot_size: int = 75):
        """
        Initialize analyzer
        
        Args:
            lot_size: Default option lot size
        """
        self.lot_size = lot_size
    
    def analyze(
        self,
        options: List,  # List of CleanedOptionData
        spot_price: float,
        lot_size: int = None
    ) -> Dict:
        """
        Calculate gamma exposure across all strikes
        
        Args:
            options: List of CleanedOptionData objects
            spot_price: Current spot price
            lot_size: Option lot size (overrides default)
            
        Returns:
            Analysis result dict
        """
        if lot_size is None:
            lot_size = self.lot_size
        
        # Group by strike
        strikes_data = {}
        
        for opt in options:
            strike = opt.strike
            
            if strike not in strikes_data:
                strikes_data[strike] = {
                    'call_oi': 0,
                    'put_oi': 0,
                    'call_gamma': 0.0,
                    'put_gamma': 0.0
                }
            
            if opt.option_type == 'CE':
                strikes_data[strike]['call_oi'] = opt.oi
                strikes_data[strike]['call_gamma'] = opt.gamma
            else:  # PE
                strikes_data[strike]['put_oi'] = opt.oi
                strikes_data[strike]['put_gamma'] = abs(opt.gamma)  # Make positive
        
        # Calculate GEX per strike
        gamma_levels = {}
        
        for strike, data in strikes_data.items():
            # Gamma Exposure = OI × Gamma × 100 (shares per lot) × Spot²
            # Divided by 10M for readability (in millions)
            # Negative sign: assuming dealers are net short
            
            call_gex = (
                -data['call_oi'] * data['call_gamma'] * 
                100 * (spot_price ** 2) / 10_000_000
            )
            
            put_gex = (
                -data['put_oi'] * data['put_gamma'] * 
                100 * (spot_price ** 2) / 10_000_000
            )
            
            net_gex = call_gex + put_gex
            
            gamma_levels[strike] = {
                'call_gex': round(call_gex, 2),
                'put_gex': round(put_gex, 2),
                'net_gex': round(net_gex, 2),
                'distance_from_spot': abs(strike - spot_price),
                'distance_pct': (abs(strike - spot_price) / spot_price * 100) if spot_price > 0 else 0
            }
        
        # Find top gamma walls (by absolute GEX)
        sorted_gex = sorted(
            gamma_levels.items(),
            key=lambda x: abs(x[1]['net_gex']),
            reverse=True
        )
        
        gamma_walls = [
            {
                'strike': strike,
                'gex': data['net_gex'],
                'distance_pct': round(data['distance_pct'], 2),
                'squeeze_risk': self._calculate_squeeze_risk(data['net_gex'], data['distance_pct'])
            }
            for strike, data in sorted_gex[:5]  # Top 5
        ]
        
        # Find zero-gamma strike (where GEX flips sign)
        zero_gamma_strike = self._find_zero_gamma_strike(gamma_levels)
        
        # Calculate total market GEX
        total_gex = sum(data['net_gex'] for data in gamma_levels.values())
        
        # Determine market regime
        if total_gex < -500:
            market_regime = 'EXPLOSIVE'
            regime_desc = 'Dealers short gamma - expect large moves'
        elif total_gex > 500:
            market_regime = 'RANGE_BOUND'
            regime_desc = 'Dealers long gamma - expect pinning'
        else:
            market_regime = 'NEUTRAL'
            regime_desc = 'Balanced gamma - normal volatility'
        
        result = {
            'gamma_walls': gamma_walls,
            'zero_gamma_strike': zero_gamma_strike,
            'total_market_gex': round(total_gex, 2),
            'market_regime': market_regime,
            'regime_description': regime_desc
        }
        
        logger.debug(
            f"Gamma Exposure: Total GEX={total_gex:.2f}M, "
            f"Regime={market_regime}, "
            f"Top Wall={gamma_walls[0]['strike'] if gamma_walls else 'N/A'}"
        )
        
        return result
    
    def _find_zero_gamma_strike(self, gamma_levels: Dict) -> Optional[float]:
        """
        Find the strike where gamma exposure flips from negative to positive
        (or vice versa)
        
        This is the theoretical "neutral" point
        """
        sorted_strikes = sorted(gamma_levels.keys())
        
        prev_gex = None
        for strike in sorted_strikes:
            curr_gex = gamma_levels[strike]['net_gex']
            
            # Check for sign flip
            if prev_gex is not None and prev_gex * curr_gex < 0:
                # Interpolate between previous and current strike
                # (simple midpoint for now)
                prev_strike = sorted_strikes[sorted_strikes.index(strike) - 1]
                zero_strike = (prev_strike + strike) / 2
                return round(zero_strike, 2)
            
            prev_gex = curr_gex
        
        return None  # No flip found
    
    def _calculate_squeeze_risk(self, gex: float, distance_pct: float) -> str:
        """
        Calculate squeeze risk based on GEX and distance
        """
        # Gamma wall strength (decay with distance)
        strength = abs(gex) * (1 / (1 + distance_pct))
        
        if distance_pct < 1.0:
            if strength > 1000:  # Thresholds need tuning based on lot size/price
                return 'EXTREME'
            elif strength > 500:
                return 'HIGH'
        elif distance_pct < 2.0:
            if strength > 500:
                return 'MODERATE'
                
        return 'LOW'
    
    def get_strike_detail(
        self,
        strike: float,
        options: List,
        spot_price: float
    ) -> Optional[Dict]:
        """
        Get detailed gamma exposure for a specific strike
        
        Args:
            strike: Strike price to analyze
            options: List of CleanedOptionData
            spot_price: Current spot
            
        Returns:
            Detailed GEX breakdown or None
        """
        # Find options at this strike
        call_opt = next((o for o in options if o.strike == strike and o.option_type == 'CE'), None)
        put_opt = next((o for o in options if o.strike == strike and o.option_type == 'PE'), None)
        
        if not call_opt and not put_opt:
            return None
        
        call_gex = 0
        put_gex = 0
        
        if call_opt:
            call_gex = (
                -call_opt.oi * call_opt.gamma * 
                100 * (spot_price ** 2) / 10_000_000
            )
        
        if put_opt:
            put_gex = (
                -put_opt.oi * abs(put_opt.gamma) * 
                100 * (spot_price ** 2) / 10_000_000
            )
        
        return {
            'strike': strike,
            'call_oi': call_opt.oi if call_opt else 0,
            'put_oi': put_opt.oi if put_opt else 0,
            'call_gamma': call_opt.gamma if call_opt else 0,
            'put_gamma': put_opt.gamma if put_opt else 0,
            'call_gex': round(call_gex, 2),
            'put_gex': round(put_gex, 2),
            'net_gex': round(call_gex + put_gex, 2),
            'distance_from_spot': abs(strike - spot_price)
        }

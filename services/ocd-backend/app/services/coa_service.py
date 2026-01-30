"""
Chart of Accuracy (COA) Service

Detects Support/Resistance strength and classifies market into 9 scenarios
based on OI percentage data calculated by Processor's PercentageAnalyzer.
"""
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class StrengthResult:
    """Result for one side (Support or Resistance)"""
    strength: str  # 'Strong', 'WTT', 'WTB'
    strike100: float  # Strike with highest OI (100%)
    strike2nd: Optional[float]  # Second highest/competitor strike
    oi100: int
    oi2nd: Optional[int]
    oichng100: int
    oichng2nd: Optional[int]
    volume100: int
    volume2nd: Optional[int]
    oi_pct100: float
    oi_pct2nd: Optional[float]
    oichng_pct100: float  # OI Change percentage
    oichng_pct2nd: Optional[float]
    volume_pct100: float  # Volume percentage
    volume_pct2nd: Optional[float]


@dataclass
class ScenarioResult:
    """COA scenario classification"""
    id: str  # '1.0' to '1.8'
    name: str
    bias: str  # 'neutral', 'bullish', 'bearish', 'unclear'
    tradable: str  # 'both', 'long', 'short', 'none'


@dataclass
class TradingLevels:
    """Calculated trading levels"""
    eos: float  # Extension of Support
    eor: float  # Extension of Resistance
    eos_plus1: float
    eos_minus1: float
    eor_plus1: float
    eor_minus1: float
    top: Optional[float]
    bottom: Optional[float]
    trade_at_eos: bool
    trade_at_eor: bool


class ChartOfAccuracyService:
    """
    Chart of Accuracy service for scenario detection and trading recommendations.
    
    9 Scenarios based on Support/Resistance strength:
    - 1.0: Strong/Strong - Trade both sides
    - 1.1: Strong/WTB - Bearish pressure
    - 1.2: Strong/WTT - Bullish pressure
    - 1.3: WTB/Strong - Bearish, support weakening
    - 1.4: WTT/Strong - Bullish, support strengthening
    - 1.5: WTB/WTB - Blood bath, no longs
    - 1.6: WTT/WTT - Bull run, no shorts
    - 1.7: WTB/WTT - Wait, both unstable
    - 1.8: WTT/WTB - Wait, both unstable
    """
    
    def __init__(self, wtt_threshold: float = 75.0):
        """
        Args:
            wtt_threshold: Percentage threshold for WTT/WTB detection (default: 75%)
        """
        self.wtt_threshold = wtt_threshold
    
    def _detect_strength(
        self,
        options: List[Dict[str, Any]],
        side: str  # 'CE' or 'PE'
    ) -> StrengthResult:
        """
        Detect strength for one side (Support for PE, Resistance for CE).
        
        Correct COA Logic:
        1. Find strike with maximum OI (100% reference)
        2. Calculate percentage for ALL strikes relative to max for: OI, OI Change, Volume
        3. Check if ANY competitor strike has >= 75% in ANY ONE of these metrics
        4. If competitor exists:
           - WTT = Competitor is developing/growing (OI Change positive, building toward 100%)
           - WTB = Competitor was higher before but is now falling (OI Change negative, down pressure)
        5. If no competitor >= 75% in any metric: Strong
        """
        # Filter options for this side
        side_options = [o for o in options if o.get('option_type') == side]
        
        empty_result = StrengthResult(
            strength='Unknown',
            strike100=0, strike2nd=None,
            oi100=0, oi2nd=None,
            oichng100=0, oichng2nd=None,
            volume100=0, volume2nd=None,
            oi_pct100=0, oi_pct2nd=None,
            oichng_pct100=0, oichng_pct2nd=None,
            volume_pct100=0, volume_pct2nd=None
        )
        
        if not side_options:
            return empty_result
        
        # Calculate max values for each metric
        max_oi = max((o.get('oi', 0) or 0 for o in side_options), default=0)
        max_oichng = max((abs(o.get('oi_change', 0) or 0) for o in side_options), default=0)
        max_volume = max((o.get('volume', 0) or 0 for o in side_options), default=0)
        max_gamma = max((abs(o.get('gamma', 0) or 0) for o in side_options), default=0)  # Greeks
        
        if max_oi == 0:
            return empty_result
        
        # Weighted scoring based on responsiveness hierarchy:
        # OI Change = Second hand (most reactive to current sentiment) → 50% weight
        # OI = Minute hand (accumulated positions, medium-term) → 35% weight  
        # Volume = Hour hand (trading activity, can be noisy) → 15% weight
        # Gamma bonus: High gamma strikes are key levels for market makers
        
        WEIGHT_OI_CHANGE = 0.50  # Most reactive - current market sentiment
        WEIGHT_OI = 0.35         # Accumulated positions - medium-term strength
        WEIGHT_VOLUME = 0.15     # Trading activity - can be noisy
        GAMMA_BONUS_WEIGHT = 0.10  # Extra weight for high-gamma strikes (MM sensitivity)
        
        for opt in side_options:
            # Calculate percentages relative to max
            opt['oi_pct'] = (opt.get('oi', 0) / max_oi * 100) if max_oi > 0 else 0
            opt['oichng_pct'] = (abs(opt.get('oi_change', 0)) / max_oichng * 100) if max_oichng > 0 else 0
            opt['volume_pct'] = (opt.get('volume', 0) / max_volume * 100) if max_volume > 0 else 0
            opt['gamma_pct'] = (abs(opt.get('gamma', 0)) / max_gamma * 100) if max_gamma > 0 else 0
            
            # Weighted score: prioritizes OI Change > OI > Volume
            weighted_score = (
                opt['oichng_pct'] * WEIGHT_OI_CHANGE +
                opt['oi_pct'] * WEIGHT_OI +
                opt['volume_pct'] * WEIGHT_VOLUME
            )
            
            # Gamma bonus: If this strike has high gamma (>50%), it's a key MM level
            # Add bonus to make these strikes more likely to be identified
            gamma_bonus = opt['gamma_pct'] * GAMMA_BONUS_WEIGHT if opt['gamma_pct'] > 50 else 0
            
            opt['combined_score'] = weighted_score + gamma_bonus
        
        # Find strike with highest WEIGHTED score (100% reference)
        # This prioritizes: OI Change (most reactive) > OI (positions) > Volume (activity)
        sorted_by_combined = sorted(side_options, key=lambda x: x.get('combined_score', 0), reverse=True)
        opt100 = sorted_by_combined[0]
        
        strike100 = opt100.get('strike', 0)
        oi100 = opt100.get('oi', 0)
        oichng100 = opt100.get('oi_change', 0)
        volume100 = opt100.get('volume', 0) or 0
        oi_pct100 = opt100.get('oi_pct', 0)
        oichng_pct100 = opt100.get('oichng_pct', 0)
        volume_pct100 = opt100.get('volume_pct', 0)

        
        # Find competitors: strikes with >= 75% in ANY of OI, OI Change, or Volume
        competitors = []
        for opt in side_options:
            if opt.get('strike') == strike100:
                continue  # Skip the 100% strike itself
            
            # Check if this strike is >= 75% in ANY metric
            is_competitor = (
                (opt.get('oi_pct', 0) or 0) >= self.wtt_threshold or
                (opt.get('oichng_pct', 0) or 0) >= self.wtt_threshold or
                (opt.get('volume_pct', 0) or 0) >= self.wtt_threshold
            )
            
            if is_competitor:
                # Calculate a combined score for ranking competitors
                opt['competitor_score'] = max(
                    opt.get('oi_pct', 0) or 0,
                    opt.get('oichng_pct', 0) or 0,
                    opt.get('volume_pct', 0) or 0
                )
                competitors.append(opt)
        
        # Determine strength based on competitors
        strength = 'Strong'
        strike2nd = None
        oi2nd = None
        oichng2nd = None
        volume2nd = None
        oi_pct2nd = None
        oichng_pct2nd = None
        volume_pct2nd = None
        
        if competitors:
            # Sort competitors by their highest percentage score
            competitors.sort(key=lambda x: x.get('competitor_score', 0), reverse=True)
            top_competitor = competitors[0]
            
            strike2nd = top_competitor.get('strike', 0)
            oi2nd = top_competitor.get('oi', 0)
            oichng2nd = top_competitor.get('oi_change', 0)
            volume2nd = top_competitor.get('volume', 0)
            oi_pct2nd = top_competitor.get('oi_pct', 0)
            oichng_pct2nd = top_competitor.get('oichng_pct', 0)
            volume_pct2nd = top_competitor.get('volume_pct', 0)
            
            # Determine WTT vs WTB based on whether competitor is growing or falling
            # WTT = Competitor is developing/building toward becoming primary (positive OI change)
            # WTB = Competitor was primary before but is now falling (negative OI change or primary falling)
            
            competitor_oi_change = oichng2nd or 0
            primary_oi_change = oichng100 or 0
            
            if competitor_oi_change > 0:
                # Competitor is GAINING - developing upward pressure
                if side == 'CE':  # Resistance
                    # If competitor CE is at higher strike and gaining → resistance moving up (bullish) = WTT
                    # If competitor CE is at lower strike and gaining → resistance moving down (bearish) = WTB
                    if strike2nd > strike100:
                        strength = 'WTT'  # Resistance shifting up (bullish pressure)
                    else:
                        strength = 'WTB'  # Resistance shifting down (bearish pressure)
                else:  # PE = Support
                    # If competitor PE is at higher strike and gaining → support moving up (bullish) = WTT  
                    # If competitor PE is at lower strike and gaining → support moving down (bearish) = WTB
                    if strike2nd > strike100:
                        strength = 'WTT'  # Support shifting up (bullish)
                    else:
                        strength = 'WTB'  # Support shifting down (bearish)
            elif competitor_oi_change < 0 or primary_oi_change < 0:
                # Competitor or primary is LOSING - indicates instability
                # If primary is losing more, the competitor was dominant before
                if primary_oi_change < competitor_oi_change:
                    # Primary is weakening faster - WTB (down pressure on current)
                    strength = 'WTB'
                else:
                    # Competitor was stronger before but now losing - still indicates WTB trend
                    strength = 'WTB' if side == 'PE' else 'WTT'
            else:
                # No clear OI change direction - default based on strike position
                if side == 'CE':
                    strength = 'WTT' if strike2nd > strike100 else 'WTB'
                else:
                    strength = 'WTT' if strike2nd > strike100 else 'WTB'
        
        return StrengthResult(
            strength=strength,
            strike100=strike100,
            strike2nd=strike2nd,
            oi100=oi100,
            oi2nd=oi2nd,
            oichng100=oichng100,
            oichng2nd=oichng2nd,
            volume100=volume100,
            volume2nd=volume2nd,
            oi_pct100=oi_pct100,
            oi_pct2nd=oi_pct2nd,
            oichng_pct100=oichng_pct100,
            oichng_pct2nd=oichng_pct2nd,
            volume_pct100=volume_pct100,
            volume_pct2nd=volume_pct2nd
        )
    
    def _classify_scenario(self, support: StrengthResult, resistance: StrengthResult) -> ScenarioResult:
        """
        Classify into one of 9 COA scenarios.
        """
        s = support.strength
        r = resistance.strength
        
        scenarios = {
            ('Strong', 'Strong'): ScenarioResult('1.0', 'Strong Both', 'neutral', 'both'),
            ('Strong', 'WTB'): ScenarioResult('1.1', 'Bearish Pressure', 'bearish', 'short'),
            ('Strong', 'WTT'): ScenarioResult('1.2', 'Bullish Pressure', 'bullish', 'long'),
            ('WTB', 'Strong'): ScenarioResult('1.3', 'Support Weakening', 'bearish', 'short'),
            ('WTT', 'Strong'): ScenarioResult('1.4', 'Support Strengthening', 'bullish', 'long'),
            ('WTB', 'WTB'): ScenarioResult('1.5', 'Blood Bath', 'bearish', 'short'),
            ('WTT', 'WTT'): ScenarioResult('1.6', 'Bull Run', 'bullish', 'long'),
            ('WTB', 'WTT'): ScenarioResult('1.7', 'Unstable', 'unclear', 'none'),
            ('WTT', 'WTB'): ScenarioResult('1.8', 'Unstable', 'unclear', 'none'),
        }
        
        return scenarios.get((s, r), ScenarioResult('?', 'Unknown', 'unknown', 'none'))
    
    def _calculate_levels(
        self,
        options: List[Dict[str, Any]],
        support: StrengthResult,
        resistance: StrengthResult,
        scenario: ScenarioResult,
        step_size: float = 50
    ) -> TradingLevels:
        """
        Calculate EOS, EOR and trading levels based on official COA 1.0 documentation.
        
        Official COA 1.0 Level Mapping:
        - 1.0 (Strong/Strong):     Top = EOR,    Bottom = EOS
        - 1.1 (Strong/WTB):        Top = EOR,    Bottom = EOS-1 (Bearish pressure, support breaks)
        - 1.2 (Strong/WTT):        Top = WTT-1,  Bottom = EOS   (Bullish pressure, resistance breaks)
        - 1.3 (WTB/Strong):        Top = EOR,    Bottom = WTB+1 (Bearish, support weakening)
        - 1.4 (WTT/Strong):        Top = EOR+1,  Bottom = EOS   (Bullish, resistance breaks)
        - 1.5 (WTB/WTB):           Top = EOR,    Bottom = N/A   (Blood Bath - no bottom)
        - 1.6 (WTT/WTT):           Top = N/A,    Bottom = EOS   (Bull Run - no top)
        - 1.7 (WTB/WTT):           Top = Wait,   Bottom = Wait  (Not tradable)
        - 1.8 (WTT/WTB):           Top = Wait,   Bottom = Wait  (Not tradable)
        """
        # Find LTP for support and resistance strikes
        support_ltp = 0
        resistance_ltp = 0
        
        # Also find LTP for WTT/WTB strikes (2nd strikes)
        support_2nd_ltp = 0
        resistance_2nd_ltp = 0
        
        for opt in options:
            strike = opt.get('strike', 0)
            opt_type = opt.get('option_type', '')
            ltp = opt.get('ltp', 0) or 0
            
            if opt_type == 'PE':
                if strike == support.strike100:
                    support_ltp = ltp
                if strike == support.strike2nd:
                    support_2nd_ltp = ltp
            elif opt_type == 'CE':
                if strike == resistance.strike100:
                    resistance_ltp = ltp
                if strike == resistance.strike2nd:
                    resistance_2nd_ltp = ltp
        
        # Calculate basic EOS/EOR (Extension of Support/Resistance)
        # EOS = Support strike - LTP of PE at support strike
        # EOR = Resistance strike + LTP of CE at resistance strike
        eos = support.strike100 - support_ltp if support.strike100 else 0
        eor = resistance.strike100 + resistance_ltp if resistance.strike100 else 0
        
        # Calculate WTT/WTB diversion levels (for 2nd strikes)
        # Diversion at 2nd strike is calculated by clicking on that volume
        wtt_level = support.strike2nd - support_2nd_ltp if support.strike2nd else 0  # Support WTT diversion
        wtb_level = support.strike2nd + support_2nd_ltp if support.strike2nd else 0  # Support WTB diversion
        resistance_wtt_level = resistance.strike2nd + resistance_2nd_ltp if resistance.strike2nd else 0
        
        # Adjacent levels (±1 step)
        eos_plus1 = eos + step_size if eos else 0
        eos_minus1 = eos - step_size if eos else 0
        eor_plus1 = eor + step_size if eor else 0
        eor_minus1 = eor - step_size if eor else 0
        
        # Determine Top and Bottom based on scenario
        top = None
        bottom = None
        trade_at_eos = False
        trade_at_eor = False
        
        if scenario.id == '1.0':  # Strong/Strong - Ideal
            top = eor
            bottom = eos
            trade_at_eos = True
            trade_at_eor = True
            
        elif scenario.id == '1.1':  # Strong Support, WTB Resistance - Bearish
            # Support will break due to bearish pressure, bottom is EOS-1
            top = eor
            bottom = eos_minus1
            trade_at_eos = False  # Support will break
            trade_at_eor = True
            
        elif scenario.id == '1.2':  # Strong Support, WTT Resistance - Bullish  
            # Resistance will break, top is at the diversion before WTT (WTT-1)
            # WTT-1 means one diversion before where resistance is WTT
            top = resistance_wtt_level - step_size if resistance_wtt_level else eor_minus1
            bottom = eos
            trade_at_eos = True
            trade_at_eor = False  # Resistance will break
            
        elif scenario.id == '1.3':  # WTB Support, Strong Resistance - Bearish
            # Support weakening, bottom is WTB+1 (one diversion above where support is WTB)
            top = eor
            bottom = wtt_level + step_size if support.strike2nd else eos_plus1
            trade_at_eos = False  # Support weakening
            trade_at_eor = True
            
        elif scenario.id == '1.4':  # WTT Support, Strong Resistance - Bullish
            # Support strengthening upward, bullish pressure breaks resistance
            # Top is EOR+1 (one diversion above resistance)
            top = eor_plus1
            bottom = eos
            trade_at_eos = True
            trade_at_eor = False  # Resistance will break upward
            
        elif scenario.id == '1.5':  # WTB/WTB - Blood Bath
            # Double bearish, no bottom, only short at EOR
            top = eor
            bottom = None  # No bottom in blood bath
            trade_at_eos = False
            trade_at_eor = True
            
        elif scenario.id == '1.6':  # WTT/WTT - Bull Run
            # Double bullish, no top, only long at EOS
            top = None  # No top in bull run
            bottom = eos
            trade_at_eos = True
            trade_at_eor = False
            
        elif scenario.id in ['1.7', '1.8']:  # Unstable - Not tradable
            top = None
            bottom = None
            trade_at_eos = False
            trade_at_eor = False
        
        return TradingLevels(
            eos=eos,
            eor=eor,
            eos_plus1=eos_plus1,
            eos_minus1=eos_minus1,
            eor_plus1=eor_plus1,
            eor_minus1=eor_minus1,
            top=top,
            bottom=bottom,
            trade_at_eos=trade_at_eos,
            trade_at_eor=trade_at_eor
        )
    
    def get_recommendation(self, scenario: ScenarioResult, levels: TradingLevels) -> str:
        """Get human-readable trading recommendation."""
        recommendations = {
            '1.0': f'Ideal scenario! Trade reversals from both EOS ({levels.eos:.0f}) and EOR ({levels.eor:.0f}).',
            '1.1': f'Bearish pressure. Look for shorts at EOR ({levels.eor:.0f}). Avoid longs.',
            '1.2': f'Bullish pressure. Look for longs at EOS ({levels.eos:.0f}). Avoid shorts.',
            '1.3': f'Support weakening. Look for shorts but wait for confirmation at {levels.eor:.0f}.',
            '1.4': f'Support strengthening. Look for longs at EOS ({levels.eos:.0f}).',
            '1.5': f'Blood bath! Only aggressive shorts. No longs until support stabilizes.',
            '1.6': f'Bull run! Only aggressive longs. No shorts until resistance stabilizes.',
            '1.7': f'Market unstable. Both sides weak. Wait for clarity.',
            '1.8': f'Market unstable. Both sides transitioning. Wait for clarity.',
        }
        return recommendations.get(scenario.id, 'Unable to determine scenario.')
    
    def analyze(
        self,
        options: List[Dict[str, Any]],
        spot_price: float,
        atm_strike: float,
        step_size: float = 50,
        visible_range: int = 10  # Number of strikes ITM and OTM from ATM
    ) -> Dict[str, Any]:
        """
        Main analysis function - returns complete COA result.
        
        Args:
            options: List of option contracts with oi_pct populated
            spot_price: Current spot price
            atm_strike: ATM strike price
            step_size: Strike step size
            visible_range: Number of strikes to consider ITM and OTM from ATM (default: 10)
                          Total visible strikes = (visible_range * 2) + 1 = 21 strikes
            
        Returns:
            Complete COA analysis result
        """
        # Filter to visible range only (intraday relevance)
        # Only consider strikes within ATM ± visible_range
        # This prevents far OTM legacy OI from skewing the analysis
        
        lower_bound = atm_strike - (step_size * visible_range)
        upper_bound = atm_strike + (step_size * visible_range)
        
        filtered_options = [
            o for o in options 
            if lower_bound <= o.get('strike', 0) <= upper_bound
        ]
        
        logger.debug(
            f"COA visible range filter: ATM={atm_strike}, "
            f"Range=[{lower_bound}, {upper_bound}], "
            f"Strikes: {len(options)} -> {len(filtered_options)}"
        )
        
        # Use filtered options for analysis
        # Detect strengths
        support = self._detect_strength(filtered_options, 'PE')
        resistance = self._detect_strength(filtered_options, 'CE')
        
        # Classify scenario
        scenario = self._classify_scenario(support, resistance)
        
        # Calculate levels (use filtered options for LTP lookup)
        levels = self._calculate_levels(filtered_options, support, resistance, scenario, step_size)
        
        # Get recommendation
        recommendation = self.get_recommendation(scenario, levels)
        
        return {
            'scenario': {
                'id': scenario.id,
                'name': scenario.name,
                'bias': scenario.bias,
                'tradable': scenario.tradable,
            },
            'support': {
                'strength': support.strength,
                'strike100': support.strike100,
                'strike2nd': support.strike2nd,
                'oi100': support.oi100,
                'oi2nd': support.oi2nd,
                'oichng100': support.oichng100,
                'oichng2nd': support.oichng2nd,
                'oi_pct100': support.oi_pct100,
                'oi_pct2nd': support.oi_pct2nd,
            },
            'resistance': {
                'strength': resistance.strength,
                'strike100': resistance.strike100,
                'strike2nd': resistance.strike2nd,
                'oi100': resistance.oi100,
                'oi2nd': resistance.oi2nd,
                'oichng100': resistance.oichng100,
                'oichng2nd': resistance.oichng2nd,
                'oi_pct100': resistance.oi_pct100,
                'oi_pct2nd': resistance.oi_pct2nd,
            },
            'levels': {
                'eos': levels.eos,
                'eor': levels.eor,
                'eos_plus1': levels.eos_plus1,
                'eos_minus1': levels.eos_minus1,
                'eor_plus1': levels.eor_plus1,
                'eor_minus1': levels.eor_minus1,
                'top': levels.top,
                'bottom': levels.bottom,
                'trade_at_eos': levels.trade_at_eos,
                'trade_at_eor': levels.trade_at_eor,
            },
            'trading': {
                'recommendation': recommendation,
            },
            'spot_price': spot_price,
            'atm_strike': atm_strike,
        }


# Singleton instance
coa_service = ChartOfAccuracyService()


def get_coa_service() -> ChartOfAccuracyService:
    """Factory function for dependency injection."""
    return coa_service

"""
Percentage Analyzer for Chart of Accuracy

Calculates OI/Volume/OI CHG percentages per strike for each option chain snapshot.

Logic (matching frontend usePercentageHighlights.js):
1. Valid strikes for 100% = ATM to 2 ITM + all OTM
2. Find max from valid strikes
3. Calculate pct = (value / max) * 100
4. Assign ranks
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class PercentageResult:
    """Result for a single strike option"""
    oi_pct: float
    volume_pct: float
    oichng_pct: float
    oi_rank: int


class PercentageAnalyzer:
    """
    Calculate OI/Volume/OI CHG percentages per strike using VISIBLE RANGE filter.
    
    Used for Chart of Accuracy support/resistance strength detection.
    Uses visible range (ATM ± 10 strikes) for max calculation.
    """
    
    def __init__(self):
        """No parameters - visible_range is passed to analyze() method"""
        pass
    
    def _calculate_side_percentages(
        self,
        options: List[Any],
        atm_strike: float,
        option_type: str,
        step_size: float,
        visible_range: int = 10  # Number of strikes ITM and OTM from ATM
    ) -> Dict[float, Dict[str, Any]]:
        """
        Calculate percentages for one side (CE or PE).
        
        Uses VISIBLE RANGE filter (ATM ± visible_range strikes) for max calculation.
        This matches frontend usePercentageHighlights.js logic.
        
        Args:
            options: List of option contracts (filtered to one type)
            atm_strike: ATM strike price
            option_type: 'CE' or 'PE'
            step_size: Strike step size
            visible_range: Number of strikes each side of ATM (default: 10)
            
        Returns:
            Dict mapping strike -> {oi_pct, volume_pct, oichng_pct, oi_rank}
        """
        result = {}
        
        if not options:
            return result
        
        # Calculate visible range bounds (ATM ± visible_range strikes)
        lower_bound = atm_strike - (step_size * visible_range)
        upper_bound = atm_strike + (step_size * visible_range)
        
        # Collect data with visibility check
        data = []
        for opt in options:
            strike = opt.strike if hasattr(opt, 'strike') else opt.get('strike', 0)
            oi = opt.oi if hasattr(opt, 'oi') else opt.get('oi', 0)
            volume = opt.volume if hasattr(opt, 'volume') else opt.get('volume', 0)
            oi_change = opt.oi_change if hasattr(opt, 'oi_change') else opt.get('oi_change', 0)
            
            # VISIBLE RANGE filter: Only strikes within ATM ± visible_range are valid for max
            in_visible_range = lower_bound <= strike <= upper_bound
            is_valid_for_100 = in_visible_range
            
            data.append({
                'strike': strike,
                'oi': oi or 0,
                'volume': volume or 0,
                'oi_change': oi_change or 0,
                'in_visible_range': in_visible_range,
                'is_valid': is_valid_for_100
            })
        
        # Find max values from valid strikes only
        valid_data = [d for d in data if d['is_valid']]
        
        if not valid_data:
            # No valid data, return zeros
            for d in data:
                result[d['strike']] = {
                    'oi_pct': 0.0,
                    'volume_pct': 0.0,
                    'oichng_pct': 0.0,
                    'oi_rank': 0
                }
            return result
        
        max_oi = max(d['oi'] for d in valid_data) or 1
        max_volume = max(d['volume'] for d in valid_data) or 1
        # For OI CHG, only positive values count for max
        positive_oi_changes = [d['oi_change'] for d in valid_data if d['oi_change'] > 0]
        max_oichng = max(positive_oi_changes) if positive_oi_changes else 1
        
        # Calculate percentages and sort for ranking
        for d in data:
            d['oi_pct'] = (d['oi'] / max_oi) * 100 if max_oi > 0 else 0
            d['volume_pct'] = (d['volume'] / max_volume) * 100 if max_volume > 0 else 0
            # OI CHG: use absolute value for negative changes
            if d['oi_change'] < 0:
                d['oichng_pct'] = (abs(d['oi_change']) / max_oichng) * 100 if max_oichng > 0 else 0
            else:
                d['oichng_pct'] = (d['oi_change'] / max_oichng) * 100 if max_oichng > 0 else 0
        
        # Assign OI ranks (1 = highest)
        sorted_by_oi = sorted([d for d in data if d['oi'] > 0], key=lambda x: x['oi'], reverse=True)
        rank_map = {}
        current_rank = 0
        last_oi = None
        for i, d in enumerate(sorted_by_oi):
            if d['oi'] != last_oi:
                current_rank = i + 1
                last_oi = d['oi']
            rank_map[d['strike']] = current_rank
        
        # Build result
        for d in data:
            result[d['strike']] = {
                'oi_pct': round(d['oi_pct'], 2),
                'volume_pct': round(d['volume_pct'], 2),
                'oichng_pct': round(d['oichng_pct'], 2),
                'oi_rank': rank_map.get(d['strike'], 0)
            }
        
        return result
    
    def analyze(
        self,
        options: List[Any],
        atm_strike: float,
        step_size: float = 50,
        visible_range: int = 10  # ATM ± 10 strikes for visible range
    ) -> Dict[str, Dict[str, Any]]:
        """
        Calculate percentages for all options using visible range filter.
        
        Args:
            options: List of option contracts (both CE and PE)
            atm_strike: ATM strike price
            step_size: Strike step size (default: 50)
            visible_range: Number of strikes each side of ATM (default: 10)
            
        Returns:
            Dict mapping "{strike}_{option_type}" -> {oi_pct, volume_pct, oichng_pct, oi_rank}
        """
        result = {}
        
        if not options or not atm_strike:
            logger.warning("No options or ATM strike provided for percentage analysis")
            return result
        
        # Separate CE and PE
        ce_options = []
        pe_options = []
        
        for opt in options:
            opt_type = opt.option_type if hasattr(opt, 'option_type') else opt.get('option_type', 'CE')
            if opt_type == 'CE':
                ce_options.append(opt)
            else:
                pe_options.append(opt)
        
        # Calculate for each side with visible range
        ce_percentages = self._calculate_side_percentages(ce_options, atm_strike, 'CE', step_size, visible_range)
        pe_percentages = self._calculate_side_percentages(pe_options, atm_strike, 'PE', step_size, visible_range)
        
        # Combine results with key format "{strike}_{type}"
        for strike, data in ce_percentages.items():
            result[f"{strike}_CE"] = data
        
        for strike, data in pe_percentages.items():
            result[f"{strike}_PE"] = data
        
        return result
    
    def enrich_options(
        self,
        options: List[Any],
        atm_strike: float,
        step_size: float = 50,
        visible_range: int = 10  # ATM ± 10 strikes for visible range
    ) -> None:
        """
        Enrich options in-place with percentage data using visible range filter.
        
        Args:
            options: List of option contracts to enrich
            atm_strike: ATM strike price
            step_size: Strike step size
            visible_range: Number of strikes each side of ATM (default: 10)
        """
        percentages = self.analyze(options, atm_strike, step_size, visible_range)
        
        for opt in options:
            strike = opt.strike if hasattr(opt, 'strike') else opt.get('strike', 0)
            opt_type = opt.option_type if hasattr(opt, 'option_type') else opt.get('option_type', 'CE')
            key = f"{strike}_{opt_type}"
            
            pct_data = percentages.get(key, {})
            
            # Set attributes (works for both Pydantic models and dicts)
            if hasattr(opt, 'oi_pct'):
                opt.oi_pct = pct_data.get('oi_pct', 0)
                opt.volume_pct = pct_data.get('volume_pct', 0)
                opt.oichng_pct = pct_data.get('oichng_pct', 0)
                opt.oi_rank = pct_data.get('oi_rank', 0)
            elif isinstance(opt, dict):
                opt['oi_pct'] = pct_data.get('oi_pct', 0)
                opt['volume_pct'] = pct_data.get('volume_pct', 0)
                opt['oichng_pct'] = pct_data.get('oichng_pct', 0)
                opt['oi_rank'] = pct_data.get('oi_rank', 0)

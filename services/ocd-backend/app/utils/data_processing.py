"""
Data Processing Utilities
Option chain data transformation and percentage calculations
"""
from typing import Dict, List, Any, Tuple
import math


def modify_oc_keys(option_data: Dict) -> Dict:
    """
    Modify option chain keys to standardized format.
    Converts float keys to integer if possible.
    """
    if "data" not in option_data or "oc" not in option_data.get("data", {}):
        return option_data
    
    oc_dict = option_data["data"]["oc"]
    modified_oc = {}
    
    for key, value in oc_dict.items():
        try:
            float_key = float(key)
            new_key = str(int(float_key)) if float_key.is_integer() else f"{float_key:.2f}"
            modified_oc[new_key] = value
        except (ValueError, TypeError):
            modified_oc[key] = value
    
    option_data["data"]["oc"] = modified_oc
    return option_data


def find_strikes(
    option_chain: Dict[str, Any],
    atm_price: float,
    max_range: int = 10
) -> List[int]:
    """
    Find strikes around ATM price.
    
    Args:
        option_chain: Option chain data
        atm_price: Current ATM price
        max_range: Number of strikes on each side
        
    Returns:
        List of strike prices
    """
    try:
        valid_strikes = [int(float(k)) for k in option_chain.keys()]
        
        if not valid_strikes:
            return [int(atm_price)]
        
        valid_strikes.sort()
        nearest_strike = min(valid_strikes, key=lambda x: abs(x - atm_price))
        
        index = valid_strikes.index(nearest_strike)
        
        # Calculate strike difference
        if index < len(valid_strikes) - 1:
            diff = valid_strikes[index + 1] - valid_strikes[index]
        elif index > 0:
            diff = valid_strikes[index] - valid_strikes[index - 1]
        else:
            diff = 50  # Default
        
        # Generate strikes
        itm_strikes = [nearest_strike - i * diff for i in range(1, max_range + 1)]
        otm_strikes = [nearest_strike + i * diff for i in range(1, max_range + 1)]
        
        strikes = sorted(itm_strikes) + [nearest_strike] + sorted(otm_strikes)
        return [s for s in strikes if s in valid_strikes or str(s) in option_chain]
        
    except Exception:
        return [int(atm_price)]


def calculate_percentage(value: float, max_value: float) -> float:
    """Calculate percentage of value relative to max"""
    if max_value <= 0 or value <= 0:
        return 0.0
    return round((value / max_value) * 100, 2)


def find_highest_values(values: List[float], threshold: float = 0.75) -> List[float]:
    """Find values >= threshold * max"""
    if not values:
        return []
    max_val = max(values)
    return sorted([v for v in values if v >= threshold * max_val], reverse=True)


def get_rank_in_highest(value: float, all_values: List[float]) -> str:
    """Get ranking position if value is in highest tier"""
    highest = find_highest_values(all_values)
    if value in highest:
        return str(highest.index(value) + 1)
    return "0"


def fetch_percentage(option_chain: Dict) -> Dict:
    """
    Calculate percentage values and rankings for option chain.
    Adds OI_percentage, vol_percentage, oichng_percentage and max_value ranks.
    """
    if "data" not in option_chain or "oc" not in option_chain.get("data", {}):
        return option_chain
    
    data = option_chain["data"]["oc"]
    
    # Collect all values
    ce_oi, ce_oichng, ce_vol = [], [], []
    pe_oi, pe_oichng, pe_vol = [], [], []
    
    for values in data.values():
        ce_data = values.get("ce", {})
        pe_data = values.get("pe", {})
        
        ce_oi.append(ce_data.get("oi", ce_data.get("OI", 0)))
        ce_oichng.append(ce_data.get("oichng", 0))
        ce_vol.append(ce_data.get("vol", 0))
        
        pe_oi.append(pe_data.get("oi", pe_data.get("OI", 0)))
        pe_oichng.append(pe_data.get("oichng", 0))
        pe_vol.append(pe_data.get("vol", 0))
    
    # Calculate max values
    max_ce_oi = max(ce_oi) if ce_oi else 1
    max_ce_oichng = max(ce_oichng) if ce_oichng else 1
    max_ce_vol = max(ce_vol) if ce_vol else 1
    max_pe_oi = max(pe_oi) if pe_oi else 1
    max_pe_oichng = max(pe_oichng) if pe_oichng else 1
    max_pe_vol = max(pe_vol) if pe_vol else 1
    
    # Calculate percentages for each value
    ce_oi_pct = [calculate_percentage(v, max_ce_oi) for v in ce_oi]
    ce_oichng_pct = [calculate_percentage(v, max_ce_oichng) for v in ce_oichng]
    ce_vol_pct = [calculate_percentage(v, max_ce_vol) for v in ce_vol]
    pe_oi_pct = [calculate_percentage(v, max_pe_oi) for v in pe_oi]
    pe_oichng_pct = [calculate_percentage(v, max_pe_oichng) for v in pe_oichng]
    pe_vol_pct = [calculate_percentage(v, max_pe_vol) for v in pe_vol]
    
    # Calculate max value rankings
    ce_oi_rank = [get_rank_in_highest(v, ce_oi_pct) for v in ce_oi_pct]
    ce_oichng_rank = [get_rank_in_highest(v, ce_oichng_pct) for v in ce_oichng_pct]
    ce_vol_rank = [get_rank_in_highest(v, ce_vol_pct) for v in ce_vol_pct]
    pe_oi_rank = [get_rank_in_highest(v, pe_oi_pct) for v in pe_oi_pct]
    pe_oichng_rank = [get_rank_in_highest(v, pe_oichng_pct) for v in pe_oichng_pct]
    pe_vol_rank = [get_rank_in_highest(v, pe_vol_pct) for v in pe_vol_pct]
    
    # Update data with percentages and rankings
    for i, (key, values) in enumerate(data.items()):
        if "ce" in values:
            values["ce"]["OI_percentage"] = ce_oi_pct[i]
            values["ce"]["oichng_percentage"] = ce_oichng_pct[i]
            values["ce"]["vol_percentage"] = ce_vol_pct[i]
            values["ce"]["OI_max_value"] = ce_oi_rank[i]
            values["ce"]["oichng_max_value"] = ce_oichng_rank[i]
            values["ce"]["vol_max_value"] = ce_vol_rank[i]
        
        if "pe" in values:
            values["pe"]["OI_percentage"] = pe_oi_pct[i]
            values["pe"]["oichng_percentage"] = pe_oichng_pct[i]
            values["pe"]["vol_percentage"] = pe_vol_pct[i]
            values["pe"]["OI_max_value"] = pe_oi_rank[i]
            values["pe"]["oichng_max_value"] = pe_oichng_rank[i]
            values["pe"]["vol_max_value"] = pe_vol_rank[i]
    
    option_chain["data"]["oc"] = data
    return option_chain


def filter_expiry_data(fut_data: Dict) -> Dict:
    """Extract expiry list from futures data"""
    try:
        opsum = fut_data.get("data", {}).get("opsum", {})
        exp_list = [int(exp) for exp in opsum.keys() if exp.isdigit()]
        fut_data["data"]["explist"] = sorted(exp_list)
    except (KeyError, ValueError):
        fut_data.setdefault("data", {})["explist"] = []
    
    return fut_data


def filter_oc_strikes(
    option_chain: Dict,
    atm_price: float,
    max_range: int = 10
) -> Dict:
    """Filter option chain to strikes around ATM"""
    if "data" not in option_chain or "oc" not in option_chain.get("data", {}):
        return option_chain
    
    oc = option_chain["data"]["oc"]
    result = find_strikes(oc, atm_price, max_range)
    
    filtered = {
        key: value for key, value in oc.items()
        if int(float(key)) in result
    }
    
    option_chain["data"]["oc"] = filtered
    return option_chain

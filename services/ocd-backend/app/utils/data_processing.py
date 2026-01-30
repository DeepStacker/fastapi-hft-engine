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



# NOTE: Percentage calculation logic moved to Processor service (PercentageAnalyzer)
# Old fetch_percentage and helpers removed to avoid duplication



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

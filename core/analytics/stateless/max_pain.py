"""
Max Pain calculation utility (stateless).

Calculates the strike price where option sellers (writers) have
minimum pain, i.e., where the total value of options expiring
in-the-money is minimized.
"""

from typing import Dict, List, Any


def calculate_max_pain(strikes_oi: Dict[float, Dict[str, int]]) -> Dict[str, Any]:
    """
    Calculate max pain strike price.
    
    Max Pain Theory: The strike price at which option sellers (market makers)
    incur the least losses when options expire. This is where the total value
    of all expiring options is minimized.
    
    Args:
        strikes_oi: Dictionary mapping strikes to OI data
                   {strike: {'call_oi': X, 'put_oi': Y}}
        
    Returns:
        Dict containing:
        - max_pain_strike: Strike with minimum total pain
        - max_pain_value: Total pain value at that strike
        - pain_distribution: List of all strikes with pain values
        
    Example:
        >>> strikes = {
        ...     26000: {'call_oi': 100000, 'put_oi': 150000},
        ...     26100: {'call_oi': 200000, 'put_oi': 100000},
        ...     26200: {'call_oi': 150000, 'put_oi': 80000}
        ... }
        >>> result = calculate_max_pain(strikes)
        >>> result['max_pain_strike']
        26100
    """
    if not strikes_oi:
        return {
            'max_pain_strike': None,
            'max_pain_value': None,
            'pain_distribution': []
        }
    
    pain_values = {}
    
    # For each potential expiry price (strike)
    for test_strike in strikes_oi.keys():
        total_pain = 0
        
        # Calculate pain for all strikes at this test price
        for strike, oi in strikes_oi.items():
            call_oi = oi.get('call_oi', 0)
            put_oi = oi.get('put_oi', 0)
            
            # Call sellers lose if spot > strike
            if test_strike > strike:
                call_pain = call_oi * (test_strike - strike)
                total_pain += call_pain
            
            # Put sellers lose if spot < strike
            if test_strike < strike:
                put_pain = put_oi * (strike - test_strike)
                total_pain += put_pain
        
        pain_values[test_strike] = total_pain
    
    # Find strike with minimum pain
    max_pain_strike = min(pain_values, key=pain_values.get)
    
    # Sort distribution for output
    pain_distribution = [
        {
            'strike': float(strike),
            'pain': int(pain)
        }
        for strike, pain in sorted(pain_values.items())
    ]
    
    return {
        'max_pain_strike': float(max_pain_strike),
        'max_pain_value': int(pain_values[max_pain_strike]),
        'pain_distribution': pain_distribution
    }

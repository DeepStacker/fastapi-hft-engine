"""
Ranking utilities for option chain data (stateless).

Provides sorting and ranking functions for strikes based on various metrics.
"""

from typing import List, Dict, Any


def rank_by_oi(options: List[Dict[str, Any]], descending: bool = True) -> List[Dict[str, Any]]:
    """
    Rank options by Open Interest.
    
    Args:
        options: List of option dictionaries
        descending: If True, highest OI first. If False, lowest first.
        
    Returns:
        Sorted list of options
    """
    return sorted(
        options,
        key=lambda x: x.get('oi', 0),
        reverse=descending
    )


def rank_by_volume(options: List[Dict[str, Any]], descending: bool = True) -> List[Dict[str, Any]]:
    """
    Rank options by trading volume.
    
    Args:
        options: List of option dictionaries
        descending: If True, highest volume first
        
    Returns:
        Sorted list of options
    """
    return sorted(
        options,
        key=lambda x: x.get('volume', 0),
        reverse=descending
    )


def rank_by_iv(options: List[Dict[str, Any]], descending: bool = True) -> List[Dict[str, Any]]:
    """
    Rank options by Implied Volatility.
    
    Args:
        options: List of option dictionaries
        descending: If True, highest IV first
        
    Returns:
        Sorted list of options
    """
    return sorted(
        options,
        key=lambda x: x.get('iv', 0),
        reverse=descending
    )


def get_top_n(options: List[Dict[str, Any]], metric: str, n: int = 3) -> List[Dict[str, Any]]:
    """
    Get top N options by specified metric.
    
    Args:
        options: List of option dictionaries
        metric: Metric name ('oi', 'volume', 'iv', 'delta', etc.)
        n: Number of top items to return
        
    Returns:
        List of top N options
    """
    sorted_options = sorted(
        options,
        key=lambda x: abs(x.get(metric, 0)),  # Use abs for delta, gamma
        reverse=True
    )
    return sorted_options[:n]


def calculate_intensity(
    options: List[Dict[str, Any]],
    metric: str
) -> Dict[float, float]:
    """
    Calculate intensity (0-1 scale) for each strike.
    
    Used for color coding - shows relative strength of metric across strikes.
    
    Args:
        options: List of option dictionaries
        metric: Metric to calculate intensity for
        
    Returns:
        Dict mapping strike to intensity (0.0 to 1.0)
    """
    # Get all values
    values = [opt.get(metric, 0) for opt in options]
    max_value = max(values) if values else 1
    
    # Avoid division by zero
    if max_value == 0:
        max_value = 1
    
    # Calculate intensity for each strike
    intensity_map = {}
    for opt in options:
        strike = opt.get('strike_price') or opt.get('strike')
        value = opt.get(metric, 0)
        intensity = round(value / max_value, 2)
        intensity_map[strike] = intensity
    
    return intensity_map

"""
Stateless analytics utilities.

Pure functions that don't require historical context or database access.
Can be used anywhere in the application for instant calculations.

Usage:
    from core.analytics.stateless import calculate_pcr, calculate_max_pain
    
    pcr = calculate_pcr(put_oi=1500, call_oi=1000)
    # Returns: 1.5
"""

from .pcr import calculate_pcr, calculate_pcr_detailed
from .max_pain import calculate_max_pain
from .rankings import (
    rank_by_oi,
    rank_by_volume,
    rank_by_iv,
    get_top_n,
    calculate_intensity
)

__all__ = [
    # PCR calculations
    'calculate_pcr',
    'calculate_pcr_detailed',
    
    # Max pain
    'calculate_max_pain',
    
    # Rankings
    'rank_by_oi',
    'rank_by_volume',
    'rank_by_iv',
    'get_top_n',
    'calculate_intensity',
]

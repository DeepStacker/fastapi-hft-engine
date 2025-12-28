"""
Time Utilities
Time calculation helpers for options trading
"""
from datetime import datetime, timedelta
from typing import Tuple
import pytz


def get_time_diff_in_days(expiry_timestamp: int) -> int:
    """
    Calculate days to expiry from Unix timestamp.
    
    Args:
        expiry_timestamp: Unix timestamp of expiry date
        
    Returns:
        Number of days to expiry (minimum 0)
    """
    expiry_date = datetime.fromtimestamp(expiry_timestamp)
    now = datetime.now()
    diff = (expiry_date - now).days
    return max(0, diff)


def calculate_time_to_expiry(
    expiry_timestamp: int,
    include_hours: bool = False
) -> Tuple[int, float]:
    """
    Calculate time to expiry in days and years.
    
    Args:
        expiry_timestamp: Unix timestamp of expiry date
        include_hours: Include partial day in calculation
        
    Returns:
        Tuple of (days, years)
    """
    expiry_date = datetime.fromtimestamp(expiry_timestamp)
    now = datetime.now()
    diff = expiry_date - now
    
    days = diff.days
    if include_hours:
        days += diff.seconds / (24 * 3600)
    
    years = max(days, 1) / 365.0
    
    return (max(0, int(days)), years)


def is_market_hours() -> bool:
    """
    Check if current time is within Indian market hours.
    Market hours: 9:15 AM - 3:30 PM IST, Monday to Friday
    
    Returns:
        True if within market hours
    """
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    
    # Check weekday (Monday = 0, Friday = 4)
    if now.weekday() > 4:
        return False
    
    # Market hours
    market_open = now.replace(hour=9, minute=15, second=0, microsecond=0)
    market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
    
    return market_open <= now <= market_close


def get_next_expiry_date(symbol: str = "NIFTY") -> datetime:
    """
    Get next probable expiry date based on symbol.
    
    Args:
        symbol: Trading symbol
        
    Returns:
        Datetime of next expiry
    """
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    
    # Weekly expiry is on Thursday
    days_until_thursday = (3 - now.weekday()) % 7
    if days_until_thursday == 0 and now.hour >= 15:
        days_until_thursday = 7
    
    next_expiry = now + timedelta(days=days_until_thursday)
    return next_expiry.replace(hour=15, minute=30, second=0, microsecond=0)


def format_expiry_date(timestamp: int) -> str:
    """
    Format expiry timestamp to readable string.
    
    Args:
        timestamp: Unix timestamp
        
    Returns:
        Formatted date string (e.g., "12-Dec-2024")
    """
    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime("%d-%b-%Y")

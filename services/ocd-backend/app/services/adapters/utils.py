"""
HFT Adapter Utilities
"""
from typing import List, Optional
from datetime import datetime

def format_expiry_date(expiry: str, expiry_list: List[int] = None) -> str:
    """
    Format expiry date for display. 
    If we have a valid expiry list, use the nearest expiry.
    
    Args:
        expiry: Raw expiry string from HFT (could be date or timestamp)
        expiry_list: List of Unix timestamps for available expiries
        
    Returns:
        Formatted expiry string (YYYY-MM-DD)
    """
    try:
        # If it looks like a date string already
        if expiry and len(str(expiry)) == 10 and '-' in str(expiry):
            # Validate it's not an old date
            exp_date = datetime.strptime(str(expiry), "%Y-%m-%d")
            if exp_date.year >= 2024:
                return str(expiry)
        
        # Try to parse as timestamp
        if expiry and str(expiry).isdigit():
            ts = int(expiry)
            if ts > 1700000000:  # Valid Unix timestamp (after 2023)
                return datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
        
        # Use first expiry from list if available
        if expiry_list and len(expiry_list) > 0:
            # Find nearest future expiry
            now_ts = datetime.now().timestamp()
            future_expiries = [e for e in expiry_list if e > now_ts]
            if future_expiries:
                nearest = min(future_expiries)
                return datetime.fromtimestamp(nearest).strftime("%Y-%m-%d")
        
        # Return empty string if no valid expiry found
        return ""
        
    except Exception:
        return ""

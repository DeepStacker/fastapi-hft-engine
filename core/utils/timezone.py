"""
Timezone Utilities - Centralized IST (India Standard Time) handling

All timestamps in this application should use IST for consistency
with Indian market trading hours.

Usage:
    from core.utils.timezone import get_ist_now, get_ist_isoformat, to_ist
"""
from datetime import datetime, timedelta
from typing import Optional

import pytz

# India Standard Time
IST = pytz.timezone('Asia/Kolkata')


def get_ist_now() -> datetime:
    """Get current datetime in IST timezone."""
    return datetime.now(IST)


def get_ist_isoformat() -> str:
    """Get current datetime as ISO format string with IST timezone."""
    return get_ist_now().isoformat()


def to_ist(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Convert a datetime to IST timezone.
    
    Args:
        dt: Datetime object (naive or aware)
        
    Returns:
        Datetime in IST timezone, or None if input is None
    """
    if dt is None:
        return None
    
    if dt.tzinfo is None:
        # Assume naive datetime is UTC
        dt = pytz.utc.localize(dt)
    
    return dt.astimezone(IST)


def utc_to_ist_isoformat(dt: Optional[datetime]) -> Optional[str]:
    """Convert UTC datetime to IST ISO format string."""
    ist_dt = to_ist(dt)
    return ist_dt.isoformat() if ist_dt else None


def get_ist_timestamp() -> float:
    """Get current timestamp in IST as Unix epoch."""
    return get_ist_now().timestamp()


def ist_to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Convert IST datetime to naive UTC datetime for database queries.
    
    The database stores timestamps as naive UTC (no timezone info).
    This function converts IST-aware datetime to naive UTC.
    
    Args:
        dt: Datetime object (IST-aware or naive assumed IST)
        
    Returns:
        Naive UTC datetime, or None if input is None
    """
    if dt is None:
        return None
    
    if dt.tzinfo is None:
        # Assume naive datetime is IST, make it aware
        dt = IST.localize(dt)
    
    # Convert to UTC and strip timezone info (naive UTC)
    return dt.astimezone(pytz.utc).replace(tzinfo=None)


def format_ist(dt: Optional[datetime], fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """Format datetime in IST with given format string."""
    if dt is None:
        return ""
    ist_dt = to_ist(dt)
    return ist_dt.strftime(fmt) if ist_dt else ""

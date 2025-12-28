"""
Helper Utilities
General purpose helper functions
"""
from uuid import uuid4
from typing import Any, Optional
import json
import hashlib


def generate_unique_id() -> str:
    """Generate a unique identifier"""
    return str(uuid4())


def generate_short_id(length: int = 8) -> str:
    """Generate a short unique identifier"""
    return str(uuid4())[:length]


def format_currency(
    amount: float,
    currency: str = "INR",
    decimal_places: int = 2
) -> str:
    """
    Format a number as currency.
    
    Args:
        amount: Amount to format
        currency: Currency code
        decimal_places: Number of decimal places
        
    Returns:
        Formatted currency string
    """
    if currency == "INR":
        return f"₹{amount:,.{decimal_places}f}"
    elif currency == "USD":
        return f"${amount:,.{decimal_places}f}"
    return f"{amount:,.{decimal_places}f} {currency}"


def format_number(
    value: float,
    decimal_places: int = 2,
    with_sign: bool = False
) -> str:
    """
    Format a number with optional sign.
    
    Args:
        value: Number to format
        decimal_places: Number of decimal places
        with_sign: Include + sign for positive numbers
        
    Returns:
        Formatted number string
    """
    formatted = f"{value:,.{decimal_places}f}"
    if with_sign and value > 0:
        formatted = f"+{formatted}"
    return formatted


def safe_divide(
    numerator: float,
    denominator: float,
    default: float = 0.0
) -> float:
    """
    Safely divide two numbers.
    
    Args:
        numerator: Numerator
        denominator: Denominator
        default: Default value if denominator is 0
        
    Returns:
        Result of division or default
    """
    if denominator == 0:
        return default
    return numerator / denominator


def clamp(value: float, min_val: float, max_val: float) -> float:
    """
    Clamp a value between min and max.
    
    Args:
        value: Value to clamp
        min_val: Minimum value
        max_val: Maximum value
        
    Returns:
        Clamped value
    """
    return max(min_val, min(max_val, value))


def safe_json_loads(
    json_str: str,
    default: Optional[Any] = None
) -> Any:
    """
    Safely parse JSON string.
    
    Args:
        json_str: JSON string to parse
        default: Default value if parsing fails
        
    Returns:
        Parsed JSON or default
    """
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return default


def hash_string(s: str) -> str:
    """
    Create MD5 hash of a string.
    
    Args:
        s: String to hash
        
    Returns:
        Hex digest of hash
    """
    return hashlib.md5(s.encode()).hexdigest()


def truncate_string(s: str, max_length: int = 100, suffix: str = "...") -> str:
    """
    Truncate a string to max length.
    
    Args:
        s: String to truncate
        max_length: Maximum length
        suffix: Suffix to add if truncated
        
    Returns:
        Truncated string
    """
    if len(s) <= max_length:
        return s
    return s[:max_length - len(suffix)] + suffix

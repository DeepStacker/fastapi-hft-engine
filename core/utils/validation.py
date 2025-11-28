"""
Input Validation and Sanitization

Prevents injection attacks and validates all user inputs.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re


class QueryParameters(BaseModel):
    """Base model for query parameter validation"""
    
    @field_validator('*', mode='before')
    @classmethod
    def sanitize_string(cls, v):
        """Sanitize string inputs"""
        if isinstance(v, str):
            # Remove potential SQL injection characters
            v = re.sub(r'[;\'"\\]', '', v)
        return v


class SymbolIDValidator(QueryParameters):
    """Validate symbol_id parameter"""
    symbol_id: int = Field(gt=0, description="Symbol ID must be positive")
    
    @field_validator('symbol_id')
    @classmethod
    def validate_symbol_id(cls, v):
        if v <= 0 or v > 999999:
            raise ValueError("symbol_id must be between 1 and 999999")
        return v


class LimitValidator(QueryParameters):
    """Validate limit parameter"""
    limit: int = Field(default=100, ge=1, le=1000)
    
    @field_validator('limit')
    @classmethod
    def validate_limit(cls, v):
        if v < 1:
            return 1
        if v > 1000:
            return 1000
        return v


class OptionTypeValidator(QueryParameters):
    """Validate option type"""
    option_type: Optional[str] = None
    
    @field_validator('option_type')
    @classmethod
    def validate_option_type(cls, v):
        if v is None:
            return v
        if v not in ['CE', 'PE']:
            raise ValueError("option_type must be 'CE' or 'PE'")
        return v


class StrikePriceValidator(QueryParameters):
    """Validate strike price"""
    strike_price: Optional[float] = None
    
    @field_validator('strike_price')
    @classmethod
    def validate_strike_price(cls, v):
        if v is not None and (v <= 0 or v > 100000):
            raise ValueError("Strike price must be between 0 and 100000")
        return v


def sanitize_sql_input(value: str) -> str:
    """
    Sanitize input to prevent SQL injection
    
    Args:
        value: User input string
        
    Returns:
        Sanitized string
    """
    if not isinstance(value, str):
        return value
        
    # Remove dangerous characters
    dangerous_chars = [';', '--', '/*', '*/', 'xp_', 'sp_', '@@']
    sanitized = value
    
    for char in dangerous_chars:
        sanitized = sanitized.replace(char, '')
    
    return sanitized.strip()

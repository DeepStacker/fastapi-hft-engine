from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

class MarketSnapshot(BaseModel):
    timestamp: datetime
    symbol_id: int
    exchange: str
    segment: str
    ltp: float
    volume: int
    oi: int
    
    @field_validator('ltp')
    @classmethod
    def validate_ltp(cls, v):
        if v < 0:
            raise ValueError('LTP must be >= 0')
        return v
    
    @field_validator('volume', 'oi')
    @classmethod
    def validate_non_negative(cls, v):
        if v < 0:
            raise ValueError('Volume and OI must be >= 0')
        return v
    
    class Config:
        from_attributes = True

class OptionContract(BaseModel):
    timestamp: datetime
    symbol_id: int
    expiry: datetime
    strike_price: float
    option_type: str  # CE or PE
    ltp: float
    volume: int
    oi: int
    iv: Optional[float] = None
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None
    
    @field_validator('option_type')
    @classmethod
    def validate_option_type(cls, v):
        if v not in ['CE', 'PE']:
            raise ValueError('option_type must be CE or PE')
        return v
    
    @field_validator('ltp', 'strike_price')
    @classmethod
    def validate_positive(cls, v):
        if v < 0:
            raise ValueError('Price values must be >= 0')
        return v
    
    @field_validator('volume', 'oi')
    @classmethod
    def validate_non_negative(cls, v):
        if v < 0:
            raise ValueError('Volume and OI must be >= 0')
        return v
    
    class Config:
        from_attributes = True

class FutureContract(BaseModel):
    timestamp: datetime
    symbol_id: int
    expiry: datetime
    ltp: float
    volume: int
    oi: int
    
    @field_validator('ltp')
    @classmethod
    def validate_positive(cls, v):
        if v < 0:
            raise ValueError('Price must be >= 0')
        return v
    
    @field_validator('volume', 'oi')
    @classmethod
    def validate_non_negative(cls, v):
        if v < 0:
            raise ValueError('Volume and OI must be >= 0')
        return v
    
    class Config:
        from_attributes = True

class Instrument(BaseModel):
    symbol_id: int
    symbol: str
    segment: str
    exchange: str
    is_active: int = Field(default=1)
    
    @field_validator('symbol_id')
    @classmethod
    def validate_symbol_id(cls, v):
        if v <= 0:
            raise ValueError('symbol_id must be positive')
        return v
    
    @field_validator('is_active')
    @classmethod
    def validate_is_active(cls, v):
        if v not in [0, 1]:
            raise ValueError('is_active must be 0 or 1')
        return v
    
    class Config:
        from_attributes = True

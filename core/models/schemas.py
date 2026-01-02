from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict

# Domain Models for API Requests/Responses

class MarketSnapshot(BaseModel):
    """Market snapshot domain model"""
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
    
    model_config = ConfigDict(from_attributes=True)

class OptionContract(BaseModel):
    """Option contract domain model"""
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
    """Future contract domain model"""
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
    
    class Config:
        from_attributes = True

class Instrument(BaseModel):
    """Instrument master model"""
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

# Kafka Message Schemas

class MarketRawMessage(BaseModel):
    """Schema for market.raw Kafka topic"""
    symbol_id: int
    payload: Dict[str, Any]
    timestamp: str
    
    @field_validator('symbol_id')
    @classmethod
    def validate_symbol_id(cls, v):
        if v <= 0:
            raise ValueError('symbol_id must be positive')
        return v

class MarketEnrichedMessage(BaseModel):
    """Schema for market.enriched Kafka topic"""
    timestamp: str
    symbol_id: int
    market_snapshot: Optional[Dict[str, Any]] = None
    options: Optional[List[Dict[str, Any]]] = []
    
    @field_validator('symbol_id')
    @classmethod
    def validate_symbol_id(cls, v):
        if v <= 0:
            raise ValueError('symbol_id must be positive')
        return v

# API Request/Response Models

class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    """JWT token data"""
    username: Optional[str] = None

class UserCreate(BaseModel):
    """User creation request"""
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    password: str = Field(..., min_length=8)
    
class UserLogin(BaseModel):
    """User login request"""
    username: str
    password: str

class User(BaseModel):
    """User response model"""
    id: int
    username: str
    email: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True

class HealthCheck(BaseModel):
    """Health check response"""
    status: str
    timestamp: datetime
    services: Optional[Dict[str, str]] = None

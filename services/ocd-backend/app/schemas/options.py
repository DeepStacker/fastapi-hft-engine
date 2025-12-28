"""
Options Schemas - Request/Response models for options data endpoints
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ExpiryDateItem(BaseModel):
    """Single expiry date item"""
    timestamp: str  # Unix timestamp
    date: str  # Formatted date string
    days_to_expiry: int


class ExpiryDateResponse(BaseModel):
    """Response for expiry dates endpoint"""
    symbol: str
    expiry_dates: List[ExpiryDateItem]


class OptionLeg(BaseModel):
    """Single option leg data (CE or PE)"""
    strike: float
    ltp: float = Field(description="Last traded price")
    open: float
    high: float
    low: float
    close: float
    volume: int
    oi: int = Field(description="Open interest")
    oi_change: float = Field(description="OI change from previous day")
    iv: Optional[float] = Field(None, description="Implied volatility")
    bid: Optional[float] = None
    ask: Optional[float] = None
    bid_qty: Optional[int] = None
    ask_qty: Optional[int] = None


class GreeksData(BaseModel):
    """Option Greeks data"""
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: Optional[float] = None
    
    # Advanced Greeks
    vanna: Optional[float] = None
    vomma: Optional[float] = None
    charm: Optional[float] = None
    speed: Optional[float] = None
    zomma: Optional[float] = None
    color: Optional[float] = None
    ultima: Optional[float] = None


class ReversalData(BaseModel):
    """Reversal detection data"""
    reversal_point: float
    confidence_score: int = Field(ge=0, le=100)
    direction: str = Field(pattern="^(bullish|bearish|neutral)$")
    support_levels: List[float] = []
    resistance_levels: List[float] = []


class StrikeData(BaseModel):
    """Complete strike data with CE and PE"""
    strike: float
    ce: OptionLeg
    pe: OptionLeg
    ce_greeks: Optional[GreeksData] = None
    pe_greeks: Optional[GreeksData] = None
    reversal: Optional[ReversalData] = None
    pcr: Optional[float] = Field(None, description="Put-Call ratio")
    max_pain: Optional[float] = None


class SpotData(BaseModel):
    """Spot/Index data"""
    symbol: str
    ltp: float
    open: float
    high: float
    low: float
    close: float
    change: float
    change_percent: float
    volume: Optional[int] = None


class FutureData(BaseModel):
    """Futures data"""
    symbol: str
    expiry: str
    ltp: float
    open: float
    high: float
    low: float
    close: float
    change: float
    change_percent: float
    oi: int
    volume: int
    basis: Optional[float] = None  # Future - Spot


class OptionChainRequest(BaseModel):
    """Request for option chain data"""
    symbol: str = Field(..., min_length=2, max_length=20)
    expiry: str = Field(..., pattern=r"^\d{10}$", description="Unix timestamp")


class OptionChainResponse(BaseModel):
    """Complete option chain response"""
    symbol: str
    expiry: str
    spot: SpotData
    future: Optional[FutureData] = None
    atm_strike: float
    strikes: List[StrikeData]
    timestamp: datetime
    
    # Summary data
    total_ce_oi: int = 0
    total_pe_oi: int = 0
    pcr: float = 0.0
    max_pain: Optional[float] = None
    iv_percentile: Optional[float] = None


class OptionDataResponse(BaseModel):
    """Generic option data response"""
    success: bool = True
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PercentageDataRequest(BaseModel):
    """Request for percentage data"""
    symbol: str = Field(..., alias="sid")
    expiry: str = Field(..., alias="exp_sid")
    strike: float
    option_type: str = Field(..., pattern="^(CE|PE)$")
    
    class Config:
        populate_by_name = True


class IVDataRequest(BaseModel):
    """Request for IV data"""
    symbol: str = Field(..., alias="sid")
    expiry: str = Field(..., alias="exp_sid")
    strike: float
    option_type: str = Field(..., pattern="^(CE|PE)$")
    
    class Config:
        populate_by_name = True


class DeltaDataRequest(BaseModel):
    """Request for delta data"""
    symbol: str = Field(..., alias="sid")
    expiry: str = Field(..., alias="exp_sid")
    strike: float
    
    class Config:
        populate_by_name = True


class FuturePriceRequest(BaseModel):
    """Request for future price data"""
    symbol: str = Field(..., alias="sid")
    expiry: str = Field(..., alias="exp_sid")
    
    class Config:
        populate_by_name = True


class LiveDataSubscription(BaseModel):
    """WebSocket subscription request"""
    symbol: str = Field(..., alias="sid")
    expiry: str = Field(..., alias="exp_sid")
    
    class Config:
        populate_by_name = True

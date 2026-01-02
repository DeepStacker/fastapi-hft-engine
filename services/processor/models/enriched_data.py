"""
Pydantic Models for Enriched Option Chain Data

These models represent the cleaned and analyzed data ready for storage.
"""
from typing import Optional, Literal, List, Dict
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class CleanedOptionData(BaseModel):
    """
    Cleaned and validated option data
    """
    strike: float
    option_type: Literal['CE', 'PE']
    
    # Price data (cleaned)
    ltp: Optional[float] = None
    bid: Optional[float] = None
    ask: Optional[float] = None  
    mid_price: Optional[float] = None  # Calculated from bid/ask
    bid_qty: int = 0
    ask_qty: int = 0
    prev_close: float = 0.0
    price_change: float = 0.0
    price_change_pct: float = 0.0
    avg_traded_price: float = 0.0
    
    # Volume
    volume: int = 0
    prev_volume: int = 0
    volume_change: int = 0
    volume_change_pct: float = 0.0
    
    # Open Interest
    oi: int = 0
    prev_oi: int = 0
    oi_change: int = 0
    oi_change_pct: float = 0.0
    
    # Greeks (from API)
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    rho: float = 0.0
    
    # IV
    iv: Optional[float] = None
    
    # Calculated fields (from our analysis)
    theoretical_price: Optional[float] = None  # From BSM
    intrinsic_value: float = 0.0
    time_value: Optional[float] = None
    moneyness: float = 0.0  # S/K ratio
    
    # Classification
    moneyness_type: str = 'OTM'  # ITM/OTM/ATM
    buildup_type: str = ''
    buildup_name: str = ''
    
    # Reversal & Support/Resistance
    reversal_price: Optional[float] = None
    support_price: Optional[float] = None
    resistance_price: Optional[float] = None
    resistance_range_price: Optional[float] = None  # New field for RR
    weekly_reversal_price: Optional[float] = None
    future_reversal_price: Optional[float] = None
    
    # Analysis Flags
    is_liquid: bool = True  # False if bid=0 or ask=0
    is_valid: bool = True  # False if critical data missing


class CleanedFuturesData(BaseModel):
    """
    Cleaned futures contract data
    """
    symbol: str
    ltp: float
    prev_close: float
    price_change: float
    price_change_pct: float
    
    volume: int
    prev_volume: int
    volume_change: int
    volume_change_pct: float
    
    oi: int
    oi_change: int
    oi_change_pct: float
    
    lot_size: int = 75
    tick_size: float = 0.1


class CleanedGlobalContext(BaseModel):
    """
    Cleaned global market context
    """
    symbol: str  # NIFTY, BANKNIFTY, etc.
    symbol_id: int
    spot_price: float
    spot_change: float
    spot_change_pct: float
    
    total_call_oi: int
    total_put_oi: int
    pcr_ratio: float
    
    atm_iv: float
    atm_iv_change: float
    
    max_pain_strike: float
    days_to_expiry: int
    
    lot_size: int = 75
    tick_size: float = 0.05
    
    exchange: str = 'NSE'
    segment: str = 'D'
    
    timestamp: datetime


class FuturesBasisAnalysis(BaseModel):
    """
    Futures-Spot Basis analysis result
    """
    basis: float
    basis_pct: float
    fair_value_basis_pct: float
    mispricing_pct: float
    futures_oi_millions: float
    signals: List[str] = Field(default_factory=list)
    sentiment: Literal['BULLISH', 'BEARISH', 'NEUTRAL']


class VIXDivergenceAnalysis(BaseModel):
    """
    VIX-IV Divergence analysis result
    """
    atm_iv: float
    india_vix: float
    expected_iv: float
    divergence: float
    divergence_pct: float
    signal: str
    strategy: str
    reason: str


class GammaLevel(BaseModel):
    """Gamma exposure at a single strike"""
    strike: float
    call_gex: float
    put_gex: float
    net_gex: float
    distance_from_spot: float


class GammaExposureAnalysis(BaseModel):
    """
    Gamma Exposure analysis result
    """
    gamma_walls: List[Dict[str, float]] = Field(default_factory=list)  # Top 3 strikes
    zero_gamma_strike: Optional[float] = None
    total_market_gex: float
    market_regime: Literal['EXPLOSIVE', 'RANGE_BOUND', 'NEUTRAL']


class EnrichedMarketData(BaseModel):
    """
    Final enriched market data with all analyses
    """
    # Metadata
    symbol: str
    expiry: str  # Expiry date for the option chain
    timestamp: datetime
    processing_timestamp: datetime = Field(default_factory=lambda: datetime.now())
    
    # Cleaned core data
    context: CleanedGlobalContext
    futures: Optional[CleanedFuturesData] = None
    options: List[CleanedOptionData] = Field(default_factory=list)
    
    # Stage 1 Analyses
    analyses: Dict[str, dict] = Field(default_factory=dict)
    # Will contain:
    # - 'futures_basis': FuturesBasisAnalysis
    # - 'vix_divergence': VIXDivergenceAnalysis
    # - 'gamma_exposure': GammaExposureAnalysis
    
    # Data quality metrics
    total_options_processed: int = 0
    illiquid_options_count: int = 0
    invalid_options_count: int = 0
    
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )

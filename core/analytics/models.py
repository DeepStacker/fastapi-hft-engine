"""
Pydantic models for analytics responses.

Ensures type safety across all analytics outputs.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================

class OptionType(str, Enum):
    """Option type"""
    CE = "CE"
    PE = "PE"


class BuildupType(str, Enum):
    """Buildup pattern types"""
    LONG_BUILDUP = "LONG BUILDUP"
    SHORT_BUILDUP = "SHORT BUILDUP"
    LONG_UNWINDING = "LONG UNWINDING"
    SHORT_UNWINDING = "SHORT UNWINDING"
    UNKNOWN = "UNKNOWN"


class MoneynessType(str, Enum):
    """Moneyness classification"""
    ITM = "ITM"
    ATM = "ATM"
    OTM = "OTM"


class MarketSentiment(str, Enum):
    """Market sentiment classification"""
    BULLISH_EXTREME = "BULLISH_EXTREME"
    BULLISH = "BULLISH"
    NEUTRAL = "NEUTRAL"
    BEARISH = "BEARISH"
    BEARISH_EXTREME = "BEARISH_EXTREME"


# ============================================================================
# STATELESS ANALYTICS MODELS
# ============================================================================

class PCRAnalysis(BaseModel):
    """Put-Call Ratio analysis result"""
    pcr_oi: float = Field(..., description="Put-Call Ratio based on OI")
    pcr_volume: float = Field(..., description="Put-Call Ratio based on Volume")
    total_call_oi: int = Field(..., ge=0)
    total_put_oi: int = Field(..., ge=0)
    signal: str = Field(..., description="Market signal")
    sentiment: MarketSentiment


class MaxPainResult(BaseModel):
    """Max Pain calculation result"""
    max_pain_strike: float = Field(..., description="Strike with minimum pain")
    max_pain_value: float = Field(..., description="Total pain value at that strike")
    pain_distribution: List[Dict[str, float]] = Field(default_factory=list)


class RankingResult(BaseModel):
    """Strike ranking result"""
    strike_price: float
    option_type: OptionType
    value: float = Field(..., description="Value of the metric being ranked")
    rank: int = Field(..., ge=1, description="Rank (1 = highest)")
    intensity: float = Field(..., ge=0, le=1, description="Normalized intensity (0-1)")


# ============================================================================
# STATEFUL ANALYTICS MODELS
# ============================================================================

class VelocityMetrics(BaseModel):
    """OI velocity metrics"""
    strike_price: float
    option_type: OptionType
    oi_velocity: float = Field(..., description="OI change per minute")
    volume_velocity: float = Field(..., description="Volume change per minute")
    time_delta_minutes: float = Field(..., gt=0)
    is_spike: bool = Field(default=False)
    spike_magnitude: Optional[float] = Field(None, ge=0)


class BuildupPattern(BaseModel):
    """Buildup pattern detection result"""
    strike_price: float
    option_type: OptionType
    pattern_type: BuildupType
    confidence: float = Field(..., ge=0, le=100, description="Confidence percentage")
    oi_change: int
    oi_change_pct: float
    volume: int
    description: str


class CumulativeOIMetrics(BaseModel):
    """Cumulative OI metrics since market open"""
    strike_price: float
    option_type: OptionType
    current_oi: int = Field(..., ge=0)
    opening_oi: Optional[int] = Field(None, ge=0)
    cumulative_oi_change: Optional[int] = None
    cumulative_volume: Optional[int] = Field(None, ge=0)
    oi_change_pct: Optional[float] = None
    session_high_oi: Optional[int] = Field(None, ge=0)
    session_low_oi: Optional[int] = Field(None, ge=0)


# ============================================================================
# CHART DATA MODELS
# ============================================================================

class OIDistributionPoint(BaseModel):
    """Single point in OI distribution"""
    strike_price: float
    call_oi: int = Field(..., ge=0)
    put_oi: int = Field(..., ge=0)
    total_oi: int = Field(..., ge=0)
    pcr: Optional[float] = None


class TimeSeriesPoint(BaseModel):
    """Generic time series data point"""
    timestamp: datetime
    value: float
    label: Optional[str] = None


class PCRTrendPoint(BaseModel):
    """PCR trend time series point"""
    timestamp: datetime
    pcr_oi: float
    pcr_volume: float
    sentiment: MarketSentiment


# ============================================================================
# CALCULATOR INPUT/OUTPUT MODELS
# ============================================================================

class MarginCalculationRequest(BaseModel):
    """Margin calculation input"""
    spot_price: float = Field(..., gt=0)
    strike: float = Field(..., gt=0)
    option_type: OptionType
    expiry_date: str = Field(..., description="Date in YYYY-MM-DD format")
    premium: float = Field(..., gt=0)
    lot_size: int = Field(..., gt=0)
    position_type: str = Field(..., regex="^(long|short)$")


class MarginCalculationResult(BaseModel):
    """Margin calculation output"""
    required_margin: float = Field(..., ge=0)
    span_margin: float = Field(..., ge=0)
    exposure_margin: float = Field(..., ge=0)
    total_margin: float = Field(..., ge=0)
    position_type: str
    breakdown: Dict[str, float]


class StrategyPnL(BaseModel):
    """Strategy P&L calculation result"""
    strategy_name: str
    initial_cost: float
    max_profit: float
    max_loss: float
    breakeven_points: List[float]
    pnl_distribution: List[Dict[str, float]]


# ============================================================================
# ANALYTICS RESPONSE WRAPPERS
# ============================================================================

class AnalyticsResponse(BaseModel):
    """Generic analytics response wrapper"""
    success: bool = True
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Any
    cache_hit: bool = Field(default=False)
    execution_time_ms: Optional[float] = None


class ErrorResponse(BaseModel):
    """Error response"""
    success: bool = False
    error: str
    error_code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# PAGINATION
# ============================================================================

class PaginatedResponse(BaseModel):
    """Paginated response wrapper"""
    total_count: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=1000)
    total_pages: int = Field(..., ge=0)
    data: List[Any]
    has_next: bool
    has_previous: bool

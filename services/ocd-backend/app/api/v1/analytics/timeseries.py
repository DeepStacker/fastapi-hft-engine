"""
Time-Series Analytics Endpoints

Provides time-series data for option chain metrics:
- Strike-level OI, LTP, IV, volume, Greeks over time
- Spot price history
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List
import random

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.dependencies import OptionalUser
from app.services.dhan_client import get_dhan_client
from app.services.options import OptionsService
from app.cache.redis import get_redis, RedisCache

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Models ==============

class TimeSeriesPoint(BaseModel):
    """Single point in time-series data"""
    timestamp: datetime
    value: float
    change: Optional[float] = None
    change_percent: Optional[float] = None


class TimeSeriesResponse(BaseModel):
    """Response for time-series data"""
    success: bool = True
    symbol: str
    strike: Optional[float] = None
    option_type: Optional[str] = None
    field: str
    data: List[TimeSeriesPoint]
    summary: dict = {}


# ============== Helper Functions ==============

async def get_analytics_service(cache: RedisCache = Depends(get_redis)) -> OptionsService:
    """Dependency to get options service for analytics"""
    dhan = await get_dhan_client(cache=cache)
    return OptionsService(dhan_client=dhan, cache=cache)


def generate_mock_timeseries(
    field: str,
    current_value: float,
    points: int = 50,
    volatility: float = 0.02
) -> List[TimeSeriesPoint]:
    """
    Generate mock time-series data for demonstration.
    In production, this would fetch from a time-series database.
    """
    data = []
    now = datetime.now()
    value = current_value
    
    for i in range(points, 0, -1):
        timestamp = now - timedelta(minutes=i * 5)
        change = random.uniform(-volatility, volatility) * value
        value = max(0.01, value + change)
        
        data.append(TimeSeriesPoint(
            timestamp=timestamp,
            value=round(value, 2),
            change=round(change, 2),
            change_percent=round((change / value) * 100, 2) if value else 0
        ))
    
    return data


# ============== Endpoints ==============

# NOTE: Spot endpoint MUST be defined before strike endpoint because FastAPI
# matches routes in order, and "/timeseries/spot/{symbol}" would otherwise
# match "/timeseries/{symbol}/{strike}" with symbol="spot"

@router.get("/timeseries/spot/{symbol}")
async def get_spot_timeseries(
    symbol: str,
    interval: str = Query("5m", regex="^(1m|5m|15m|1h|1d)$"),
    limit: int = Query(100, ge=10, le=500),
    current_user: OptionalUser = None,
    service: OptionsService = Depends(get_analytics_service),
) -> TimeSeriesResponse:
    """Get spot price time-series for an index."""
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(symbol=symbol, expiry="")
        current_value = live_data.get("spot", {}).get("ltp", 25000)
    except:
        current_value = 25000
    
    timeseries = generate_mock_timeseries(
        field="spot",
        current_value=float(current_value),
        points=limit,
        volatility=0.001
    )
    
    values = [p.value for p in timeseries]
    summary = {
        "min": round(min(values), 2),
        "max": round(max(values), 2),
        "open": round(values[0], 2),
        "close": round(values[-1], 2),
        "change": round(values[-1] - values[0], 2),
    }
    
    return TimeSeriesResponse(
        symbol=symbol,
        field="spot",
        data=timeseries,
        summary=summary
    )


@router.get("/timeseries/{symbol}/{strike}")
async def get_strike_timeseries(
    symbol: str,
    strike: float,
    option_type: str = Query("CE", regex="^(CE|PE)$"),
    field: str = Query("oi", regex="^(oi|ltp|iv|volume|delta|theta)$"),
    interval: str = Query("5m", regex="^(1m|5m|15m|1h|1d)$"),
    limit: int = Query(50, ge=10, le=500),
    current_user: OptionalUser = None,
    service: OptionsService = Depends(get_analytics_service),
) -> TimeSeriesResponse:
    """
    Get time-series data for a specific strike.
    
    - **symbol**: Index symbol (NIFTY, BANKNIFTY, etc.)
    - **strike**: Strike price
    - **option_type**: CE or PE
    - **field**: Data field (oi, ltp, iv, volume, delta, theta)
    - **interval**: Time interval (1m, 5m, 15m, 1h, 1d)
    - **limit**: Number of data points
    """
    symbol = symbol.upper()
    current_value = 100.0
    
    try:
        # Try to get current live data for realistic starting point
        live_data = await service.get_live_data(
            symbol=symbol,
            expiry="",
            include_greeks=True,
            include_reversal=False
        )
        
        if live_data and "oc" in live_data:
            strike_key = f"{strike:.6f}"
            if strike_key in live_data["oc"]:
                strike_data = live_data["oc"][strike_key]
                opt = strike_data.get("ce" if option_type == "CE" else "pe", {})
                
                field_mapping = {
                    "oi": opt.get("OI", opt.get("oi", 0)),
                    "ltp": opt.get("ltp", 0),
                    "iv": opt.get("iv", 0),
                    "volume": opt.get("volume", opt.get("vol", 0)),
                    "delta": opt.get("optgeeks", {}).get("delta", 0),
                    "theta": opt.get("optgeeks", {}).get("theta", 0),
                }
                current_value = field_mapping.get(field, 0) or 100
    except Exception as e:
        logger.warning(f"Could not fetch live data for timeseries: {e}")
    
    # Generate time-series data
    timeseries = generate_mock_timeseries(
        field=field,
        current_value=float(current_value),
        points=limit,
        volatility=0.01 if field in ["iv", "delta", "theta"] else 0.05
    )
    
    # Calculate summary statistics
    values = [p.value for p in timeseries]
    summary = {
        "min": round(min(values), 2),
        "max": round(max(values), 2),
        "avg": round(sum(values) / len(values), 2),
        "current": round(values[-1], 2) if values else 0,
        "change_from_start": round(values[-1] - values[0], 2) if len(values) > 1 else 0,
    }
    
    return TimeSeriesResponse(
        symbol=symbol,
        strike=strike,
        option_type=option_type,
        field=field,
        data=timeseries,
        summary=summary
    )


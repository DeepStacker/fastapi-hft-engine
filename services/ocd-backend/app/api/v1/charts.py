"""
Charts API Endpoints - OHLCV Data for TradingView Charts
"""
import logging
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services.dhan_ticks import get_ticks_service
from app.schemas.common import ResponseModel

logger = logging.getLogger(__name__)
router = APIRouter()


class ChartDataRequest(BaseModel):
    """Request model for chart data"""
    symbol: str = "NIFTY"
    interval: str = "15"
    days: int = 30


class CandleData(BaseModel):
    """Single candle data"""
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float = 0


class ChartDataResponse(BaseModel):
    """Response model for chart data"""
    success: bool
    symbol: str = ""
    candles: list = []
    count: int = 0
    error: Optional[str] = None


@router.get("/data", response_model=ChartDataResponse)
async def get_chart_data(
    symbol: str = Query(default="NIFTY", description="Symbol (NIFTY, BANKNIFTY, FINNIFTY)"),
    interval: str = Query(default="15", description="Timeframe (1, 5, 15, 30, 60, D)"),
    days: int = Query(default=30, description="Days of historical data"),
):
    """
    Get OHLCV chart data for a symbol.
    
    Fetches candlestick data from Dhan ticks API.
    """
    logger.info(f"Chart data request: symbol={symbol}, interval={interval}, days={days}")
    
    ticks_service = await get_ticks_service()
    result = await ticks_service.get_chart_data(
        symbol=symbol.upper(),
        interval=interval,
        days_back=days,
    )
    
    return ChartDataResponse(**result)


@router.get("/symbols")
async def get_chart_symbols():
    """
    Get available symbols for charting.
    """
    from app.services.dhan_ticks import INSTRUMENT_MAP
    
    symbols = []
    for symbol, info in INSTRUMENT_MAP.items():
        symbols.append({
            "symbol": symbol,
            "name": symbol,
            "sec_id": info["SEC_ID"]
        })
        
    # Sort: Indices first (TYPE=IDX), then others alphabetically
    symbols.sort(key=lambda x: (INSTRUMENT_MAP[x["symbol"]]["TYPE"] != "IDX", x["symbol"]))
    
    return ResponseModel(success=True, data=symbols)


@router.get("/intervals")
async def get_chart_intervals():
    """
    Get available timeframe intervals.
    """
    intervals = [
        {"value": "15S", "label": "15 sec"},
        {"value": "1", "label": "1 min"},
        {"value": "5", "label": "5 min"},
        {"value": "15", "label": "15 min"},
        {"value": "30", "label": "30 min"},
        {"value": "60", "label": "1 hour"},
        {"value": "D", "label": "Daily"},
    ]
    
    return ResponseModel(success=True, data=intervals)

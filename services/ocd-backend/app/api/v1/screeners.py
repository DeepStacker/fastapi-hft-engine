"""
Screener API Endpoints
Provides endpoints for Scalp, Positional, and Support/Resistance screeners.
"""
import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from app.core.dependencies import OptionalUser
from app.services.dhan_client import get_dhan_client
from app.services.options import OptionsService
from app.services.screener import ScreenerService, ScreenerType, get_screener_service
from app.cache.redis import get_redis, RedisCache

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Response Models ==============

class ScreenerSignal(BaseModel):
    """Single screener signal"""
    symbol: str
    strike: float
    option_type: str
    signal: str
    strength: float
    reason: str
    entry_price: float
    target_price: float
    stop_loss: float
    timestamp: str
    metrics: dict


class ScreenerResponse(BaseModel):
    """Response for screener results"""
    success: bool = True
    screener_type: str
    symbol: str
    expiry: str
    total_signals: int
    signals: List[ScreenerSignal]


# ============== Helper Functions ==============

async def get_screener_service_dep(
    cache: RedisCache = Depends(get_redis)
) -> ScreenerService:
    """Dependency to get screener service"""
    dhan = await get_dhan_client(cache=cache)
    options_service = OptionsService(dhan_client=dhan, cache=cache)
    return ScreenerService(options_service=options_service, cache=cache)


# ============== Scalp Screener Endpoint ==============

@router.get("/scalp/{symbol}/{expiry}")
async def get_scalp_signals(
    symbol: str,
    expiry: str,
    min_oi_change_pct: float = Query(5.0, ge=1.0, le=50.0),
    min_volume: int = Query(1000, ge=100),
    current_user: OptionalUser = None,
    service: ScreenerService = Depends(get_screener_service_dep),
) -> ScreenerResponse:
    """
    Scalp Screener: Find short-term trading opportunities.
    
    - **symbol**: Trading symbol (e.g., NIFTY, BANKNIFTY)
    - **expiry**: Expiry timestamp
    - **min_oi_change_pct**: Minimum OI change percentage
    - **min_volume**: Minimum volume threshold
    
    Returns signals for quick trades based on OI changes and momentum.
    """
    symbol = symbol.upper()
    
    try:
        results = await service.run_scalp_screener(
            symbol=symbol,
            expiry=expiry,
            min_oi_change_pct=min_oi_change_pct,
            min_volume=min_volume
        )
        
        return ScreenerResponse(
            screener_type="scalp",
            symbol=symbol,
            expiry=expiry,
            total_signals=len(results),
            signals=[
                ScreenerSignal(
                    symbol=r.symbol,
                    strike=r.strike,
                    option_type=r.option_type,
                    signal=r.signal,
                    strength=r.strength,
                    reason=r.reason,
                    entry_price=r.entry_price,
                    target_price=r.target_price,
                    stop_loss=r.stop_loss,
                    timestamp=r.timestamp.isoformat(),
                    metrics=r.metrics
                )
                for r in results
            ]
        )
    except Exception as e:
        logger.error(f"Error running scalp screener: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Positional Screener Endpoint ==============

@router.get("/positional/{symbol}/{expiry}")
async def get_positional_signals(
    symbol: str,
    expiry: str,
    min_oi_buildup: int = Query(100000, ge=10000),
    current_user: OptionalUser = None,
    service: ScreenerService = Depends(get_screener_service_dep),
) -> ScreenerResponse:
    """
    Positional Screener: Find multi-day position opportunities.
    
    - **symbol**: Trading symbol
    - **expiry**: Expiry timestamp
    - **min_oi_buildup**: Minimum OI threshold
    
    Returns signals for swing trades based on OI buildup and trends.
    """
    symbol = symbol.upper()
    
    try:
        results = await service.run_positional_screener(
            symbol=symbol,
            expiry=expiry,
            min_oi_buildup=min_oi_buildup
        )
        
        return ScreenerResponse(
            screener_type="positional",
            symbol=symbol,
            expiry=expiry,
            total_signals=len(results),
            signals=[
                ScreenerSignal(
                    symbol=r.symbol,
                    strike=r.strike,
                    option_type=r.option_type,
                    signal=r.signal,
                    strength=r.strength,
                    reason=r.reason,
                    entry_price=r.entry_price,
                    target_price=r.target_price,
                    stop_loss=r.stop_loss,
                    timestamp=r.timestamp.isoformat(),
                    metrics=r.metrics
                )
                for r in results
            ]
        )
    except Exception as e:
        logger.error(f"Error running positional screener: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Support/Resistance Screener Endpoint ==============

@router.get("/sr/{symbol}/{expiry}")
async def get_sr_signals(
    symbol: str,
    expiry: str,
    current_user: OptionalUser = None,
    service: ScreenerService = Depends(get_screener_service_dep),
) -> ScreenerResponse:
    """
    Support/Resistance Screener: Find trades near key S/R levels.
    
    - **symbol**: Trading symbol
    - **expiry**: Expiry timestamp
    
    Returns signals based on high OI concentrations as S/R levels.
    """
    symbol = symbol.upper()
    
    try:
        results = await service.run_sr_screener(
            symbol=symbol,
            expiry=expiry
        )
        
        return ScreenerResponse(
            screener_type="sr",
            symbol=symbol,
            expiry=expiry,
            total_signals=len(results),
            signals=[
                ScreenerSignal(
                    symbol=r.symbol,
                    strike=r.strike,
                    option_type=r.option_type,
                    signal=r.signal,
                    strength=r.strength,
                    reason=r.reason,
                    entry_price=r.entry_price,
                    target_price=r.target_price,
                    stop_loss=r.stop_loss,
                    timestamp=r.timestamp.isoformat(),
                    metrics=r.metrics
                )
                for r in results
            ]
        )
    except Exception as e:
        logger.error(f"Error running S/R screener: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== All Screeners Endpoint ==============

@router.get("/all/{symbol}/{expiry}")
async def get_all_signals(
    symbol: str,
    expiry: str,
    current_user: OptionalUser = None,
    service: ScreenerService = Depends(get_screener_service_dep),
):
    """
    Run all screeners and return combined results.
    """
    symbol = symbol.upper()
    
    try:
        scalp_results = await service.run_scalp_screener(symbol, expiry)
        positional_results = await service.run_positional_screener(symbol, expiry)
        sr_results = await service.run_sr_screener(symbol, expiry)
        
        def format_signals(results):
            return [
                {
                    "symbol": r.symbol,
                    "strike": r.strike,
                    "option_type": r.option_type,
                    "signal": r.signal,
                    "strength": r.strength,
                    "reason": r.reason,
                    "entry_price": r.entry_price,
                    "target_price": r.target_price,
                    "stop_loss": r.stop_loss,
                    "timestamp": r.timestamp.isoformat(),
                    "metrics": r.metrics
                }
                for r in results
            ]
        
        return {
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "screeners": {
                "scalp": {
                    "total": len(scalp_results),
                    "signals": format_signals(scalp_results)
                },
                "positional": {
                    "total": len(positional_results),
                    "signals": format_signals(positional_results)
                },
                "sr": {
                    "total": len(sr_results),
                    "signals": format_signals(sr_results)
                }
            }
        }
    except Exception as e:
        logger.error(f"Error running screeners: {e}")
        raise HTTPException(status_code=500, detail=str(e))

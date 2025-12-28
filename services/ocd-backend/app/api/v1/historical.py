"""
Historical Option Chain API Endpoints
Provides endpoints for querying and replaying historical option chain data.
"""
import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from app.core.dependencies import OptionalUser
from app.services.dhan_client import get_dhan_client
from app.services.options import OptionsService, get_options_service
from app.services.historical import HistoricalService, get_historical_service
from app.cache.redis import get_redis, RedisCache

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Request/Response Models ==============

class AvailableDatesResponse(BaseModel):
    """Response for available historical dates"""
    success: bool = True
    symbol: str
    dates: List[str]


class AvailableTimesResponse(BaseModel):
    """Response for available times on a specific date"""
    success: bool = True
    symbol: str
    date: str
    times: List[str]


class HistoricalSnapshotResponse(BaseModel):
    """Response for a historical snapshot"""
    success: bool = True
    symbol: str
    expiry: str
    date: str
    time: str
    spot: float
    atm_strike: float
    pcr: float
    max_pain: float
    option_chain: dict
    futures: Optional[dict] = None


# ============== Helper Functions ==============

async def get_historical_service_dep(
    cache: RedisCache = Depends(get_redis)
) -> HistoricalService:
    """Dependency to get historical service"""
    dhan = await get_dhan_client(cache=cache)
    options_service = OptionsService(dhan_client=dhan, cache=cache)
    return HistoricalService(
        dhan_client=dhan,
        options_service=options_service,
        cache=cache
    )


# ============== Available Dates Endpoint ==============

@router.get("/dates/{symbol}")
async def get_available_dates(
    symbol: str,
    current_user: OptionalUser = None,
    service: HistoricalService = Depends(get_historical_service_dep),
) -> AvailableDatesResponse:
    """
    Get list of available historical dates for a symbol.
    
    - **symbol**: Trading symbol (e.g., NIFTY, BANKNIFTY)
    
    Returns dates in YYYY-MM-DD format, most recent first.
    """
    symbol = symbol.upper()
    
    try:
        dates = await service.get_available_dates(symbol)
        return AvailableDatesResponse(
            symbol=symbol,
            dates=dates
        )
    except Exception as e:
        logger.error(f"Error getting available dates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Available Times Endpoint ==============

@router.get("/times/{symbol}/{date}")
async def get_available_times(
    symbol: str,
    date: str,
    current_user: OptionalUser = None,
    service: HistoricalService = Depends(get_historical_service_dep),
) -> AvailableTimesResponse:
    """
    Get available snapshot times for a specific date.
    
    - **symbol**: Trading symbol
    - **date**: Date in YYYY-MM-DD format
    
    Returns times in HH:MM format.
    """
    symbol = symbol.upper()
    
    try:
        times = await service.get_available_times(symbol, date)
        return AvailableTimesResponse(
            symbol=symbol,
            date=date,
            times=times
        )
    except Exception as e:
        logger.error(f"Error getting available times: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Historical Snapshot Endpoint ==============

@router.get("/snapshot/{symbol}/{expiry}")
async def get_historical_snapshot(
    symbol: str,
    expiry: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    time: str = Query(..., description="Time in HH:MM format"),
    current_user: OptionalUser = None,
    service: HistoricalService = Depends(get_historical_service_dep),
) -> HistoricalSnapshotResponse:
    """
    Get a specific historical option chain snapshot.
    
    - **symbol**: Trading symbol
    - **expiry**: Expiry timestamp
    - **date**: Date in YYYY-MM-DD format
    - **time**: Time in HH:MM format
    
    Returns complete option chain data for the specified point in time.
    """
    symbol = symbol.upper()
    
    try:
        snapshot = await service.get_historical_snapshot(
            symbol=symbol,
            expiry=expiry,
            date_str=date,
            time_str=time
        )
        
        if not snapshot:
            raise HTTPException(
                status_code=404, 
                detail=f"No historical data found for {symbol} on {date} at {time}"
            )
        
        return HistoricalSnapshotResponse(
            symbol=symbol,
            expiry=expiry,
            date=date,
            time=time,
            spot=snapshot.spot,
            atm_strike=snapshot.atm_strike,
            pcr=snapshot.pcr,
            max_pain=snapshot.max_pain,
            option_chain=snapshot.option_chain,
            futures=snapshot.futures
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting historical snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Replay Range Endpoint ==============

@router.get("/replay/{symbol}/{expiry}")
async def get_replay_data(
    symbol: str,
    expiry: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    start_time: str = Query("09:15", description="Start time in HH:MM format"),
    end_time: str = Query("15:30", description="End time in HH:MM format"),
    interval: int = Query(5, ge=1, le=60, description="Interval in minutes"),
    current_user: OptionalUser = None,
    service: HistoricalService = Depends(get_historical_service_dep),
):
    """
    Get multiple snapshots for replay functionality.
    
    - **symbol**: Trading symbol
    - **expiry**: Expiry timestamp
    - **date**: Date in YYYY-MM-DD format
    - **start_time**: Start time in HH:MM format
    - **end_time**: End time in HH:MM format
    - **interval**: Interval between snapshots in minutes
    
    Returns list of snapshots for sequential playback.
    """
    symbol = symbol.upper()
    
    try:
        start_datetime = datetime.strptime(f"{date} {start_time}", "%Y-%m-%d %H:%M")
        end_datetime = datetime.strptime(f"{date} {end_time}", "%Y-%m-%d %H:%M")
        
        snapshots = await service.get_snapshots_in_range(
            symbol=symbol,
            expiry=expiry,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            interval_minutes=interval
        )
        
        return {
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "date": date,
            "start_time": start_time,
            "end_time": end_time,
            "interval_minutes": interval,
            "total_snapshots": len(snapshots),
            "snapshots": [
                {
                    "time": s.timestamp.strftime("%H:%M"),
                    "spot": s.spot,
                    "atm_strike": s.atm_strike,
                    "pcr": s.pcr,
                    "max_pain": s.max_pain,
                    "option_chain": s.option_chain,
                }
                for s in snapshots
            ]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date/time format: {e}")
    except Exception as e:
        logger.error(f"Error getting replay data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Save Current Snapshot (Admin) ==============

@router.post("/snapshot/{symbol}/{expiry}")
async def save_current_snapshot(
    symbol: str,
    expiry: str,
    current_user: OptionalUser = None,
    cache: RedisCache = Depends(get_redis),
):
    """
    Save current option chain data as a historical snapshot.
    Used for data collection. Requires authentication.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    symbol = symbol.upper()
    
    try:
        dhan = await get_dhan_client(cache=cache)
        options_service = OptionsService(dhan_client=dhan, cache=cache)
        
        # Get current live data
        live_data = await options_service.get_live_data(
            symbol=symbol,
            expiry=expiry,
            include_greeks=True,
            include_reversal=False
        )
        
        if not live_data:
            raise HTTPException(status_code=404, detail="No live data available")
        
        # Create snapshot
        from app.services.historical import HistoricalSnapshot
        snapshot = HistoricalSnapshot(
            symbol=symbol,
            expiry=expiry,
            timestamp=datetime.now(),
            spot=live_data.get("spot", {}).get("ltp", 0),
            atm_strike=live_data.get("atm_strike", 0),
            pcr=live_data.get("pcr", 0),
            max_pain=live_data.get("max_pain_strike", 0),
            option_chain=live_data.get("oc", {}),
            futures=live_data.get("future"),
        )
        
        # Save it
        service = HistoricalService(cache=cache)
        success = await service.save_snapshot(symbol, expiry, snapshot)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save snapshot")
        
        return {
            "success": True,
            "message": f"Snapshot saved for {symbol} at {snapshot.timestamp.isoformat()}",
            "timestamp": snapshot.timestamp.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))

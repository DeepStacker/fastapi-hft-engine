"""
Time-Series Analytics Endpoints

Provides time-series data for option chain metrics:
- Strike-level OI, LTP, IV, volume, Greeks over time
- Spot price history
"""
import logging
from datetime import datetime, timedelta, time as dt_time
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_ist_now, IST

from app.core.dependencies import OptionalUser
from app.config.database import get_db
from app.services.dhan_client import get_dhan_client
from app.services.options import OptionsService
from app.cache.redis import get_redis, RedisCache
from app.repositories.historical import get_historical_repository
from core.database.models import OptionContractDB

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


class MultiViewResponse(BaseModel):
    """Response for multi-view timeseries (CE, PE, differences, ratios)"""
    success: bool = True
    symbol: str
    strike: float
    field: str
    views: dict = {}  # {view_name: [TimeSeriesPoint, ...]}
    summary: dict = {}


# ============== Helper Functions ==============

async def get_analytics_service(
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis)
) -> OptionsService:
    """Dependency to get options service for analytics"""
    dhan = await get_dhan_client(cache=cache)
    return OptionsService(dhan_client=dhan, cache=cache, db=db)


# ============== Endpoints ==============

# NOTE: Spot endpoint MUST be defined before strike endpoint because FastAPI
# matches routes in order, and "/timeseries/spot/{symbol}" would otherwise
# match "/timeseries/{symbol}/{strike}" with symbol="spot"

@router.get("/timeseries/spot/{symbol}")
async def get_spot_timeseries(
    symbol: str,
    interval: str = Query("5m", regex="^(1m|5m|15m|1h|1d)$"),
    limit: int = Query(100, ge=10, le=500),
    date: Optional[str] = Query(None, description="Trade date YYYY-MM-DD"),
    current_user: OptionalUser = None,
    db: AsyncSession = Depends(get_db),
    service: OptionsService = Depends(get_analytics_service),
) -> TimeSeriesResponse:
    """Get spot price time-series for an index from TimescaleDB."""
    symbol = symbol.upper()
    repo = get_historical_repository(db)
    
    # Calculate time range
    now = get_ist_now().replace(tzinfo=None)
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except:
            target_date = now.date()
    else:
        target_date = now.date()
        
    # Approximation for interval parsing
    minutes_map = {"1m": 1, "5m": 5, "15m": 15, "1h": 60, "1d": 1440}
    interval_minutes = minutes_map.get(interval, 5)
    
    if date and target_date < now.date():
        start_time = datetime.combine(target_date, dt_time.min)
        end_time = datetime.combine(target_date, dt_time.max)
    else:
        start_time = now - timedelta(minutes=limit * interval_minutes)
        end_time = now
    
    # Get symbol ID
    symbol_id = await repo.get_symbol_id(symbol)
    if not symbol_id:
        return TimeSeriesResponse(
            symbol=symbol,
            field="spot",
            data=[],
            summary={"error": "Symbol not found"}
        )

    # Fetch real data
    timeseries = await repo.get_spot_timeseries(
        symbol_id=symbol_id,
        start_time=start_time,
        end_time=end_time,
        interval_minutes=interval_minutes
    )
    
    # Fallback to current live price if history is empty (e.g. fresh deployment)
    if not timeseries:
        try:
            live_data = await service.get_live_data(symbol=symbol, expiry="")
            current_value = live_data.get("spot", {}).get("ltp", 0)
            if current_value > 0:
                timeseries = [
                    TimeSeriesPoint(
                        timestamp=now,
                        value=float(current_value),
                        change=0,
                        change_percent=0
                    )
                ]
        except Exception:
            pass

    values = [p.value for p in timeseries]
    summary = {}
    if values:
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
        data=[
            TimeSeriesPoint(
                timestamp=p.timestamp,
                value=p.value,
                change=p.change,
                change_percent=p.change_percent
            ) for p in timeseries
        ],
        summary=summary
    )


@router.get("/timeseries/{symbol}/{strike}")
async def get_strike_timeseries(
    symbol: str,
    strike: float,
    option_type: str = Query("CE", regex="^(CE|PE)$"),
    field: str = Query("oi", regex="^(oi|oi_change|ltp|iv|volume|delta|theta|gamma|vega)$"),
    interval: str = Query("5m", regex="^(1m|5m|15m|1h|1d)$"),
    limit: int = Query(50, ge=10, le=500),
    expiry: str = Query(..., description="Expiry date YYYY-MM-DD"),
    date: Optional[str] = Query(None, description="Trade date YYYY-MM-DD"),
    current_user: OptionalUser = None,
    db: AsyncSession = Depends(get_db),
    service: OptionsService = Depends(get_analytics_service),
) -> TimeSeriesResponse:
    """
    Get time-series data for a specific strike from TimescaleDB.
    """
    symbol = symbol.upper()
    repo = get_historical_repository(db)
    
    # Calculate time range (Use naive IST to match DB)
    minutes_map = {"1m": 1, "5m": 5, "15m": 15, "1h": 60, "1d": 1440}
    interval_minutes = minutes_map.get(interval, 5)
    
    # DB timestamps are stored as naive IST (wall clock)
    now = get_ist_now().replace(tzinfo=None)
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except:
            target_date = now.date()
    else:
        target_date = now.date()
    
    # Commodity symbols have extended trading hours (no 3:30 PM cap)
    COMMODITY_SYMBOLS = {"CRUDEOIL", "NATURALGAS", "GOLD", "SILVER", "COPPER", "ALUMINIUM", "ZINC", "LEAD", "NICKEL"}
    is_commodity = symbol.upper() in COMMODITY_SYMBOLS
    
    # Market hours: 9:15 AM to 3:30 PM for equity indices
    market_open = datetime.combine(target_date, datetime.strptime("09:15", "%H:%M").time())
    market_close = datetime.combine(target_date, datetime.strptime("15:30", "%H:%M").time())
    
    # Start time: Use Midnight to capture pre-market/simulation data
    start_time = datetime.combine(target_date, dt_time.min)
    
    # End time: current time, but capped at 3:30 PM for non-commodity symbols
    if target_date < now.date():
        # Historical date: use full day
        end_time = datetime.combine(target_date, dt_time.max)
    else:
        if is_commodity:
            end_time = now
        else:
            end_time = min(now, market_close)

    # Get symbol ID
    symbol_id = await repo.get_symbol_id(symbol)
    if not symbol_id:
        return TimeSeriesResponse(
            symbol=symbol,
            field=field,
            data=[],
            summary={"error": "Symbol not found"}
        )
    
    # Fetch real data (Try exact expiry string first)
    timeseries = await repo.get_option_timeseries(
        symbol_id=symbol_id,
        strike=strike,
        option_type=option_type,
        expiry=expiry,
        field=field,
        start_time=start_time,
        end_time=end_time,
        interval_minutes=interval_minutes
    )

    # Fallback: Check if expiry needs conversion (ISO -> Unix Timestamp)
    # The DB often stores expiry as Unix timestamp string (e.g. "1767119400")
    # Fallback: Check if expiry needs conversion (ISO -> Unix Timestamp)
    # The DB often stores expiry as Unix timestamp string (e.g. "1767119400")
    if not timeseries and "-" in expiry:
        try:
            # Convert YYYY-MM-DD to Noon IST Timestamp (matching get_expiry_dates)
            dt = datetime.strptime(expiry, "%Y-%m-%d")
            
            # Use 12:00 IST (Noon) to match keys in storage
            dt_ist = datetime.combine(dt.date(), dt_time(12, 0)).replace(tzinfo=IST)
            unix_expiry = str(int(dt_ist.timestamp()))
            
            timeseries = await repo.get_option_timeseries(
                symbol_id=symbol_id,
                strike=strike,
                option_type=option_type,
                expiry=unix_expiry,
                field=field,
                start_time=start_time,
                end_time=end_time,
                interval_minutes=interval_minutes
            )
        except Exception:
            pass  # Use original expiry

    # Fallback to live data point if history still empty
    if not timeseries:
        try:
            live_data = await service.get_live_data(
                symbol=symbol,
                expiry=expiry,
                include_greeks=True
            )
            if live_data and "oc" in live_data:
                strike_key = f"{strike:.6f}"
                # Try simple key lookup if precise fails
                if strike_key not in live_data["oc"]:
                    strike_key = str(strike)
                    if strike_key.endswith(".0"):
                        strike_key = strike_key[:-2]
                
                if strike_key in live_data["oc"]:
                    strike_data = live_data["oc"][strike_key]
                    opt = strike_data.get("ce" if option_type == "CE" else "pe", {})
                    
                    # Greeks are at top-level AND in optgeeks object
                    optgeeks = opt.get("optgeeks", {}) or {}
                    
                    field_mapping = {
                        # OI fields
                        "oi": opt.get("OI") or opt.get("oi", 0),
                        "oi_change": opt.get("oichng") or opt.get("oi_change", 0),
                        # Price fields
                        "ltp": opt.get("ltp", 0),
                        "iv": opt.get("iv", 0),
                        "volume": opt.get("vol") or opt.get("volume", 0),
                        # Greeks - check top-level first, then optgeeks
                        "delta": opt.get("delta") or optgeeks.get("delta", 0),
                        "theta": opt.get("theta") or optgeeks.get("theta", 0),
                        "gamma": opt.get("gamma") or optgeeks.get("gamma", 0),
                        "vega": opt.get("vega") or optgeeks.get("vega", 0),
                    }
                    current_value = field_mapping.get(field, 0)
                    # Allow 0 values for fields like Delta/Theta
                    timeseries = [
                         TimeSeriesPoint(
                            timestamp=end_time,
                            value=float(current_value) if current_value else 0.0,
                            change=0,
                            change_percent=0
                        )
                    ]
        except Exception:
            pass

    values = [p.value for p in timeseries]
    summary = {}
    if values:
        summary = {
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "avg": round(sum(values) / len(values), 2),
            "current": round(values[-1], 2),
            "change_from_start": round(values[-1] - values[0], 2) if len(values) > 1 else 0,
        }
    
    return TimeSeriesResponse(
        symbol=symbol,
        strike=strike,
        option_type=option_type,
        field=field,
        data=[
            TimeSeriesPoint(
                timestamp=p.timestamp,
                value=p.value,
                change=p.change,
                change_percent=p.change_percent
            ) for p in timeseries
        ],
        summary=summary
    )


@router.get("/timeseries/{symbol}/{strike}/multi")
async def get_strike_multiview_timeseries(
    symbol: str,
    strike: float,
    field: str = Query("oi", regex="^(oi|oi_change|ltp|iv|volume|delta|theta|gamma|vega)$"),
    interval: str = Query("5m", regex="^(1m|5m|15m|1h|1d)$"),
    expiry: str = Query(..., description="Expiry date YYYY-MM-DD"),
    date: Optional[str] = Query(None, description="Trade date YYYY-MM-DD"),
    current_user: OptionalUser = None,
    db: AsyncSession = Depends(get_db),
    service: OptionsService = Depends(get_analytics_service),
) -> MultiViewResponse:
    """
    Get multi-view time-series data for a strike.
    Returns CE, PE, and derived metrics (differences, ratios).
    """
    symbol = symbol.upper()
    repo = get_historical_repository(db)
    
    # Calculate time range
    minutes_map = {"1m": 1, "5m": 5, "15m": 15, "1h": 60, "1d": 1440}
    interval_minutes = minutes_map.get(interval, 5)
    
    # Get current time in IST (timezone-aware)
    now_ist = get_ist_now()
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except:
            target_date = now_ist.date()
    else:
        target_date = now_ist.date()
    
    # Market hours: 9:15 AM to 3:30 PM IST for equity indices
    COMMODITY_SYMBOLS = {"CRUDEOIL", "NATURALGAS", "GOLD", "SILVER", "COPPER", "ALUMINIUM", "ZINC", "LEAD", "NICKEL"}
    is_commodity = symbol.upper() in COMMODITY_SYMBOLS
    
    # Create timezone-aware market open/close times in IST
    market_open_ist = datetime.combine(target_date, datetime.strptime("09:15", "%H:%M").time()).replace(tzinfo=IST)
    market_close_ist = datetime.combine(target_date, datetime.strptime("15:30", "%H:%M").time()).replace(tzinfo=IST)
    
    # Start time: Market open (9:15 AM IST) for intraday data
    start_time_ist = market_open_ist
    
    # End time: Min(current time, market close) for today; Full day for historical
    if target_date < now_ist.date():
        # Historical date - use full market hours
        end_time_ist = market_close_ist
    elif target_date == now_ist.date():
        # Today - use current time capped at market close (or beyond for commodities)
        if is_commodity:
            end_time_ist = now_ist
        else:
            end_time_ist = min(now_ist, market_close_ist)
    else:
        # Future date - no data expected
        end_time_ist = market_close_ist
    
    # Convert to UTC for database query (DB stores timestamps in UTC)
    from datetime import timezone
    start_time = start_time_ist.astimezone(timezone.utc).replace(tzinfo=None)
    end_time = end_time_ist.astimezone(timezone.utc).replace(tzinfo=None)
    
    # Get symbol ID
    symbol_id = await repo.get_symbol_id(symbol)
    
    if not symbol_id:
        return MultiViewResponse(
            symbol=symbol,
            strike=strike,
            field=field,
            views={},
            summary={"error": "Symbol not found"}
        )
    
    # Get available expiries for smart fallback (lightweight query)
    sample_expiries = []
    try:
        from sqlalchemy import select, distinct
        expiry_query = select(
            distinct(OptionContractDB.expiry),
        ).where(
            OptionContractDB.symbol_id == symbol_id
        ).limit(5)
        expiry_result = await db.execute(expiry_query)
        sample_expiries = [r[0] for r in expiry_result.fetchall()]
    except Exception:
        pass  # Silently continue without expiry fallback
    
    # Convert expiry if needed
    query_expiry = expiry
    # Normalize YYYY-MM-DD to Noon IST Timestamp if needed
    if "-" in expiry:
        try:
            dt = datetime.strptime(expiry, "%Y-%m-%d")
            # Align to Noon IST
            dt_ist = datetime.combine(dt.date(), dt_time(12, 0)).replace(tzinfo=IST)
            query_expiry = str(int(dt_ist.timestamp()))
        except Exception:
            pass  # Use original expiry
    
    # Smart expiry fallback: if requested expiry doesn't match DB, use first available
    if sample_expiries and str(query_expiry) not in [str(e) for e in sample_expiries]:
        try:
            requested_ts = int(query_expiry) if query_expiry.isdigit() else 0
            for db_expiry in sample_expiries:
                if abs(db_expiry - requested_ts) < 86400:  # Within 24 hours
                    query_expiry = str(db_expiry)
                    break
            else:
                # No close match, use first available
                query_expiry = str(sample_expiries[0])
        except Exception:
            pass  # Continue with original expiry
    
    # Fetch CE and PE data
    ce_data = await repo.get_option_timeseries(
        symbol_id=symbol_id, strike=strike, option_type="CE",
        expiry=query_expiry, field=field, start_time=start_time,
        end_time=end_time, interval_minutes=interval_minutes
    )
    
    pe_data = await repo.get_option_timeseries(
        symbol_id=symbol_id, strike=strike, option_type="PE",
        expiry=query_expiry, field=field, start_time=start_time,
        end_time=end_time, interval_minutes=interval_minutes
    )
    
    # If no data and query_expiry was converted, try with original expiry string
    if not ce_data and not pe_data and query_expiry != expiry:
        ce_data = await repo.get_option_timeseries(
            symbol_id=symbol_id, strike=strike, option_type="CE",
            expiry=expiry, field=field, start_time=start_time,
            end_time=end_time, interval_minutes=interval_minutes
        )
        pe_data = await repo.get_option_timeseries(
            symbol_id=symbol_id, strike=strike, option_type="PE",
            expiry=expiry, field=field, start_time=start_time,
            end_time=end_time, interval_minutes=interval_minutes
        )

    
    # Fallback to live data if no historical data found
    if not ce_data and not pe_data:
        try:
            live_data = await service.get_live_data(
                symbol=symbol,
                expiry=expiry,
                include_greeks=True
            )
            if live_data and "oc" in live_data:
                strike_key = str(int(strike))
                if strike_key not in live_data["oc"]:
                    strike_key = f"{strike:.6f}"
                
                if strike_key in live_data["oc"]:
                    strike_data = live_data["oc"][strike_key]
                    now_ts = get_ist_now().replace(tzinfo=None)
                    
                    # Extract field value for CE/PE
                    for opt_type, data_list, opt_key in [("CE", ce_data, "ce"), ("PE", pe_data, "pe")]:
                        opt = strike_data.get(opt_key, {})
                        optgeeks = opt.get("optgeeks", {}) or {}
                        field_mapping = {
                            "oi": opt.get("OI") or opt.get("oi", 0),
                            "oi_change": opt.get("oichng") or opt.get("oi_change", 0),
                            "ltp": opt.get("ltp", 0),
                            "iv": opt.get("iv", 0),
                            "volume": opt.get("vol") or opt.get("volume", 0),
                            "delta": opt.get("delta") or optgeeks.get("delta", 0),
                            "theta": opt.get("theta") or optgeeks.get("theta", 0),
                            "gamma": opt.get("gamma") or optgeeks.get("gamma", 0),
                            "vega": opt.get("vega") or optgeeks.get("vega", 0),
                        }
                        current_value = field_mapping.get(field, 0)
                        from app.repositories.historical import TimeSeriesPoint
                        if opt_type == "CE":
                            ce_data = [TimeSeriesPoint(timestamp=now_ts, value=float(current_value) if current_value else 0.0)]
                        else:
                            pe_data = [TimeSeriesPoint(timestamp=now_ts, value=float(current_value) if current_value else 0.0)]
        except Exception:
            pass  # Continue with empty data
    
    # Build views dict
    views = {}
    
    # CE view
    views["ce"] = [
        {"timestamp": p.timestamp.isoformat(), "value": p.value, "change": p.change, "change_percent": p.change_percent}
        for p in ce_data
    ]
    
    # PE view
    views["pe"] = [
        {"timestamp": p.timestamp.isoformat(), "value": p.value, "change": p.change, "change_percent": p.change_percent}
        for p in pe_data
    ]
    
    # Compute derived metrics (align by timestamp)
    ce_by_ts = {p.timestamp: p.value for p in ce_data}
    pe_by_ts = {p.timestamp: p.value for p in pe_data}
    all_timestamps = sorted(set(ce_by_ts.keys()) | set(pe_by_ts.keys()))
    
    ce_minus_pe = []
    pe_minus_ce = []
    ce_div_pe = []
    pe_div_ce = []
    
    for ts in all_timestamps:
        ce_val = ce_by_ts.get(ts, 0) or 0
        pe_val = pe_by_ts.get(ts, 0) or 0
        
        ce_minus_pe.append({"timestamp": ts.isoformat(), "value": round(ce_val - pe_val, 4)})
        pe_minus_ce.append({"timestamp": ts.isoformat(), "value": round(pe_val - ce_val, 4)})
        
        # Ratios (handle division by zero)
        ce_div_pe.append({
            "timestamp": ts.isoformat(),
            "value": round(ce_val / pe_val, 4) if pe_val != 0 else 0
        })
        pe_div_ce.append({
            "timestamp": ts.isoformat(),
            "value": round(pe_val / ce_val, 4) if ce_val != 0 else 0
        })
    
    views["ce_minus_pe"] = ce_minus_pe
    views["pe_minus_ce"] = pe_minus_ce
    views["ce_div_pe"] = ce_div_pe
    views["pe_div_ce"] = pe_div_ce
    
    # Summary
    summary = {
        "ce_count": len(ce_data),
        "pe_count": len(pe_data),
        "total_points": len(all_timestamps),
    }
    
    if ce_data:
        ce_vals = [p.value for p in ce_data]
        summary["ce_current"] = ce_vals[-1] if ce_vals else 0
        summary["ce_change"] = round(ce_vals[-1] - ce_vals[0], 2) if len(ce_vals) > 1 else 0
    
    if pe_data:
        pe_vals = [p.value for p in pe_data]
        summary["pe_current"] = pe_vals[-1] if pe_vals else 0
        summary["pe_change"] = round(pe_vals[-1] - pe_vals[0], 2) if len(pe_vals) > 1 else 0
    
    return MultiViewResponse(
        symbol=symbol,
        strike=strike,
        field=field,
        views=views,
        summary=summary
    )

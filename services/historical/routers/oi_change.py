"""
OI Change Router

Endpoints for querying OI change development over time.
Powers OI buildup charts and session tracking.
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.connection import get_db
from services.analytics.models import AnalyticsCumulativeOI
from services.historical.cache import cache
import structlog

logger = structlog.get_logger("oi-change-router")

router = APIRouter()


@router.get("/{symbol_id}/{strike}")
async def get_oi_change_chart(
    symbol_id: int,
    strike: float,
    option_type: str = Query(..., regex="^(CE|PE)$"),
    expiry: str = Query(..., description="Expiry date (YYYY-MM-DD) - REQUIRED for historical"),
    from_time: datetime = Query(..., description="Start timestamp - REQUIRED for historical"),
    to_time: Optional[datetime] = None,
    interval: str = Query("1m", regex="^(1m|5m|15m|1h)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get OI change development chart data (HISTORICAL).
    
    ⚠️ For historical queries, MUST specify expiry and time range explicitly.
    For live/current data, use /latest endpoint instead.
    
    Args:
        symbol_id: Security ID (e.g., 13 for NIFTY)
        strike: Strike price
        option_type: CE or PE
        expiry: Expiry date (YYYY-MM-DD) - REQUIRED
        from_time: Start time - REQUIRED
        to_time: End time (default: now)
        interval: Aggregation interval (1m, 5m, 15m, 1h)
        
    Returns:
        Time-series data for charting OI buildup
    """
    try:
        from datetime import timezone
        if not to_time:
            to_time = datetime.now(timezone.utc)
        
        # Check cache first
        cache_key = cache.make_cache_key(
            "oi_change",
            symbol_id=symbol_id,
            strike=strike,
            option_type=option_type,
            expiry=expiry,
            from_time=from_time.isoformat(),
            to_time=to_time.isoformat(),
            interval=interval
        )
        
        cached_data = await cache.get(cache_key)
        if cached_data:
            logger.debug(f"Cache hit for OI change: {symbol_id}/{strike}")
            return cached_data
        
        # Parse expiry
        from datetime import date
        expiry_date = date.fromisoformat(expiry)
        
        # Determine which table/view to query based on interval
        if interval == "1m":
            # Use continuous aggregate if available
            table_name = "analytics_cumoi_1min"
            time_column = "bucket"
        elif interval == "5m":
            table_name = "analytics_cumoi_5min"
            time_column = "bucket"
        elif interval == "15m":
            table_name = "analytics_cumoi_15min"
            time_column = "bucket"
        elif interval == "1h":
            table_name = "analytics_cumoi_1hour"
            time_column = "bucket"
        else:
            # Default to raw table
            table_name = "analytics_cumulative_oi"
            time_column = "timestamp"
        
        # Query analytics_cumulative_oi
        stmt = select(AnalyticsCumulativeOI).where(
            and_(
                AnalyticsCumulativeOI.symbol_id == symbol_id,
                AnalyticsCumulativeOI.strike_price == strike,
                AnalyticsCumulativeOI.option_type == option_type,
                AnalyticsCumulativeOI.expiry == expiry_date,
                AnalyticsCumulativeOI.timestamp >= from_time,
                AnalyticsCumulativeOI.timestamp <= to_time
            )
        ).order_by(AnalyticsCumulativeOI.timestamp.asc())
        
        result = await db.execute(stmt)
        records = result.scalars().all()
        
        # Format for charting
        data_points = []
        for record in records:
            data_points.append({
                "time": record.timestamp.isoformat(),
                "cumulative_oi_change": record.cumulative_oi_change,
                "current_oi": record.current_oi,
                "oi_change_pct": float(record.oi_change_pct) if record.oi_change_pct else None,
                "session_high": record.session_high_oi,
                "session_low": record.session_low_oi
            })
        
        
        # Calculate stats
        if data_points:
            total_change = data_points[-1]["cumulative_oi_change"] if data_points[-1]["cumulative_oi_change"] else 0
            max_change = max((d["cumulative_oi_change"] or 0) for d in data_points)
            min_change = min((d["cumulative_oi_change"] or 0) for d in data_points)
        else:
            total_change = max_change = min_change = 0
        
        result = {
            "symbol_id": symbol_id,
            "strike": strike,
            "option_type": option_type,
            "expiry": expiry,
            "from": from_time.isoformat(),
            "to": to_time.isoformat(),
            "interval": interval,
            "data": data_points,
            "stats": {
                "total_change": total_change,
                "max_change": max_change,
                "min_change": min_change,
                "data_points": len(data_points)
            }
        }
        
        # Cache the result
        ttl = cache.calculate_ttl(from_time)
        await cache.set(cache_key, result, ttl=ttl)
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching OI change data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest/{symbol_id}/{strike}")
async def get_latest_oi_change(
    symbol_id: int,
    strike: float,
    option_type: str = Query(..., regex="^(CE|PE)$"),
    lookback_minutes: int = Query(60, description="How far back to look (default: 60 min)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get latest/current OI change data (LIVE-LIKE).
    
    ✅ For current/live data - NO need to specify expiry or exact time.
    System auto-selects latest expiry and time range.
    
    Args:
        symbol_id: Security ID
        strike: Strike price
        option_type: CE or PE
        lookback_minutes: Time window (default: 60 min from now)
        
    Returns:
        Recent OI change data (live-like behavior)
    """
    try:
        from datetime import timedelta
        
        # Auto-select time range (last N minutes)
        to_time = datetime.now()
        from_time = to_time - timedelta(minutes=lookback_minutes)
        
        # Find latest expiry for this symbol
        expiry_stmt = select(AnalyticsCumulativeOI.expiry).where(
            and_(
                AnalyticsCumulativeOI.symbol_id == symbol_id,
                AnalyticsCumulativeOI.timestamp >= from_time
            )
        ).order_by(AnalyticsCumulativeOI.timestamp.desc()).limit(1)
        
        expiry_result = await db.execute(expiry_stmt)
        latest_expiry = expiry_result.scalar_one_or_none()
        
        if not latest_expiry:
            return {
                "symbol_id": symbol_id,
                "strike": strike,
                "option_type": option_type,
                "data": [],
                "message": "No recent data found"
            }
        
        # Query data for latest expiry
        stmt = select(AnalyticsCumulativeOI).where(
            and_(
                AnalyticsCumulativeOI.symbol_id == symbol_id,
                AnalyticsCumulativeOI.strike_price == strike,
                AnalyticsCumulativeOI.option_type == option_type,
                AnalyticsCumulativeOI.expiry == latest_expiry,
                AnalyticsCumulativeOI.timestamp >= from_time,
                AnalyticsCumulativeOI.timestamp <= to_time
            )
        ).order_by(AnalyticsCumulativeOI.timestamp.asc())
        
        result = await db.execute(stmt)
        records = result.scalars().all()
        
        # Format data
        data_points = []
        for record in records:
            data_points.append({
                "time": record.timestamp.isoformat(),
                "cumulative_oi_change": record.cumulative_oi_change,
                "current_oi": record.current_oi,
                "oi_change_pct": float(record.oi_change_pct) if record.oi_change_pct else None
            })
        
        return {
            "symbol_id": symbol_id,
            "strike": strike,
            "option_type": option_type,
            "expiry": latest_expiry.isoformat(),  # Auto-selected
            "from": from_time.isoformat(),
            "to": to_time.isoformat(),
            "data": data_points,
            "auto_selected": True  # Indicates this was auto-selected
        }
        
    except Exception as e:
        logger.error(f"Error fetching latest OI change: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol_id}/all-strikes")
async def get_all_strikes_oi_change(
    symbol_id: int,
    option_type: str = Query(..., regex="^(CE|PE)$"),
    time: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get OI change for all strikes at a specific time.
    Powers heatmap visualization.
    
    Args:
        symbol_id: Security ID
        option_type: CE or PE
        time: Specific timestamp (default: latest)
        
    Returns:
        OI change data for all strikes
    """
    try:
        if not time:
            time = datetime.now()
        
        # Find closest timestamp
        stmt = select(AnalyticsCumulativeOI).where(
            and_(
                AnalyticsCumulativeOI.symbol_id == symbol_id,
                AnalyticsCumulativeOI.option_type == option_type,
                AnalyticsCumulativeOI.timestamp <= time
            )
        ).order_by(AnalyticsCumulativeOI.timestamp.desc()).limit(100)
        
        result = await db.execute(stmt)
        records = result.scalars().all()
        
        # Group by strike
        strike_data = {}
        for record in records:
            strike = float(record.strike_price)
            if strike not in strike_data:
                strike_data[strike] = {
                    "strike": strike,
                    "cumulative_oi_change": record.cumulative_oi_change,
                    "oi_change_pct": float(record.oi_change_pct) if record.oi_change_pct else None,
                    "current_oi": record.current_oi
                }
        
        return {
            "symbol_id": symbol_id,
            "option_type": option_type,
            "timestamp": time.isoformat(),
            "strikes": list(strike_data.values())
        }
        
    except Exception as e:
        logger.error(f"Error fetching all strikes OI change: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

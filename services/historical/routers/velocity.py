"""
Velocity Router

Endpoints for querying velocity metrics and momentum indicators.
Powers velocity timeline charts and spike detection.
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from datetime import datetime
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.connection import get_db
from services.analytics.models import AnalyticsVelocity
import structlog

logger = structlog.get_logger("velocity-router")

router = APIRouter()


@router.get("/{symbol_id}/{strike}")
async def get_velocity_timeline(
    symbol_id: int,
    strike: float,
    option_type: str = Query(..., regex="^(CE|PE)$"),
    expiry: str = Query(..., description="Expiry date (YYYY-MM-DD) - REQUIRED"),
    from_time: datetime = Query(..., description="Start timestamp - REQUIRED"),
    to_time: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get velocity timeline for momentum analysis (HISTORICAL).
    
    ⚠️ For historical queries, MUST specify expiry and time range.
    For live data, use /latest endpoint.
    
    Args:
        symbol_id: Security ID
        strike: Strike price
        option_type: CE or PE
        expiry: Expiry date - REQUIRED
        from_time: Start time - REQUIRED
        to_time: End time (default: now)
        
    Returns:
        Velocity data with spike markers
    """
    try:
        if not to_time:
            to_time = datetime.now()
        
        from datetime import date
        expiry_date = date.fromisoformat(expiry)
        
        stmt = select(AnalyticsVelocity).where(
            and_(
                AnalyticsVelocity.symbol_id == symbol_id,
                AnalyticsVelocity.strike_price == strike,
                AnalyticsVelocity.option_type == option_type,
                AnalyticsVelocity.expiry == expiry_date,
                AnalyticsVelocity.timestamp >= from_time,
                AnalyticsVelocity.timestamp <= to_time
            )
        ).order_by(AnalyticsVelocity.timestamp.asc())
        
        result = await db.execute(stmt)
        records = result.scalars().all()
        
        # Format data
        data_points = []
        spikes = []
        
        for record in records:
            point = {
                "time": record.timestamp.isoformat(),
                "oi_velocity": float(record.oi_velocity) if record.oi_velocity else 0,
                "volume_velocity": float(record.volume_velocity) if record.volume_velocity else 0,
                "price_velocity": float(record.price_velocity) if record.price_velocity else 0,
                "is_spike": record.is_spike
            }
            data_points.append(point)
            
            if record.is_spike:
                spikes.append({
                    "time": record.timestamp.isoformat(),
                    "oi_velocity": float(record.oi_velocity),
                    "magnitude": float(record.spike_magnitude) if record.spike_magnitude else 0
                })
        
        return {
            "symbol_id": symbol_id,
            "strike": strike,
            "option_type": option_type,
            "expiry": expiry,
            "from": from_time.isoformat(),
            "to": to_time.isoformat(),
            "data": data_points,
            "spikes": spikes,
            "stats": {
                "total_spikes": len(spikes),
                "avg_oi_velocity": sum(d["oi_velocity"] for d in data_points) / len(data_points) if data_points else 0,
                "max_oi_velocity": max((d["oi_velocity"] for d in data_points), default=0)
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching velocity data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest/{symbol_id}/{strike}")
async def get_latest_velocity(
    symbol_id: int,
    strike: float,
    option_type: str = Query(..., regex="^(CE|PE)$"),
    lookback_minutes: int = Query(30, description="Time window (default: 30 min)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get latest velocity data (LIVE-LIKE).
    
    ✅ Auto-selects latest expiry and time range.
    No need to specify expiry or exact timestamps.
    
    Args:
        symbol_id: Security ID
        strike: Strike price
        option_type: CE or PE
        lookback_minutes: Time window (default: 30 min)
        
    Returns:
        Recent velocity with spike markers
    """
    try:
        from datetime import timedelta
        
        to_time = datetime.now()
        from_time = to_time - timedelta(minutes=lookback_minutes)
        
        # Auto-select latest expiry
        expiry_stmt = select(AnalyticsVelocity.expiry).where(
            and_(
                AnalyticsVelocity.symbol_id == symbol_id,
                AnalyticsVelocity.timestamp >= from_time
            )
        ).order_by(AnalyticsVelocity.timestamp.desc()).limit(1)
        
        expiry_result = await db.execute(expiry_stmt)
        latest_expiry = expiry_result.scalar_one_or_none()
        
        if not latest_expiry:
            return {
                "symbol_id": symbol_id,
                "data": [],
                "message": "No recent data"
            }
        
        # Query velocity data
        stmt = select(AnalyticsVelocity).where(
            and_(
                AnalyticsVelocity.symbol_id == symbol_id,
                AnalyticsVelocity.strike_price == strike,
                AnalyticsVelocity.option_type == option_type,
                AnalyticsVelocity.expiry == latest_expiry,
                AnalyticsVelocity.timestamp >= from_time
            )
        ).order_by(AnalyticsVelocity.timestamp.asc())
        
        result = await db.execute(stmt)
        records = result.scalars().all()
        
        data_points = []
        spikes = []
        
        for record in records:
            point = {
                "time": record.timestamp.isoformat(),
                "oi_velocity": float(record.oi_velocity) if record.oi_velocity else 0,
                "is_spike": record.is_spike
            }
            data_points.append(point)
            
            if record.is_spike:
                spikes.append({
                    "time": record.timestamp.isoformat(),
                    "magnitude": float(record.spike_magnitude) if record.spike_magnitude else 0
                })
        
        return {
            "symbol_id": symbol_id,
            "strike": strike,
            "option_type": option_type,
            "expiry": latest_expiry.isoformat(),
            "data": data_points,
            "spikes": spikes,
            "auto_selected": True
        }
        
    except Exception as e:
        logger.error(f"Error fetching latest velocity: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol_id}/heatmap")
async def get_velocity_heatmap(
    symbol_id: int,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get velocity heatmap data for all strikes.
    
    Args:
        symbol_id: Security ID
        from_time: Start time
        to_time: End time
        
    Returns:
        Heatmap matrix of velocities
    """
    try:
        if not from_time:
            from_time = datetime.now().replace(hour=9, minute=15, second=0, microsecond=0)
        if not to_time:
            to_time = datetime.now()
        
        stmt = select(AnalyticsVelocity).where(
            and_(
                AnalyticsVelocity.symbol_id == symbol_id,
                AnalyticsVelocity.timestamp >= from_time,
                AnalyticsVelocity.timestamp <= to_time
            )
        ).order_by(
            AnalyticsVelocity.timestamp.asc(),
            AnalyticsVelocity.strike_price.asc()
        )
        
        result = await db.execute(stmt)
        records = result.scalars().all()
        
        # Build heatmap matrix
        heatmap = {}
        for record in records:
            time_key = record.timestamp.isoformat()
            strike = float(record.strike_price)
            
            if time_key not in heatmap:
                heatmap[time_key] = {}
            
            heatmap[time_key][strike] = {
                "oi_velocity": float(record.oi_velocity) if record.oi_velocity else 0,
                "is_spike": record.is_spike
            }
        
        return {
            "symbol_id": symbol_id,
            "from": from_time.isoformat(),
            "to": to_time.isoformat(),
            "heatmap": heatmap
        }
        
    except Exception as e:
        logger.error(f"Error fetching velocity heatmap: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

"""
Distribution Router

Endpoints for OI distribution snapshots and evolution.
Powers distribution charts and heatmaps.
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from datetime import datetime
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.connection import get_db
from services.analytics.models import AnalyticsOIDistribution
import structlog

logger = structlog.get_logger("distribution-router")

router = APIRouter()


@router.get("/{symbol_id}")
async def get_oi_distribution(
    symbol_id: int,
    time: Optional[datetime] = None,
    expiry: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get OI distribution snapshot at a specific time.
    
    Args:
        symbol_id: Security ID
        time: Specific timestamp (default: latest)
        expiry: Option expiry filter
        
    Returns:
        OI distribution data
    """
    try:
        if not time:
            time = datetime.now()
        
        # Build query
        conditions = [
            AnalyticsOIDistribution.symbol_id == symbol_id,
            AnalyticsOIDistribution.timestamp <= time
        ]
        
        if expiry:
            conditions.append(AnalyticsOIDistribution.expiry == expiry)
        
        stmt = select(AnalyticsOIDistribution).where(
            and_(*conditions)
        ).order_by(AnalyticsOIDistribution.timestamp.desc()).limit(1)
        
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        
        if not record:
            raise HTTPException(status_code=404, detail="No distribution data found")
        
        return {
            "symbol_id": symbol_id,
            "timestamp": record.timestamp.isoformat(),
            "expiry": record.expiry.isoformat(),
            "totals": {
                "call_oi": record.total_call_oi,
                "put_oi": record.total_put_oi,
                "pcr": float(record.pcr_oi) if record.pcr_oi else None
            },
            "atm": {
                "strike": float(record.atm_strike) if record.atm_strike else None,
                "call_oi": record.atm_call_oi,
                "put_oi": record.atm_put_oi
            },
            "max_oi": {
                "call_strike": float(record.max_call_oi_strike) if record.max_call_oi_strike else None,
                "call_oi": record.max_call_oi,
                "put_strike": float(record.max_put_oi_strike) if record.max_put_oi_strike else None,
                "put_oi": record.max_put_oi
            },
            "distribution": record.strike_wise_distribution,
            "spot_price": float(record.spot_price) if record.spot_price else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching distribution: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

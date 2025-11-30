"""
Opportunities Router

Endpoints for trading opportunities and signals.
Powers opportunity timeline and backtesting.
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from datetime import datetime
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.connection import get_db
from services.analytics.models import AnalyticsOpportunities
import structlog

logger = structlog.get_logger("opportunities-router")

router = APIRouter()


@router.get("/{symbol_id}")
async def get_opportunities(
    symbol_id: int,
    opportunity_type: Optional[str] = Query(None, regex="^(scalp|swing|hedge|spread)$"),
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    active_only: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    Get trading opportunities for a symbol.
    
    Args:
        symbol_id: Security ID
        opportunity_type: Filter by type (scalp, swing, hedge, spread)
        from_time: Start time
        to_time: End time
        active_only: Show only active opportunities
        
    Returns:
        List of opportunities with outcomes
    """
    try:
        if not from_time:
            from_time = datetime.now().replace(hour=9, minute=15, second=0, microsecond=0)
        if not to_time:
            to_time = datetime.now()
        
        # Build query
        conditions = [
            AnalyticsOpportunities.symbol_id == symbol_id,
            AnalyticsOpportunities.timestamp >= from_time,
            AnalyticsOpportunities.timestamp <= to_time
        ]
        
        if opportunity_type:
            conditions.append(AnalyticsOpportunities.opportunity_type == opportunity_type)
        
        if active_only:
            conditions.append(AnalyticsOpportunities.is_active == True)
        
        stmt = select(AnalyticsOpportunities).where(
            and_(*conditions)
        ).order_by(AnalyticsOpportunities.timestamp.desc())
        
        result = await db.execute(stmt)
        records = result.scalars().all()
        
        # Format opportunities
        opportunities = []
        for record in records:
            opportunities.append({
                "id": record.id,
                "timestamp": record.timestamp.isoformat(),
                "type": record.opportunity_type,
                "strategy": record.strategy,
                "entry": {
                    "strikes": record.entry_strikes,
                    "price": float(record.entry_price) if record.entry_price else None,
                    "spot": float(record.spot_at_entry) if record.spot_at_entry else None
                },
                "risk_reward": {
                    "max_profit": float(record.max_profit) if record.max_profit else None,
                    "max_loss": float(record.max_loss) if record.max_loss else None,
                    "ratio": float(record.risk_reward_ratio) if record.risk_reward_ratio else None
                },
                "targets": {
                    "target_price": float(record.target_price) if record.target_price else None,
                    "stop_loss": float(record.stop_loss) if record.stop_loss else None
                },
                "confidence": float(record.confidence_score) if record.confidence_score else None,
                "time_horizon_minutes": record.time_horizon_minutes,
                "is_active": record.is_active,
                "outcome": {
                    "exit_time": record.exit_timestamp.isoformat() if record.exit_timestamp else None,
                    "exit_price": float(record.exit_price) if record.exit_price else None,
                    "profit_loss": float(record.actual_profit_loss) if record.actual_profit_loss else None,
                    "type": record.outcome_type
                } if not record.is_active else None
            })
        
        # Calculate stats
        total_opportunities = len(opportunities)
        closed_opportunities = [o for o in opportunities if not o["is_active"]]
        winning_opportunities = [o for o in closed_opportunities 
                                if o["outcome"] and o["outcome"]["profit_loss"] and o["outcome"]["profit_loss"] > 0]
        
        return {
            "symbol_id": symbol_id,
            "from": from_time.isoformat(),
            "to": to_time.isoformat(),
            "filter": opportunity_type,
            "opportunities": opportunities,
            "stats": {
                "total": total_opportunities,
                "active": total_opportunities - len(closed_opportunities),
                "closed": len(closed_opportunities),
                "won": len(winning_opportunities),
                "win_rate": (len(winning_opportunities) / len(closed_opportunities) * 100) 
                           if closed_opportunities else 0,
                "avg_profit": (sum(o["outcome"]["profit_loss"] for o in closed_opportunities 
                                  if o["outcome"] and o["outcome"]["profit_loss"]) / len(closed_opportunities))
                             if closed_opportunities else 0
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching opportunities: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

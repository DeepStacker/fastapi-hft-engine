"""
Performance Analytics Service

Calculates and tracks recommendation performance metrics:
- Win rate (profitable vs losing recommendations)
- Average P&L per strategy
- POP accuracy (predicted vs actual)
- Confidence calibration
- Time-based performance trends
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from app.models.strategy_position import (
    TrackedPosition, RecommendationHistory, PositionStatus
)

logger = logging.getLogger(__name__)


@dataclass
class StrategyPerformance:
    """Performance metrics for a strategy type."""
    strategy_type: str
    total_recommendations: int
    tracked_count: int
    track_rate: float
    
    # P&L metrics
    total_pnl: float
    avg_pnl: float
    win_count: int
    loss_count: int
    win_rate: float
    
    # POP accuracy
    avg_predicted_pop: float
    actual_win_rate: float
    pop_accuracy: float  # How close predicted POP matches actual
    
    # Risk metrics
    avg_max_profit: float
    avg_max_loss: float
    profit_factor: float  # Total wins / Total losses
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ConfidenceCalibration:
    """Calibration between confidence scores and actual outcomes."""
    confidence_bucket: str  # e.g., "0.6-0.7"
    bucket_min: float
    bucket_max: float
    recommendation_count: int
    actual_win_rate: float
    expected_win_rate: float  # Average confidence in bucket
    calibration_error: float  # |actual - expected|
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TimePeriodPerformance:
    """Performance for a time period."""
    period: str  # e.g., "2026-01", "Week 4"
    recommendations: int
    tracked: int
    total_pnl: float
    win_rate: float
    avg_confidence: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class PerformanceAnalytics:
    """
    Analyzes recommendation and position performance for accountability.
    
    Provides:
    1. Strategy-level performance breakdown
    2. Confidence calibration analysis
    3. Time-series performance trends
    4. User-specific statistics
    """
    
    # --------------------------------------------------------
    # PUBLIC API
    # --------------------------------------------------------
    
    async def get_overall_stats(
        self,
        db: AsyncSession,
        user_id: Optional[str] = None,
        days_back: int = 30
    ) -> Dict[str, Any]:
        """
        Get high-level performance statistics.
        
        Returns aggregate stats for dashboard display.
        """
        cutoff = datetime.utcnow() - timedelta(days=days_back)
        
        # Base query filters
        pos_filters = [TrackedPosition.created_at >= cutoff]
        if user_id:
            pos_filters.append(TrackedPosition.user_id == user_id)
        
        # Get position stats
        pos_query = select(
            func.count(TrackedPosition.id).label('total'),
            func.sum(TrackedPosition.final_pnl).label('total_pnl'),
            func.avg(TrackedPosition.final_pnl).label('avg_pnl'),
            func.count().filter(TrackedPosition.final_pnl > 0).label('wins'),
            func.count().filter(TrackedPosition.final_pnl < 0).label('losses'),
            func.count().filter(TrackedPosition.status == PositionStatus.ACTIVE).label('active'),
            func.count().filter(TrackedPosition.status == PositionStatus.CLOSED).label('closed')
        ).where(and_(*pos_filters))
        
        result = await db.execute(pos_query)
        row = result.fetchone()
        
        total = row.total or 0
        wins = row.wins or 0
        losses = row.losses or 0
        
        return {
            "period_days": days_back,
            "total_positions": total,
            "active_positions": row.active or 0,
            "closed_positions": row.closed or 0,
            "total_pnl": row.total_pnl or 0,
            "average_pnl": row.avg_pnl or 0,
            "win_count": wins,
            "loss_count": losses,
            "win_rate": (wins / (wins + losses) * 100) if (wins + losses) > 0 else 0,
            "profit_factor": abs(wins / losses) if losses > 0 else wins
        }
    
    async def get_strategy_breakdown(
        self,
        db: AsyncSession,
        user_id: Optional[str] = None,
        days_back: int = 30
    ) -> List[StrategyPerformance]:
        """
        Get performance breakdown by strategy type.
        """
        cutoff = datetime.utcnow() - timedelta(days=days_back)
        
        # Get positions grouped by strategy
        pos_filters = [TrackedPosition.created_at >= cutoff]
        if user_id:
            pos_filters.append(TrackedPosition.user_id == user_id)
        
        query = select(
            TrackedPosition.strategy_type,
            func.count(TrackedPosition.id).label('count'),
            func.sum(TrackedPosition.final_pnl).label('total_pnl'),
            func.avg(TrackedPosition.final_pnl).label('avg_pnl'),
            func.count().filter(TrackedPosition.final_pnl > 0).label('wins'),
            func.count().filter(TrackedPosition.final_pnl < 0).label('losses')
        ).where(
            and_(*pos_filters)
        ).group_by(TrackedPosition.strategy_type)
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        # Get recommendation counts from history
        rec_query = select(
            RecommendationHistory.strategy_type,
            func.count(RecommendationHistory.id).label('rec_count'),
            func.count().filter(RecommendationHistory.user_action == 'tracked').label('tracked'),
            func.avg(RecommendationHistory.confidence).label('avg_confidence')
        ).where(
            RecommendationHistory.created_at >= cutoff
        ).group_by(RecommendationHistory.strategy_type)
        
        rec_result = await db.execute(rec_query)
        rec_rows = {r.strategy_type: r for r in rec_result.fetchall()}
        
        performances = []
        for row in rows:
            rec_data = rec_rows.get(row.strategy_type)
            total_recs = rec_data.rec_count if rec_data else row.count
            tracked = rec_data.tracked if rec_data else row.count
            
            wins = row.wins or 0
            losses = row.losses or 0
            
            performances.append(StrategyPerformance(
                strategy_type=row.strategy_type,
                total_recommendations=total_recs,
                tracked_count=tracked,
                track_rate=(tracked / total_recs * 100) if total_recs > 0 else 0,
                total_pnl=row.total_pnl or 0,
                avg_pnl=row.avg_pnl or 0,
                win_count=wins,
                loss_count=losses,
                win_rate=(wins / (wins + losses) * 100) if (wins + losses) > 0 else 0,
                avg_predicted_pop=0,  # Would need position metrics
                actual_win_rate=(wins / (wins + losses) * 100) if (wins + losses) > 0 else 0,
                pop_accuracy=0,
                avg_max_profit=0,
                avg_max_loss=0,
                profit_factor=abs((row.total_pnl or 0) / (losses or 1))
            ))
        
        return performances
    
    async def get_confidence_calibration(
        self,
        db: AsyncSession,
        bucket_size: float = 0.1
    ) -> List[ConfidenceCalibration]:
        """
        Analyze how well confidence scores predict actual outcomes.
        
        Groups recommendations by confidence buckets and compares
        predicted vs actual win rates.
        """
        # Get all recommendations with outcomes
        query = select(
            RecommendationHistory.confidence,
            RecommendationHistory.outcome_pnl,
            RecommendationHistory.outcome_pop_actual
        ).where(
            RecommendationHistory.outcome_pnl.isnot(None)
        )
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        # Group by confidence buckets
        buckets = defaultdict(lambda: {"count": 0, "wins": 0, "conf_sum": 0})
        
        for row in rows:
            bucket_idx = int(row.confidence / bucket_size)
            bucket_min = bucket_idx * bucket_size
            bucket_key = f"{bucket_min:.1f}-{bucket_min + bucket_size:.1f}"
            
            buckets[bucket_key]["count"] += 1
            buckets[bucket_key]["conf_sum"] += row.confidence
            if row.outcome_pnl > 0:
                buckets[bucket_key]["wins"] += 1
        
        calibrations = []
        for bucket_key, data in sorted(buckets.items()):
            parts = bucket_key.split("-")
            bucket_min = float(parts[0])
            bucket_max = float(parts[1])
            
            expected = data["conf_sum"] / data["count"] if data["count"] > 0 else 0
            actual = data["wins"] / data["count"] if data["count"] > 0 else 0
            
            calibrations.append(ConfidenceCalibration(
                confidence_bucket=bucket_key,
                bucket_min=bucket_min,
                bucket_max=bucket_max,
                recommendation_count=data["count"],
                expected_win_rate=expected * 100,
                actual_win_rate=actual * 100,
                calibration_error=abs(actual - expected) * 100
            ))
        
        return calibrations
    
    async def get_time_series_performance(
        self,
        db: AsyncSession,
        user_id: Optional[str] = None,
        granularity: str = "week",  # week, month
        periods: int = 12
    ) -> List[TimePeriodPerformance]:
        """
        Get performance over time periods.
        """
        now = datetime.utcnow()
        results = []
        
        for i in range(periods - 1, -1, -1):
            if granularity == "week":
                start = now - timedelta(weeks=i+1)
                end = now - timedelta(weeks=i)
                period_label = f"Week {periods - i}"
            else:  # month
                start = now - timedelta(days=30*(i+1))
                end = now - timedelta(days=30*i)
                period_label = (now - timedelta(days=30*i)).strftime("%Y-%m")
            
            filters = [
                TrackedPosition.created_at >= start,
                TrackedPosition.created_at < end
            ]
            if user_id:
                filters.append(TrackedPosition.user_id == user_id)
            
            query = select(
                func.count(TrackedPosition.id).label('count'),
                func.sum(TrackedPosition.final_pnl).label('total_pnl'),
                func.count().filter(TrackedPosition.final_pnl > 0).label('wins')
            ).where(and_(*filters))
            
            result = await db.execute(query)
            row = result.fetchone()
            
            count = row.count or 0
            wins = row.wins or 0
            
            results.append(TimePeriodPerformance(
                period=period_label,
                recommendations=count,
                tracked=count,
                total_pnl=row.total_pnl or 0,
                win_rate=(wins / count * 100) if count > 0 else 0,
                avg_confidence=0
            ))
        
        return results
    
    async def get_best_performing_strategies(
        self,
        db: AsyncSession,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get top performing strategies by win rate and P&L.
        """
        query = select(
            TrackedPosition.strategy_type,
            func.count(TrackedPosition.id).label('count'),
            func.sum(TrackedPosition.final_pnl).label('total_pnl'),
            func.avg(TrackedPosition.final_pnl).label('avg_pnl'),
            (func.count().filter(TrackedPosition.final_pnl > 0) * 100.0 / 
             func.count(TrackedPosition.id)).label('win_rate')
        ).where(
            TrackedPosition.final_pnl.isnot(None)
        ).group_by(
            TrackedPosition.strategy_type
        ).having(
            func.count(TrackedPosition.id) >= 3  # Minimum sample size
        ).order_by(
            func.avg(TrackedPosition.final_pnl).desc()
        ).limit(limit)
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        return [
            {
                "strategy_type": row.strategy_type,
                "count": row.count,
                "total_pnl": row.total_pnl or 0,
                "avg_pnl": row.avg_pnl or 0,
                "win_rate": row.win_rate or 0
            }
            for row in rows
        ]

    async def get_best_strategy_for_context(
        self,
        db: AsyncSession,
        bias: str, # bullish, bearish, neutral
        iv_regime: str, # Low, Normal, High
        min_samples: int = 3
    ) -> Optional[str]:
        """
        Identify the best performing strategy for a specific market context.
        
        Uses historical data (Feedback Loop) to find what worked in 
        similar conditions (e.g., High IV + Bullish Pressure).
        """
        # Query positions that match this context
        # Note: JSONB querying depends on how data is stored.
        # We assume entry_context has 'bias' and 'iv_regime'.
        
        # Safe query avoiding complex JSON operators for now if possible, 
        # or use simple text matching if JSON structure varies.
        # Ideally: TrackedPosition.entry_context['bias'].astext == bias
        
        query = select(
            TrackedPosition.strategy_type,
            func.avg(TrackedPosition.final_pnl).label('avg_pnl'),
            (func.count().filter(TrackedPosition.final_pnl > 0) * 100.0 / 
             func.count(TrackedPosition.id)).label('win_rate'),
             func.count(TrackedPosition.id).label('count')
        ).where(
            and_(
                TrackedPosition.entry_context['bias'].astext == bias,
                TrackedPosition.final_pnl.isnot(None)
                # optionally check iv_regime if strict
            )
        ).group_by(
            TrackedPosition.strategy_type
        ).having(
            func.count(TrackedPosition.id) >= min_samples
        ).order_by(
            func.avg(TrackedPosition.final_pnl).desc()
        ).limit(1)
        
        try:
            result = await db.execute(query)
            best = result.fetchone()
            if best and best.win_rate > 50: # Only recommend if it actually works
                return best.strategy_type
        except Exception as e:
            logger.warning(f"Strategy feedback loop query failed: {e}")
            
        return None


# ============================================================
# FACTORY
# ============================================================

_performance_analytics_instance = None

def get_performance_analytics() -> PerformanceAnalytics:
    """Get singleton instance."""
    global _performance_analytics_instance
    if _performance_analytics_instance is None:
        _performance_analytics_instance = PerformanceAnalytics()
    return _performance_analytics_instance

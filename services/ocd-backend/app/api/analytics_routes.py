"""
Analytics API Routes

Provides endpoints for performance analytics and accountability metrics.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.services.performance_analytics import (
    get_performance_analytics,
    PerformanceAnalytics,
    StrategyPerformance,
    ConfidenceCalibration,
    TimePeriodPerformance
)

router = APIRouter(prefix="/analytics", tags=["Performance Analytics"])


# ============================================================
# RESPONSE MODELS
# ============================================================

class OverallStatsResponse(BaseModel):
    period_days: int
    total_positions: int
    active_positions: int
    closed_positions: int
    total_pnl: float
    average_pnl: float
    win_count: int
    loss_count: int
    win_rate: float
    profit_factor: float


class StrategyPerformanceResponse(BaseModel):
    strategy_type: str
    total_recommendations: int
    tracked_count: int
    track_rate: float
    total_pnl: float
    avg_pnl: float
    win_count: int
    loss_count: int
    win_rate: float
    avg_predicted_pop: float
    actual_win_rate: float
    pop_accuracy: float
    avg_max_profit: float
    avg_max_loss: float
    profit_factor: float


class CalibrationResponse(BaseModel):
    confidence_bucket: str
    bucket_min: float
    bucket_max: float
    recommendation_count: int
    expected_win_rate: float
    actual_win_rate: float
    calibration_error: float


class TimeSeriesResponse(BaseModel):
    period: str
    recommendations: int
    tracked: int
    total_pnl: float
    win_rate: float
    avg_confidence: float


class TopStrategyResponse(BaseModel):
    strategy_type: str
    count: int
    total_pnl: float
    avg_pnl: float
    win_rate: float


class FullAnalyticsResponse(BaseModel):
    overall: OverallStatsResponse
    by_strategy: List[StrategyPerformanceResponse]
    time_series: List[TimeSeriesResponse]
    top_strategies: List[TopStrategyResponse]


# ============================================================
# DEPENDENCY
# ============================================================

def get_analytics() -> PerformanceAnalytics:
    return get_performance_analytics()


# Placeholder for user auth - replace with real auth
async def get_current_user_id() -> str:
    return "default_user"


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/overview", response_model=OverallStatsResponse)
async def get_overview(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    analytics: PerformanceAnalytics = Depends(get_analytics)
):
    """
    Get high-level performance statistics.
    
    Returns aggregate stats including total P&L, win rate, and position counts.
    """
    stats = await analytics.get_overall_stats(db, user_id=user_id, days_back=days)
    return OverallStatsResponse(**stats)


@router.get("/by-strategy", response_model=List[StrategyPerformanceResponse])
async def get_strategy_breakdown(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    analytics: PerformanceAnalytics = Depends(get_analytics)
):
    """
    Get performance breakdown by strategy type.
    
    Shows win rate, P&L, and track rate for each strategy.
    """
    breakdowns = await analytics.get_strategy_breakdown(db, user_id=user_id, days_back=days)
    return [StrategyPerformanceResponse(**b.to_dict()) for b in breakdowns]


@router.get("/calibration", response_model=List[CalibrationResponse])
async def get_confidence_calibration(
    bucket_size: float = Query(0.1, ge=0.05, le=0.25),
    db: AsyncSession = Depends(get_db),
    analytics: PerformanceAnalytics = Depends(get_analytics)
):
    """
    Analyze confidence calibration.
    
    Shows how well confidence scores predict actual outcomes.
    A well-calibrated system has low calibration error.
    """
    calibrations = await analytics.get_confidence_calibration(db, bucket_size=bucket_size)
    return [CalibrationResponse(**c.to_dict()) for c in calibrations]


@router.get("/time-series", response_model=List[TimeSeriesResponse])
async def get_time_series(
    granularity: str = Query("week", regex="^(week|month)$"),
    periods: int = Query(12, ge=4, le=52),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    analytics: PerformanceAnalytics = Depends(get_analytics)
):
    """
    Get performance over time periods.
    
    Useful for tracking improvement or degradation in strategy performance.
    """
    series = await analytics.get_time_series_performance(
        db, user_id=user_id, granularity=granularity, periods=periods
    )
    return [TimeSeriesResponse(**s.to_dict()) for s in series]


@router.get("/top-strategies", response_model=List[TopStrategyResponse])
async def get_top_strategies(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    analytics: PerformanceAnalytics = Depends(get_analytics)
):
    """
    Get best performing strategies by average P&L.
    
    Only includes strategies with at least 3 tracked positions.
    """
    strategies = await analytics.get_best_performing_strategies(db, limit=limit)
    return [TopStrategyResponse(**s) for s in strategies]


@router.get("/full", response_model=FullAnalyticsResponse)
async def get_full_analytics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    analytics: PerformanceAnalytics = Depends(get_analytics)
):
    """
    Get complete analytics dashboard data in one call.
    
    Combines overview, strategy breakdown, time series, and top strategies.
    """
    overall = await analytics.get_overall_stats(db, user_id=user_id, days_back=days)
    by_strategy = await analytics.get_strategy_breakdown(db, user_id=user_id, days_back=days)
    time_series = await analytics.get_time_series_performance(db, user_id=user_id)
    top_strategies = await analytics.get_best_performing_strategies(db)
    
    return FullAnalyticsResponse(
        overall=OverallStatsResponse(**overall),
        by_strategy=[StrategyPerformanceResponse(**b.to_dict()) for b in by_strategy],
        time_series=[TimeSeriesResponse(**s.to_dict()) for s in time_series],
        top_strategies=[TopStrategyResponse(**s) for s in top_strategies]
    )

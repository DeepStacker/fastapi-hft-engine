"""
Position Tracking API Routes

Endpoints for tracking strategy positions, getting alerts, and adjustments.
"""
import logging
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.models.strategy_position import (
    TrackedPosition, PositionAdjustment, PositionAlert as PositionAlertModel,
    RecommendationHistory, PositionStatus, AdjustmentType
)
from app.models.position_snapshot import PositionSnapshot
from app.services.adjustment_engine import get_adjustment_engine, AdjustmentEngine
from app.services.options import get_options_service, OptionsService
from app.services.coa_service import get_coa_service
from app.core.security import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/positions", tags=["Position Tracking"])


# ========================================
# REQUEST/RESPONSE SCHEMAS
# ========================================

class LegSchema(BaseModel):
    strike: float
    option_type: str  # CE or PE
    action: str  # BUY or SELL
    qty: int = 1
    lot_size: int = 1
    entry_price: float
    iv: Optional[float] = None


class CreatePositionRequest(BaseModel):
    """Request to track a new position."""
    strategy_type: str = Field(..., description="Strategy type (e.g., iron_condor)")
    symbol: str = Field(default="NIFTY")
    expiry: str = Field(...)
    legs: List[LegSchema]
    
    # Optional entry context
    entry_spot: Optional[float] = None
    entry_atm_iv: Optional[float] = None
    entry_pcr: Optional[float] = None
    
    # Optional metrics (can be calculated if not provided)
    entry_metrics: Optional[dict] = None
    market_context: Optional[dict] = None
    
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "strategy_type": "iron_condor",
                "symbol": "NIFTY",
                "expiry": "27-02-2025",
                "legs": [
                    {"strike": 23500, "option_type": "PE", "action": "SELL", "qty": 2, "lot_size": 75, "entry_price": 45.0},
                    {"strike": 23400, "option_type": "PE", "action": "BUY", "qty": 2, "lot_size": 75, "entry_price": 25.0},
                    {"strike": 23800, "option_type": "CE", "action": "SELL", "qty": 2, "lot_size": 75, "entry_price": 50.0},
                    {"strike": 23900, "option_type": "CE", "action": "BUY", "qty": 2, "lot_size": 75, "entry_price": 30.0}
                ],
                "entry_spot": 23650,
                "notes": "Weekly IC for range-bound market"
            }
        }


class UpdatePositionRequest(BaseModel):
    """Request to update a position."""
    status: Optional[str] = None
    current_pnl: Optional[float] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    exit_reason: Optional[str] = None


class PositionResponse(BaseModel):
    """Response for a single position."""
    id: str
    strategy_type: str
    symbol: str
    expiry: str
    legs: List[dict]
    status: str
    entry_spot: float
    entry_time: str
    entry_metrics: Optional[dict] = None
    current_pnl: float
    current_pnl_pct: float
    peak_pnl: float
    notes: Optional[str] = None
    tags: List[str] = []
    alerts_count: int = 0
    
    class Config:
        from_attributes = True


class PositionAnalysisResponse(BaseModel):
    """Response for position analysis."""
    position_id: str
    alerts: List[dict]
    adjustments: List[dict]
    current_metrics: dict
    risk_score: float


class AlertResponse(BaseModel):
    """Response for positions alerts."""
    id: str
    position_id: str
    alert_type: str
    severity: str
    message: str
    is_read: bool
    detected_at: str
    recommended_action: Optional[str] = None


# ========================================
# ENDPOINTS
# ========================================

@router.post("/", response_model=PositionResponse)
async def create_position(
    request: CreatePositionRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    options_service: OptionsService = Depends(get_options_service)
):
    """
    Create and track a new strategy position.
    
    Optionally fetches current market data if entry_spot not provided.
    """
    try:
        # Get current spot if not provided
        entry_spot = request.entry_spot
        entry_iv = request.entry_atm_iv
        entry_pcr = request.entry_pcr
        
        if not entry_spot:
            try:
                live_data = await options_service.get_live_data(
                    symbol=request.symbol,
                    expiry=request.expiry,
                    include_greeks=True
                )
                if live_data:
                    entry_spot = live_data.get("sltp", 0)
                    entry_iv = live_data.get("atmiv")
                    entry_pcr = live_data.get("pcr")
            except Exception as e:
                logger.warning(f"Could not fetch live data: {e}")
                entry_spot = 0
        
        # Convert legs to dict format
        legs_data = [leg.model_dump() for leg in request.legs]
        
        # Create position
        position = TrackedPosition(
            user_id=user_id,
            strategy_type=request.strategy_type,
            symbol=request.symbol,
            expiry=request.expiry,
            legs=legs_data,
            entry_spot=entry_spot or 0,
            entry_atm_iv=entry_iv,
            entry_pcr=entry_pcr,
            entry_context=request.market_context,
            entry_metrics=request.entry_metrics,
            notes=request.notes,
            tags=request.tags or [],
            status=PositionStatus.ACTIVE.value
        )
        
        db.add(position)
        await db.commit()
        await db.refresh(position)
        
        return PositionResponse(
            id=str(position.id),
            strategy_type=position.strategy_type,
            symbol=position.symbol,
            expiry=position.expiry,
            legs=position.legs,
            status=position.status,
            entry_spot=position.entry_spot,
            entry_time=position.entry_time.isoformat() if position.entry_time else "",
            entry_metrics=position.entry_metrics,
            current_pnl=position.current_pnl,
            current_pnl_pct=position.current_pnl_pct,
            peak_pnl=position.peak_pnl,
            notes=position.notes,
            tags=position.tags or []
        )
        
    except Exception as e:
        logger.exception("Failed to create position")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[PositionResponse])
async def list_positions(
    status: Optional[str] = Query(None, description="Filter by status"),
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """List all tracked positions for the current user."""
    try:
        query = select(TrackedPosition).where(
            TrackedPosition.user_id == user_id
        ).options(selectinload(TrackedPosition.alerts))
        
        if status:
            query = query.where(TrackedPosition.status == status)
        if symbol:
            query = query.where(TrackedPosition.symbol == symbol)
        
        query = query.order_by(TrackedPosition.created_at.desc())
        query = query.limit(limit).offset(offset)
        
        result = await db.execute(query)
        positions = result.scalars().all()
        
        return [
            PositionResponse(
                id=str(p.id),
                strategy_type=p.strategy_type,
                symbol=p.symbol,
                expiry=p.expiry,
                legs=p.legs,
                status=p.status,
                entry_spot=p.entry_spot,
                entry_time=p.entry_time.isoformat() if p.entry_time else "",
                entry_metrics=p.entry_metrics,
                current_pnl=p.current_pnl,
                current_pnl_pct=p.current_pnl_pct,
                peak_pnl=p.peak_pnl,
                notes=p.notes,
                tags=p.tags or [],
                alerts_count=len([a for a in p.alerts if not a.is_read])
            )
            for p in positions
        ]
        
    except Exception as e:
        logger.exception("Failed to list positions")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{position_id}", response_model=PositionResponse)
async def get_position(
    position_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get a single position by ID."""
    result = await db.execute(
        select(TrackedPosition)
        .where(TrackedPosition.id == position_id)
        .where(TrackedPosition.user_id == user_id)
        .options(selectinload(TrackedPosition.alerts))
    )
    position = result.scalar_one_or_none()
    
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    return PositionResponse(
        id=str(position.id),
        strategy_type=position.strategy_type,
        symbol=position.symbol,
        expiry=position.expiry,
        legs=position.legs,
        status=position.status,
        entry_spot=position.entry_spot,
        entry_time=position.entry_time.isoformat() if position.entry_time else "",
        entry_metrics=position.entry_metrics,
        current_pnl=position.current_pnl,
        current_pnl_pct=position.current_pnl_pct,
        peak_pnl=position.peak_pnl,
        notes=position.notes,
        tags=position.tags or [],
        alerts_count=len([a for a in position.alerts if not a.is_read])
    )


@router.patch("/{position_id}")
async def update_position(
    position_id: UUID,
    request: UpdatePositionRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Update a position (status, notes, P&L, etc.)."""
    result = await db.execute(
        select(TrackedPosition)
        .where(TrackedPosition.id == position_id)
        .where(TrackedPosition.user_id == user_id)
    )
    position = result.scalar_one_or_none()
    
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    # Update fields
    update_data = request.model_dump(exclude_unset=True)
    
    if "status" in update_data:
        update_data["status"] = PositionStatus(update_data["status"])
        if update_data["status"] == PositionStatus.CLOSED:
            update_data["exit_time"] = datetime.utcnow()
    
    for key, value in update_data.items():
        setattr(position, key, value)
    
    await db.commit()
    
    return {"success": True, "message": "Position updated"}


@router.delete("/{position_id}")
async def delete_position(
    position_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Delete a tracked position."""
    result = await db.execute(
        select(TrackedPosition)
        .where(TrackedPosition.id == position_id)
        .where(TrackedPosition.user_id == user_id)
    )
    position = result.scalar_one_or_none()
    
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    await db.delete(position)
    await db.commit()
    
    return {"success": True, "message": "Position deleted"}


@router.post("/{position_id}/analyze", response_model=PositionAnalysisResponse)
async def analyze_position(
    position_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    options_service: OptionsService = Depends(get_options_service),
    adjustment_engine: AdjustmentEngine = Depends(get_adjustment_engine)
):
    """
    Analyze a position for risk conditions and get adjustment suggestions.
    
    Fetches current market data and runs all checks.
    """
    # Get position
    result = await db.execute(
        select(TrackedPosition)
        .where(TrackedPosition.id == position_id)
        .where(TrackedPosition.user_id == user_id)
    )
    position = result.scalar_one_or_none()
    
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    # Get current market data
    live_data_available = False
    try:
        live_data = await options_service.get_live_data(
            symbol=position.symbol,
            expiry=position.expiry,
            include_greeks=True
        )
        current_spot = live_data.get("spot", {}).get("ltp") or live_data.get("sltp", 0)
        current_iv = live_data.get("atmiv", 0)
        
        # Check if we have valid live data (not stale/closed market)
        if current_spot > 0 and current_iv > 0:
            live_data_available = True
        else:
            # Market likely closed - use entry values
            current_spot = position.entry_spot
            current_iv = position.entry_atm_iv or 15
    except Exception as e:
        logger.warning(f"Could not fetch live data for analysis: {e}")
        current_spot = position.entry_spot
        current_iv = position.entry_atm_iv or 15
    
    # If market is closed and using entry values, return minimal analysis
    if not live_data_available:
        return PositionAnalysisResponse(
            position_id=str(position_id),
            alerts=[{
                "alert_type": "market_closed",
                "severity": "info",
                "message": "Market is closed. Analysis will be available when market opens.",
                "current_value": 0,
                "threshold_value": 0,
                "recommended_action": None
            }],
            adjustments=[],
            current_metrics={"market_status": "closed"},
            risk_score=0
        )
    
    # Run analysis with live data
    position_dict = {
        "id": str(position.id),
        "legs": position.legs,
        "entry_metrics": position.entry_metrics,
        "entry_spot": position.entry_spot,
        "entry_atm_iv": position.entry_atm_iv,
        "expiry": position.expiry,
        "current_pnl": position.current_pnl
    }
    
    analysis = adjustment_engine.analyze_position(
        position=position_dict,
        current_spot=current_spot,
        current_iv=current_iv,
        option_chain=live_data.get("oc", {})
    )
    
    # Update position with latest metrics
    current_metrics = analysis.get("current_metrics", {})
    if current_metrics:
        position.current_pnl = current_metrics.get("pnl", position.current_pnl)
        
        # Calculate PnL percentage
        max_profit = position.entry_metrics.get("max_profit", 0) if position.entry_metrics else 0
        if max_profit > 0:
            position.current_pnl_pct = (position.current_pnl / max_profit) * 100
        
        if max_profit > 0:
            position.current_pnl_pct = (position.current_pnl / max_profit) * 100
    
    # --- SANDBOX DATA CAPTURE ---
    # 1. Get Market Context (Pressure/Trend) via COA
    coa_service = get_coa_service()
    option_chain = live_data.get("oc", [])
    market_context = {}
    
    try:
        if option_chain:
            # Analyze market structure
            coa_result = coa_service.analyze(
                options=option_chain,
                spot_price=current_spot,
                atm_strike=position.entry_metrics.get("atm_strike", current_spot), # Use entry ATM if current not clear
                step_size=50 # Default NIFTY, should be dynamic
            )
            market_context = {
                "scenario_id": coa_result.get("scenario", {}).get("id"),
                "scenario_name": coa_result.get("scenario", {}).get("name"),
                "bias": coa_result.get("scenario", {}).get("bias"),
                "support_strength": coa_result.get("support", {}).get("strength"),
                "resistance_strength": coa_result.get("resistance", {}).get("strength"),
                "iv_percentile": 50 # Placeholder, should come from analytics
            }
    except Exception as e:
        logger.warning(f"Failed to capture market context: {e}")

    # 2. Create Position Snapshot
    snapshot = PositionSnapshot(
        position_id=position.id,
        spot_price=current_spot,
        atm_iv=current_iv,
        current_pnl=position.current_pnl,
        current_pnl_pct=position.current_pnl_pct,
        greeks={
            "delta": current_metrics.get("net_delta"),
            "gamma": current_metrics.get("net_gamma"),
            "theta": current_metrics.get("net_theta"),
            "vega": current_metrics.get("net_vega"),
        },
        metrics=current_metrics,
        market_context=market_context,
        adjustments_suggested=[a.get("adjustment_type") for a in analysis.get("adjustments", [])]
    )
    db.add(snapshot)
    
    # Only persist NEW critical/warning alerts (avoid duplicates)
    existing_alert_messages = set()
    existing_alerts = await db.execute(
        select(PositionAlertModel.message).where(
            PositionAlertModel.position_id == position.id,
            PositionAlertModel.is_dismissed == False
        )
    )
    for row in existing_alerts:
        existing_alert_messages.add(row[0])
    
    for alert_data in analysis.get("alerts", []):
        if alert_data.get("severity") in ["warning", "critical"]:
            if alert_data.get("message") not in existing_alert_messages:
                alert = PositionAlertModel(
                    position_id=position.id,
                    alert_type=alert_data.get("alert_type"),
                    severity=alert_data.get("severity"),
                    message=alert_data.get("message"),
                    recommended_action=alert_data.get("recommended_action"),
                    market_snapshot={
                        "spot": current_spot,
                        "iv": current_iv
                    }
                )
                db.add(alert)
    
    await db.commit()
    
    return PositionAnalysisResponse(
        position_id=str(position_id),
        alerts=analysis.get("alerts", []),
        adjustments=analysis.get("adjustments", []),
        current_metrics=analysis.get("current_metrics", {}),
        risk_score=analysis.get("risk_score", 0)
    )


@router.get("/{position_id}/alerts", response_model=List[AlertResponse])
async def get_position_alerts(
    position_id: UUID,
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get alerts for a specific position."""
    # Verify ownership
    result = await db.execute(
        select(TrackedPosition)
        .where(TrackedPosition.id == position_id)
        .where(TrackedPosition.user_id == user_id)
    )
    position = result.scalar_one_or_none()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    # Get alerts
    query = select(PositionAlertModel).where(
        PositionAlertModel.position_id == position_id
    )
    if unread_only:
        query = query.where(PositionAlertModel.is_read == False)
    
    query = query.order_by(PositionAlertModel.created_at.desc())
    
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    return [
        AlertResponse(
            id=str(a.id),
            position_id=str(a.position_id),
            alert_type=a.alert_type,
            severity=a.severity,
            message=a.message,
            is_read=a.is_read,
            detected_at=a.detected_at.isoformat() if a.detected_at else "",
            recommended_action=a.recommended_action
        )
        for a in alerts
    ]


@router.post("/{position_id}/alerts/mark-read")
async def mark_alerts_read(
    position_id: UUID,
    alert_ids: Optional[List[str]] = None,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Mark alerts as read."""
    # Verify ownership
    result = await db.execute(
        select(TrackedPosition)
        .where(TrackedPosition.id == position_id)
        .where(TrackedPosition.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Position not found")
    
    # Mark alerts
    query = update(PositionAlertModel).where(
        PositionAlertModel.position_id == position_id
    )
    if alert_ids:
        query = query.where(PositionAlertModel.id.in_([UUID(aid) for aid in alert_ids]))
    
    query = query.values(is_read=True)
    await db.execute(query)
    await db.commit()
    
    return {"success": True}


@router.get("/alerts/all", response_model=List[AlertResponse])
async def get_all_alerts(
    unread_only: bool = Query(True),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get all alerts across all positions for the user."""
    # Subquery to get user's position IDs
    position_ids = select(TrackedPosition.id).where(
        TrackedPosition.user_id == user_id
    )
    
    query = select(PositionAlertModel).where(
        PositionAlertModel.position_id.in_(position_ids)
    )
    
    if unread_only:
        query = query.where(PositionAlertModel.is_read == False)
    
    query = query.order_by(PositionAlertModel.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    return [
        AlertResponse(
            id=str(a.id),
            position_id=str(a.position_id),
            alert_type=a.alert_type,
            severity=a.severity,
            message=a.message,
            is_read=a.is_read,
            detected_at=a.detected_at.isoformat() if a.detected_at else "",
            recommended_action=a.recommended_action
        )
        for a in alerts
    ]

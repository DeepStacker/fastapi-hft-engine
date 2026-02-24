"""
Strategy Position Models

Database models for tracking recommended strategy structures,
their current status, and adjustment history.
"""
import uuid
from datetime import datetime
from typing import List, Optional
from enum import Enum

from sqlalchemy import (
    Column, String, Float, Integer, Boolean, 
    DateTime, ForeignKey, Text, Enum as SQLEnum, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from core.database.db import Base
from app.models.base import TimestampMixin


class PositionStatus(str, Enum):
    """Status of a tracked position."""
    RECOMMENDED = "recommended"  # Just recommended, not yet tracked
    ACTIVE = "active"            # User is actively tracking
    ADJUSTED = "adjusted"        # Position has been modified
    CLOSED = "closed"            # Position is closed
    EXPIRED = "expired"          # Position expired worthless


class AdjustmentType(str, Enum):
    """Type of position adjustment."""
    ROLL_UP = "roll_up"
    ROLL_DOWN = "roll_down"
    ROLL_OUT = "roll_out"
    ADD_HEDGE = "add_hedge"
    CLOSE_PARTIAL = "close_partial"
    CLOSE_FULL = "close_full"
    CONVERT = "convert"  # Convert to different structure
    MANUAL = "manual"


class TrackedPosition(Base, TimestampMixin):
    """
    A tracked options strategy position.
    
    Stores the full structure (legs), entry conditions,
    current P&L tracking, and status.
    """
    __tablename__ = "tracked_positions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # User who is tracking this position
    user_id = Column(String(128), nullable=False, index=True)
    
    # Strategy metadata
    strategy_type = Column(String(50), nullable=False)  # iron_condor, bull_put_spread, etc.
    symbol = Column(String(20), nullable=False, index=True)
    expiry = Column(String(20), nullable=False)
    
    # The legs as JSON (list of leg objects)
    # Each leg: {strike, option_type, action, qty, lot_size, entry_price, iv}
    legs = Column(JSONB, nullable=False)
    
    # Entry conditions snapshot
    entry_spot = Column(Float, nullable=False)
    entry_atm_iv = Column(Float, nullable=True)
    entry_pcr = Column(Float, nullable=True)
    entry_time = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Market context at entry
    entry_context = Column(JSONB, nullable=True)
    
    # Calculated metrics at entry
    entry_metrics = Column(JSONB, nullable=True)
    # {max_profit, max_loss, pop, breakevens, net_delta, net_theta, ...}
    
    # Current tracking
    status = Column(String(20), default=PositionStatus.ACTIVE.value, nullable=False)
    current_pnl = Column(Float, default=0.0)
    current_pnl_pct = Column(Float, default=0.0)
    peak_pnl = Column(Float, default=0.0)  # High water mark
    drawdown_pnl = Column(Float, default=0.0)  # Max drawdown from peak
    
    # Exit conditions (if closed)
    exit_spot = Column(Float, nullable=True)
    exit_time = Column(DateTime(timezone=True), nullable=True)
    exit_reason = Column(String(100), nullable=True)  # profit_target, stop_loss, adjustment, manual
    final_pnl = Column(Float, nullable=True)
    
    # User notes
    notes = Column(Text, nullable=True)
    
    # Tags for filtering
    tags = Column(JSONB, default=list)
    
    # Relationships
    adjustments = relationship(
        "PositionAdjustment", 
        back_populates="position",
        cascade="all, delete-orphan",
        order_by="PositionAdjustment.created_at.desc()"
    )
    
    alerts = relationship(
        "PositionAlert",
        back_populates="position",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<TrackedPosition {self.strategy_type} {self.symbol} {self.expiry}>"
    
    @property
    def net_premium(self) -> float:
        """Calculate net premium from legs."""
        total = 0.0
        for leg in self.legs or []:
            qty = leg.get("qty", 1) * leg.get("lot_size", 1)
            price = leg.get("entry_price", 0)
            if leg.get("action") == "SELL":
                total += price * qty
            else:
                total -= price * qty
        return total


class PositionAdjustment(Base, TimestampMixin):
    """
    Record of an adjustment made to a position.
    
    Tracks what was changed, why, and the new leg configuration.
    """
    __tablename__ = "position_adjustments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id = Column(UUID(as_uuid=True), ForeignKey("tracked_positions.id"), nullable=False)
    
    adjustment_type = Column(SQLEnum(AdjustmentType), nullable=False)
    
    # What triggered this adjustment
    trigger_reason = Column(String(200), nullable=False)
    # e.g., "Delta drift > 0.15", "Short leg tested", "IV spike > 20%"
    
    # Spot at time of adjustment
    spot_at_adjustment = Column(Float, nullable=False)
    
    # The old legs (snapshot before adjustment)
    old_legs = Column(JSONB, nullable=False)
    
    # The new legs (after adjustment)
    new_legs = Column(JSONB, nullable=False)
    
    # Cost/credit of the adjustment
    adjustment_cost = Column(Float, default=0.0)  # Negative = received credit
    
    # P&L realized from closed legs
    realized_pnl = Column(Float, default=0.0)
    
    # Whether this was a system recommendation or manual
    is_system_recommended = Column(Boolean, default=True)
    
    # User who executed the adjustment
    executed_by = Column(String(128), nullable=True)
    
    # Relationship
    position = relationship("TrackedPosition", back_populates="adjustments")
    
    def __repr__(self):
        return f"<PositionAdjustment {self.adjustment_type.value} for {self.position_id}>"


class PositionAlert(Base, TimestampMixin):
    """
    Alerts generated for a tracked position.
    
    The adjustment engine creates these when conditions warrant attention.
    """
    __tablename__ = "position_alerts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id = Column(UUID(as_uuid=True), ForeignKey("tracked_positions.id"), nullable=False)
    
    # Alert classification
    alert_type = Column(String(50), nullable=False)
    # Types: delta_drift, gamma_risk, theta_decay, iv_spike, leg_tested, profit_target, stop_loss
    
    severity = Column(String(20), default="info")  # info, warning, critical
    
    # Alert message
    message = Column(Text, nullable=False)
    
    # Recommended action (if any)
    recommended_action = Column(String(200), nullable=True)
    suggested_adjustment = Column(JSONB, nullable=True)
    
    # Status
    is_read = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    
    # When alert condition was detected
    detected_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Market snapshot when alert was created
    market_snapshot = Column(JSONB, nullable=True)
    # {spot, atm_iv, position_greeks, ...}
    
    # Relationship
    position = relationship("TrackedPosition", back_populates="alerts")
    
    def __repr__(self):
        return f"<PositionAlert {self.alert_type} for {self.position_id}>"


class RecommendationHistory(Base, TimestampMixin):
    """
    Track all strategy recommendations for accountability.
    
    Even if user doesn't track, we log what was recommended
    to measure system performance over time.
    """
    __tablename__ = "recommendation_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # What was recommended
    strategy_type = Column(String(50), nullable=False)
    symbol = Column(String(20), nullable=False)
    expiry = Column(String(20), nullable=False)
    
    # The recommended legs
    legs = Column(JSONB, nullable=False)
    
    # Metrics at recommendation time
    metrics = Column(JSONB, nullable=False)
    
    # Market context
    market_context = Column(JSONB, nullable=False)
    
    # Confidence score
    confidence = Column(Float, nullable=False)
    
    # User action
    user_action = Column(String(20), default="ignored")
    # Values: ignored, tracked, modified, rejected
    
    # If tracked, link to position
    tracked_position_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Outcome (filled later if tracked)
    outcome_pnl = Column(Float, nullable=True)
    outcome_pop_actual = Column(Boolean, nullable=True)  # Did it profit?
    
    def __repr__(self):
        return f"<RecommendationHistory {self.strategy_type} {self.symbol}>"

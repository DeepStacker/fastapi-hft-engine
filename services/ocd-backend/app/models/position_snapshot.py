"""
Position Snapshot Model

Records the exact state of a position and the market at a point in time.
This "Sandbox" data enables:
1. Replay and backtesting of adjustment logic
2. Analysis of strategy performance vs market conditions
3. Feedback loop for intelligent recommendations
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from core.database.db import Base
from app.models.base import TimestampMixin

class PositionSnapshot(Base, TimestampMixin):
    """
    Time-series snapshot of a tracked position.
    
    Captured every time the analysis engine runs.
    """
    __tablename__ = "position_snapshots"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id = Column(UUID(as_uuid=True), ForeignKey("tracked_positions.id"), nullable=False, index=True)
    
    # When this snapshot was taken
    snapshot_time = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    
    # Market State
    spot_price = Column(Float, nullable=False)
    atm_iv = Column(Float, nullable=True)
    
    # Position State
    current_pnl = Column(Float, default=0.0)
    current_pnl_pct = Column(Float, default=0.0)
    
    # Detailed Greeks (Net Delta, Gamma, Theta, Vega)
    greeks = Column(JSONB, nullable=True) 
    # Example: {"delta": 0.15, "gamma": 0.02, "theta": -500, "vega": 1200}
    
    # Analysis Metrics
    metrics = Column(JSONB, nullable=True)
    # Example: {"pop": 65.5, "max_profit": 5000, "risk_score": 7.2}
    
    # Market Context (Pressure, Sentiment)
    market_context = Column(JSONB, nullable=True)
    # Example: {"pressure": "Bullish", "iv_percentile": 75, "coa_scenario": "1.2"}
    
    # Engine Output
    adjustments_suggested = Column(JSONB, nullable=True)
    # List of adjustments suggested at this timestamp
    
    # Relationship
    position = relationship("TrackedPosition", backref="snapshots")
    
    def __repr__(self):
        return f"<PositionSnapshot {self.position_id} @ {self.snapshot_time}>"

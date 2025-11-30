"""
Analytics Database Models

Time-series tables for post-storage stateful analysis.
Optimized for charting and historical queries.

Focus: Every metric should be chartable over time
- OI change development
- Velocity evolution  
- Greeks changes
- Pattern occurrences
"""

from sqlalchemy import Column, Integer, BigInteger, Numeric, String, DateTime, Date, Boolean, JSON, Index
from core.database.models import Base
from datetime import datetime


class AnalyticsCumulativeOI(Base):
    """
    Cumulative OI metrics since market open.
    
    Charting Use Cases:
    - OI buildup over session
    - Call vs Put accumulation charts
    - Strike-wise OI development
    - Session high/low bands
    """
    __tablename__ = 'analytics_cumulative_oi'
    
    # Primary key
    timestamp = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    symbol_id = Column(Integer, primary_key=True, nullable=False)
    strike_price = Column(Numeric(10, 2), primary_key=True, nullable=False)
    option_type = Column(String(2), primary_key=True, nullable=False)  # CE/PE
    expiry = Column(Date, nullable=False, index=True)
    
    # Cumulative metrics (chartable!)
    current_oi = Column(BigInteger, nullable=False)
    opening_oi = Column(BigInteger)
    cumulative_oi_change = Column(BigInteger)  # Chart: OI buildup since open
    cumulative_volume = Column(BigInteger)
    
    # Session extremes (for bands)
    session_high_oi = Column(BigInteger)
    session_low_oi = Column(BigInteger)
    
    # Percentage changes (for normalized charts)
    oi_change_pct = Column(Numeric(10, 4))
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        # Composite indexes for common query patterns
        Index('idx_cumoi_symbol_expiry_time', 'symbol_id', 'expiry', 'timestamp'),
        Index('idx_cumoi_strike_type_time', 'strike_price', 'option_type', 'timestamp'),
        Index('idx_cumoi_time_only', 'timestamp'),  # For time-range scans
    )


class AnalyticsVelocity(Base):
    """
    Rate of change metrics (velocity).
    
    Charting Use Cases:
    - OI velocity trending (momentum charts)
    - Volume spike detection timeline
    - Price velocity tracking
    - Acceleration/deceleration patterns
    """
    __tablename__ = 'analytics_velocity'
    
    # Primary key
    timestamp = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    symbol_id = Column(Integer, primary_key=True, nullable=False)
    strike_price = Column(Numeric(10, 2), primary_key=True, nullable=False)
    option_type = Column(String(2), primary_key=True, nullable=False)
    expiry = Column(Date, nullable=False, index=True)
    
    # Velocity metrics (per minute) - CHARTABLE!
    oi_velocity = Column(Numeric(15, 2))  # Chart: Momentum over time
    volume_velocity = Column(Numeric(15, 2))
    price_velocity = Column(Numeric(10, 4))
    
    # Derived metrics
    oi_acceleration = Column(Numeric(15, 4))  # Change in velocity
    is_spike = Column(Boolean, default=False)  # Highlight on charts
    spike_magnitude = Column(Numeric(10, 2))  # For coloring intensity
    
    # Time delta for calculation
    time_delta_seconds = Column(Integer)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_velocity_symbol_expiry_time', 'symbol_id', 'expiry', 'timestamp'),
        Index('idx_velocity_spikes', 'is_spike', 'timestamp'),  # Find all spikes
    )


class AnalyticsZones(Base):
    """
    Support/Resistance and special zones.
    
    Charting Use Cases:
    - Zone evolution over time
    - Max pain migration charts
    - Support/resistance level changes
    - Zone strength visualization
    """
    __tablename__ = 'analytics_zones'
    
    # Primary key
    timestamp = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    symbol_id = Column(Integer, primary_key=True, nullable=False)
    expiry = Column(Date, primary_key=True, nullable=False)
    zone_type = Column(String(20), primary_key=True, nullable=False)  # support/resistance/max_pain
    strike_price = Column(Numeric(10, 2), primary_key=True, nullable=False)
    
    # Zone characteristics
    strength = Column(Numeric(5, 2))  # 0-100 confidence score
    oi_concentration = Column(BigInteger)  # Total OI at this level
    
    # Zone boundaries (for visualization)
    upper_bound = Column(Numeric(10, 2))
    lower_bound = Column(Numeric(10, 2))
    
    # Change tracking
    zone_age_minutes = Column(Integer)  # How long this zone existed
    is_new = Column(Boolean, default=True)
    is_broken = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_zones_symbol_expiry_type', 'symbol_id', 'expiry', 'zone_type', 'timestamp'),
        Index('idx_zones_active', 'is_broken', 'timestamp'),  # Active zones only
    )


class AnalyticsPatterns(Base):
    """
    Detected patterns and trading signals.
    
    Charting Use Cases:
    - Pattern occurrence timeline
    - Success rate tracking
    - Signal strength evolution
    - Opportunity markers on charts
    """
    __tablename__ = 'analytics_patterns'
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    symbol_id = Column(Integer, nullable=False, index=True)
    expiry = Column(Date, nullable=False, index=True)
    
    # Pattern identification
    pattern_type = Column(String(50), nullable=False, index=True)  # unusual_oi, reversal, etc.
    confidence = Column(Numeric(5, 2))  # 0-100 score
    
    # Pattern details (flexible JSON)
    metadata_ = Column(JSON)  # Pattern-specific data
    
    # Trading implications
    signal_type = Column(String(20))  # buy/sell/neutral/scalp
    signal_strength = Column(Numeric(5, 2))  # For filtering
    
    # Strike context
    strikes_involved = Column(JSON)  # List of strikes
    price_level = Column(Numeric(10, 2))  # Spot price when detected
    
    # Outcome tracking (for backtesting)
    is_confirmed = Column(Boolean, default=False)
    outcome_profit_pct = Column(Numeric(10, 4))  # For ML training
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_patterns_symbol_type_time', 'symbol_id', 'pattern_type', 'timestamp'),
        Index('idx_patterns_signal_time', 'signal_type', 'timestamp'),
    )


class AnalyticsGreeksTimeline(Base):
    """
    Greeks evolution over time (NEW!).
    
    Charting Use Cases:
    - Delta/Gamma flip detection
    - Theta decay visualization
    - Vega changes with volatility
    - Greeks correlation analysis
    """
    __tablename__ = 'analytics_greeks_timeline'
    
    # Primary key
    timestamp = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    symbol_id = Column(Integer, primary_key=True, nullable=False)
    strike_price = Column(Numeric(10, 2), primary_key=True, nullable=False)
    option_type = Column(String(2), primary_key=True, nullable=False)
    expiry = Column(Date, nullable=False, index=True)
    
    # Greeks snapshots
    delta = Column(Numeric(10, 6))
    gamma = Column(Numeric(10, 8))
    theta = Column(Numeric(10, 6))
    vega = Column(Numeric(10, 6))
    rho = Column(Numeric(10, 6))
    
    # Greeks changes (for velocity charts)
    delta_change = Column(Numeric(10, 6))
    gamma_change = Column(Numeric(10, 8))
    
    # Special events
    delta_flip = Column(Boolean, default=False)  # Crossed 0.5
    gamma_peak = Column(Boolean, default=False)  # Local maximum
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_greeks_symbol_strike_time', 'symbol_id', 'strike_price', 'timestamp'),
        Index('idx_greeks_flips', 'delta_flip', 'timestamp'),
    )


class AnalyticsOIDistribution(Base):
    """
    OI distribution snapshots for heatmap visualization.
    
    Charting Use Cases:
    - OI heatmap over time
    - Strike concentration animation
    - Call-Put distribution evolution
    - ATM OI tracking
    """
    __tablename__ = 'analytics_oi_distribution'
    
    # Primary key
    timestamp = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    symbol_id = Column(Integer, primary_key=True, nullable=False)
    expiry = Column(Date, primary_key=True, nullable=False)
    
    # Distribution summary
    total_call_oi = Column(BigInteger)
    total_put_oi = Column(BigInteger)
    pcr_oi = Column(Numeric(10, 4))
    
    # ATM metrics
    atm_strike = Column(Numeric(10, 2))
    atm_call_oi = Column(BigInteger)
    atm_put_oi = Column(BigInteger)
    
    # Concentration metrics
    max_call_oi_strike = Column(Numeric(10, 2))
    max_call_oi = Column(BigInteger)
    max_put_oi_strike = Column(Numeric(10, 2))
    max_put_oi = Column(BigInteger)
    
    # Distribution (JSON for flexibility)
    strike_wise_distribution = Column(JSON)  # Full distribution map
    
    # Metadata
    spot_price = Column(Numeric(10, 2))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_oi_dist_symbol_expiry_time', 'symbol_id', 'expiry', 'timestamp'),
    )


class AnalyticsOpportunities(Base):
    """
    Trading opportunities detected by the system.
    
    Charting Use Cases:
    - Opportunity timeline
    - Success rate tracking
    - Risk-reward visualization
    - Entry/exit level markers
    """
    __tablename__ = 'analytics_opportunities'
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    symbol_id = Column(Integer, nullable=False, index=True)
    expiry = Column(Date, nullable=False)
    
    # Opportunity details
    opportunity_type = Column(String(30), nullable=False)  # scalp/swing/hedge/spread
    strategy = Column(String(50))  # straddle/strangle/vertical/etc
    
    # Entry details
    entry_strikes = Column(JSON)  # List of strikes to trade
    entry_price = Column(Numeric(10, 2))
    spot_at_entry = Column(Numeric(10, 2))
    
    # Risk-reward
    max_profit = Column(Numeric(12, 2))
    max_loss = Column(Numeric(12, 2))
    risk_reward_ratio = Column(Numeric(6, 2))
    
    # Targets
    target_price = Column(Numeric(10, 2))
    stop_loss = Column(Numeric(10, 2))
    
    # Confidence
    confidence_score = Column(Numeric(5, 2))  # 0-100
    time_horizon_minutes = Column(Integer)  # Expected duration
    
    # Outcome (for backtesting)
    is_active = Column(Boolean, default=True)
    exit_timestamp = Column(DateTime)
    exit_price = Column(Numeric(10, 2))
    actual_profit_loss = Column(Numeric(12, 2))
    outcome_type = Column(String(20))  # target_hit/stop_loss/expired
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_opp_symbol_type_time', 'symbol_id', 'opportunity_type', 'timestamp'),
        Index('idx_opp_active', 'is_active', 'timestamp'),
    )


# TimescaleDB specific SQL (to run after model creation)
TIMESCALE_SETUP_SQL = """
-- Convert to hypertables (time-series optimization)
SELECT create_hypertable('analytics_cumulative_oi', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('analytics_velocity', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('analytics_zones', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('analytics_greeks_timeline', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('analytics_oi_distribution', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE);

-- Continuous aggregates for charting (pre-computed rollups)
CREATE MATERIALIZED VIEW analytics_cumoi_5min
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('5 minutes', timestamp) AS bucket,
    symbol_id,
    strike_price,
    option_type,
    expiry,
    AVG(cumulative_oi_change) as avg_oi_change,
    MAX(cumulative_oi_change) as max_oi_change,
    MIN(cumulative_oi_change) as min_oi_change,
    AVG(oi_change_pct) as avg_oi_change_pct
FROM analytics_cumulative_oi
GROUP BY bucket, symbol_id, strike_price, option_type, expiry;

CREATE MATERIALIZED VIEW analytics_velocity_5min
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('5 minutes', timestamp) AS bucket,
    symbol_id,
    strike_price,
    option_type,
    expiry,
    AVG(oi_velocity) as avg_oi_velocity,
    MAX(oi_velocity) as max_oi_velocity,
    COUNT(*) FILTER (WHERE is_spike) as spike_count
FROM analytics_velocity
GROUP BY bucket, symbol_id, strike_price, option_type, expiry;

-- Retention policies (auto-delete old raw data, keep aggregates)
SELECT add_retention_policy('analytics_cumulative_oi', INTERVAL '30 days');
SELECT add_retention_policy('analytics_velocity', INTERVAL '30 days');

-- Compression (save 90% storage on old data)
ALTER TABLE analytics_cumulative_oi SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol_id, strike_price, option_type'
);

SELECT add_compression_policy('analytics_cumulative_oi', INTERVAL '7 days');
"""

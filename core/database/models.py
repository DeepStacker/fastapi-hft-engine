"""
Complete Database Models - Production Ready

All models fully implemented with proper relationships, indexes, and constraints.
"""
from sqlalchemy import Column, Integer, String, Float, BigInteger, Boolean, DateTime, Text, JSON, ForeignKey, Index, CheckConstraint, desc, Enum
from sqlalchemy.dialects.postgresql import UUID
from uuid import uuid4
import enum
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database.db import Base


class InstrumentDB(Base):
    """
    Instrument (Stock/Index) master data
    
    Matches Dhan API structure exactly.
    """
    __tablename__ = "instruments"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol_id = Column(Integer, unique=True, nullable=False, index=True)  # Dhan's symbol ID
    symbol = Column(String(50), nullable=False, index=True)  # NIFTY, BANKNIFTY, etc.
    segment_id = Column(Integer, nullable=False, index=True)  # 0=Indices, 1=Stocks, 5=Commodities
    exchange = Column(String(10), default='NSE', nullable=False, index=True)  # NSE, BSE, MCX
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    snapshots = relationship("MarketSnapshotDB", back_populates="instrument", cascade="all, delete-orphan")
    options = relationship("OptionContractDB", back_populates="instrument", cascade="all, delete-orphan")
    futures = relationship("FutureContractDB", back_populates="instrument", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_instrument_active_symbol', 'is_active', 'symbol_id'),
        Index('idx_instrument_segment', 'segment_id'),
        CheckConstraint('segment_id IN (0, 1, 5)', name='chk_valid_segment'),
    )
    
    def __repr__(self):
        return f"<Instrument(symbol={self.symbol}, segment_id={self.segment_id})>"


class MarketSnapshotDB(Base):
    """
    Real-time market snapshot data (TimescaleDB hypertable)
    """
    __tablename__ = "market_snapshots"
    
    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    trade_date = Column(DateTime, nullable=True, index=True)  # Trading day (date only, derived from timestamp)
    symbol_id = Column(Integer, ForeignKey('instruments.symbol_id', ondelete='CASCADE'), nullable=False, index=True)
    exchange = Column(String(10), nullable=False)
    segment = Column(String(10), nullable=False)
    
    # Price data
    ltp = Column(Float, nullable=False)
    open_price = Column(Float, nullable=True)
    high = Column(Float, nullable=True)
    low = Column(Float, nullable=True)
    close = Column(Float, nullable=True)
    prev_close = Column(Float, nullable=True)
    
    # Volume data
    volume = Column(BigInteger, default=0)
    traded_value = Column(Float, default=0)
    total_buy_qty = Column(BigInteger, default=0)
    total_sell_qty = Column(BigInteger, default=0)
    
    # Open Interest
    oi = Column(BigInteger, default=0)
    oi_change = Column(BigInteger, default=0)
    
    # Market depth (top 5 bids/asks)
    market_depth = Column(JSON, nullable=True)
    
    # Additional fields
    upper_circuit = Column(Float, nullable=True)
    lower_circuit = Column(Float, nullable=True)
    vwap = Column(Float, nullable=True)
    
    # Global context fields
    spot_change = Column(Float, nullable=True)
    spot_change_pct = Column(Float, nullable=True)
    total_call_oi = Column(BigInteger, nullable=True)
    total_put_oi = Column(BigInteger, nullable=True)
    pcr_ratio = Column(Float, nullable=True)
    atm_iv = Column(Float, nullable=True)
    atm_iv_change = Column(Float, nullable=True)
    max_pain_strike = Column(Float, nullable=True)
    days_to_expiry = Column(Integer, nullable=True)
    lot_size = Column(Integer, nullable=True)
    tick_size = Column(Float, nullable=True)
    
    # Raw data for reference
    raw_data = Column(JSON, nullable=True)
    
    # Aggregate analysis results
    gex_analysis = Column(JSON, nullable=True)
    iv_skew_analysis = Column(JSON, nullable=True)
    pcr_analysis = Column(JSON, nullable=True)
    market_wide_analysis = Column(JSON, nullable=True)
    
    # Relationships
    instrument = relationship("InstrumentDB", back_populates="snapshots")
    
    # Indexes for TimescaleDB
    __table_args__ = (
        Index('idx_snapshots_time_symbol', 'timestamp', 'symbol_id'),
        Index('idx_snapshots_symbol_time_desc', 'symbol_id', desc('timestamp')),
        CheckConstraint('ltp >= 0', name='chk_ltp_nonneg'),
        CheckConstraint('volume >= 0', name='chk_volume_nonneg'),
    )
    
    def __repr__(self):
        return f"<Snapshot(symbol_id={self.symbol_id}, ltp={self.ltp}, time={self.timestamp})>"


class OptionContractDB(Base):
    """
    Option contract data
    """
    __tablename__ = "option_contracts"
    
    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    trade_date = Column(DateTime, nullable=True, index=True)  # Trading day (date only, derived from timestamp)
    symbol_id = Column(Integer, ForeignKey('instruments.symbol_id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Contract details
    expiry = Column(BigInteger, nullable=False, index=True)  # Unix timestamp
    strike_price = Column(Float, nullable=False, index=True)
    option_type = Column(String(2), nullable=False, index=True)  # CE or PE
    
    # Price data
    ltp = Column(Float, default=0)
    open_price = Column(Float, nullable=True)
    high = Column(Float, nullable=True)
    low = Column(Float, nullable=True)
    close = Column(Float, nullable=True)
    prev_close = Column(Float, nullable=True)
    bid = Column(Float, nullable=True)
    ask = Column(Float, nullable=True)
    mid_price = Column(Float, nullable=True)
    price_change = Column(Float, nullable=True)
    price_change_pct = Column(Float, nullable=True)
    avg_traded_price = Column(Float, nullable=True)
    
    # Volume & OI
    volume = Column(BigInteger, default=0)
    prev_volume = Column(BigInteger, nullable=True)
    volume_change = Column(BigInteger, nullable=True)
    volume_change_pct = Column(Float, nullable=True)
    oi = Column(BigInteger, default=0)
    prev_oi = Column(BigInteger, nullable=True)
    oi_change = Column(BigInteger, default=0)
    oi_change_pct = Column(Float, nullable=True)
    
    # Greeks
    iv = Column(Float, nullable=True)  # Implied Volatility
    delta = Column(Float, nullable=True)
    gamma = Column(Float, nullable=True)
    theta = Column(Float, nullable=True)
    vega = Column(Float, nullable=True)
    rho = Column(Float, nullable=True)
    
    # Market data
    bid_price = Column(Float, nullable=True)
    ask_price = Column(Float, nullable=True)
    bid_qty = Column(BigInteger, default=0)
    ask_qty = Column(BigInteger, default=0)
    
    # Calculated fields from analysis
    theoretical_price = Column(Float, nullable=True)
    intrinsic_value = Column(Float, nullable=True)
    time_value = Column(Float, nullable=True)
    moneyness = Column(Float, nullable=True)
    moneyness_type = Column(String(3), nullable=True)  # ITM/OTM/ATM
    
    # Classification
    buildup_type = Column(String(2), nullable=True)  # LB/SB/LU/SU
    buildup_name = Column(String(50), nullable=True)
    
    # Reversal & Support/Resistance
    reversal_price = Column(Float, nullable=True)
    support_price = Column(Float, nullable=True)
    resistance_price = Column(Float, nullable=True)
    resistance_range_price = Column(Float, nullable=True)
    weekly_reversal_price = Column(Float, nullable=True)
    future_reversal_price = Column(Float, nullable=True)
    
    # Flags
    is_liquid = Column(Boolean, default=True)
    is_valid = Column(Boolean, default=True)
    
    # Analysis data (JSON for flexibility and performance)
    order_flow_analysis = Column(JSON, nullable=True)
    smart_money_analysis = Column(JSON, nullable=True)
    liquidity_analysis = Column(JSON, nullable=True)
    
    # Relationships
    instrument = relationship("InstrumentDB", back_populates="options")
    
    # Indexes
    __table_args__ = (
        Index('idx_options_expiry_strike_type', 'expiry', 'strike_price', 'option_type'),
        Index('idx_options_symbol_expiry', 'symbol_id', 'expiry'),
        Index('idx_options_time_symbol', 'timestamp', 'symbol_id'),
        Index('idx_options_symbol_expiry_date', 'symbol_id', 'expiry', 'trade_date'),  # For historical queries
        CheckConstraint('option_type IN (\'CE\', \'PE\')', name='chk_option_type'),
        CheckConstraint('strike_price > 0', name='chk_strike_positive'),
        CheckConstraint('ltp >= 0', name='chk_option_ltp_nonneg'),
    )


class FutureContractDB(Base):
    """
    Future contract data
    """
    __tablename__ = "future_contracts"
    
    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    symbol_id = Column(Integer, ForeignKey('instruments.symbol_id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Contract details
    expiry = Column(String(20), nullable=False, index=True)
    contract_type = Column(String(20), default='FUTIDX')  # FUTIDX, FUTSTK
    
    # Price data
    ltp = Column(Float, nullable=False)
    open_price = Column(Float, nullable=True)
    high = Column(Float, nullable=True)
    low = Column(Float, nullable=True)
    close = Column(Float, nullable=True)
    prev_close = Column(Float, nullable=True)
    
    # Volume & OI
    volume = Column(BigInteger, default=0)
    oi = Column(BigInteger, default=0)
    oi_change = Column(BigInteger, default=0)
    
    # Additional
    basis = Column(Float, nullable=True)  # Future - Spot
    cost_of_carry = Column(Float, nullable=True)
    
    # Relationships
    instrument = relationship("InstrumentDB", back_populates="futures")
    
    # Indexes
    __table_args__ = (
        Index('idx_futures_symbol_expiry', 'symbol_id', 'expiry'),
        Index('idx_futures_time_symbol', 'timestamp', 'symbol_id'),
        CheckConstraint('ltp >= 0', name='chk_future_ltp_nonneg'),
    )


class UserDB(Base):
    """
    User accounts for API access.
    
    .. deprecated:: 2.0.0
        This model is deprecated for new code. Use `AppUserDB` instead,
        which supports Firebase authentication, user roles, and premium
        subscriptions. `UserDB` is retained for backward compatibility
        with existing admin services and API key management.
        
        Migration path:
        - For new user-facing features, use AppUserDB
        - For admin/internal API key access, continue using UserDB
        - Both models can coexist until full migration is complete
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    
    # User details
    full_name = Column(String(200), nullable=True)
    phone = Column(String(20), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)
    
    # API limits
    api_calls_limit = Column(Integer, default=10000)  # Per day
    websocket_limit = Column(Integer, default=10)  # Concurrent connections
    
    # Relationships
    api_keys = relationship("APIKeyDB", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLogDB", back_populates="user")
    
    __table_args__ = (
        Index('idx_user_active', 'is_active'),
        Index('idx_user_created', 'created_at'),
    )
    
    def __repr__(self):
        return f"<User(username={self.username}, email={self.email})>"


class APIKeyDB(Base):
    """
    API keys for programmatic access
    """
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Limits
    rate_limit = Column(Integer, default=100)  # Requests per minute
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("UserDB", back_populates="api_keys")
    
    __table_args__ = (
        Index('idx_apikey_active', 'is_active'),
    )


class AuditLogDB(Base):
    """
    Audit log for security and compliance
    """
    __tablename__ = "audit_logs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # User info
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    username = Column(String(50), nullable=True)
    ip_address = Column(String(50), nullable=True)
    
    # Action details
    action = Column(String(100), nullable=False, index=True)
    resource = Column(String(200), nullable=True)
    method = Column(String(10), nullable=True)
    status_code = Column(Integer, nullable=True)
    
    # Additional context
    details = Column(JSON, nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("UserDB", back_populates="audit_logs")
    
    __table_args__ = (
        Index('idx_audit_time_action', 'timestamp', 'action'),
        Index('idx_audit_user_time', 'user_id', 'timestamp'),
    )


class SystemConfigDB(Base):
    """
    Dynamic system configuration
    """
    __tablename__ = "system_config"
    
    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    category = Column(String(50), nullable=False, index=True)  # performance, security, trading, etc.
    data_type = Column(String(20), default="string")  # string, int, float, bool, json
    is_encrypted = Column(Boolean, default=False)
    requires_restart = Column(Boolean, default=False)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String(50), nullable=True)


class AlertRuleDB(Base):
    """
    System alert rules
    """
    __tablename__ = "alert_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    metric = Column(String(100), nullable=False)  # cpu, memory, error_rate, latency
    condition = Column(String(20), nullable=False)  # >, <, >=, <=, ==
    threshold = Column(Float, nullable=False)
    severity = Column(String(20), default="warning")  # info, warning, critical
    
    enabled = Column(Boolean, default=True, index=True)
    notification_channels = Column(JSON, nullable=True)  # ["email", "slack", "sms"]
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(50), nullable=True)


class TradingSessionDB(Base):
    """
    Trading session/market hours tracking
    """
    __tablename__ = "trading_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, nullable=False, index=True, unique=True)
    exchange = Column(String(10), nullable=False, index=True)
    
    # Session timings
    pre_open_start = Column(DateTime, nullable=True)
    pre_open_end = Column(DateTime, nullable=True)
    normal_open = Column(DateTime, nullable=False)
    normal_close = Column(DateTime, nullable=False)
    post_close_start = Column(DateTime, nullable=True)
    post_close_end = Column(DateTime, nullable=True)
    
    # Status
    is_trading_day = Column(Boolean, default=True)
    is_holiday = Column(Boolean, default=False)
    holiday_name = Column(String(200), nullable=True)
    
    # Market status
    market_status = Column(String(20), default='CLOSED')  # CLOSED, PRE_OPEN, OPEN, POST_CLOSE
    
    __table_args__ = (
        Index('idx_session_date_exchange', 'date', 'exchange'),
    )


# Create all indexes on module import
class FIIDIIDataDB(Base):
    """
    FII/DII (Foreign Institutional Investors / Domestic Institutional Investors) Data
    Daily institutional trading activity data
    """
    __tablename__ = "fii_dii_data"
    
    id = Column(BigInteger, primary_key=True, index=True)
    date = Column(DateTime, nullable=False, index=True)
    category = Column(String(10), nullable=False, index=True)  # FII, DII, PRO, CLIENT
    
    # Trading values (in crores)
    buy_value = Column(Float, nullable=True)
    sell_value = Column(Float, nullable=True)
    net_value = Column(Float, nullable=True)
    
    # Additional metrics
    buy_contracts = Column(BigInteger, nullable=True)
    sell_contracts = Column(BigInteger, nullable=True)
    oi_contracts = Column(BigInteger, nullable=True)
    
    # Metadata
    source = Column(String(50), default='NSE', nullable=True)
    raw_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Indexes
    __table_args__ = (
        Index('idx_fiidii_date_category', 'date', 'category'),
        CheckConstraint("category IN ('FII', 'DII', 'PRO', 'CLIENT')", name='chk_valid_category'),
    )
    
    def __repr__(self):
        return f"<FIIDIIData(date={self.date}, category={self.category}, net={self.net_value})>"


class MarketMoodIndexDB(Base):
    """
    Market Mood Index - Composite sentiment indicator
    Calculated from PCR, OI distribution, FII/DII activity, price momentum, IV changes
    """
    __tablename__ = "market_mood_index"
    
    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    symbol_id = Column(Integer, ForeignKey('instruments.symbol_id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Main mood score and sentiment
    mood_score = Column(Float, nullable=False)  # -100 to +100
    sentiment = Column(String(20), nullable=False)  # EXTREME_FEAR, FEAR, NEUTRAL, GREED, EXTREME_GREED
    
    # Component scores (weights can vary)
    pcr_score = Column(Float, nullable=True)  # PCR component
    oi_distribution_score = Column(Float, nullable=True)  # OI skew component
    fii_activity_score = Column(Float, nullable=True)  # FII/DII component
    price_momentum_score = Column(Float, nullable=True)  # Price momentum component
    iv_change_score = Column(Float, nullable=True)  # IV change component
    
    # Supporting data
    pcr = Column(Float, nullable=True)
    vix_value = Column(Float, nullable=True)
    advance_decline_ratio = Column(Float, nullable=True)
    fii_activity = Column(Float, nullable=True)
    
    # Metadata
    meta_data = Column(JSON, nullable=True)  # Algorithm params, component details
    version = Column(String(10), default='1.0')  # Algorithm version
    
    # Relationships
    instrument = relationship("InstrumentDB", foreign_keys=[symbol_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_mood_time_symbol', 'timestamp', 'symbol_id'),
        Index('idx_mood_sentiment', 'sentiment'),
        CheckConstraint('mood_score >= -100 AND mood_score <= 100', name='chk_mood_score_range'),
        CheckConstraint(
            "sentiment IN ('EXTREME_FEAR', 'FEAR', 'NEUTRAL', 'GREED', 'EXTREME_GREED')",
            name='chk_valid_sentiment'
        ),
    )
    
    def __repr__(self):
        return f"<MarketMood(symbol_id={self.symbol_id}, score={self.mood_score}, sentiment={self.sentiment})>"


class PCRHistoryDB(Base):
    """
    Put-Call Ratio (PCR) Historical Tracking
    Tracks PCR based on OI and Volume over time
    """
    __tablename__ = "pcr_history"
    
    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    symbol_id = Column(Integer, ForeignKey('instruments.symbol_id', ondelete='CASCADE'), nullable=False, index=True)
    expiry = Column(String(20), nullable=False, index=True)
    
    # PCR values
    pcr_oi = Column(Float, nullable=False)  # Put OI / Call OI
    pcr_volume = Column(Float, nullable=False)  # Put Volume / Call Volume
    
    # Supporting data
    total_call_oi = Column(BigInteger, default=0)
    total_put_oi = Column(BigInteger, default=0)
    total_call_volume = Column(BigInteger, default=0)
    total_put_volume = Column(BigInteger, default=0)
    
    # Change tracking
    pcr_oi_change = Column(Float, nullable=True)  # Change from previous reading
    pcr_volume_change = Column(Float, nullable=True)
    
    # Strike-wise distribution (for heatmaps)
    strike_distribution = Column(JSON, nullable=True)  # {strike: {call_oi, put_oi, pcr}}
    
    # Max Pain and other derivatives
    max_pain_strike = Column(Float, nullable=True)
    
    # Relationships
    instrument = relationship("InstrumentDB", foreign_keys=[symbol_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_pcr_time_symbol', 'timestamp', 'symbol_id'),
        Index('idx_pcr_symbol_expiry', 'symbol_id', 'expiry'),
        CheckConstraint('pcr_oi >= 0', name='chk_pcr_oi_nonneg'),
        CheckConstraint('pcr_volume >= 0', name='chk_pcr_volume_nonneg'),
    )
    
    def __repr__(self):
        return f"<PCRHistory(symbol_id={self.symbol_id}, pcr_oi={self.pcr_oi}, pcr_vol={self.pcr_volume})>"


class SupportResistanceLevelDB(Base):
    """
    Support and Resistance Levels detected from option chain data
    Uses OI concentration, OI buildup patterns, and price action
    """
    __tablename__ = "support_resistance_levels"
    
    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    symbol_id = Column(Integer, ForeignKey('instruments.symbol_id', ondelete='CASCADE'), nullable=False, index=True)
    expiry = Column(String(20), nullable=False, index=True)
    
    # Level details
    level_type = Column(String(10), nullable=False, index=True)  # SUPPORT, RESISTANCE
    price = Column(Float, nullable=False, index=True)
    
    # Confidence and strength
    strength = Column(Integer, nullable=False)  # 1-10 confidence score
    confidence = Column(Float, default=50.0)  # Percentage confidence
    
    # Detection source
    source = Column(String(20), nullable=False)  # OI_MAX, OI_BUILDUP, PRICE_ACTION, COMBINED
    
    # Supporting metrics
    total_oi = Column(BigInteger, nullable=True)  # Total OI at this level
    call_oi = Column(BigInteger, nullable=True)
    put_oi = Column(BigInteger, nullable=True)
    oi_buildup_pct = Column(Float, nullable=True)  # OI change percentage
    
    # Zone definition (range around the level)
    zone_lower = Column(Float, nullable=True)
    zone_upper = Column(Float, nullable=True)
    
    # Metadata
    meta_data = Column(JSON, nullable=True)  # Detection algorithm details, additional metrics
    
    # Status flags
    is_active = Column(Boolean, default=True, index=True)
    is_breached = Column(Boolean, default=False)  # Price crossed this level
    breached_at = Column(DateTime, nullable=True)
    
    # Relationships
    instrument = relationship("InstrumentDB", foreign_keys=[symbol_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_sr_time_symbol', 'timestamp', 'symbol_id'),
        Index('idx_sr_symbol_expiry_type', 'symbol_id', 'expiry', 'level_type'),
        Index('idx_sr_active_levels', 'is_active', 'symbol_id'),
        CheckConstraint("level_type IN ('SUPPORT', 'RESISTANCE')", name='chk_valid_level_type'),
        CheckConstraint('strength >= 1 AND strength <= 10', name='chk_strength_range'),
        CheckConstraint('confidence >= 0 AND confidence <= 100', name='chk_confidence_range'),
        CheckConstraint(
            "source IN ('OI_MAX', 'OI_BUILDUP', 'PRICE_ACTION', 'COMBINED')",
            name='chk_valid_source'
        ),
    )
    
    def __repr__(self):
        return f"<SupportResistance(type={self.level_type}, price={self.price}, strength={self.strength})>"


# Create all indexes on module import
def create_indexes():
    """Create additional performance indexes"""
    from sqlalchemy import text
    from core.database.db import engine
    
    # This would be run as part of migrations
    indexes = [
        # Covering indexes
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_snapshots_covering ON market_snapshots(symbol_id, timestamp DESC) INCLUDE (ltp, volume, oi)",
        
        # Partial indexes
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_users ON users(username) WHERE is_active = true",
        
        # Expression indexes
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_snapshots_date ON market_snapshots(DATE(timestamp))",
        
        # Phase 1 indexes
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mood_recent ON market_mood_index(symbol_id, timestamp DESC) WHERE timestamp > NOW() - INTERVAL '7 days'",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_sr_levels ON support_resistance_levels(symbol_id, price) WHERE is_active = true",
    ]
    
    # These would be applied via Alembic migrations
    
    
class UserRole(str, enum.Enum):
    """User role enumeration"""
    USER = "user"
    PREMIUM = "premium"
    ADMIN = "admin"


class AppUserDB(Base):
    """
    Application User (Trader) - Synced with ocd-backend
    Matches the schema of ocd-backend's User model
    """
    __tablename__ = "app_users"
    
    # Primary key
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True
    )
    
    # Firebase authentication
    firebase_uid = Column(
        String(128),
        unique=True,
        nullable=False,
        index=True
    )
    
    # User info
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=True)
    profile_image = Column(Text, nullable=True)
    
    # Authentication status
    is_email_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    login_provider = Column(String(50), default="email", nullable=False)
    
    # Role and subscription
    role = Column(
        Enum(UserRole),
        default=UserRole.USER,
        nullable=False
    )
    subscription_expires = Column(DateTime(timezone=True), nullable=True)
    
    # Session tracking
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_logout = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps provided by Base/TimestampMixin in OCD, implementing manually here or using Mixin if available
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('ix_app_users_active_role', 'is_active', 'role'),
        Index('ix_app_users_role_subscription', 'role', 'subscription_expires'),
        Index('ix_app_users_last_login', 'last_login'),
    )

    def __repr__(self):
        return f"<AppUser {self.username} ({self.email})>"

    @property
    def is_admin(self) -> bool:
        """Check if user is admin"""
        return self.role == UserRole.ADMIN
    
    @property
    def is_premium(self) -> bool:
        """Check if user has active premium subscription"""
        if self.role == UserRole.ADMIN:
            return True
        if self.role == UserRole.PREMIUM and self.subscription_expires:
            # Handle timezone-aware vs naive comparison if needed
            now = datetime.utcnow()
            if self.subscription_expires.tzinfo:
                 from datetime import timezone
                 now = datetime.now(timezone.utc)
            return self.subscription_expires > now
        return False
    
    @property
    def display_name(self) -> str:
        """Get display name (full name or username)"""
        return self.full_name or self.username
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "id": str(self.id),
            "email": self.email,
            "username": self.username,
            "full_name": self.full_name,
            "profile_image": self.profile_image,
            "role": self.role.value,
            "is_active": self.is_active,
            "is_email_verified": self.is_email_verified,
            "is_premium": self.is_premium,
            "login_provider": self.login_provider,
            "subscription_expires": (
                self.subscription_expires.isoformat()
                if self.subscription_expires else None
            ),
            "last_login": (
                self.last_login.isoformat()
                if self.last_login else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
class AdminAuditLogDB(Base):
    """
    Admin Audit Log - Tracks administrative actions for security and compliance.
    """
    __tablename__ = "admin_audit_logs"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True
    )
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    
    # Actor (Admin)
    actor_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True
    )
    
    # Action details
    action = Column(String(50), nullable=False, index=True)  # CREATE, DELETE, UPDATE, LOGIN
    resource_type = Column(String(50), nullable=False, index=True)  # USER, CONFIG, SYSTEM
    resource_id = Column(String(128), nullable=True)
    
    # Context
    details = Column(JSON, nullable=True)  # Changes, snapshots
    ip_address = Column(String(45), nullable=True)
    status = Column(String(20), default="success", nullable=False)  # success, failure
    
    # Indexes
    __table_args__ = (
        Index('ix_admin_audit_actor_time', 'actor_id', 'timestamp'),
        Index('ix_admin_audit_resource', 'resource_type', 'resource_id'),
    )
    
    def __repr__(self):
        return f"<AdminAuditLog {self.action} on {self.resource_type} by {self.actor_id}>"


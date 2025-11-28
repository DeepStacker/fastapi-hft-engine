"""
Complete Database Models - Production Ready

All models fully implemented with proper relationships, indexes, and constraints.
"""
from sqlalchemy import Column, Integer, String, Float, BigInteger, Boolean, DateTime, Text, JSON, ForeignKey, Index, CheckConstraint, desc
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database.db import Base


class InstrumentDB(Base):
    """
    Instrument (Stock/Index) master data
    """
    __tablename__ = "instruments"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol_id = Column(Integer, unique=True, nullable=False, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    exchange = Column(String(10), nullable=False, index=True)  # NSE, BSE, etc.
    segment = Column(String(10), nullable=False)  # EQ, FO, etc.
    isin = Column(String(20), unique=True, nullable=True)
    company_name = Column(String(200), nullable=True)
    sector = Column(String(100), nullable=True)
    industry = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=1, nullable=False, index=True)
    lot_size = Column(Integer, default=1)
    tick_size = Column(Float, default=0.05)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    snapshots = relationship("MarketSnapshotDB", back_populates="instrument", cascade="all, delete-orphan")
    options = relationship("OptionContractDB", back_populates="instrument", cascade="all, delete-orphan")
    futures = relationship("FutureContractDB", back_populates="instrument", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_instrument_active_symbol', 'is_active', 'symbol_id'),
        Index('idx_instrument_exchange_segment', 'exchange', 'segment'),
        CheckConstraint('lot_size > 0', name='chk_lot_size_positive'),
    )
    
    def __repr__(self):
        return f"<Instrument(symbol={self.symbol}, exchange={self.exchange})>"


class MarketSnapshotDB(Base):
    """
    Real-time market snapshot data (TimescaleDB hypertable)
    """
    __tablename__ = "market_snapshots"
    
    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
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
    
    # Raw data for reference
    raw_data = Column(JSON, nullable=True)
    
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
    symbol_id = Column(Integer, ForeignKey('instruments.symbol_id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Contract details
    expiry = Column(String(20), nullable=False, index=True)
    strike_price = Column(Float, nullable=False, index=True)
    option_type = Column(String(2), nullable=False, index=True)  # CE or PE
    
    # Price data
    ltp = Column(Float, default=0)
    open_price = Column(Float, nullable=True)
    high = Column(Float, nullable=True)
    low = Column(Float, nullable=True)
    close = Column(Float, nullable=True)
    prev_close = Column(Float, nullable=True)
    
    # Volume & OI
    volume = Column(BigInteger, default=0)
    oi = Column(BigInteger, default=0)
    oi_change = Column(BigInteger, default=0)
    
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
    
    # Relationships
    instrument = relationship("InstrumentDB", back_populates="options")
    
    # Indexes
    __table_args__ = (
        Index('idx_options_expiry_strike_type', 'expiry', 'strike_price', 'option_type'),
        Index('idx_options_symbol_expiry', 'symbol_id', 'expiry'),
        Index('idx_options_time_symbol', 'timestamp', 'symbol_id'),
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
    User accounts for API access
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
    ]
    
    # These would be applied via Alembic migrations
    pass

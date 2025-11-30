"""
API Key Models

Database models for API key management and usage tracking.
Supports tiered access with rate limiting and permissions.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, JSON, Numeric
from core.database.db import Base
from datetime import datetime


class APIKey(Base):
    """
    API Key for external clients.
    
    Supports tiered access with different rate limits and permissions.
    """
    __tablename__ = 'gateway_api_keys'
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Key identification
    key = Column(String(64), unique=True, nullable=False, index=True)
    key_name = Column(String(100), nullable=False)  # Friendly name
    client_name = Column(String(100), nullable=False)  # Client/company name
    contact_email = Column(String(200))
    
    # Access tier
    tier = Column(String(20), nullable=False, index=True)  # free, basic, pro, enterprise
    
    # Rate limiting (requests per minute)
    rate_limit_per_minute = Column(Integer, nullable=False)
    rate_limit_per_day = Column(Integer)  # Optional daily quota
    
    # Permissions & Scope
    allowed_symbols = Column(JSON)  # null = all, [13, 26] = specific symbols
    allowed_endpoints = Column(JSON)  # null = all, ['option-chain', 'analytics'] = specific
    max_historical_days = Column(Integer, default=7)  # How far back they can query
    
    # Usage tracking
    total_requests = Column(BigInteger, default=0)
    total_bytes_transferred = Column(BigInteger, default=0)
    last_used_at = Column(DateTime)
    requests_today = Column(Integer, default=0)
    last_reset_date = Column(DateTime, default=datetime.utcnow)
    
    # Lifecycle management
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime)  # null = no expiration
    
    # Metadata
    notes = Column(String(500))  # Internal notes
    created_by = Column(String(100))  # Admin who created it


class APIUsageLog(Base):
    """
    Detailed usage logs for analytics and billing.
    
    Stores per-request metadata for auditing and analytics.
    """
    __tablename__ = 'api_usage_logs'
    
    # Primary key
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    
    # API Key reference
    api_key_id = Column(Integer, nullable=False, index=True)
    
    # Request details
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    endpoint = Column(String(200), nullable=False, index=True)
    method = Column(String(10))  # GET, POST
    
    # Request parameters
    query_params = Column(JSON)
    path_params = Column(JSON)
    
    # Response details
    status_code = Column(Integer)
    response_time_ms = Column(Integer)  # Latency
    bytes_transferred = Column(Integer)
    
    # Client info
    ip_address = Column(String(45))  # IPv6 support
    user_agent = Column(String(500))
    
    # Error tracking
    error_message = Column(String(500))


class APITier(Base):
    """
    Tier configuration for different access levels.
    
    Defines limits and features per tier.
    """
    __tablename__ = 'api_tiers'
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Tier identification
    tier_name = Column(String(20), unique=True, nullable=False)  # free, basic, pro, enterprise
    display_name = Column(String(50))  # "Free Tier", "Professional"
    
    # Limits
    rate_limit_per_minute = Column(Integer, nullable=False)
    rate_limit_per_day = Column(Integer)
    max_historical_days = Column(Integer, default=7)
    
    # Features
    realtime_access = Column(Boolean, default=True)
    historical_access = Column(Boolean, default=True)
    analytics_access = Column(Boolean, default=True)
    webhook_support = Column(Boolean, default=False)
    
    # Pricing (for reference)
    monthly_price_usd = Column(Numeric(10, 2))
    
    # Metadata
    description = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# Default tier configurations
DEFAULT_TIERS = [
    {
        'tier_name': 'free',
        'display_name': 'Free Tier',
        'rate_limit_per_minute': 10,
        'rate_limit_per_day': 1000,
        'max_historical_days': 0,  # No historical
        'realtime_access': True,
        'historical_access': False,
        'analytics_access': False,
        'webhook_support': False,
        'monthly_price_usd': 0,
        'description': 'Limited access for testing and evaluation'
    },
    {
        'tier_name': 'basic',
        'display_name': 'Basic',
        'rate_limit_per_minute': 100,
        'rate_limit_per_day': 10000,
        'max_historical_days': 7,
        'realtime_access': True,
        'historical_access': True,
        'analytics_access': True,
        'webhook_support': False,
        'monthly_price_usd': 99,
        'description': 'Standard access for small applications'
    },
    {
        'tier_name': 'pro',
        'display_name': 'Professional',
        'rate_limit_per_minute': 1000,
        'rate_limit_per_day': 100000,
        'max_historical_days': 30,
        'realtime_access': True,
        'historical_access': True,
        'analytics_access': True,
        'webhook_support': True,
        'monthly_price_usd': 499,
        'description': 'Advanced features for professional traders'
    },
    {
        'tier_name': 'enterprise',
        'display_name': 'Enterprise',
        'rate_limit_per_minute': 10000,
        'rate_limit_per_day': None,  # Unlimited
        'max_historical_days': 365,
        'realtime_access': True,
        'historical_access': True,
        'analytics_access': True,
        'webhook_support': True,
        'monthly_price_usd': None,  # Custom pricing
        'description': 'Unlimited access with dedicated support and SLA'
    }
]

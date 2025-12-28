"""
Database Seeder - Initialize default configurations and instruments
Run this on startup or via CLI to seed the database with default values
"""
import asyncio
import os
import logging
from typing import List, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import AsyncSessionLocal
from app.config.settings import settings
from app.models.config import SystemConfig, TradingInstrument, ConfigCategory
from app.repositories.config import ConfigRepository, InstrumentRepository

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# Default Configurations - Extracted from settings.py
# ═══════════════════════════════════════════════════════════════════

DEFAULT_CONFIGS: List[Dict[str, Any]] = [
    # API Settings
    {
        "key": "DHAN_API_BASE_URL",
        "value": settings.DHAN_API_BASE_URL,
        "category": ConfigCategory.API,
        "description": "Dhan API base URL for market data",
        "display_name": "Dhan API Base URL",
        "is_sensitive": False,
        "value_type": "string",
    },
    {
        "key": "DHAN_API_TIMEOUT",
        "value": str(settings.DHAN_API_TIMEOUT),
        "category": ConfigCategory.API,
        "description": "API request timeout in seconds",
        "display_name": "API Timeout",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "DHAN_API_RETRY_COUNT",
        "value": str(settings.DHAN_API_RETRY_COUNT),
        "category": ConfigCategory.API,
        "description": "Number of retries for failed API requests",
        "display_name": "API Retry Count",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "DHAN_API_RETRY_DELAY",
        "value": str(settings.DHAN_API_RETRY_DELAY),
        "category": ConfigCategory.API,
        "description": "Delay between retries in seconds",
        "display_name": "API Retry Delay",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "DHAN_AUTH_TOKEN",
        "value": settings.DHAN_AUTH_TOKEN or "",
        "category": ConfigCategory.API,
        "description": "Dhan API authentication token - KEEP SECRET!",
        "display_name": "Dhan Auth Token",
        "is_sensitive": True,
        "value_type": "string",
    },
    {
        "key": "DHAN_CLIENT_ID",
        "value": "",
        "category": ConfigCategory.API,
        "description": "Dhan Client ID for API authentication",
        "display_name": "Dhan Client ID",
        "is_sensitive": False,
        "value_type": "string",
    },
    
    # Cache Settings
    {
        "key": "REDIS_CACHE_TTL",
        "value": str(settings.REDIS_CACHE_TTL),
        "category": ConfigCategory.CACHE,
        "description": "Default cache TTL in seconds",
        "display_name": "Default Cache TTL",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "REDIS_OPTIONS_CACHE_TTL",
        "value": str(settings.REDIS_OPTIONS_CACHE_TTL),
        "category": ConfigCategory.CACHE,
        "description": "Options data cache TTL (controls API rate)",
        "display_name": "Options Cache TTL",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "REDIS_EXPIRY_CACHE_TTL",
        "value": str(settings.REDIS_EXPIRY_CACHE_TTL),
        "category": ConfigCategory.CACHE,
        "description": "Expiry dates cache TTL in seconds",
        "display_name": "Expiry Cache TTL",
        "is_sensitive": False,
        "value_type": "number",
    },
    
    # Trading Settings
    {
        "key": "DEFAULT_RISK_FREE_RATE",
        "value": str(settings.DEFAULT_RISK_FREE_RATE),
        "category": ConfigCategory.TRADING,
        "description": "Risk-free rate for Black-Scholes model (0.10 = 10%)",
        "display_name": "Risk-Free Rate",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "DEFAULT_SYMBOL",
        "value": settings.DEFAULT_SYMBOL,
        "category": ConfigCategory.TRADING,
        "description": "Default trading symbol on load",
        "display_name": "Default Symbol",
        "is_sensitive": False,
        "value_type": "string",
    },
    
    # WebSocket Settings
    {
        "key": "WS_HEARTBEAT_INTERVAL",
        "value": str(settings.WS_HEARTBEAT_INTERVAL),
        "category": ConfigCategory.SYSTEM,
        "description": "WebSocket heartbeat interval in seconds",
        "display_name": "WS Heartbeat",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "WS_BROADCAST_INTERVAL",
        "value": str(settings.WS_BROADCAST_INTERVAL),
        "category": ConfigCategory.SYSTEM,
        "description": "Live data broadcast interval (lower = faster)",
        "display_name": "WS Broadcast Interval",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "WS_MAX_CONNECTIONS",
        "value": str(settings.WS_MAX_CONNECTIONS),
        "category": ConfigCategory.SYSTEM,
        "description": "Maximum WebSocket connections per server",
        "display_name": "Max WS Connections",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "WS_CHARTS_BROADCAST_INTERVAL",
        "value": str(getattr(settings, 'WS_CHARTS_BROADCAST_INTERVAL', 0.25)),
        "category": ConfigCategory.CACHE,
        "description": "Charts WebSocket broadcast interval in seconds (0.25 = 4 updates/sec)",
        "display_name": "Charts WS Interval (sec)",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "POLLING_FALLBACK_INTERVAL",
        "value": "3000",
        "category": ConfigCategory.CACHE,
        "description": "REST polling fallback interval in milliseconds when WebSocket unavailable",
        "display_name": "Polling Fallback (ms)",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "UI_UPDATE_THROTTLE",
        "value": "100",
        "category": ConfigCategory.UI,
        "description": "Frontend UI update throttle in milliseconds (prevents flickering)",
        "display_name": "UI Update Throttle (ms)",
        "is_sensitive": False,
        "value_type": "number",
    },
    
    # Rate Limiting
    {
        "key": "RATE_LIMIT_PER_MINUTE",
        "value": str(settings.RATE_LIMIT_PER_MINUTE),
        "category": ConfigCategory.SECURITY,
        "description": "API requests allowed per minute per user",
        "display_name": "Rate Limit/Min",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "RATE_LIMIT_BURST",
        "value": str(settings.RATE_LIMIT_BURST),
        "category": ConfigCategory.SECURITY,
        "description": "Burst limit for rate limiter",
        "display_name": "Rate Limit Burst",
        "is_sensitive": False,
        "value_type": "number",
    },
    
    # Logging
    {
        "key": "LOG_LEVEL",
        "value": settings.LOG_LEVEL,
        "category": ConfigCategory.SYSTEM,
        "description": "Application log level (DEBUG, INFO, WARNING, ERROR)",
        "display_name": "Log Level",
        "is_sensitive": False,
        "value_type": "string",
    },
    
    # UI Settings
    {
        "key": "UI_DEFAULT_THEME",
        "value": "dark",
        "category": ConfigCategory.UI,
        "description": "Default theme for new users",
        "display_name": "Default Theme",
        "is_sensitive": False,
        "value_type": "string",
    },
    {
        "key": "UI_DEFAULT_STRIKES_COUNT",
        "value": "21",
        "category": ConfigCategory.UI,
        "description": "Default number of strikes to show in option chain",
        "display_name": "Default Strikes",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "UI_ENABLE_ANIMATIONS",
        "value": "true",
        "category": ConfigCategory.UI,
        "description": "Enable UI animations",
        "display_name": "Enable Animations",
        "is_sensitive": False,
        "value_type": "boolean",
    },
    {
        "key": "UI_TABLE_PAGE_SIZE",
        "value": "50",
        "category": ConfigCategory.UI,
        "description": "Default table page size",
        "display_name": "Table Page Size",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "UI_CHART_REFRESH_INTERVAL",
        "value": "5000",
        "category": ConfigCategory.UI,
        "description": "Chart refresh interval in milliseconds",
        "display_name": "Chart Refresh (ms)",
        "is_sensitive": False,
        "value_type": "number",
    },
    
    # Feature Flags
    {
        "key": "FEATURE_WEBSOCKET_ENABLED",
        "value": "true",
        "category": ConfigCategory.FEATURES,
        "description": "Enable WebSocket real-time updates",
        "display_name": "WebSocket Enabled",
        "is_sensitive": False,
        "value_type": "boolean",
    },
    {
        "key": "FEATURE_GREEKS_ENABLED",
        "value": "true",
        "category": ConfigCategory.FEATURES,
        "description": "Enable Options Greeks calculations",
        "display_name": "Greeks Enabled",
        "is_sensitive": False,
        "value_type": "boolean",
    },
    {
        "key": "FEATURE_OI_ANALYSIS_ENABLED",
        "value": "true",
        "category": ConfigCategory.FEATURES,
        "description": "Enable Open Interest analysis features",
        "display_name": "OI Analysis Enabled",
        "is_sensitive": False,
        "value_type": "boolean",
    },
    {
        "key": "FEATURE_IV_CHART_ENABLED",
        "value": "true",
        "category": ConfigCategory.FEATURES,
        "description": "Enable Implied Volatility chart",
        "display_name": "IV Chart Enabled",
        "is_sensitive": False,
        "value_type": "boolean",
    },
    {
        "key": "FEATURE_PCR_GAUGE_ENABLED",
        "value": "true",
        "category": ConfigCategory.FEATURES,
        "description": "Enable Put-Call Ratio gauge",
        "display_name": "PCR Gauge Enabled",
        "is_sensitive": False,
        "value_type": "boolean",
    },
    {
        "key": "FEATURE_STRADDLE_CHART_ENABLED",
        "value": "true",
        "category": ConfigCategory.FEATURES,
        "description": "Enable Straddle chart visualization",
        "display_name": "Straddle Chart Enabled",
        "is_sensitive": False,
        "value_type": "boolean",
    },
    {
        "key": "FEATURE_MULTI_EXPIRY_ENABLED",
        "value": "true",
        "category": ConfigCategory.FEATURES,
        "description": "Enable multi-expiry view",
        "display_name": "Multi Expiry Enabled",
        "is_sensitive": False,
        "value_type": "boolean",
    },
    
    # Trading Thresholds
    {
        "key": "TRADING_PCR_BULLISH_THRESHOLD",
        "value": "0.7",
        "category": ConfigCategory.TRADING,
        "description": "PCR below this is considered bullish",
        "display_name": "PCR Bullish Threshold",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "TRADING_PCR_BEARISH_THRESHOLD",
        "value": "1.3",
        "category": ConfigCategory.TRADING,
        "description": "PCR above this is considered bearish",
        "display_name": "PCR Bearish Threshold",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "TRADING_IV_HIGH_THRESHOLD",
        "value": "25",
        "category": ConfigCategory.TRADING,
        "description": "IV percentage considered high",
        "display_name": "High IV Threshold (%)",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "TRADING_OI_SPIKE_MULTIPLIER",
        "value": "2.0",
        "category": ConfigCategory.TRADING,
        "description": "OI change multiplier to consider as spike",
        "display_name": "OI Spike Multiplier",
        "is_sensitive": False,
        "value_type": "number",
    },
    
    # Session Settings
    {
        "key": "SESSION_TIMEOUT_MINUTES",
        "value": "60",
        "category": ConfigCategory.SECURITY,
        "description": "Session timeout in minutes",
        "display_name": "Session Timeout (min)",
        "is_sensitive": False,
        "value_type": "number",
    },
    {
        "key": "SESSION_REFRESH_THRESHOLD",
        "value": "15",
        "category": ConfigCategory.SECURITY,
        "description": "Minutes before expiry to refresh session",
        "display_name": "Session Refresh (min)",
        "is_sensitive": False,
        "value_type": "number",
    },
]


# ═══════════════════════════════════════════════════════════════════
# Default Trading Instruments
# ═══════════════════════════════════════════════════════════════════

DEFAULT_INSTRUMENTS: List[Dict[str, Any]] = [
    {
        "symbol": "NIFTY",
        "display_name": "Nifty 50",
        "segment": "IDX",
        "lot_size": 25,
        "tick_size": 0.05,
        "strike_interval": 50.0,
        "strikes_count": 20,
        "is_active": True,
        "priority": 1,
    },
    {
        "symbol": "BANKNIFTY",
        "display_name": "Bank Nifty",
        "segment": "IDX",
        "lot_size": 15,
        "tick_size": 0.05,
        "strike_interval": 100.0,
        "strikes_count": 20,
        "is_active": True,
        "priority": 2,
    },
    {
        "symbol": "FINNIFTY",
        "display_name": "Fin Nifty",
        "segment": "IDX",
        "lot_size": 25,
        "tick_size": 0.05,
        "strike_interval": 50.0,
        "strikes_count": 15,
        "is_active": True,
        "priority": 3,
    },
    {
        "symbol": "MIDCPNIFTY",
        "display_name": "Midcap Nifty",
        "segment": "IDX",
        "lot_size": 50,
        "tick_size": 0.05,
        "strike_interval": 25.0,
        "strikes_count": 15,
        "is_active": True,
        "priority": 4,
    },
    {
        "symbol": "SENSEX",
        "display_name": "BSE Sensex",
        "segment": "IDX",
        "lot_size": 10,
        "tick_size": 0.05,
        "strike_interval": 100.0,
        "strikes_count": 15,
        "is_active": True,
        "priority": 5,
    },
    {
        "symbol": "BANKEX",
        "display_name": "BSE Bankex",
        "segment": "IDX",
        "lot_size": 15,
        "tick_size": 0.05,
        "strike_interval": 100.0,
        "strikes_count": 15,
        "is_active": True,
        "priority": 6,
    },
]


async def seed_configs(db: AsyncSession) -> int:
    """Seed default configurations if they don't exist"""
    config_repo = ConfigRepository(db)
    count = 0
    
    for cfg in DEFAULT_CONFIGS:
        exists = await config_repo.key_exists(cfg["key"])
        if not exists:
            await config_repo.create(**cfg)
            count += 1
            logger.info(f"Seeded config: {cfg['key']}")
    
    await db.commit()
    return count


async def seed_instruments(db: AsyncSession) -> int:
    """Seed default trading instruments if they don't exist"""
    instrument_repo = InstrumentRepository(db)
    count = 0
    
    for inst in DEFAULT_INSTRUMENTS:
        exists = await instrument_repo.symbol_exists(inst["symbol"])
        if not exists:
            await instrument_repo.create(**inst)
            count += 1
            logger.info(f"Seeded instrument: {inst['symbol']}")
    
    await db.commit()
    return count


async def seed_admin_user(db: AsyncSession) -> int:
    """
    Promote first user to admin if no admin exists.
    Also checks ADMIN_EMAIL env var to create/promote a specific admin.
    """
    from app.repositories.user import UserRepository
    from app.models.user import UserRole
    
    user_repo = UserRepository(db)
    count = 0
    
    # Check if any admin exists
    admins = await user_repo.get_admins()
    if admins:
        logger.info(f"Admin user already exists: {admins[0].email}")
        return 0
    
    # Check for ADMIN_EMAIL env var
    admin_email = settings.ADMIN_EMAIL if hasattr(settings, 'ADMIN_EMAIL') else None
    if not admin_email:
        admin_email = os.getenv("ADMIN_EMAIL")
    
    if admin_email:
        user = await user_repo.get_by_email(admin_email)
        if user:
            user.role = UserRole.ADMIN
            await db.commit()
            logger.info(f"Promoted {admin_email} to admin")
            return 1
        else:
            logger.info(f"ADMIN_EMAIL user {admin_email} not found. They will be promoted when they log in.")
    
    # If no admin and no ADMIN_EMAIL, promote the first user
    users = await user_repo.get_all(limit=1, order_by="created_at")
    if users:
        users[0].role = UserRole.ADMIN
        await db.commit()
        logger.info(f"Promoted first user {users[0].email} to admin")
        return 1
    
    logger.info("No users found to promote to admin")
    return 0


async def run_seeder():
    """Run all seeders"""
    async with AsyncSessionLocal() as db:
        logger.info("Starting database seeding...")
        
        config_count = await seed_configs(db)
        instrument_count = await seed_instruments(db)
        admin_count = await seed_admin_user(db)
        
        logger.info(f"Seeding complete: {config_count} configs, {instrument_count} instruments, {admin_count} admins")
        
        return {
            "configs_seeded": config_count,
            "instruments_seeded": instrument_count,
            "admins_seeded": admin_count,
        }


# CLI entry point
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_seeder())

"""
Core Enums - Single Source of Truth

All enumerations used across services are defined here.
Import from core.schemas.enums instead of defining duplicates.
"""

from enum import Enum


class OptionType(str, Enum):
    """Option type - Call or Put"""
    CE = "CE"
    PE = "PE"


class BuildupType(str, Enum):
    """Buildup pattern types for option chain analysis"""
    LONG_BUILDUP = "LONG BUILDUP"
    SHORT_BUILDUP = "SHORT BUILDUP"
    LONG_UNWINDING = "LONG UNWINDING"
    SHORT_UNWINDING = "SHORT UNWINDING"
    UNKNOWN = "UNKNOWN"


class MoneynessType(str, Enum):
    """Option moneyness classification"""
    ITM = "ITM"
    ATM = "ATM"
    OTM = "OTM"


class MarketSentiment(str, Enum):
    """Market sentiment classification based on indicators"""
    BULLISH_EXTREME = "BULLISH_EXTREME"
    BULLISH = "BULLISH"
    NEUTRAL = "NEUTRAL"
    BEARISH = "BEARISH"
    BEARISH_EXTREME = "BEARISH_EXTREME"


class UserRole(str, Enum):
    """User role for access control"""
    USER = "user"
    PREMIUM = "premium"
    ADMIN = "admin"


class ServiceStatus(str, Enum):
    """Service health/response status"""
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL = "partial"


class OrderType(str, Enum):
    """Trading order type"""
    BUY = "BUY"
    SELL = "SELL"


class TimeFrame(str, Enum):
    """Data aggregation timeframes"""
    M1 = "1m"
    M5 = "5m"
    M15 = "15m"
    H1 = "1h"
    D1 = "1d"


class AlertSeverity(str, Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class BackupStatus(str, Enum):
    """Backup job status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"

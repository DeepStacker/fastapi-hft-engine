"""
Timezone Utilities - Re-exported from core module.

DEPRECATED: Import directly from core.utils.timezone instead.

This file exists for backward compatibility. All timezone functions
are now defined in core/utils/timezone.py as the single source of truth.
"""
# Re-export everything from core module
from core.utils.timezone import (
    IST,
    get_ist_now,
    get_ist_isoformat,
    to_ist,
    ist_to_utc,
    utc_to_ist_isoformat,
    get_ist_timestamp,
    format_ist,
)

__all__ = [
    "IST",
    "get_ist_now",
    "get_ist_isoformat",
    "to_ist",
    "ist_to_utc",
    "utc_to_ist_isoformat",
    "get_ist_timestamp",
    "format_ist",
]

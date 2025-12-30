# Timestamp Consistency Guide

## Standard: Use IST for all business timestamps

### How to use
```python
from core.utils.timezone import get_ist_now, get_ist_isoformat

# For datetime objects
timestamp = get_ist_now()

# For ISO format strings
timestamp_str = get_ist_isoformat()
```

### Files Already Fixed (14 core files)
- `core/analytics/models.py`
- `core/error_handling/handler.py`
- `core/logging/audit.py`
- `core/backup/backup_manager.py`
- `core/resilience/circuit_breaker.py`
- `services/admin/auth.py`
- `services/ocd-backend/app/api/v1/notifications.py`
- `services/ocd-backend/app/api/v1/health.py`
- `services/ocd-backend/app/api/v1/auth.py`
- `services/ocd-backend/app/repositories/user.py`
- `services/realtime/analytics_calculator.py`
- `services/storage/main.py`

### Files Pending Fix (Lower Priority)
These files still use `datetime.utcnow()` or `datetime.now()`:

**Admin Service:**
- `services/admin/services/metrics_collector.py`
- `services/admin/services/audit.py`
- `services/admin/routers/dhan_tokens.py`
- `services/admin/routers/traders.py`
- `services/admin/routers/services.py`

**Core Modules:**
- `core/monitoring/alert_monitor.py`
- `core/validation/schemas.py`
- `core/notifications/alert_notifier.py`
- `core/health/checker.py`
- `core/health/health_check.py`
- `core/database/batch_writer.py`

**Scripts (OK to leave as-is):**
- Test files, seed scripts, load tests

### When to Fix
- Fix when touching these files for other reasons
- Not critical for functionality (mainly display consistency)

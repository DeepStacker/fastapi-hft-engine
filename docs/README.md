# Code Quality Documentation

This directory contains documentation for maintaining code quality and consistency.

## Available Guides

- [contracts.md](./contracts.md) - Kafka/Redis/WebSocket message schemas
- [docker-compose.md](./docker-compose.md) - Docker configuration usage
- [timestamps.md](./timestamps.md) - Timestamp handling (IST standard)

## Architecture

### Single Sources of Truth

| Concern | Location |
|---------|----------|
| Configuration | `core/config/settings.py` |
| Exceptions | `core/exceptions/__init__.py` |
| Circuit Breaker | `core/resilience/circuit_breaker.py` |
| Dhan Client | `core/clients/dhan.py` |
| BSM Calculator | `core/analytics/bsm.py` |
| Redis Client | `core/cache/redis.py` |
| DB Sessions | `core/database/session.py` |
| Health Response | `core/health/response.py` |
| Logging | `core/logging/config.py` |
| Timezone | `core/utils/timezone.py` |

### Import Patterns

```python
# Config
from core.config.settings import get_settings

# Exceptions
from core.exceptions import StockifyException, DatabaseException

# Cache
from core.cache import get_redis_client, RedisKeys

# Database
from core.database.session import get_db, get_read_db

# Logging
from core.logging.config import configure_logging, get_logger

# Time
from core.utils.timezone import get_ist_now, get_ist_isoformat
```

"""
Prometheus Metrics for Stockify Trading Platform - DISTRIBUTED VERSION

Provides application metrics for monitoring with Redis-backed storage:
- HTTP request latency and counts
- WebSocket connection metrics
- Cache hit/miss ratios
- External API latency

Uses Redis for distributed aggregation across all workers/pods.
Falls back to in-memory storage if Redis is unavailable.
"""
import time
import logging
import asyncio
from typing import Callable, Optional
from functools import wraps

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Redis connection for distributed metrics
_metrics_redis: Optional[object] = None
_use_redis_metrics = True  # Set to False to force in-memory mode

# Local fallback metrics storage (used when Redis unavailable)
_local_metrics = {
    "http_requests_total": {},
    "http_request_duration_seconds": {},
    "websocket_connections_active": 0,
    "websocket_connections_total": 0,
    "websocket_messages_sent_total": 0,
    "cache_hits_total": 0,
    "cache_misses_total": 0,
    "external_api_duration_seconds": {},
    "external_api_errors_total": {},
}

# Metrics key prefix in Redis
METRICS_PREFIX = "stockify:metrics:"


async def init_metrics_redis() -> bool:
    """Initialize Redis connection for metrics storage."""
    global _metrics_redis, _use_redis_metrics
    
    if not _use_redis_metrics:
        logger.info("Redis metrics disabled, using in-memory storage")
        return False
    
    try:
        from app.cache.redis import get_redis_connection
        _metrics_redis = await get_redis_connection()
        logger.info("Distributed metrics initialized with Redis backend")
        return True
    except Exception as e:
        logger.warning(f"Redis unavailable for metrics, using in-memory fallback: {e}")
        _metrics_redis = None
        return False


async def _redis_incr(key: str, value: int = 1) -> int:
    """Increment a Redis counter atomically."""
    if _metrics_redis:
        try:
            return await _metrics_redis.incrby(f"{METRICS_PREFIX}{key}", value)
        except Exception as e:
            logger.warning(f"Redis metrics incr failed: {e}")
    return 0


async def _redis_incrbyfloat(key: str, value: float) -> float:
    """Increment a Redis float atomically."""
    if _metrics_redis:
        try:
            return await _metrics_redis.incrbyfloat(f"{METRICS_PREFIX}{key}", value)
        except Exception as e:
            logger.warning(f"Redis metrics incrbyfloat failed: {e}")
    return 0.0


async def _redis_get(key: str) -> Optional[str]:
    """Get a Redis value."""
    if _metrics_redis:
        try:
            return await _metrics_redis.get(f"{METRICS_PREFIX}{key}")
        except Exception as e:
            logger.warning(f"Redis metrics get failed: {e}")
    return None


async def _redis_set(key: str, value: str) -> bool:
    """Set a Redis value."""
    if _metrics_redis:
        try:
            await _metrics_redis.set(f"{METRICS_PREFIX}{key}", value)
            return True
        except Exception as e:
            logger.warning(f"Redis metrics set failed: {e}")
    return False


def _sync_increment_counter(name: str, labels: dict = None, value: int = 1):
    """Synchronous counter increment (uses local storage + schedules Redis update)."""
    key = f"{name}"
    if labels:
        key += ":" + ":".join(f"{k}={v}" for k, v in sorted(labels.items()))
    
    # Update local storage immediately
    if name not in _local_metrics:
        _local_metrics[name] = {}
    
    if isinstance(_local_metrics[name], dict):
        _local_metrics[name][key] = _local_metrics[name].get(key, 0) + value
    else:
        _local_metrics[name] += value
    
    # Schedule async Redis update (fire and forget)
    if _metrics_redis:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_redis_incr(key, value))
        except RuntimeError:
            pass  # No event loop running


def increment_counter(name: str, labels: dict = None, value: int = 1):
    """
    Increment a counter metric.
    Updates both local storage and Redis for distributed aggregation.
    """
    _sync_increment_counter(name, labels, value)


def _sync_observe_histogram(name: str, value: float, labels: dict = None):
    """Synchronous histogram observation."""
    key = f"{name}"
    if labels:
        key += ":" + ":".join(f"{k}={v}" for k, v in sorted(labels.items()))
    
    # Update local storage
    if name not in _local_metrics:
        _local_metrics[name] = {}
    
    if key not in _local_metrics[name]:
        _local_metrics[name][key] = [0.0, 0]  # [sum, count]
    
    _local_metrics[name][key][0] += value
    _local_metrics[name][key][1] += 1
    
    # Schedule async Redis updates (fire and forget)
    if _metrics_redis:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_redis_incrbyfloat(f"{key}:sum", value))
            loop.create_task(_redis_incr(f"{key}:count", 1))
        except RuntimeError:
            pass


def observe_histogram(name: str, value: float, labels: dict = None):
    """
    Observe a value for histogram metric (simplified as sum/count).
    Updates both local storage and Redis.
    """
    _sync_observe_histogram(name, labels, value)


def set_gauge(name: str, value: float):
    """Set a gauge metric value."""
    _local_metrics[name] = value
    
    # Schedule async Redis update
    if _metrics_redis:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_redis_set(name, str(value)))
        except RuntimeError:
            pass


def get_all_metrics() -> dict:
    """Get all metrics (local view - for debugging)."""
    return _local_metrics.copy()


async def get_distributed_metrics() -> dict:
    """
    Get aggregated metrics from Redis (distributed view).
    Falls back to local metrics if Redis unavailable.
    """
    if not _metrics_redis:
        return _local_metrics.copy()
    
    try:
        # Scan all metrics keys
        metrics = {}
        cursor = 0
        prefix = METRICS_PREFIX
        
        while True:
            cursor, keys = await _metrics_redis.scan(cursor, match=f"{prefix}*", count=100)
            
            for key in keys:
                short_key = key.replace(prefix, "")
                value = await _metrics_redis.get(key)
                if value:
                    try:
                        metrics[short_key] = float(value)
                    except ValueError:
                        metrics[short_key] = value
            
            if cursor == 0:
                break
        
        return metrics
    except Exception as e:
        logger.warning(f"Failed to fetch distributed metrics: {e}")
        return _local_metrics.copy()


def format_prometheus_metrics() -> str:
    """Format metrics in Prometheus text format (local view)."""
    lines = []
    
    # Add instance identifier for debugging
    import os
    instance_id = os.getenv("HOSTNAME", "unknown")
    lines.append(f"# Instance: {instance_id}")
    lines.append("")
    
    for name, value in _local_metrics.items():
        if isinstance(value, dict):
            for label_key, metric_value in value.items():
                if isinstance(metric_value, list):
                    # Histogram (sum/count)
                    clean_key = label_key.replace(":", ",").replace("=", '="') + '"' if "=" in label_key else ""
                    if clean_key:
                        lines.append(f"{name}_sum{{{clean_key}}} {metric_value[0]}")
                        lines.append(f"{name}_count{{{clean_key}}} {metric_value[1]}")
                    else:
                        lines.append(f"{name}_sum {metric_value[0]}")
                        lines.append(f"{name}_count {metric_value[1]}")
                else:
                    # Counter
                    clean_key = label_key.replace(":", ",").replace("=", '="') + '"' if "=" in label_key else ""
                    if clean_key:
                        lines.append(f"{name}{{{clean_key}}} {metric_value}")
                    else:
                        lines.append(f"{name} {metric_value}")
        else:
            # Gauge
            lines.append(f"{name} {value}")
    
    return "\n".join(lines)


async def format_distributed_prometheus_metrics() -> str:
    """Format distributed metrics from Redis in Prometheus text format."""
    metrics = await get_distributed_metrics()
    lines = []
    
    lines.append("# TYPE stockify_metrics_distributed gauge")
    lines.append("# HELP stockify_metrics_distributed Aggregated metrics across all instances")
    
    for key, value in metrics.items():
        # Clean up key for Prometheus format
        clean_key = key.replace(":", "_").replace("=", "_")
        lines.append(f"stockify_{clean_key} {value}")
    
    return "\n".join(lines)


class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware to collect HTTP request metrics with distributed storage."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip metrics endpoint itself
        if request.url.path == "/metrics" or request.url.path == "/api/v1/metrics":
            return await call_next(request)
        
        start_time = time.perf_counter()
        
        response = await call_next(request)
        
        duration = time.perf_counter() - start_time
        
        # Record metrics
        labels = {
            "method": request.method,
            "path": self._normalize_path(request.url.path),
            "status": str(response.status_code)
        }
        
        increment_counter("http_requests_total", labels)
        observe_histogram("http_request_duration_seconds", duration, {
            "method": request.method,
            "path": self._normalize_path(request.url.path)
        })
        
        return response
    
    def _normalize_path(self, path: str) -> str:
        """Normalize path to reduce cardinality (replace IDs with placeholders)."""
        parts = path.split("/")
        normalized = []
        for part in parts:
            # Replace UUIDs and numeric IDs with placeholder
            if part.isdigit() or (len(part) == 36 and "-" in part):
                normalized.append("{id}")
            else:
                normalized.append(part)
        return "/".join(normalized)


# WebSocket metrics helpers
def ws_connection_opened():
    """Track WebSocket connection opened."""
    _local_metrics["websocket_connections_active"] = _local_metrics.get("websocket_connections_active", 0) + 1
    _local_metrics["websocket_connections_total"] = _local_metrics.get("websocket_connections_total", 0) + 1
    
    if _metrics_redis:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_redis_incr("websocket_connections_active", 1))
            loop.create_task(_redis_incr("websocket_connections_total", 1))
        except RuntimeError:
            pass


def ws_connection_closed():
    """Track WebSocket connection closed."""
    _local_metrics["websocket_connections_active"] = max(0, _local_metrics.get("websocket_connections_active", 0) - 1)
    
    if _metrics_redis:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_redis_incr("websocket_connections_active", -1))
        except RuntimeError:
            pass


def ws_message_sent():
    """Track WebSocket message sent."""
    _local_metrics["websocket_messages_sent_total"] = _local_metrics.get("websocket_messages_sent_total", 0) + 1
    
    if _metrics_redis:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_redis_incr("websocket_messages_sent_total", 1))
        except RuntimeError:
            pass


# Cache metrics helpers
def cache_hit(cache_type: str = "default"):
    """Track cache hit."""
    increment_counter("cache_hits_total", {"type": cache_type})


def cache_miss(cache_type: str = "default"):
    """Track cache miss."""
    increment_counter("cache_misses_total", {"type": cache_type})


# External API metrics
def track_external_api(endpoint: str):
    """Decorator to track external API call metrics."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                duration = time.perf_counter() - start
                observe_histogram("external_api_duration_seconds", duration, {"endpoint": endpoint})
                return result
            except Exception as e:
                increment_counter("external_api_errors_total", {"endpoint": endpoint})
                raise
        return wrapper
    return decorator

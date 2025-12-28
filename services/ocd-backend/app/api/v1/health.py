"""
Health Check Endpoints
"""
from datetime import datetime
import time

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from app.config.settings import settings
from app.config.database import check_db_connection
from app.cache.redis import RedisCache, get_redis
from app.schemas.common import HealthResponse

router = APIRouter()

# Track app start time
_start_time = time.time()


@router.get("/health", response_model=HealthResponse)
async def health_check(
    redis: RedisCache = Depends(get_redis)
):
    """
    Health check endpoint.
    Returns status of database and Redis connections.
    """
    # Check database
    db_status = "connected"
    try:
        db_ok = await check_db_connection()
        if not db_ok:
            db_status = "disconnected"
    except Exception:
        db_status = "error"
    
    # Check Redis
    redis_status = "connected"
    try:
        redis_ok = await redis.ping()
        if not redis_ok:
            redis_status = "disconnected"
    except Exception:
        redis_status = "error"
    
    # Determine overall status
    if db_status == "connected" and redis_status == "connected":
        status = "healthy"
    elif db_status == "error" or redis_status == "error":
        status = "unhealthy"
    else:
        status = "degraded"
    
    return HealthResponse(
        status=status,
        version=settings.APP_VERSION,
        database=db_status,
        redis=redis_status,
        timestamp=datetime.utcnow(),
        uptime_seconds=round(time.time() - _start_time, 2)
    )


@router.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs"
    }


@router.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    """
    Prometheus metrics endpoint.
    Returns metrics in Prometheus text format for scraping.
    """
    from app.core.metrics import format_prometheus_metrics
    return format_prometheus_metrics()


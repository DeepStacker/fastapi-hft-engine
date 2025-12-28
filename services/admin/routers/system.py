"""
System Monitoring Router

Handles system statistics, health monitoring, and real-time metrics.
"""
from fastapi import APIRouter, Depends
from services.admin.auth import get_current_admin_user
from services.admin.models import SystemStats
from services.admin.services.metrics_collector import metrics_collector
from services.admin.services.cache import cache_service
import psutil
import time
import redis.asyncio as redis
from core.config.settings import get_settings
import logging

logger = logging.getLogger("stockify.admin.system")
router = APIRouter(prefix="/system", tags=["system"])
settings = get_settings()


@router.get("/stats", response_model=SystemStats)
async def get_system_stats(admin = Depends(get_current_admin_user)):
    """Get real-time system statistics"""
    # Try cache first (1 second TTL to prevent DoS but keep real-time)
    cache_key = "system:stats"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return SystemStats(**cached_data)

    # CPU, Memory, Disk from psutil
    cpu = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory().percent
    disk = psutil.disk_usage('/').percent
    
    active_connections = 0
    cache_hit_rate = 0.0
    
    try:
        # Use shared Redis connection from cache_service
        if not cache_service.redis:
            await cache_service.connect()
            
        redis_client = cache_service.redis
        
        # Get active WebSocket connections from Redis
        ws_count = await redis_client.get("ws:total_connections")
        active_connections = int(ws_count) if ws_count else 0
        
        # Get cache hit rate
        info = await redis_client.info("stats")
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        cache_hit_rate = (hits / (hits + misses) * 100) if (hits + misses) > 0 else 0.0
        
        # Do NOT close the shared connection
    except Exception as e:
        logger.error(f"Failed to get Redis stats: {e}")
    
    # Calculate uptime
    uptime_seconds = int(time.time() - psutil.boot_time())
    
    result = SystemStats(
        cpu_percent=cpu,
        memory_percent=memory,
        disk_percent=disk,
        active_connections=active_connections,
        cache_hit_rate=cache_hit_rate,
        uptime_seconds=uptime_seconds
    )
    
    # Cache result (1 second TTL)
    await cache_service.set(cache_key, result.dict(), ttl=1)
    
    return result


@router.get("/health")
async def health_check():
    """System health check"""
    return {
        "status": "healthy",
        "timestamp": time.time()
    }


# WebSocket for real-time updates
from fastapi import WebSocket, WebSocketDisconnect, Query, status
import asyncio
from services.admin.auth import get_current_admin_user, get_current_user
from jose import jwt, JWTError

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, 
    token: str = Query(None)
):
    """
    Real-time system dashboard updates via WebSocket
    Broadcasts system stats every second
    """
    # Validate token
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    try:
        # Basic validation - in production use proper dependency
        # We decode manually here to avoid complex WebSocket dependency injection issues
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    
    # Track connection in Redis
    # Track connection in Redis
    try:
        if not cache_service.redis:
            await cache_service.connect()
        await cache_service.redis.incr("ws:total_connections")
    except Exception as e:
        logger.error(f"Failed to track WS connection: {e}")
        
    try:
        while True:
            # Collect real-time stats
            cpu = psutil.cpu_percent(interval=None)
            memory = psutil.virtual_memory().percent
            disk = psutil.disk_usage('/').percent
            
            # Send update
            await websocket.send_json({
                "type": "system_stats",
                "data": {
                    "cpu_percent": cpu,
                    "memory_percent": memory,
                    "disk_percent": disk,
                    "timestamp": time.time()
                }
            })
            
            # Wait for next update
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        try:
            if cache_service.redis:
                await cache_service.redis.decr("ws:total_connections")
        except:
            pass

"""
Monitoring Endpoints - System metrics, WebSocket stats, Database info
Provides real-time monitoring data for admin dashboard
"""
import os
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    psutil = None

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.config.database import get_db, AsyncSessionLocal
from app.core.dependencies import CurrentAdmin
from app.schemas.common import ResponseModel
from app.cache.redis import RedisCache, get_redis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/monitoring", tags=["Admin Monitoring"])


# ═══════════════════════════════════════════════════════════════════
# System Metrics
# ═══════════════════════════════════════════════════════════════════

@router.get("/system", response_model=ResponseModel)
async def get_system_metrics(
    current_user: CurrentAdmin,
):
    """
    Get system metrics - CPU, memory, disk usage.
    """
    if not PSUTIL_AVAILABLE:
        return ResponseModel(
            success=False,
            message="psutil not installed. Install with: pip install psutil"
        )
    
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_count = psutil.cpu_count()
        
        # Memory
        memory = psutil.virtual_memory()
        
        # Disk
        disk = psutil.disk_usage('/')
        
        # Network (optional)
        try:
            net_io = psutil.net_io_counters()
            network = {
                "bytes_sent": net_io.bytes_sent,
                "bytes_recv": net_io.bytes_recv,
                "packets_sent": net_io.packets_sent,
                "packets_recv": net_io.packets_recv,
            }
        except Exception:
            network = None
        
        # Process info
        process = psutil.Process(os.getpid())
        process_memory = process.memory_info()
        
        metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count,
            },
            "memory": {
                "total": memory.total,
                "available": memory.available,
                "used": memory.used,
                "percent": memory.percent,
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": disk.percent,
            },
            "process": {
                "memory_rss": process_memory.rss,
                "memory_vms": process_memory.vms,
                "cpu_percent": process.cpu_percent(),
            },
            "network": network,
        }
        
        return ResponseModel(success=True, data=metrics)
        
    except Exception as e:
        logger.error(f"Failed to get system metrics: {e}")
        return ResponseModel(
            success=False,
            message=f"Failed to get system metrics: {str(e)}"
        )


# ═══════════════════════════════════════════════════════════════════
# WebSocket Stats (placeholder - integrate with your WS manager)
# ═══════════════════════════════════════════════════════════════════

# Store for tracking WS connections (in production, use Redis)
_ws_stats = {
    "active_connections": 0,
    "total_connections": 0,
    "total_messages_sent": 0,
    "last_broadcast": None,
}


def update_ws_stats(event: str, count: int = 1):
    """Update WebSocket statistics (call from WS handlers)"""
    if event == "connect":
        _ws_stats["active_connections"] += count
        _ws_stats["total_connections"] += count
    elif event == "disconnect":
        _ws_stats["active_connections"] = max(0, _ws_stats["active_connections"] - count)
    elif event == "broadcast":
        _ws_stats["total_messages_sent"] += count
        _ws_stats["last_broadcast"] = datetime.utcnow().isoformat()


@router.get("/websockets", response_model=ResponseModel)
async def get_websocket_stats(
    current_user: CurrentAdmin,
    cache: Optional[RedisCache] = Depends(get_redis),
):
    """
    Get WebSocket connection statistics.
    """
    # Try to get from Redis first (if WS manager uses Redis)
    ws_data = dict(_ws_stats)
    
    if cache:
        try:
            # Check for Redis-stored WS stats
            active = await cache.get("ws:active_connections")
            if active is not None:
                ws_data["active_connections"] = int(active)
        except Exception:
            pass
    
    ws_data["timestamp"] = datetime.utcnow().isoformat()
    
    return ResponseModel(success=True, data=ws_data)


# ═══════════════════════════════════════════════════════════════════
# Database Stats
# ═══════════════════════════════════════════════════════════════════

@router.get("/database", response_model=ResponseModel)
async def get_database_stats(
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Get database statistics - table counts, connection info.
    """
    try:
        # Get table row counts
        tables_query = """
            SELECT 
                relname as table_name,
                n_live_tup as row_count
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
        """
        result = await db.execute(text(tables_query))
        tables = [{"name": row[0], "rows": row[1]} for row in result.fetchall()]
        
        # Get database size
        size_query = "SELECT pg_database_size(current_database())"
        size_result = await db.execute(text(size_query))
        db_size = size_result.scalar()
        
        # Connection info
        conn_query = """
            SELECT count(*) FROM pg_stat_activity 
            WHERE datname = current_database()
        """
        conn_result = await db.execute(text(conn_query))
        active_connections = conn_result.scalar()
        
        stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "tables": tables,
            "database_size_bytes": db_size,
            "active_connections": active_connections,
        }
        
        return ResponseModel(success=True, data=stats)
        
    except Exception as e:
        logger.error(f"Failed to get database stats: {e}")
        return ResponseModel(
            success=False,
            message=f"Failed to get database stats: {str(e)}"
        )


# ═══════════════════════════════════════════════════════════════════
# Logs Viewer
# ═══════════════════════════════════════════════════════════════════

# Simple in-memory log buffer (in production, use file or external service)
_log_buffer: List[Dict[str, Any]] = []
MAX_LOG_BUFFER = 1000


class AdminLogHandler(logging.Handler):
    """Custom log handler that stores logs for admin viewing"""
    
    def emit(self, record):
        if len(_log_buffer) >= MAX_LOG_BUFFER:
            _log_buffer.pop(0)
        
        _log_buffer.append({
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": self.format(record),
        })


def setup_admin_log_handler():
    """Setup the admin log handler on root logger"""
    handler = AdminLogHandler()
    handler.setLevel(logging.INFO)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logging.getLogger().addHandler(handler)


@router.get("/logs", response_model=ResponseModel)
async def get_logs(
    current_user: CurrentAdmin,
    level: Optional[str] = Query(default=None, description="Filter by level: DEBUG, INFO, WARNING, ERROR"),
    limit: int = Query(default=100, le=500, description="Number of logs to return"),
    search: Optional[str] = Query(default=None, description="Search in log messages"),
):
    """
    Get recent application logs.
    """
    logs = list(reversed(_log_buffer))  # Most recent first
    
    # Filter by level
    if level:
        level_upper = level.upper()
        logs = [log for log in logs if log["level"] == level_upper]
    
    # Search filter
    if search:
        search_lower = search.lower()
        logs = [log for log in logs if search_lower in log["message"].lower()]
    
    # Limit
    logs = logs[:limit]
    
    return ResponseModel(
        success=True,
        data={
            "logs": logs,
            "total_in_buffer": len(_log_buffer),
            "filtered_count": len(logs),
        }
    )


# ═══════════════════════════════════════════════════════════════════
# Redis Stats
# ═══════════════════════════════════════════════════════════════════

@router.get("/redis", response_model=ResponseModel)
async def get_redis_stats(
    current_user: CurrentAdmin,
    cache: Optional[RedisCache] = Depends(get_redis),
):
    """
    Get Redis cache statistics.
    """
    if not cache:
        return ResponseModel(
            success=False,
            message="Redis not available"
        )
    
    try:
        info = await cache.info()
        
        stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "connected": True,
            "used_memory": info.get("used_memory_human", "N/A"),
            "connected_clients": info.get("connected_clients", 0),
            "total_keys": info.get("db0", {}).get("keys", 0) if isinstance(info.get("db0"), dict) else 0,
            "uptime_seconds": info.get("uptime_in_seconds", 0),
            "hit_rate": None,
        }
        
        # Calculate hit rate
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        if hits + misses > 0:
            stats["hit_rate"] = round(hits / (hits + misses) * 100, 2)
        
        return ResponseModel(success=True, data=stats)
        
    except Exception as e:
        logger.error(f"Failed to get Redis stats: {e}")
        return ResponseModel(
            success=False,
            message=f"Redis error: {str(e)}"
        )

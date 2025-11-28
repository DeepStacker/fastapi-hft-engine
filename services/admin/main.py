"""
Admin Dashboard Backend - Complete Implementation

Provides comprehensive admin API endpoints for system management.
"""
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
import asyncio
import json
from sqlalchemy import select, func, text, desc
from collections import defaultdict

from services.gateway.auth import get_current_admin_user
from core.database.db import async_session_factory
from core.database.models import (
    UserDB, AuditLogDB, APIKeyDB, InstrumentDB,
    MarketSnapshotDB, OptionContractDB
)

# Pydantic models
class SystemStats(BaseModel):
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    active_connections: int
    cache_hit_rate: float
    uptime_seconds: int

class LogEntry(BaseModel):
    id: int
    timestamp: datetime
    level: str
    service: str
    message: str
    metadata: Optional[Dict[str, Any]]

class AlertRule(BaseModel):
    id: Optional[int]
    name: str
    condition: str
    threshold: float
    severity: str  # critical, warning, info
    enabled: bool
    notification_channels: List[str]

class APIMetrics(BaseModel):
    endpoint: str
    total_requests: int
    avg_latency_ms: float
    error_rate: float
    last_hour_requests: int

class ServiceStatus(BaseModel):
    name: str
    status: str  # running, stopped, error
    uptime: int
    cpu_percent: float
    memory_mb: int
    restart_count: int

class ConfigItem(BaseModel):
    key: str
    value: str
    description: str
    category: str
    requires_restart: bool


admin_app = FastAPI(
    title="Stockify Admin API",
    description="Admin dashboard backend",
    version="1.0.0"
)


# ==================== SYSTEM MONITORING ====================

@admin_app.get("/system/stats", response_model=SystemStats)
async def get_system_stats(admin = Depends(get_current_admin_user)):
    """Get real-time system statistics"""
    import psutil
    import time
    from datetime import datetime
    
    # Get system metrics
    cpu = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory().percent
    disk = psutil.disk_usage('/').percent
    
    # Get active WebSocket connections
    from services.gateway.websocket_manager import manager
    active_connections = len(manager.active_connections)
    
    # Get cache hit rate from Redis
    import redis.asyncio as redis
    redis_client = await redis.from_url("redis://localhost:6379")
    info = await redis_client.info("stats")
    hits = info.get("keyspace_hits", 0)
    misses = info.get("keyspace_misses", 0)
    cache_hit_rate = (hits / (hits + misses) * 100) if (hits + misses) > 0 else 0
    
    # Calculate uptime
    with open("/proc/uptime", "r") as f:
        uptime_seconds = int(float(f.read().split()[0]))
    
    return {
        "cpu_percent": cpu,
        "memory_percent": memory,
        "disk_percent": disk,
        "active_connections": active_connections,
        "cache_hit_rate": cache_hit_rate,
        "uptime_seconds": uptime_seconds
    }


@admin_app.get("/system/realtime-stats")
async def realtime_stats_stream(admin = Depends(get_current_admin_user)):
    """Server-Sent Events stream for real-time stats"""
    async def event_generator():
        while True:
            stats = await get_system_stats(admin)
            yield f"data: {json.dumps(stats.dict())}\n\n"
            await asyncio.sleep(2)  # Update every 2 seconds
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


# ==================== LOG MANAGEMENT ====================

@admin_app.get("/logs", response_model=List[LogEntry])
async def get_logs(
    service: Optional[str] = None,
    level: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    admin = Depends(get_current_admin_user)
):
    """Get system logs with filtering"""
    async with async_session_factory() as session:
        stmt = select(AuditLogDB).order_by(desc(AuditLogDB.timestamp))
        
        # Apply filters
        if service:
            stmt = stmt.where(AuditLogDB.action.contains(service))
        if level:
            stmt = stmt.where(AuditLogDB.status_code >= 400 if level == "error" else AuditLogDB.status_code < 400)
        if search:
            stmt = stmt.where(AuditLogDB.action.contains(search) | AuditLogDB.resource.contains(search))
        
        stmt = stmt.limit(limit).offset(offset)
        
        result = await session.execute(stmt)
        logs = result.scalars().all()
        
        return [
            {
                "id": log.id,
                "timestamp": log.timestamp,
                "level": "error" if log.status_code >= 400 else "info",
                "service": "api",
                "message": f"{log.action} - {log.resource}",
                "metadata": log.details
            }
            for log in logs
        ]


@admin_app.get("/logs/stream")
async def logs_stream(admin = Depends(get_current_admin_user)):
    """Real-time log streaming via SSE"""
    async def log_generator():
        # In production, this would tail actual log files
        # For now, simulate with audit logs
        last_id = 0
        while True:
            async with async_session_factory() as session:
                stmt = select(AuditLogDB).where(
                    AuditLogDB.id > last_id
                ).order_by(AuditLogDB.timestamp).limit(10)
                
                result = await session.execute(stmt)
                logs = result.scalars().all()
                
                for log in logs:
                    last_id = log.id
                    yield f"data: {json.dumps({'id': log.id, 'timestamp': log.timestamp.isoformat(), 'message': log.action})}\n\n"
            
            await asyncio.sleep(1)
    
    return StreamingResponse(log_generator(), media_type="text/event-stream")


# ==================== ALERT MANAGEMENT ====================

# In-memory store (in production, use database)
alerts_store = []

@admin_app.get("/alerts", response_model=List[AlertRule])
async def get_alerts(admin = Depends(get_current_admin_user)):
    """Get all alert rules"""
    return alerts_store


@admin_app.post("/alerts", response_model=AlertRule)
async def create_alert(alert: AlertRule, admin = Depends(get_current_admin_user)):
    """Create new alert rule"""
    alert.id = len(alerts_store) + 1
    alerts_store.append(alert)
    return alert


@admin_app.put("/alerts/{alert_id}")
async def update_alert(alert_id: int, alert: AlertRule, admin = Depends(get_current_admin_user)):
    """Update alert rule"""
    for i, a in enumerate(alerts_store):
        if a.id == alert_id:
            alerts_store[i] = alert
            return alert
    raise HTTPException(status_code=404, detail="Alert not found")


@admin_app.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: int, admin = Depends(get_current_admin_user)):
    """Delete alert rule"""
    global alerts_store
    alerts_store = [a for a in alerts_store if a.id != alert_id]
    return {"message": "Alert deleted"}


# ==================== API ANALYTICS ====================

@admin_app.get("/analytics/endpoints", response_model=List[APIMetrics])
async def get_endpoint_metrics(
    timeframe: str = "1h",  # 1h, 24h, 7d
    admin = Depends(get_current_admin_user)
):
    """Get API endpoint usage metrics"""
    async with async_session_factory() as session:
        # Calculate timeframe
        now = datetime.utcnow()
        if timeframe == "1h":
            start_time = now - timedelta(hours=1)
        elif timeframe == "24h":
            start_time = now - timedelta(days=1)
        else:
            start_time = now - timedelta(days=7)
        
        # Query audit logs for endpoint metrics
        stmt = select(
            AuditLogDB.resource.label('endpoint'),
            func.count().label('total_requests'),
            func.count().filter(AuditLogDB.status_code >= 400).label('errors')
        ).where(
            AuditLogDB.timestamp >= start_time
        ).group_by(AuditLogDB.resource)
        
        result = await session.execute(stmt)
        rows = result.all()
        
        metrics = []
        for row in rows:
            total = row.total_requests
            errors = row.errors
            metrics.append({
                "endpoint": row.endpoint or "unknown",
                "total_requests": total,
                "avg_latency_ms": 0,  # Would need to track this separately
                "error_rate": (errors / total * 100) if total > 0 else 0,
                "last_hour_requests": total  # Simplified
            })
        
        return metrics


@admin_app.get("/analytics/users")
async def get_user_analytics(admin = Depends(get_current_admin_user)):
    """Get user activity analytics"""
    async with async_session_factory() as session:
        # Total users
        total_users = await session.execute(select(func.count()).select_from(UserDB))
        total = total_users.scalar()
        
        # Active users (last 24h)
        day_ago = datetime.utcnow() - timedelta(days=1)
        active_stmt = select(func.count(func.distinct(AuditLogDB.user_id))).where(
            AuditLogDB.timestamp >= day_ago
        )
        active_result = await session.execute(active_stmt)
        active = active_result.scalar()
        
        # New users (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        new_stmt = select(func.count()).select_from(UserDB).where(
            UserDB.created_at >= week_ago
        )
        new_result = await session.execute(new_stmt)
        new_users = new_result.scalar()
        
        return {
            "total_users": total,
            "active_users_24h": active,
            "new_users_7d": new_users,
            "retention_rate": (active / total * 100) if total > 0 else 0
        }


# ==================== SERVICE MANAGEMENT ====================

@admin_app.get("/services", response_model=List[ServiceStatus])
async def get_services(admin = Depends(get_current_admin_user)):
    """Get all service statuses"""
    import subprocess
    
    services = ["gateway", "ingestion", "processor", "storage", "realtime"]
    statuses = []
    
    for service in services:
        try:
            # Check if service is running (simplified)
            result = subprocess.run(
                ["docker", "ps", "--filter", f"name=stockify-{service}", "--format", "{{.Status}}"],
                capture_output=True,
                text=True
            )
            
            status = "running" if "Up" in result.stdout else "stopped"
            
            statuses.append({
                "name": service,
                "status": status,
                "uptime": 3600,  # Placeholder
                "cpu_percent": 0,
                "memory_mb": 0,
                "restart_count": 0
            })
        except Exception:
            statuses.append({
                "name": service,
                "status": "error",
                "uptime": 0,
                "cpu_percent": 0,
                "memory_mb": 0,
                "restart_count": 0
            })
    
    return statuses


@admin_app.post("/services/{service_name}/restart")
async def restart_service(service_name: str, admin = Depends(get_current_admin_user)):
    """Restart a service"""
    import subprocess
    
    try:
        subprocess.run(
            ["docker", "restart", f"stockify-{service_name}"],
            check=True
        )
        return {"message": f"Service {service_name} restarted successfully"}
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=500, detail="Failed to restart service")


# ==================== DATABASE MANAGEMENT ====================

@admin_app.post("/database/query")
async def execute_query(
    query: str,
    admin = Depends(get_current_admin_user)
):
    """Execute a database query (read-only)"""
    # Security: Only allow SELECT queries
    if not query.strip().upper().startswith("SELECT"):
        raise HTTPException(status_code=403, detail="Only SELECT queries allowed")
    
    async with async_session_factory() as session:
        try:
            result = await session.execute(text(query))
            rows = result.fetchall()
            columns = result.keys()
            
            return {
                "columns": list(columns),
                "rows": [dict(zip(columns, row)) for row in rows],
                "row_count": len(rows)
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@admin_app.get("/database/stats")
async def get_database_stats(admin = Depends(get_current_admin_user)):
    """Get database statistics"""
    async with async_session_factory() as session:
        # Table sizes
        stats = {}
        
        for model in [MarketSnapshotDB, OptionContractDB, InstrumentDB, UserDB]:
            count = await session.execute(select(func.count()).select_from(model))
            stats[model.__tablename__] = {
                "row_count": count.scalar(),
                "table_name": model.__tablename__
            }
        
        #  Database size
        size_query = text("SELECT pg_database_size(current_database())")
        size_result = await session.execute(size_query)
        db_size = size_result.scalar()
        
        return {
            "tables": stats,
            "total_size_bytes": db_size,
            "total_size_mb": round(db_size / 1024 / 1024, 2)
        }


# ==================== CACHE MANAGEMENT ====================

@admin_app.get("/cache/stats")
async def get_cache_stats(admin = Depends(get_current_admin_user)):
    """Get cache statistics"""
    import redis.asyncio as redis
    
    redis_client = await redis.from_url("redis://localhost:6379")
    info = await redis_client.info()
    
    return {
        "used_memory_mb": round(info["used_memory"] / 1024 / 1024, 2),
        "total_keys": info["db0"]["keys"] if "db0" in info else 0,
        "hit_rate": 0,  # Calculate from keyspace_hits/misses
        "evicted_keys": info.get("evicted_keys", 0)
    }


@admin_app.delete("/cache/flush")
async def flush_cache(admin = Depends(get_current_admin_user)):
    """Flush all cache"""
    import redis.asyncio as redis
    
    redis_client = await redis.from_url("redis://localhost:6379")
    await redis_client.flushall()
    
    return {"message": "Cache flushed successfully"}


# ==================== USER MANAGEMENT ====================

@admin_app.get("/users")
async def get_users(
    limit: int = 100,
    offset: int = 0,
    admin = Depends(get_current_admin_user)
):
    """Get all users"""
    async with async_session_factory() as session:
        stmt = select(UserDB).limit(limit).offset(offset)
        result = await session.execute(stmt)
        users = result.scalars().all()
        
        return [{
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_active": u.is_active,
            "is_admin": u.is_admin,
            "created_at": u.created_at.isoformat(),
            "last_login": u.last_login.isoformat() if u.last_login else None
        } for u in users]


@admin_app.put("/users/{user_id}/toggle")
async def toggle_user_status(user_id: int, admin = Depends(get_current_admin_user)):
    """Enable/disable user"""
    async with async_session_factory() as session:
        stmt = select(UserDB).where(UserDB.id == user_id)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user.is_active = not user.is_active
        await session.commit()
        
        return {"message": f"User {'enabled' if user.is_active else 'disabled'}"}


# ==================== CONFIGURATION ====================

# In-memory config store (in production, use database)
config_store = {
    "max_websocket_connections": {"value": "10", "category": "performance", "requires_restart": True},
    "cache_ttl_seconds": {"value": "60", "category": "caching", "requires_restart": False},
    "rate_limit_per_minute": {"value": "100", "category": "security", "requires_restart": False},
}

@admin_app.get("/config", response_model=List[ConfigItem])
async def get_config(admin = Depends(get_current_admin_user)):
    """Get all configuration items"""
    return [
        {
            "key": k,
            "value": v["value"],
            "description": f"Configuration for {k}",
            "category": v["category"],
            "requires_restart": v["requires_restart"]
        }
        for k, v in config_store.items()
    ]


@admin_app.put("/config/{key}")
async def update_config(
    key: str,
    value: str,
    admin = Depends(get_current_admin_user)
):
    """Update configuration value"""
    if key in config_store:
        config_store[key]["value"] = value
        return {"message": "Configuration updated", "requires_restart": config_store[key]["requires_restart"]}
    raise HTTPException(status_code=404, detail="Config key not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(admin_app, host="0.0.0.0", port=8001)

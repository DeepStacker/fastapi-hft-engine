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
    MarketSnapshotDB, OptionContractDB, SystemConfigDB, AlertRuleDB
)
import redis.asyncio as redis

# Redis client for Pub/Sub
redis_pubsub_client: redis.Redis = None

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

# Add CORS
from fastapi.middleware.cors import CORSMiddleware
admin_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    
    # Get active WebSocket connections (Mocked for now as we can't access Gateway memory)
    active_connections = 0
    
    # Get cache hit rate from Redis
    import redis.asyncio as redis
    try:
        redis_client = await redis.from_url("redis://redis:6379")
        info = await redis_client.info("stats")
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        cache_hit_rate = (hits / (hits + misses) * 100) if (hits + misses) > 0 else 0
        await redis_client.close()
    except Exception:
        cache_hit_rate = 0
    
    # Calculate uptime
    uptime_seconds = int(time.time() - psutil.boot_time())
    
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

@admin_app.get("/alerts", response_model=List[AlertRule])
async def get_alerts(admin = Depends(get_current_admin_user)):
    """Get all alert rules"""
    async with async_session_factory() as session:
        result = await session.execute(select(AlertRuleDB))
        alerts = result.scalars().all()
        return alerts


@admin_app.post("/alerts", response_model=AlertRule)
async def create_alert(alert: AlertRule, admin = Depends(get_current_admin_user)):
    """Create new alert rule"""
    async with async_session_factory() as session:
        db_alert = AlertRuleDB(
            name=alert.name,
            metric=alert.metric if hasattr(alert, 'metric') else "cpu", # Default or from model
            condition=alert.condition,
            threshold=alert.threshold,
            severity=alert.severity,
            enabled=alert.enabled,
            notification_channels=alert.notification_channels,
            created_by=admin.username
        )
        session.add(db_alert)
        await session.commit()
        await session.refresh(db_alert)
        return db_alert


@admin_app.put("/alerts/{alert_id}")
async def update_alert(alert_id: int, alert: AlertRule, admin = Depends(get_current_admin_user)):
    """Update alert rule"""
    async with async_session_factory() as session:
        stmt = select(AlertRuleDB).where(AlertRuleDB.id == alert_id)
        result = await session.execute(stmt)
        db_alert = result.scalar_one_or_none()
        
        if not db_alert:
            raise HTTPException(status_code=404, detail="Alert not found")
            
        db_alert.name = alert.name
        db_alert.condition = alert.condition
        db_alert.threshold = alert.threshold
        db_alert.severity = alert.severity
        db_alert.enabled = alert.enabled
        db_alert.notification_channels = alert.notification_channels
        
        await session.commit()
        await session.refresh(db_alert)
        return db_alert


@admin_app.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: int, admin = Depends(get_current_admin_user)):
    """Delete alert rule"""
    async with async_session_factory() as session:
        stmt = select(AlertRuleDB).where(AlertRuleDB.id == alert_id)
        result = await session.execute(stmt)
        db_alert = result.scalar_one_or_none()
        
        if not db_alert:
            raise HTTPException(status_code=404, detail="Alert not found")
            
        await session.delete(db_alert)
        await session.commit()
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
    import aiodocker
    
    services = ["gateway", "ingestion", "processor", "storage", "realtime", "admin", "timescaledb", "redis", "kafka", "zookeeper"]
    statuses = []
    
    async with aiodocker.Docker() as docker:
        for service in services:
            try:
                # Find container by name
                container_name = f"stockify-{service}"
                try:
                    container = await docker.containers.get(container_name)
                    info = await container.show()
                    
                    state = info.get("State", {})
                    status = "running" if state.get("Running") else "stopped"
                    started_at = state.get("StartedAt")
                    
                    # Calculate uptime
                    uptime = 0
                    if started_at and status == "running":
                        try:
                            # Parse Docker timestamp (ISO 8601)
                            start_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                            uptime = int((datetime.now(start_dt.tzinfo) - start_dt).total_seconds())
                        except Exception:
                            pass
                            
                    # Get stats (simplified, just placeholder for now as stats() is a stream)
                    # For real stats we'd need to stream briefly or use a separate collector
                    
                    statuses.append({
                        "name": service,
                        "status": status,
                        "uptime": uptime,
                        "cpu_percent": 0, # Requires stats stream
                        "memory_mb": 0,   # Requires stats stream
                        "restart_count": info.get("RestartCount", 0)
                    })
                except aiodocker.exceptions.DockerError:
                     statuses.append({
                        "name": service,
                        "status": "stopped", # Not found means stopped/not created
                        "uptime": 0,
                        "cpu_percent": 0,
                        "memory_mb": 0,
                        "restart_count": 0
                    })
            except Exception as e:
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
    import aiodocker
    
    async with aiodocker.Docker() as docker:
        try:
            container_name = f"stockify-{service_name}"
            container = await docker.containers.get(container_name)
            await container.restart()
            return {"message": f"Service {service_name} restarted successfully"}
        except aiodocker.exceptions.DockerError as e:
            raise HTTPException(status_code=500, detail=f"Failed to restart service: {str(e)}")


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

@admin_app.get("/config", response_model=List[ConfigItem])
async def get_config(admin = Depends(get_current_admin_user)):
    """Get all configuration items"""
    async with async_session_factory() as session:
        result = await session.execute(select(SystemConfigDB))
        configs = result.scalars().all()
        return [
            {
                "key": c.key,
                "value": c.value,
                "description": c.description or "",
                "category": c.category,
                "requires_restart": c.requires_restart
            }
            for c in configs
        ]


@admin_app.put("/config/{key}")
async def update_config(
    key: str,
    value: str,
    admin = Depends(get_current_admin_user)
):
    """Update configuration value"""
    global redis_pubsub_client
    
    async with async_session_factory() as session:
        stmt = select(SystemConfigDB).where(SystemConfigDB.key == key)
        result = await session.execute(stmt)
        config = result.scalar_one_or_none()
        
        if not config:
            # Create if not exists (upsert)
            config = SystemConfigDB(
                key=key,
                value=value,
                category="general", # Default
                updated_by=admin.username
            )
            session.add(config)
        else:
            config.value = value
            config.updated_by = admin.username
            
        await session.commit()
        
        # Broadcast change via Redis Pub/Sub
        try:
            if redis_pubsub_client:
                message = json.dumps({"key": key, "action": "update"})
                await redis_pubsub_client.publish("config:updates", message)
        except Exception as e:
            # Don't fail the update if pub/sub fails
            pass
        
        return {"message": "Configuration updated", "requires_restart": config.requires_restart}


@admin_app.on_event("startup")
async def startup():
    """Initialize Redis Pub/Sub on startup."""
    global redis_pubsub_client
    redis_pubsub_client = await redis.from_url("redis://redis:6379/0", decode_responses=True)




@admin_app.get("/dashboard.html")
@admin_app.get("/dashboard")
@admin_app.get("/")
async def serve_dashboard():
    """Serve the admin dashboard HTML"""
    from fastapi.responses import FileResponse
    import os
    dashboard_path = os.path.join(os.path.dirname(__file__), "dashboard.html")
    return FileResponse(dashboard_path, media_type="text/html")


@admin_app.on_event("shutdown")
async def shutdown():
    """Cleanup Redis on shutdown."""
    global redis_pubsub_client
    if redis_pubsub_client:
        await redis_pubsub_client.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(admin_app, host="0.0.0.0", port=8001)

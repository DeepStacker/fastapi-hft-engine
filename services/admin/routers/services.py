"""
Services Management Router

Handles microservice monitoring and management with real Docker stats.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from services.admin.auth import get_current_admin_user
from services.admin.models import ServiceStatus
from services.admin.services.metrics_collector import metrics_collector
from services.admin.services.docker_manager import docker_manager
from services.admin.services.cache import cache_service
import logging
from datetime import datetime

logger = logging.getLogger("stockify.admin.services")
router = APIRouter(prefix="/services", tags=["services"])

# Service names in the system
KNOWN_SERVICES = [
    "gateway",
    "ingestion",
    "processor",
    "storage",
    "realtime",
    "grpc-server",
    "admin"
]

# Map service names to actual container names (without stockify- prefix if standard)
# Default behavior assumes stockify-{service_name}
SERVICE_CONTAINER_MAP = {
    "grpc-server": "stockify-grpc",
}

def get_container_name(service_name: str) -> str:
    """Get the actual container name for a service"""
    return SERVICE_CONTAINER_MAP.get(service_name, f"stockify-{service_name}")


@router.get("", response_model=List[ServiceStatus])
async def list_services(admin = Depends(get_current_admin_user)):
    """List all services with real Docker status and metrics"""
    # Try cache first (short TTL due to real-time nature)
    cache_key = "services:list"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return [ServiceStatus(**item) for item in cached_data]

    services = []
    
    # Get all containers first to avoid multiple Docker calls
    import asyncio
    containers = await asyncio.to_thread(docker_manager.list_containers, all=True)
    container_map = {c['name']: c for c in containers}
    
    # Fetch metrics for all services concurrently
    metrics_tasks = [metrics_collector.get_service_cpu_memory(name) for name in KNOWN_SERVICES]
    metrics_results = await asyncio.gather(*metrics_tasks)
    metrics_map = dict(zip(KNOWN_SERVICES, metrics_results))

    for service_name in KNOWN_SERVICES:
        try:
            target_container_name = get_container_name(service_name)
            container = container_map.get(target_container_name)
            
            if container:
                # Calculate uptime
                uptime = 0
                restart_count = 0
                
                if container['status'] == 'running':
                    try:
                        # Parse StartedAt: "2023-10-27T10:00:00.123456789Z"
                        started_at_str = container.get('started_at', '')
                        # Handle nanoseconds if present (Python < 3.11 doesn't handle them well in fromisoformat)
                        if '.' in started_at_str:
                            # Truncate to microseconds
                            base, fraction = started_at_str.split('.')
                            if fraction.endswith('Z'):
                                fraction = fraction[:-1]
                            started_at_str = f"{base}.{fraction[:6]}"
                        elif started_at_str.endswith('Z'):
                             started_at_str = started_at_str[:-1]
                             
                        started_at = datetime.fromisoformat(started_at_str)
                        uptime = int((datetime.utcnow() - started_at).total_seconds())
                    except Exception as e:
                        logger.warning(f"Failed to parse uptime for {service_name}: {e}")
                        uptime = 0
                
                # Get restart count
                restart_count = container.get('restart_count', 0)
                
                # Get real metrics from pre-fetched map
                cpu_percent, memory_mb = metrics_map.get(service_name, (0.0, 0.0))
                
                status = container['status']
                
            else:
                status = "stopped"
                uptime = 0
                cpu_percent = 0.0
                memory_mb = 0
                restart_count = 0

            services.append(ServiceStatus(
                name=service_name,
                status=status,
                uptime=uptime,
                cpu_percent=cpu_percent,
                memory_mb=int(memory_mb),
                restart_count=restart_count
            ))
        except Exception as e:
            logger.error(f"Failed to get stats for {service_name}: {e}")
            services.append(ServiceStatus(
                name=service_name,
                status="error",
                uptime=0,
                cpu_percent=0.0,
                memory_mb=0,
                restart_count=0
            ))
    
    # Cache the result (5 seconds TTL)
    await cache_service.set(
        cache_key, 
        [s.dict() for s in services], 
        ttl=5
    )
    
    return services


@router.get("/{service_name}", response_model=ServiceStatus)
async def get_service(
    service_name: str,
    admin = Depends(get_current_admin_user)
):
    """Get detailed stats for a specific service"""
    if service_name not in KNOWN_SERVICES:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
    
    # Try cache first
    cache_key = f"services:detail:{service_name}"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return ServiceStatus(**cached_data)

    try:
        container_name = get_container_name(service_name)
        container = docker_manager.get_container(container_name)
        
        if not container:
             result = ServiceStatus(
                name=service_name,
                status="stopped",
                uptime=0,
                cpu_percent=0.0,
                memory_mb=0,
                restart_count=0
            )
             await cache_service.set(cache_key, result.dict(), ttl=5)
             return result

        cpu_percent, memory_mb = await metrics_collector.get_service_cpu_memory(service_name)
        
        result = ServiceStatus(
            name=service_name,
            status=container.status,
            uptime=0, # Placeholder
            cpu_percent=cpu_percent,
            memory_mb=int(memory_mb),
            restart_count=0
        )
        
        # Cache result
        await cache_service.set(cache_key, result.dict(), ttl=5)
        return result
        
    except Exception as e:
        logger.error(f"Failed to get stats for {service_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{service_name}/restart")
async def restart_service(
    service_name: str,
    admin = Depends(get_current_admin_user)
):
    """Restart a service using Docker API"""
    if service_name not in KNOWN_SERVICES:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
    
    try:
        container_id = get_container_name(service_name)
        success = docker_manager.restart_container(container_id)
        
        if success:
            # Invalidate caches
            await cache_service.delete("services:list")
            await cache_service.delete(f"services:detail:{service_name}")
            
            return {"message": f"Service {service_name} restarted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to restart container")
            
    except Exception as e:
        logger.error(f"Failed to restart {service_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{service_name}/reload-config")
async def reload_service_config(
    service_name: str,
    admin = Depends(get_current_admin_user)
):
    """Trigger hot configuration reload for a service"""
    from services.admin.services.config_reloader import config_reloader
    
    success = await config_reloader.trigger_reload(service_name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to trigger config reload")
        
    return {"message": f"Configuration reload triggered for {service_name}"}


@router.get("/{service_name}/logs")
async def get_service_logs(
    service_name: str,
    lines: int = 100,
    admin = Depends(get_current_admin_user)
):
    """Get recent logs for a service"""
    if service_name not in KNOWN_SERVICES:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
    
    try:
        container_id = get_container_name(service_name)
        logs = docker_manager.get_logs(container_id, tail=lines)
        
        if logs is None:
             raise HTTPException(status_code=404, detail="Logs not found or container not running")

        return {
            "service": service_name,
            "logs": logs.split('\n') if isinstance(logs, str) else [],
            "message": "Logs retrieved successfully"
        }
    except Exception as e:
        logger.error(f"Failed to get logs for {service_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket for real-time service updates
from fastapi import WebSocket, WebSocketDisconnect, Query, status
from jose import jwt, JWTError
import asyncio
from core.config.settings import get_settings

@router.websocket("/ws")
async def websocket_services(
    websocket: WebSocket,
    token: str = Query(None)
):
    """
    Real-time service status updates via WebSocket
    """
    settings = get_settings()
    
    # Validate token
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("sub") is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    
    try:
        while True:
            # Get all containers
            containers = await asyncio.to_thread(docker_manager.list_containers, all=True)
            container_map = {c['name']: c for c in containers}
            
            # Fetch metrics for all services concurrently
            metrics_tasks = [metrics_collector.get_service_cpu_memory(name) for name in KNOWN_SERVICES]
            metrics_results = await asyncio.gather(*metrics_tasks)
            metrics_map = dict(zip(KNOWN_SERVICES, metrics_results))
            
            services_data = []
            
            for service_name in KNOWN_SERVICES:
                target_container_name = get_container_name(service_name)
                container = container_map.get(target_container_name)
                if container:
                    cpu_percent, memory_mb = metrics_map.get(service_name, (0.0, 0.0))
                    
                    # Calculate uptime
                    uptime = 0
                    if container['status'] == 'running':
                        try:
                            started_at_str = container.get('started_at', '')
                            if '.' in started_at_str:
                                base, fraction = started_at_str.split('.')
                                if fraction.endswith('Z'): fraction = fraction[:-1]
                                started_at_str = f"{base}.{fraction[:6]}"
                            elif started_at_str.endswith('Z'):
                                started_at_str = started_at_str[:-1]
                            started_at = datetime.fromisoformat(started_at_str)
                            uptime = int((datetime.utcnow() - started_at).total_seconds())
                        except:
                            uptime = 0

                    services_data.append({
                        "name": service_name,
                        "status": str(container['status']),
                        "uptime": uptime,
                        "cpu_percent": cpu_percent,
                        "memory_mb": int(memory_mb),
                        "restart_count": container.get('restart_count', 0)
                    })
                else:
                    services_data.append({
                        "name": service_name,
                        "status": "stopped",
                        "uptime": 0,
                        "cpu_percent": 0,
                        "memory_mb": 0,
                        "restart_count": 0
                    })
            
            await websocket.send_json({
                "type": "services_update",
                "data": services_data
            })
            
            await asyncio.sleep(2)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error in services: {e}")

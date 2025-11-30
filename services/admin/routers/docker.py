"""
Docker Control Router

Endpoints for managing Docker containers - restart, stop, start, logs, stats.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from services.api_gateway.auth import get_current_admin_user
from services.admin.services.docker_manager import docker_manager

router = APIRouter(prefix="/docker", tags=["docker"])


class ContainerInfo(BaseModel):
    id: str
    name: str
    image: str
    status: str
    state: str
    created: str
    ports: dict


class ContainerStats(BaseModel):
    cpu_percent: float
    memory_usage: int
    memory_limit: int
    memory_percent: float
    network_rx_bytes: int
    network_tx_bytes: int


@router.get("/containers", response_model=List[ContainerInfo])
async def list_containers(
    all: bool = True,
    admin = Depends(get_current_admin_user)
):
    """List all Docker containers"""
    containers = docker_manager.list_containers(all=all)
    return containers


@router.post("/containers/{container_id}/restart")
async def restart_container(
    container_id: str,
    admin = Depends(get_current_admin_user)
):
    """Restart a Docker container"""
    success = docker_manager.restart_container(container_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Container not found or restart failed")
    
    return {"message": f"Container {container_id} restarted successfully"}


@router.post("/containers/{container_id}/stop")
async def stop_container(
    container_id: str,
    timeout: int = 10,
    admin = Depends(get_current_admin_user)
):
    """Stop a Docker container"""
    success = docker_manager.stop_container(container_id, timeout=timeout)
    
    if not success:
        raise HTTPException(status_code=404, detail="Container not found or stop failed")
    
    return {"message": f"Container {container_id} stopped successfully"}


@router.post("/containers/{container_id}/start")
async def start_container(
    container_id: str,
    admin = Depends(get_current_admin_user)
):
    """Start a Docker container"""
    success = docker_manager.start_container(container_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Container not found or start failed")
    
    return {"message": f"Container {container_id} started successfully"}


@router.get("/containers/{container_id}/logs")
async def get_container_logs(
    container_id: str,
    tail: int = 100,
    admin = Depends(get_current_admin_user)
):
    """Get container logs"""
    logs = docker_manager.get_container_logs(container_id, tail=tail, follow=False)
    
    if logs is None:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Decode bytes to string
    log_text = logs.decode('utf-8') if isinstance(logs, bytes) else str(logs)
    
    return {
        "container_id": container_id,
        "logs": log_text,
        "lines": log_text.split('\n')
    }


@router.get("/containers/{container_id}/stats", response_model=ContainerStats)
async def get_container_stats(
    container_id: str,
    admin = Depends(get_current_admin_user)
):
    """Get container resource stats"""
    stats = docker_manager.get_container_stats(container_id)
    
    if stats is None:
        raise HTTPException(status_code=404, detail="Container not found or stats unavailable")
    
    return stats

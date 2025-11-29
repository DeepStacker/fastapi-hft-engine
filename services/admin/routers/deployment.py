"""
Deployment Router

Endpoints for service orchestration - deploy, scale, update.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.gateway.auth import get_current_admin_user
from services.admin.services.orchestrator import orchestrator

router = APIRouter(prefix="/deployment", tags=["deployment"])


class ScaleRequest(BaseModel):
    service_name: str
    replicas: int


class UpdateRequest(BaseModel):
    service_name: str
    image_tag: str = "latest"


@router.post("/scale")
async def scale_service(
    request: ScaleRequest,
    admin = Depends(get_current_admin_user)
):
    """Scale a service"""
    success = orchestrator.scale_service(request.service_name, request.replicas)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to scale service")
    
    return {"message": f"Service {request.service_name} scaling to {request.replicas} initiated"}


@router.post("/update")
async def update_service(
    request: UpdateRequest,
    admin = Depends(get_current_admin_user)
):
    """Update a service image"""
    success = orchestrator.update_service(request.service_name, request.image_tag)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update service")
    
    return {"message": f"Service {request.service_name} update initiated"}


@router.post("/deploy")
async def deploy_stack(
    admin = Depends(get_current_admin_user)
):
    """Deploy/Update entire stack"""
    success = orchestrator.deploy_stack()
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to deploy stack")
    
    return {"message": "Stack deployment initiated"}

"""
Deployment Router

Endpoints for service orchestration - deploy, scale, update.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from services.admin.auth import get_current_admin_user
from services.admin.services.orchestrator import orchestrator
from services.admin.services.audit import audit_service

router = APIRouter(prefix="/deployment", tags=["deployment"])


class ScaleRequest(BaseModel):
    service_name: str
    replicas: int


class UpdateRequest(BaseModel):
    service_name: str
    image_tag: str = "latest"


@router.post("/scale")
async def scale_service(
    data: ScaleRequest,
    request: Request,
    admin = Depends(get_current_admin_user)
):
    """Scale a service"""
    try:
        success = orchestrator.scale_service(data.service_name, data.replicas)
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Scale operation failed: {str(e)}. Note: Scaling from inside a container has limitations."
        )
    
    if not success:
        raise HTTPException(
            status_code=500, 
            detail="Failed to scale service. Check admin-service logs for details. This may be due to Docker network conflicts when running compose from inside a container."
        )
    
    # Audit log
    await audit_service.log(
        action="SCALE",
        resource_type="DEPLOYMENT",
        resource_id=data.service_name,
        details={"replicas": data.replicas},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Service {data.service_name} scaling to {data.replicas} initiated"}


@router.post("/update")
async def update_service(
    data: UpdateRequest,
    request: Request,
    admin = Depends(get_current_admin_user)
):
    """Update a service image"""
    success = orchestrator.update_service(data.service_name, data.image_tag)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update service")
    
    # Audit log
    await audit_service.log(
        action="UPDATE_IMAGE",
        resource_type="DEPLOYMENT",
        resource_id=data.service_name,
        details={"image_tag": data.image_tag},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Service {data.service_name} update initiated"}


@router.post("/deploy")
async def deploy_stack(
    request: Request,
    admin = Depends(get_current_admin_user)
):
    """Deploy/Update entire stack"""
    success = orchestrator.deploy_stack()
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to deploy stack")
    
    # Audit log
    await audit_service.log(
        action="DEPLOY_STACK",
        resource_type="DEPLOYMENT",
        resource_id="full_stack",
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Stack deployment initiated"}

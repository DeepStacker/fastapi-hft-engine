"""
Audit Logs Router
Exposes audit logs to the frontend.
"""
from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from sqlalchemy import select, desc
from services.admin.auth import get_current_admin_user
from services.admin.models.schemas import AuditLog
from core.database.pool import read_session
from core.database.models import AdminAuditLogDB
from uuid import UUID

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("", response_model=List[AuditLog])
async def list_audit_logs(
    skip: int = 0,
    limit: int = 50,
    resource_type: Optional[str] = None,
    action: Optional[str] = None,
    actor_id: Optional[UUID] = None,
    admin = Depends(get_current_admin_user)
):
    """List audit logs with filtering"""
    async with read_session() as session:
        query = select(AdminAuditLogDB).order_by(desc(AdminAuditLogDB.timestamp))
        
        if resource_type:
            query = query.where(AdminAuditLogDB.resource_type == resource_type)
        if action:
            query = query.where(AdminAuditLogDB.action == action)
        if actor_id:
             query = query.where(AdminAuditLogDB.actor_id == actor_id)
             
        query = query.offset(skip).limit(limit)
        result = await session.execute(query)
        logs = result.scalars().all()
        return logs

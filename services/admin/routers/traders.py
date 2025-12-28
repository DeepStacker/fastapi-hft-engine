"""
Traders Management Router

Handles operations on App Users (Traders) - formerly managed by OCD Backend.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlalchemy import select, update, or_
from services.admin.auth import get_current_admin_user
from services.admin.models.schemas import AppUser, AppUserUpdate, AppUserCreate
from core.database.pool import read_session, write_session
from core.database.models import AppUserDB
from services.admin.services.audit import audit_service
import logging
from uuid import UUID, uuid4
from datetime import datetime
from fastapi import Request

logger = logging.getLogger("stockify.admin.traders")
router = APIRouter(prefix="/traders", tags=["traders"])

@router.get("", response_model=List[AppUser])
async def list_traders(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    admin = Depends(get_current_admin_user)
):
    """List application users (traders)"""
    async with read_session() as session:
        query = select(AppUserDB)
        
        if search:
            search_filter = or_(
                AppUserDB.email.ilike(f"%{search}%"),
                AppUserDB.username.ilike(f"%{search}%"),
                AppUserDB.full_name.ilike(f"%{search}%")
            )
            query = query.where(search_filter)
            
        query = query.offset(skip).limit(limit)
        result = await session.execute(query)
        users = result.scalars().all()
        return users

@router.put("/{user_id}", response_model=AppUser)
async def update_trader(
    user_id: UUID,
    user_update: AppUserUpdate,
    request: Request,
    admin = Depends(get_current_admin_user)
):
    """Update trader status/role"""
    async with write_session() as session:
        result = await session.execute(select(AppUserDB).where(AppUserDB.id == user_id))
        db_user = result.scalar_one_or_none()
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Capture old state for audit
        changes = {}
        if user_update.is_active is not None and user_update.is_active != db_user.is_active:
            changes["is_active"] = {"old": db_user.is_active, "new": user_update.is_active}
        if user_update.role is not None and user_update.role != db_user.role:
            changes["role"] = {"old": str(db_user.role), "new": str(user_update.role)}
        if user_update.full_name is not None and user_update.full_name != db_user.full_name:
            changes["full_name"] = {"old": db_user.full_name, "new": user_update.full_name}

        if user_update.is_active is not None:
            db_user.is_active = user_update.is_active
        if user_update.role is not None:
             db_user.role = user_update.role
        if user_update.full_name is not None:
            db_user.full_name = user_update.full_name
            
        await session.commit()
        await session.refresh(db_user)
        
        # Audit Log
        if changes:
             await audit_service.log(
                action="UPDATE",
                resource_type="USER",
                resource_id=str(user_id),
                actor_id=None, # Admin ID extracted from token usually, currently admin object format varies
                details=changes,
                ip_address=request.client.host
             )
        
        return db_user

@router.post("", response_model=AppUser)
async def create_trader(
    user_create: AppUserCreate,
    request: Request,
    admin = Depends(get_current_admin_user)
):
    """Create a new trader (DB record only)"""
    async with write_session() as session:
        # Check if exists
        result = await session.execute(
            select(AppUserDB).where(
                or_(
                    AppUserDB.email == user_create.email,
                    AppUserDB.username == user_create.username
                )
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="User with this email or username already exists")

        new_user = AppUserDB(
            id=uuid4(),
            firebase_uid=user_create.firebase_uid,
            email=user_create.email,
            username=user_create.username,
            full_name=user_create.full_name,
            role=user_create.role,
            is_active=user_create.is_active,
            created_at=datetime.utcnow()
        )
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)
        
        # Audit Log
        await audit_service.log(
            action="CREATE",
            resource_type="USER",
            resource_id=str(new_user.id),
            details={"username": new_user.username, "email": new_user.email},
            ip_address=request.client.host
        )
        
        return new_user

@router.delete("/{user_id}", status_code=204)
async def delete_trader(
    user_id: UUID,
    request: Request,
    admin = Depends(get_current_admin_user)
):
    """Delete a trader"""
    async with write_session() as session:
        result = await session.execute(select(AppUserDB).where(AppUserDB.id == user_id))
        db_user = result.scalar_one_or_none()
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        username = db_user.username
        await session.delete(db_user)
        await session.commit()
        
        # Audit Log
        await audit_service.log(
            action="DELETE",
            resource_type="USER",
            resource_id=str(user_id),
            details={"username": username},
            ip_address=request.client.host
        )

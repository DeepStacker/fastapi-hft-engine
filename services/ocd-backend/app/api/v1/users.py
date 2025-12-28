"""
Users Endpoints - Admin user management
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.core.dependencies import CurrentAdmin
from app.core.exceptions import NotFoundException, ValidationException
from app.repositories.user import UserRepository
from app.models.user import UserRole
from app.schemas.user import UserResponse, UserUpdate, UserListResponse
from app.schemas.common import ResponseModel, PaginatedResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=PaginatedResponse[UserListResponse])
async def list_users(
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str = Query(default=None),
):
    """
    List all users (admin only).
    """
    user_repo = UserRepository(db)
    skip = (page - 1) * page_size
    
    if search:
        users = await user_repo.search(search, skip, page_size)
        total = len(users)  # Simplified; should count total matches
    else:
        users = await user_repo.get_all(skip=skip, limit=page_size, order_by="created_at", descending=True)
        total = await user_repo.count()
    
    pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        items=[UserListResponse.model_validate(u.to_dict()) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


@router.get("/{user_id}", response_model=ResponseModel[UserResponse])
async def get_user(
    user_id: UUID,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Get user by ID (admin only).
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    
    if not user:
        raise NotFoundException("User", user_id)
    
    return ResponseModel(
        success=True,
        data=UserResponse.model_validate(user.to_dict())
    )


@router.put("/{user_id}", response_model=ResponseModel[UserResponse])
async def update_user(
    user_id: UUID,
    update_data: UserUpdate,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Update user (admin only).
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    
    if not user:
        raise NotFoundException("User", user_id)
    
    # Convert role string to enum if provided
    update_dict = update_data.model_dump(exclude_unset=True)
    if "role" in update_dict:
        update_dict["role"] = UserRole(update_dict["role"])
    
    updated_user = await user_repo.update(user_id, update_dict)
    await db.commit()
    
    logger.info(f"User {user_id} updated by admin {current_user.email}")
    
    return ResponseModel(
        success=True,
        message="User updated successfully",
        data=UserResponse.model_validate(updated_user.to_dict())
    )


@router.post("/{user_id}/deactivate", response_model=ResponseModel)
async def deactivate_user(
    user_id: UUID,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Deactivate a user (admin only).
    """
    if user_id == current_user.id:
        raise ValidationException("Cannot deactivate yourself")
    
    user_repo = UserRepository(db)
    user = await user_repo.deactivate(user_id)
    
    if not user:
        raise NotFoundException("User", user_id)
    
    await db.commit()
    
    logger.info(f"User {user_id} deactivated by admin {current_user.email}")
    
    return ResponseModel(
        success=True,
        message="User deactivated successfully"
    )


@router.post("/{user_id}/activate", response_model=ResponseModel)
async def activate_user(
    user_id: UUID,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Activate a user (admin only).
    """
    user_repo = UserRepository(db)
    user = await user_repo.activate(user_id)
    
    if not user:
        raise NotFoundException("User", user_id)
    
    await db.commit()
    
    logger.info(f"User {user_id} activated by admin {current_user.email}")
    
    return ResponseModel(
        success=True,
        message="User activated successfully"
    )

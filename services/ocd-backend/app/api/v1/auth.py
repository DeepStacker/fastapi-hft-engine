"""
Authentication Endpoints
"""
import os
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.core.security import verify_firebase_token, revoke_user_tokens
from app.core.exceptions import UnauthorizedException, ValidationException
from app.core.dependencies import CurrentUser, Cache
from app.repositories.user import UserRepository
from app.models.user import UserRole
from app.schemas.user import (
    AuthVerifyRequest,
    AuthVerifyResponse,
    UserResponse,
    UserProfileUpdate,
)
from app.schemas.common import ResponseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# Get admin email from environment
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").lower().strip()


@router.post("/verify", response_model=AuthVerifyResponse)
async def verify_token(
    request: AuthVerifyRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    cache: Cache = None
):
    """
    Verify Firebase ID token and return user data.
    Creates user if not exists.
    Auto-promotes ADMIN_EMAIL user to admin role.
    """
    # Verify token
    token_data = verify_firebase_token(request.id_token)
    if not token_data:
        raise UnauthorizedException("Invalid or expired token")
    
    firebase_uid = token_data.get("uid")
    email = token_data.get("email")
    
    if not firebase_uid or not email:
        raise ValidationException("Token missing required claims")
    
    # Get or create user with race condition handling
    user_repo = UserRepository(db)
    user = await user_repo.get_by_firebase_uid(firebase_uid)
    
    if not user:
        # Create new user
        username = email.split("@")[0]
        
        # Ensure unique username
        base_username = username
        counter = 1
        while await user_repo.username_exists(username):
            username = f"{base_username}{counter}"
            counter += 1
        
        # Check if this email should be admin
        should_be_admin = ADMIN_EMAIL and email.lower() == ADMIN_EMAIL
        initial_role = UserRole.ADMIN if should_be_admin else UserRole.USER
        
        try:
            user = await user_repo.create(
                firebase_uid=firebase_uid,
                email=email,
                username=username,
                is_email_verified=token_data.get("email_verified", False),
                login_provider=token_data.get("sign_in_provider", "email"),
                profile_image=token_data.get("picture"),
                role=initial_role,
            )
            await db.commit()
            
            if should_be_admin:
                logger.info(f"Created new ADMIN user: {email} (matched ADMIN_EMAIL)")
            else:
                logger.info(f"Created new user: {email}")
        except Exception as e:
            # Handle race condition - another request created the user
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                await db.rollback()
                user = await user_repo.get_by_firebase_uid(firebase_uid)
                if not user:
                    # Try by email as fallback
                    user = await user_repo.get_by_email(email)
                logger.info(f"Race condition handled - found existing user: {email}")
            else:
                raise
    else:
        # Existing user - check if they should be promoted to admin
        if ADMIN_EMAIL and email.lower() == ADMIN_EMAIL and user.role != UserRole.ADMIN:
            user.role = UserRole.ADMIN
            await db.commit()
            logger.info(f"Promoted existing user to ADMIN: {email}")
    
    # Update last login
    if user:
        await user_repo.update_last_login(user.id)
        await db.commit()
    
    return AuthVerifyResponse(
        user=UserResponse.model_validate(user.to_dict()),
        token_valid=True,
        message="Authentication successful"
    )


@router.post("/register", response_model=AuthVerifyResponse)
async def register(
    request: AuthVerifyRequest = Body(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user with Firebase token.
    Same as verify but explicitly for registration.
    """
    return await verify_token(request, db)


@router.get("/profile", response_model=ResponseModel[UserResponse])
async def get_profile(current_user: CurrentUser):
    """Get current user's profile"""
    return ResponseModel(
        success=True,
        data=UserResponse.model_validate(current_user.to_dict())
    )


@router.put("/profile", response_model=ResponseModel[UserResponse])
async def update_profile(
    update_data: UserProfileUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """Update current user's profile"""
    user_repo = UserRepository(db)
    
    # Check username availability if changing
    if update_data.username and update_data.username != current_user.username:
        if await user_repo.username_exists(update_data.username):
            raise ValidationException("Username already taken")
    
    # Update user
    updated_user = await user_repo.update(
        current_user.id,
        update_data.model_dump(exclude_unset=True)
    )
    await db.commit()
    
    return ResponseModel(
        success=True,
        message="Profile updated successfully",
        data=UserResponse.model_validate(updated_user.to_dict())
    )


@router.post("/logout", response_model=ResponseModel)
async def logout(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    cache: Cache = None
):
    """
    Logout user and invalidate session.
    """
    user_repo = UserRepository(db)
    
    # Update last logout
    await user_repo.update_last_logout(current_user.id)
    await db.commit()
    
    # Invalidate user cache
    if cache:
        await cache.delete(f"user:{current_user.firebase_uid}")
    
    # Optionally revoke Firebase tokens
    # revoke_user_tokens(current_user.firebase_uid)
    
    logger.info(f"User logged out: {current_user.email}")
    
    return ResponseModel(
        success=True,
        message="Logged out successfully"
    )


@router.post("/upgrade", response_model=ResponseModel[UserResponse])
async def upgrade_subscription(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Upgrade user to premium subscription.
    In production, this would integrate with payment processing.
    """
    from datetime import timedelta
    from app.models.user import UserRole
    
    user_repo = UserRepository(db)
    
    # In production, verify payment was successful
    # For now, directly upgrade
    update_data = {
        "role": UserRole.PREMIUM,
        "subscription_expires": datetime.utcnow() + timedelta(days=30)
    }
    
    updated_user = await user_repo.update(current_user.id, update_data)
    await db.commit()
    
    logger.info(f"User upgraded to premium: {current_user.email}")
    
    return ResponseModel(
        success=True,
        message="Subscription upgraded to Premium",
        data=UserResponse.model_validate(updated_user.to_dict())
    )


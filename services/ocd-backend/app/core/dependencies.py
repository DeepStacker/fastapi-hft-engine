"""
FastAPI Dependencies - Reusable dependency injection
"""
import logging
from typing import Optional, Annotated
from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.core.security import verify_firebase_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.user import User, UserRole
from app.repositories.user import UserRepository
from app.services.notification import create_welcome_notifications
from app.cache.redis import RedisCache, get_redis

logger = logging.getLogger(__name__)


async def get_token_from_header(
    authorization: Annotated[Optional[str], Header()] = None
) -> str:
    """Extract Bearer token from Authorization header"""
    if not authorization:
        raise UnauthorizedException("Missing authorization header")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise UnauthorizedException("Invalid authorization header format")
    
    return parts[1]


async def get_current_user(
    token: Annotated[str, Depends(get_token_from_header)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[RedisCache, Depends(get_redis)],
) -> User:
    """
    Get current authenticated user from Firebase token.
    Creates user in database if not exists.
    """
    # Verify Firebase token
    token_data = verify_firebase_token(token)
    if not token_data:
        raise UnauthorizedException("Invalid or expired token")
    
    firebase_uid = token_data.get("uid")
    if not firebase_uid:
        raise UnauthorizedException("Invalid token payload")
    
    # Check cache first
    cache_key = f"user:{firebase_uid}"
    cached_user_id = await redis.get(cache_key)
    
    user_repo = UserRepository(db)
    
    if cached_user_id:
        user = await user_repo.get_by_id(cached_user_id)
        if user and user.is_active:
            return user
    
    # Get or create user from database
    user = await user_repo.get_by_firebase_uid(firebase_uid)
    
    if not user:
        # Auto-create user on first login
        try:
            user = await user_repo.create(
                firebase_uid=firebase_uid,
                email=token_data.get("email", ""),
                username=token_data.get("email", "").split("@")[0],
                full_name=token_data.get("name"),
                is_email_verified=token_data.get("email_verified", False),
                login_provider=token_data.get("sign_in_provider", "email"),
                profile_image=token_data.get("picture"),
            )
            await db.commit()
            
            # Create welcome notifications for the new user
            try:
                await create_welcome_notifications(db, user.id)
                logger.info(f"Created welcome notifications for: {user.email}")
            except Exception as notif_error:
                logger.warning(f"Failed to create welcome notifications: {notif_error}")
            
            logger.info(f"Auto-created new user: {user.email}")
        except Exception as e:
            # Handle possible race condition or existing email with different UID
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                await db.rollback()
                user = await user_repo.get_by_email(token_data.get("email", ""))
                if user:
                    # Link existing email account to new Firebase UID
                    user.firebase_uid = firebase_uid
                    await db.commit()
                    logger.info(f"Linked existing user {user.email} to new Firebase UID: {firebase_uid}")
                else:
                    # If still not found, re-raise the original error
                    raise UnauthorizedException("Failed to register user account")
            else:
                logger.error(f"Error auto-creating user: {e}")
                raise
    
    if not user.is_active:
        raise ForbiddenException("User account is deactivated")
    
    # Update last login
    await user_repo.update_last_login(user.id)
    
    # Cache user ID
    await redis.set(cache_key, str(user.id), ttl=3600)
    
    return user


async def get_current_admin_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Get current user and verify admin role"""
    # Development mode bypass - allow any authenticated user to access admin
    from app.config.settings import settings
    if settings.is_development:
        return current_user
    
    if current_user.role != UserRole.ADMIN:
        raise ForbiddenException("Admin access required")
    return current_user


async def get_current_premium_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Get current user and verify premium or admin role"""
    if current_user.role not in [UserRole.PREMIUM, UserRole.ADMIN]:
        raise ForbiddenException("Premium subscription required")
    return current_user


async def get_optional_user(
    authorization: Annotated[Optional[str], Header()] = None,
    db: AsyncSession = Depends(get_db),
    redis: RedisCache = Depends(get_redis),
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise.
    Useful for endpoints with optional authentication.
    """
    if not authorization:
        return None
    
    try:
        token = await get_token_from_header(authorization)
        return await get_current_user(token, db, redis)
    except UnauthorizedException:
        return None


# Type aliases for cleaner endpoint signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentAdmin = Annotated[User, Depends(get_current_admin_user)]
CurrentPremium = Annotated[User, Depends(get_current_premium_user)]
OptionalUser = Annotated[Optional[User], Depends(get_optional_user)]
DBSession = Annotated[AsyncSession, Depends(get_db)]
Cache = Annotated[RedisCache, Depends(get_redis)]

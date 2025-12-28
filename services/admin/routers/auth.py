"""
Admin Authentication Router

Public endpoints for admin login & authentication.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from services.admin.auth import authenticate_user, create_access_token, create_refresh_token, get_current_admin_user
from datetime import timedelta
from core.config.settings import get_settings
from core.rate_limiting.auth_limiter import get_auth_limiter
import structlog
from fastapi import Request

settings = get_settings()
logger = structlog.get_logger(__name__)
auth_limiter = get_auth_limiter(settings.REDIS_URL)

router = APIRouter(prefix="/auth", tags=["authentication"])


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login endpoint - Public (no authentication required)
    
    Returns JWT tokens for authenticated admin users
    
    Rate limited to prevent brute force attacks:
    - 5 attempts per minute per IP
    - Account lockout after 5 failed attempts (15 min)
    """
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    
    # Check if IP is locked out
    if await auth_limiter.is_locked_out(client_ip):
        logger.warning(
            "Login attempt from locked out IP",
            ip_address=client_ip,
            username=form_data.username
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again in 15 minutes.",
        )
    
    # Authenticate user
    user = await authenticate_user(form_data.username, form_data.password)
    
    if not user:
        # Record failed attempt
        attempt_count = await auth_limiter.record_failed_login(client_ip, form_data.username)
        
        logger.warning(
            "Failed login attempt",
            ip_address=client_ip,
            username=form_data.username,
            attempt_count=attempt_count
        )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is admin
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    # Clear failed attempts on successful login
    await auth_limiter.clear_failed_attempts(client_ip)
    
    logger.info(
        "Successful admin login",
        username=user.username,
        ip_address=client_ip
    )
    
    # Create tokens
    access_token = create_access_token(
        data={"sub": user.username, "is_admin": True},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    refresh_token = create_refresh_token(user.username)
    
    return{
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.get("/me")
async def get_current_user_info(user = Depends(get_current_admin_user)):
    """Get current logged-in user info"""
    return {
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "is_active": user.is_active
    }

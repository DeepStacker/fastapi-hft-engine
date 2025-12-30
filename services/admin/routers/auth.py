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


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(request: Request, body: RefreshRequest):
    """
    Refresh access token using refresh token.
    
    Use this to get a new access token without re-authenticating.
    Refresh tokens are valid for 7 days.
    """
    from jose import jwt, JWTError
    
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Decode refresh token
        payload = jwt.decode(
            body.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        
        # Verify token type
        token_type = payload.get("type")
        if token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type - expected refresh token"
            )
        
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # Verify user still exists in admin users
        from services.admin.auth import ADMIN_USERS
        if username not in ADMIN_USERS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User no longer authorized"
            )
        
        logger.info(
            "Token refresh successful",
            username=username,
            ip_address=client_ip
        )
        
        # Create new tokens
        access_token = create_access_token(
            data={"sub": username, "is_admin": True},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        # Create new refresh token (rotating refresh tokens for security)
        new_refresh_token = create_refresh_token(username)
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
        
    except JWTError as e:
        logger.warning(
            "Token refresh failed",
            error=str(e),
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

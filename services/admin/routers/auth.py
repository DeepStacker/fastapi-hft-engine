"""
Admin Authentication Router

Public endpoints for admin login & authentication.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from services.api_gateway.auth import authenticate_user, create_access_token, create_refresh_token, get_current_admin_user
from datetime import timedelta
from core.config.settings import get_settings

settings = get_settings()

router = APIRouter(prefix="/auth", tags=["authentication"])


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login endpoint - Public (no authentication required)
    
    Returns JWT tokens for authenticated admin users
    """
    # Authenticate user
    user = await authenticate_user(form_data.username, form_data.password)
    
    if not user:
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

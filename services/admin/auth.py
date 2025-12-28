"""
Admin Service Authentication Module

Provides authentication functionality for the admin service.
This is a standalone auth module since the api_gateway was removed.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from core.config.settings import get_settings
import os

settings = get_settings()
security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AdminUser(BaseModel):
    """Admin user model"""
    username: str
    email: Optional[str] = None
    is_admin: bool = True
    is_active: bool = True


# Hardcoded admin credentials for development
# In production, use database-backed users
ADMIN_USERS = {
    "admin": {
        "username": "admin",
        "email": "admin@stockify.local",
        "hashed_password": pwd_context.hash(os.getenv("ADMIN_PASSWORD", "admin123")),
        "is_admin": True,
        "is_active": True
    }
}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)


async def authenticate_user(username: str, password: str) -> Optional[AdminUser]:
    """Authenticate user by username and password"""
    user_data = ADMIN_USERS.get(username)
    if not user_data:
        return None
    if not verify_password(password, user_data["hashed_password"]):
        return None
    return AdminUser(**{k: v for k, v in user_data.items() if k != "hashed_password"})


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(username: str) -> str:
    """Create a JWT refresh token"""
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode = {"sub": username, "exp": expire, "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> AdminUser:
    """
    Validate JWT token and return current user.
    For admin dashboard - all authenticated users are considered admins.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        
        # Verify user is an admin
        if username not in ADMIN_USERS:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized as admin",
            )
            
        return AdminUser(username=username, is_admin=True)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
        )


async def get_current_admin_user(
    user: AdminUser = Depends(get_current_user)
) -> AdminUser:
    """
    Ensure current user has admin privileges.
    For now, all authenticated users are admins.
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return user

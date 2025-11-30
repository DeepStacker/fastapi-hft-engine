"""
Admin Authentication using JWT

Provides JWT-based authentication for admin endpoints.
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import structlog

from core.config.settings import settings

logger = structlog.get_logger("admin-auth")

# JWT Configuration
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_admin_token(username: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token for admin user.
    
    Args:
        username: Admin username
        expires_delta: Token expiration time (default: 60 minutes)
        
    Returns:
        JWT token string
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": username,
        "exp": expire,
        "type": "admin",
        "iat": datetime.utcnow()
    }
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def verify_admin_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Verify admin JWT token.
    
    Args:
        credentials: HTTP bearer credentials
        
    Returns:
        Admin username
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Could not validate admin credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if username is None or token_type != "admin":
            logger.warning("Invalid token payload", username=username, type=token_type)
            raise credentials_exception
        
        # Check expiration
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp) < datetime.utcnow():
            logger.warning("Token expired", username=username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin token has expired"
            )
        
        logger.debug("Admin token verified", username=username)
        return username
        
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise credentials_exception


# Admin login endpoint (to be added to router)
class AdminLoginRequest:
    """Admin login request schema"""
    username: str
    password: str


async def authenticate_admin(username: str, password: str) -> Optional[str]:
    """
    Authenticate admin user against database.
    
    Args:
        username: Admin username
        password: Admin password
        
    Returns:
        Username if authenticated, None otherwise
    """
    from core.database.db import async_session_factory
    from core.database.models import UserDB
    from sqlalchemy import select
    
    try:
        async with async_session_factory() as session:
            result = await session.execute(
                select(UserDB).where(UserDB.username == username)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                logger.warning(f"Admin auth failed: User {username} not found")
                return None
                
            if not verify_password(password, user.hashed_password):
                logger.warning(f"Admin auth failed: Invalid password for {username}")
                return None
                
            logger.info(f"Admin authenticated: {username}")
            return username
            
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return None


# Dependency to use in protected routes
async def get_current_admin(username: str = Depends(verify_admin_token)) -> str:
    """
    Dependency for protected admin endpoints.
    
    Usage:
        @router.get("/admin/endpoint", dependencies=[Depends(get_current_admin)])
    """
    return username


# ============================================================================
# LEGACY COMPATIBILITY LAYER (For Admin Service)
# ============================================================================

from fastapi.security import OAuth2PasswordBearer
from core.database.db import async_session_factory
from core.database.models import UserDB
from core.logging.audit import log_auth_event
from sqlalchemy import select

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Legacy create_access_token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(username: str) -> str:
    """Legacy create_refresh_token"""
    to_encode = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(days=30),
        "type": "refresh"
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def authenticate_user(username: str, password: str) -> Optional[UserDB]:
    """Legacy authenticate_user returning UserDB object"""
    async with async_session_factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.username == username))
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
            
        return user

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserDB:
    """Legacy get_current_user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    async with async_session_factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.username == username))
        user = result.scalar_one_or_none()
        if user is None:
            raise credentials_exception
        return user

async def get_current_admin_user(current_user: UserDB = Depends(get_current_user)) -> UserDB:
    """Legacy get_current_admin_user"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

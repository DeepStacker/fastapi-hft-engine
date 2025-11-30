"""
Complete Authentication & Authorization - Production Ready

Full implementation with JWT, API keys, role-based access control.
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from functools import wraps
import secrets
import hashlib

from core.config.settings import get_settings
from core.database.db import async_session_factory
from core.database.models import UserDB, APIKeyDB, AuditLogDB
from core.logging.audit import log_auth_event

settings = get_settings()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
http_bearer = HTTPBearer()


def get_password_hash(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token
    
    Args:
        data: Payload data (must include 'sub' for username)
        expires_delta: Token expiration time
    
    Returns:
        JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def create_refresh_token(username: str) -> str:
    """Create refresh token with longer expiration"""
    to_encode = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(days=30),
        "type": "refresh"
    }
    
    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


async def authenticate_user(username: str, password: str) -> Optional[UserDB]:
    """
    Authenticate user with username and password
    
    Returns:
        User object if authenticated, None otherwise
    """
    async with async_session_factory() as session:
        result = await session.execute(
            select(UserDB).where(UserDB.username == username)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            # Log failed attempt
            await log_auth_event(
                action="login_failed",
                username=username,
                details={"reason": "user_not_found"}
            )
            return None
        
        if not user.is_active:
            await log_auth_event(
                action="login_failed",
                username=username,
                details={"reason": "user_inactive"}
            )
            return None
        
        if not verify_password(password, user.hashed_password):
            await log_auth_event(
                action="login_failed",
                username=username,
                details={"reason": "invalid_password"}
            )
            return None
        
        # Update last login
        user.last_login = datetime.utcnow()
        await session.commit()
        
        # Log successful login
        await log_auth_event(
            action="login_success",
            username=username,
            user_id=user.id
        )
        
        return user


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserDB:
    """
    Get current user from JWT token
    
    Dependency for protected endpoints
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if username is None or token_type != "access":
            raise credentials_exception
            
    except JWTError as e:
        await log_auth_event(
            action="token_validation_failed",
            details={"error": str(e)}
        )
        raise credentials_exception
    
    async with async_session_factory() as session:
        result = await session.execute(
            select(UserDB).where(UserDB.username == username)
        )
        user = result.scalar_one_or_none()
        
        if user is None or not user.is_active:
            raise credentials_exception
        
        return user


async def get_current_active_user(
    current_user: UserDB = Depends(get_current_user)
) -> UserDB:
    """Verify user is active"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_admin_user(
    current_user: UserDB = Depends(get_current_user)
) -> UserDB:
    """Verify user is admin"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def generate_api_key() -> tuple[str, str]:
    """
    Generate API key pair
    
    Returns:
        (plain_key, hashed_key) tuple
    """
    # Generate secure random key
    plain_key = f"sk_{secrets.token_urlsafe(32)}"
    
    # Hash for storage
    hashed_key = hashlib.sha256(plain_key.encode()).hexdigest()
    
    return (plain_key, hashed_key)


async def verify_api_key(api_key: str) -> Optional[UserDB]:
    """
    Verify API key and return associated user
    
    Args:
        api_key: Plain API key from request
    
    Returns:
        User object if valid, None otherwise
    """
    # Hash the provided key
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    async with async_session_factory() as session:
        result = await session.execute(
            select(APIKeyDB).where(
                APIKeyDB.key_hash == key_hash,
                APIKeyDB.is_active == True
            )
        )
        api_key_obj = result.scalar_one_or_none()
        
        if not api_key_obj:
            await log_auth_event(
                action="apikey_validation_failed",
                details={"key_hash": key_hash[:16]}
            )
            return None
        
        # Check expiration
        if api_key_obj.expires_at and api_key_obj.expires_at < datetime.utcnow():
            await log_auth_event(
                action="apikey_expired",
                user_id=api_key_obj.user_id
            )
            return None
        
        # Update last used
        api_key_obj.last_used = datetime.utcnow()
        
        # Get associated user
        result = await session.execute(
            select(UserDB).where(UserDB.id == api_key_obj.user_id)
        )
        user = result.scalar_one_or_none()
        
        await session.commit()
        
        if user and user.is_active:
            return user
        
        return None


async def get_user_from_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer)
) -> UserDB:
    """
    Dependency to get user from API key
    
    Usage in endpoints:
        @app.get("/protected")
        async def protected(user: UserDB = Depends(get_user_from_api_key)):
            ...
    """
    api_key = credentials.credentials
    
    user = await verify_api_key(api_key)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


def require_role(required_role: str):
    """
    Decorator for role-based access control
    
    Usage:
        @require_role("admin")
        async def admin_only_endpoint(user = Depends(get_current_user)):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, user: UserDB = None, **kwargs):
            if required_role == "admin" and not user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Requires {required_role} role"
                )
            return await func(*args, user=user, **kwargs)
        return wrapper
    return decorator


async def create_user(
    username: str,
    email: str,
    password: str,
    full_name: Optional[str] = None,
    is_admin: bool = False
) -> UserDB:
    """
    Create new user account
    
    Args:
        username: Unique username
        email: Unique email
        password: Plain password (will be hashed)
        full_name: Optional full name
        is_admin: Admin privilege flag
    
    Returns:
        Created user object
    
    Raises:
        ValueError: If username or email already exists
    """
    async with async_session_factory() as session:
        # Check if user exists
        result = await session.execute(
            select(UserDB).where(
                (UserDB.username == username) | (UserDB.email == email)
            )
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise ValueError("Username or email already exists")
        
        # Create user
        new_user = UserDB(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            is_admin=is_admin,
            is_active=True,
            is_verified=False
        )
        
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)
        
        # Log creation
        await log_auth_event(
            action="user_created",
            username=username,
            user_id=new_user.id,
            details={"is_admin": is_admin}
        )
        
        return new_user


async def create_api_key_for_user(
    user_id: int,
    name: str,
    rate_limit: int = 100,
    expires_in_days: Optional[int] = None
) -> tuple[str, APIKeyDB]:
    """
    Create API key for user
    
    Returns:
        (plain_key, api_key_object) tuple
        NOTE: plain_key is only available at creation time!
    """
    plain_key, hashed_key = generate_api_key()
    
    async with async_session_factory() as session:
        api_key = APIKeyDB(
            user_id=user_id,
            key_hash=hashed_key,
            name=name,
            rate_limit=rate_limit,
            is_active=True,
            expires_at=datetime.utcnow() + timedelta(days=expires_in_days) if expires_in_days else None
        )
        
        session.add(api_key)
        await session.commit()
        await session.refresh(api_key)
        
        await log_auth_event(
            action="apikey_created",
            user_id=user_id,
            details={"name": name}
        )
        
        return (plain_key, api_key)


# Initialize default admin user on first run
async def init_default_users():
    """Create default admin user if none exists"""
    async with async_session_factory() as session:
        result = await session.execute(
            select(UserDB).where(UserDB.is_admin == True)
        )
        admin_exists = result.scalar_one_or_none()
        
        if not admin_exists:
            # Create default admin
            admin_user = await create_user(
                username="admin",
                email="admin@stockify.local",
                password=settings.DEFAULT_ADMIN_PASSWORD if hasattr(settings, 'DEFAULT_ADMIN_PASSWORD') else "ChangeMe123!",
                full_name="System Administrator",
                is_admin=True
            )
            
            # Create API key
            plain_key, _ = await create_api_key_for_user(
                user_id=admin_user.id,
                name="Default Admin Key",
                rate_limit=1000
            )
            
            print(f"Default admin created!")
            print(f"Username: admin")
            print(f"API Key: {plain_key}")
            print(f"IMPORTANT: Change password and rotate API key immediately!")

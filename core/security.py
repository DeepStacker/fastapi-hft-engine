from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
import uuid
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
from .config import settings # Import settings if not already done

load_dotenv()

# --- Configuration ---
# !! IMPORTANT: Use a strong, randomly generated secret key stored securely (e.g., env var) !!
SECRET_KEY = os.getenv("SECRET_KEY", "a_very_insecure_default_secret_key_345lkjdfsdf98sd7fsd")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # Access token lifetime
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 60 # Password reset token lifetime (e.g., 1 hour)
REFRESH_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# --- Password Hashing ---
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,  # Explicitly set rounds
    bcrypt__ident="2b",  # Use the modern identifier
    bcrypt__min_rounds=12,  # Minimum acceptable rounds
    bcrypt__max_rounds=12,  # Maximum acceptable rounds
)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes a plain password."""
    return pwd_context.hash(password)

# --- JWT Token Handling ---
def create_access_token(data: Dict, expires_delta: datetime) -> str:
    """Creates a JWT token with the given data and expiration"""
    to_encode = data.copy()
    # Set expiration using timestamp
    to_encode.update({"exp": int(expires_delta.timestamp())})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes a JWT token, returning the payload or None if invalid/expired."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

# --- Password Reset Token Handling ---
def create_password_reset_token(email: str) -> str:
    """Creates a JWT token specifically for password reset."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "exp": expire,
        "sub": email, # Subject is the user's email
        "purpose": "password_reset" # Add a purpose claim
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_password_reset_token(token: str) -> Optional[str]:
    """
    Verifies a password reset token.
    Returns the email if the token is valid and for password reset purpose, otherwise None.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("purpose") == "password_reset":
            return payload.get("sub") # Return email
        return None # Invalid purpose
    except JWTError:
        return None # Invalid token (expired or malformed)

# --- Blacklisting (Conceptual - requires implementation, e.g., using Redis) ---
# Example: A simple set in memory (NOT suitable for production)
# In production, use Redis: await redis_client.sadd("token_blacklist", token)

# --- Refresh Token Handling ---
from pydantic import BaseModel

class TokenPayload(BaseModel):
    sub: str
    exp: int
    type: str
    jti: str  # JWT ID for blacklisting

async def create_token_pair(subject: str, redis_client) -> Dict[str, str]:
    """Creates both access and refresh tokens"""
    # Calculate expiration times
    access_token_expires = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    
    # Create tokens with JTI (JWT ID) for blacklisting
    access_jti = str(uuid.uuid4())
    refresh_jti = str(uuid.uuid4())
    
    access_token = create_access_token(
        data={"sub": subject, "type": "access", "jti": access_jti},
        expires_delta=access_token_expires
    )
    refresh_token = create_access_token(  # Reuse create_access_token for refresh token
        data={"sub": subject, "type": "refresh", "jti": refresh_jti},
        expires_delta=refresh_token_expires
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

async def verify_token(token: str, redis_client) -> Optional[TokenPayload]:
    """Verifies a token and checks if it's blacklisted"""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        
        # Check if token is blacklisted using JTI
        is_blacklisted = await redis_client.exists(f"blacklisted_token:{token_data.jti}")
        if is_blacklisted:
            return None
            
        return token_data
    except (jwt.PyJWTError, ValueError):
        return None

async def blacklist_token(jti: str, exp: int, redis_client) -> None:
    """Adds a token to the blacklist with expiration"""
    # Calculate remaining time until expiration
    now = datetime.now(timezone.utc)
    exp_datetime = datetime.fromtimestamp(exp, timezone.utc)
    ttl = int((exp_datetime - now).total_seconds())
    
    if ttl > 0:
        await redis_client.setex(f"blacklisted_token:{jti}", ttl, "1")

async def is_token_blacklisted(jti: str, redis_client) -> bool:
    """Checks if a token is blacklisted"""
    return await redis_client.exists(f"blacklisted_token:{jti}")


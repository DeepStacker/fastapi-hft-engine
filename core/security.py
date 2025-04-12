from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
from pydantic import BaseModel # Added BaseModel
import uuid # Added uuid

# Import settings
from .config import settings

load_dotenv()

# --- Password Hashing ---
# Use explicit bcrypt settings to potentially avoid warnings
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
    bcrypt__ident="2b",
    bcrypt__min_rounds=12,
    bcrypt__max_rounds=12,
)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password."""
    # Handle cases where hashed_password might be None (e.g., Firebase-only user)
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes a plain password."""
    return pwd_context.hash(password)

# --- JWT Token Model ---
class TokenPayload(BaseModel):
    sub: Optional[str] = None # Subject (usually username or user ID)
    exp: Optional[int] = None # Expiry timestamp
    type: Optional[str] = None # e.g., "access", "refresh"
    jti: Optional[str] = None # JWT ID
    purpose: Optional[str] = None # e.g., "password_reset"

# --- JWT Token Handling ---
def create_token(data: dict, expires_delta: datetime) -> str:
    """Creates a JWT token with the given data and expiration"""
    to_encode = data.copy()
    # Set expiration using timestamp
    to_encode.update({"exp": int(expires_delta.timestamp())})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def create_token_pair(subject: str) -> Dict[str, str]:
    """Creates both access and refresh tokens"""
    # Calculate expiration times using timedelta
    access_token_expires = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = datetime.now(timezone.utc) + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

    # Create tokens with JTI (JWT ID) for blacklisting
    access_jti = str(uuid.uuid4())
    refresh_jti = str(uuid.uuid4())

    access_token = create_token(
        data={"sub": subject, "type": "access", "jti": access_jti},
        expires_delta=access_token_expires
    )
    refresh_token = create_token(
        data={"sub": subject, "type": "refresh", "jti": refresh_jti},
        expires_delta=refresh_token_expires
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

async def verify_token(token: str, redis_client) -> Optional[TokenPayload]:
    """Verifies a token (access or refresh) and checks if it's blacklisted"""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)

        # Check required fields
        if not token_data.jti or not token_data.exp or not token_data.sub or not token_data.type:
             return None # Invalid payload structure

        # Check if token is blacklisted using JTI
        is_blacklisted = await redis_client.exists(f"blacklisted_token:{token_data.jti}")
        if is_blacklisted:
            return None

        return token_data
    # Correct the exception type here
    except (JWTError, ValueError): # Catch decoding errors and validation errors
        return None

# --- Password Reset Token Handling ---
def create_password_reset_token(email: str) -> str:
    """Creates a JWT token specifically for password reset."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "exp": int(expire.timestamp()), # Use timestamp
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
    except jwt.PyJWTError:
        return None # Invalid token (expired or malformed)


# --- Blacklisting (using Redis) ---
async def blacklist_token(jti: str, exp: int, redis_client) -> None:
    """Adds a token's JTI to the blacklist with expiration"""
    # Calculate remaining time until expiration
    now = datetime.now(timezone.utc)
    # Ensure exp is treated as a timestamp
    exp_datetime = datetime.fromtimestamp(exp, timezone.utc)
    ttl = int((exp_datetime - now).total_seconds())

    if ttl > 0:
        # Store JTI in Redis with expiration (TTL)
        await redis_client.setex(f"blacklisted_token:{jti}", ttl, "1")



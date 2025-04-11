from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
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

# --- Password Hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes a plain password."""
    return pwd_context.hash(password)

# --- JWT Token Handling ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
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
token_blacklist = set()

def add_token_to_blacklist(token: str):
    """Adds a token to the blacklist (conceptual)."""
    # Production: await redis_client.sadd("token_blacklist", jti) # jti = payload.get("jti")
    # Production: await redis_client.expireat("token_blacklist", int(payload.get("exp")))
    token_blacklist.add(token)
    print(f"Token added to blacklist (in-memory): {token[:10]}...") # For demo

async def is_token_blacklisted(token: str) -> bool:
    """Checks if a token is blacklisted (conceptual)."""
    # Production: jti = decode_token(token).get("jti")
    # Production: return await redis_client.sismember("token_blacklist", jti)
    return token in token_blacklist


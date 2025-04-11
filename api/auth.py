from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Any, Optional, Dict
import logging
from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession # Import AsyncSession
from pydantic import BaseModel # Import BaseModel

# Import security functions
from core.security import (
    create_access_token, verify_password, get_password_hash, decode_token,
    create_password_reset_token, verify_password_reset_token,
    create_token_pair, verify_token, blacklist_token,
    TokenPayload
)
# Import Pydantic models (Remove Token from this import)
from models.user import UserCreate, UserPublic, UserPreferences, PasswordChange, PasswordResetRequest, PasswordResetPerform # Added models
# Import DB session dependency
from core.database import get_db
# Import CRUD functions
from crud import user_crud

logger = logging.getLogger(__name__)
router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# --- Token Model Definition ---
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

# --- Dependency to Get Current User (using DB) ---
async def get_current_user_dependency(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db), # Add DB session dependency
    request: Request = None,
) -> user_crud.db_models.User: # Return the DB model instance
    """
    Dependency to verify token and return the current user from DB.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    redis_client = request.app.state.redis
    token_data = await verify_token(token, redis_client)
    if not token_data:
        raise credentials_exception

    # Use CRUD function to get user from DB
    user = await user_crud.get_user_by_username(db=db, username=token_data.sub)
    if user is None:
        logger.debug(f"User '{token_data.sub}' not found in DB based on token.")
        raise credentials_exception
    if user.disabled:
         logger.warning(f"Authentication attempt by disabled user: {token_data.sub}")
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    return user # Return the SQLAlchemy User model instance

# --- Authentication Endpoints (using DB) ---

@router.post("/auth/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db) # Add DB session dependency
):
    """Registers a new user."""
    # Check username uniqueness
    if await user_crud.get_user_by_username(db, username=user_in.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    # Check email uniqueness
    if await user_crud.get_user_by_email(db, email=user_in.email):
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    # Add phone check if needed

    hashed_password = get_password_hash(user_in.password)
    try:
        user_db = await user_crud.create_user(db=db, user=user_in, hashed_password=hashed_password)
    except ValueError as e: # Catch the specific error from CRUD
         # Handle potential integrity errors (e.g., race condition if checks passed but insert failed)
         logger.error(f"Error creating user: {e}")
         raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, # Use 409 Conflict for duplicate data
            detail="User with this username or email might already exist.",
        )
    except Exception as e: # Catch other unexpected errors
        logger.error(f"Unexpected error creating user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during registration.",
        )

    logger.info(f"User registered: {user_db.username}")
    return user_db


@router.post("/auth/token", response_model=Token) # Use the locally defined Token model
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db), # Add DB session dependency
    request: Request = None,
):
    """Provides an access token for valid username/email and password."""
    # Use CRUD function to find user by username or email
    user = await user_crud.get_user_by_username_or_email(db, identifier=form_data.username)

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.disabled:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    tokens = await create_token_pair(user.username, request.app.state.redis)
    logger.info(f"User logged in: {user.username}")
    return tokens

@router.post("/auth/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    refresh_token: str,
):
    """Creates new token pair using refresh token"""
    redis_client = request.app.state.redis
    token_data = await verify_token(refresh_token, redis_client)
    
    if not token_data or token_data.type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create new token pair
    tokens = await create_token_pair(token_data.sub, redis_client)
    
    # Blacklist the used refresh token
    await blacklist_token(token_data.jti, token_data.exp, redis_client)
    
    return tokens

@router.post("/auth/logout")
async def logout(
    request: Request,
    token: str = Depends(oauth2_scheme),
):
    """Logout endpoint that blacklists the current token"""
    redis_client = request.app.state.redis
    token_data = await verify_token(token, redis_client)
    
    if token_data:
        # Blacklist the current token
        await blacklist_token(token_data.jti, token_data.exp, redis_client)
    
    return {"message": "Successfully logged out"}

@router.get("/users/me", response_model=UserPublic)
async def read_users_me(
    current_user: user_crud.db_models.User = Depends(get_current_user_dependency) # Dependency returns DB model
):
    """Returns the current authenticated user's public information."""
    # Pydantic model validates from attributes
    return current_user

@router.post("/users/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_current_user_password(
    password_data: PasswordChange,
    current_user: user_crud.db_models.User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db)
):
    """Allows the currently authenticated user to change their password."""
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )
    await user_crud.update_user_password(db=db, db_user=current_user, new_password=password_data.new_password)
    logger.info(f"User '{current_user.username}' changed their password.")
    # No content needed in response body for 204
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/auth/forgot-password")
async def forgot_password(
    request_data: PasswordResetRequest,
    # db: AsyncSession = Depends(get_db) # Inject DB if needed to check email existence first
):
    """
    Initiates the password reset process.
    Checks if the email exists (optional) and sends a reset token (conceptual).
    """
    # Optional: Check if user with this email exists before generating token
    # user = await user_crud.get_user_by_email(db, email=request_data.email)
    # if not user:
    #     # Return success even if email doesn't exist to avoid enumeration attacks
    #     logger.warning(f"Password reset requested for non-existent email: {request_data.email}")
    #     return {"message": "If an account with that email exists, a password reset link has been sent."}

    reset_token = create_password_reset_token(email=request_data.email)

    # --- !!! Email Sending Logic Placeholder !!! ---
    # In a real application, you would send an email here containing a link
    # like: https://yourfrontend.com/reset-password?token={reset_token}
    # Example using print for demonstration:
    print(f"--- Password Reset Email (Simulation) ---")
    print(f"To: {request_data.email}")
    print(f"Subject: Reset Your Password")
    print(f"Body: Click the link to reset your password: /auth/reset-password?token={reset_token}") # Use token in link
    print(f"---------------------------------------")
    logger.info(f"Password reset token generated for email: {request_data.email}")
    # --- End Placeholder ---

    # Always return a generic success message to prevent email enumeration
    return {"message": "If an account with that email exists, a password reset link has been sent."}


@router.post("/auth/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    reset_data: PasswordResetPerform,
    db: AsyncSession = Depends(get_db)
):
    """Resets the user's password using a valid reset token."""
    email = verify_password_reset_token(reset_data.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    user = await user_crud.get_user_by_email(db, email=email)
    if not user:
        # Should ideally not happen if token was valid, but handle defensively
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with token not found",
        )
    if user.disabled:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reset password for an inactive user")

    await user_crud.update_user_password(db=db, db_user=user, new_password=reset_data.new_password)
    logger.info(f"Password reset successfully for user: {user.username} (via email: {email})")
    # Optional: Add logic here to blacklist the used reset token if needed

    return Response(status_code=status.HTTP_204_NO_CONTENT)


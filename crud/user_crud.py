from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from typing import Optional, Dict, Any
import logging

# Import your SQLAlchemy model and Pydantic schemas
from models import db_models
from models import user as user_schemas
# Import password hashing utility
from core.security import get_password_hash

logger = logging.getLogger(__name__)

async def get_user_by_username(db: AsyncSession, username: str) -> Optional[db_models.User]:
    """Retrieves a user by username (Firebase UID) from the database."""
    result = await db.execute(select(db_models.User).filter(db_models.User.username == username))
    return result.scalars().first()

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[db_models.User]:
    """Retrieves a user by email from the database."""
    # Ensure email is not None before querying
    if not email:
        return None
    result = await db.execute(select(db_models.User).filter(db_models.User.email == email.lower()))
    return result.scalars().first()

async def get_user_by_username_or_email(db: AsyncSession, identifier: str) -> Optional[db_models.User]:
    """Retrieves a user by username or email (for manual login)."""
    identifier_lower = identifier.lower()
    result = await db.execute(
        select(db_models.User).filter(
            or_(
                db_models.User.username == identifier_lower,
                db_models.User.email == identifier_lower
            )
        )
    )
    return result.scalars().first()

async def get_or_create_firebase_user(db: AsyncSession, uid: str, email: Optional[str] = None) -> db_models.User:
    """Gets a user by Firebase UID (stored as username) or creates one if not found."""
    # First try to get existing user
    user = await get_user_by_username(db, username=uid)
    if user:
        return user

    # Check for potential race condition - try getting by email
    if email:
        user = await get_user_by_email(db, email=email)
        if user:
            return user

    # Create new user if not found
    try:
        # Create a default empty string password for Firebase users to satisfy MySQL
        db_user = db_models.User(
            username=uid,
            email=email.lower() if email else None,
            hashed_password='',  # Empty string instead of None
            disabled=False,
            preferences={"default_strike_count": 20}
        )
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        logger.info(f"Created new user for Firebase UID: {uid}")
        return db_user
    except IntegrityError as e:
        await db.rollback()
        logger.warning(f"Race condition during user creation for UID {uid}? {str(e)}")
        
        # One final attempt to get the user in case of race condition
        user = await get_user_by_username(db, username=uid)
        if user:
            return user
            
        # If we still can't find the user, let's try by email one last time
        if email:
            user = await get_user_by_email(db, email=email)
            if user:
                return user
                
        logger.error(f"Failed to create or retrieve user after integrity error for UID {uid}")
        raise ValueError(f"Could not create or find user for UID {uid}")

# Restore create_user for manual registration
async def create_user(db: AsyncSession, user: user_schemas.UserCreate, hashed_password: str) -> db_models.User:
    """Creates a new user in the database for manual registration."""
    db_user = db_models.User(
        username=user.username.lower(),
        email=user.email.lower(),
        phone_no=user.phone_no,
        hashed_password=hashed_password, # Store the provided hash
        disabled=False,
        # preferences will use DB default
    )
    db.add(db_user)
    try:
        await db.commit()
        await db.refresh(db_user)
        return db_user
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Database integrity error: {e.orig}")

# Keep update_user_prefs function
async def update_user_prefs(db: AsyncSession, db_user: db_models.User, preferences: user_schemas.UserPreferences) -> db_models.User:
    """Updates user preferences in the database."""
    # Pydantic model_dump converts the Pydantic model to a dict suitable for JSON storage
    db_user.preferences = preferences.model_dump()
    db.add(db_user) # Add to session to track changes
    await db.commit()
    await db.refresh(db_user)
    return db_user

# Restore update_user_password function
async def update_user_password(db: AsyncSession, db_user: db_models.User, new_password: str) -> db_models.User:
    """Updates a user's password in the database."""
    db_user.hashed_password = get_password_hash(new_password)
    db.add(db_user) # Add to session to track changes
    await db.commit()
    await db.refresh(db_user)
    return db_user


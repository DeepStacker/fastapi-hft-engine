from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError # Import for handling unique constraint errors
from typing import Optional, Dict, Any

# Import your SQLAlchemy model and Pydantic schemas
from models import db_models
from models import user as user_schemas
# Import password hashing utility
from core.security import get_password_hash

async def get_user_by_username(db: AsyncSession, username: str) -> Optional[db_models.User]:
    """Retrieves a user by username from the database."""
    result = await db.execute(select(db_models.User).filter(db_models.User.username == username.lower()))
    return result.scalars().first()

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[db_models.User]:
    """Retrieves a user by email from the database."""
    result = await db.execute(select(db_models.User).filter(db_models.User.email == email.lower()))
    return result.scalars().first()

async def get_user_by_username_or_email(db: AsyncSession, identifier: str) -> Optional[db_models.User]:
    """Retrieves a user by username or email."""
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


async def create_user(db: AsyncSession, user: user_schemas.UserCreate, hashed_password: str) -> db_models.User:
    """Creates a new user in the database."""
    db_user = db_models.User(
        username=user.username.lower(),
        email=user.email.lower(),
        phone_no=user.phone_no,
        hashed_password=hashed_password,
    )
    db.add(db_user)
    try:
        await db.commit()
        await db.refresh(db_user)
        return db_user
    except IntegrityError as e: # Catch potential unique constraint violations
        await db.rollback()
        # Determine if it was username or email (or phone if unique)
        # This requires checking the specific database error details, which can vary.
        # For simplicity, we raise a generic error here. A more robust implementation
        # would parse the error message or code.
        raise ValueError(f"Database integrity error: {e.orig}")


async def update_user_prefs(db: AsyncSession, db_user: db_models.User, preferences: user_schemas.UserPreferences) -> db_models.User:
    """Updates user preferences in the database."""
    # Pydantic model_dump converts the Pydantic model to a dict suitable for JSON storage
    db_user.preferences = preferences.model_dump()
    db.add(db_user) # Add to session to track changes
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def update_user_password(db: AsyncSession, db_user: db_models.User, new_password: str) -> db_models.User:
    """Updates a user's password in the database."""
    db_user.hashed_password = get_password_hash(new_password)
    db.add(db_user) # Add to session to track changes
    await db.commit()
    await db.refresh(db_user)
    return db_user


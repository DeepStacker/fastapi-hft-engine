from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import AsyncGenerator

from .config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True, # Recommended for checking connections
    # echo=True, # Uncomment for debugging SQL queries
)

# Create session factory
# expire_on_commit=False is important for async sessions in FastAPI
AsyncSessionFactory = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Base class for declarative models
Base = declarative_base()

# Dependency to get DB session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides an async database session."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit() # Commit transaction if no exceptions
        except Exception:
            await session.rollback() # Rollback on error
            raise
        finally:
            await session.close()


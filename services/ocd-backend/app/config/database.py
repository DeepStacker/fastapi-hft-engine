"""
Database Configuration - Async SQLAlchemy with PostgreSQL
Includes connection pooling, session management, and read replica support
"""
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from sqlalchemy import text
import logging

from app.config.settings import settings

logger = logging.getLogger(__name__)

# =============================================================================
# Primary (Write) Engine - Used for all write operations
# =============================================================================
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_timeout=settings.DATABASE_POOL_TIMEOUT,
    pool_pre_ping=True,  # Enable connection health checks
)

# Session factory for primary (write) database
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# =============================================================================
# Read Replica Engine - Used for read-heavy analytics queries
# Falls back to primary if no replica configured
# =============================================================================
_read_replica_engine = None
_read_replica_session = None


def _init_read_replica():
    """Initialize read replica engine if configured"""
    global _read_replica_engine, _read_replica_session
    
    replica_url = getattr(settings, 'DATABASE_READ_REPLICA_URL', None)
    
    if replica_url and replica_url != settings.DATABASE_URL:
        _read_replica_engine = create_async_engine(
            replica_url,
            echo=settings.DATABASE_ECHO,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_timeout=settings.DATABASE_POOL_TIMEOUT,
            pool_pre_ping=True,
        )
        _read_replica_session = async_sessionmaker(
            _read_replica_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
        logger.info("Read replica database configured")
    else:
        logger.info("No read replica configured, using primary for all queries")


# Initialize on module load
_init_read_replica()


from app.models.base import Base


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides a database session for WRITE operations.
    Automatically handles commit/rollback and session cleanup.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()


async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides a database session for READ operations.
    Uses read replica if configured, otherwise falls back to primary.
    """
    session_factory = _read_replica_session or AsyncSessionLocal
    
    async with session_factory() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Read database session error: {e}")
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database - create all tables on primary"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized")


async def close_db() -> None:
    """Close all database connections"""
    await engine.dispose()
    if _read_replica_engine:
        await _read_replica_engine.dispose()
    logger.info("Database connections closed")


async def check_db_connection() -> bool:
    """Check if database is accessible"""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False


async def check_read_replica_connection() -> bool:
    """Check if read replica is accessible"""
    if not _read_replica_session:
        return False
    
    try:
        async with _read_replica_session() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Read replica connection check failed: {e}")
        return False


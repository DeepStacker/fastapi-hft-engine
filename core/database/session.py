"""
Database Session Factory - Single Source of Truth

All services should use this factory for database connections.
Provides connection pooling, read replicas, and health checks.
"""
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
import logging

from core.config.settings import get_settings

settings = get_settings()
logger = logging.getLogger("database")

# Base model for all database models
Base = declarative_base()

# Module-level state
_engine = None
_read_engine = None
_session_factory = None
_read_session_factory = None


def _get_engine():
    """Get or create primary database engine"""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
            echo=settings.DATABASE_ECHO,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DATABASE_POOL_TIMEOUT,
            pool_pre_ping=settings.DB_POOL_PRE_PING,
            pool_recycle=settings.DB_POOL_RECYCLE,
        )
        logger.info(f"Created database engine for {settings.DATABASE_URL[:40]}...")
    return _engine


def _get_read_engine():
    """Get or create read replica engine (if configured)"""
    global _read_engine
    if _read_engine is None and settings.DATABASE_READ_REPLICA_URL:
        _read_engine = create_async_engine(
            settings.DATABASE_READ_REPLICA_URL,
            echo=settings.DATABASE_ECHO,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DATABASE_POOL_TIMEOUT,
            pool_pre_ping=settings.DB_POOL_PRE_PING,
        )
        logger.info("Created read replica engine")
    return _read_engine


def _get_session_factory():
    """Get session factory for write operations"""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            _get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _session_factory


def _get_read_session_factory():
    """Get session factory for read operations"""
    global _read_session_factory
    if _read_session_factory is None:
        read_engine = _get_read_engine()
        # Fall back to primary if no read replica
        engine = read_engine or _get_engine()
        _read_session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _read_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for WRITE database sessions.
    Auto-commits on success, rolls back on error.
    """
    factory = _get_session_factory()
    async with factory() as session:
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
    Dependency for READ database sessions.
    Uses read replica if available.
    """
    factory = _get_read_session_factory()
    async with factory() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Read session error: {e}")
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create all database tables"""
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized")


async def close_db() -> None:
    """Close all database connections"""
    global _engine, _read_engine, _session_factory, _read_session_factory
    
    if _engine:
        await _engine.dispose()
        _engine = None
    if _read_engine:
        await _read_engine.dispose()
        _read_engine = None
    
    _session_factory = None
    _read_session_factory = None
    logger.info("Database connections closed")


async def check_db_connection() -> bool:
    """Check if database is accessible"""
    try:
        factory = _get_session_factory()
        async with factory() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False

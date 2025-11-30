"""
Database Connection Setup with Optimized Pooling

Provides async database engine with production-grade pool configuration.
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import structlog

from core.config.settings import settings

logger = structlog.get_logger("database")

# Create async engine with optimized connection pooling
# Note: Async engines manage their own pool, don't specify poolclass
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,                 # Base pool size
    max_overflow=10,              # Additional connections under load
    pool_timeout=30,              # Max wait for connection (seconds)
    pool_recycle=3600,            # Recycle after 1 hour
    pool_pre_ping=True,           # Test connections before use
    connect_args={
        "command_timeout": 60,    # Query timeout
        "timeout": 10,            # Connection timeout
        "server_settings": {
            "jit": "off"          # Disable JIT for faster connects
        }
    },
    echo=settings.LOG_LEVEL == "DEBUG",
    echo_pool=False,              # Disable pool logging
    future=True,                  # Use SQLAlchemy 2.0 style
    
    # Execution Options
    execution_options={
        "isolation_level": "READ COMMITTED"
    }
)

# Create sessionmaker
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,       # Don't expire objects after commit
    autoflush=False,              # Manual flush control
    autocommit=False              # Explicit transaction control
)


@asynccontextmanager
async def get_db_context():
    """
    Async context manager for database sessions.
    
    Usage:
        async with get_db_context() as session:
            result = await session.execute(query)
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}", exc_info=True)
            raise
        finally:
            await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for database sessions.
    
    Usage:
        def route(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}", exc_info=True)
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database connection pool"""
    try:
        async with engine.begin() as conn:
            # Test connection
            await conn.execute("SELECT 1")
        logger.info(
            "Database connection pool initialized",
            pool_size=20,
            max_overflow=10,
            pool_timeout=30
        )
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}", exc_info=True)
        raise


async def close_db():
    """Close database connection pool"""
    await engine.dispose()
    logger.info("Database connection pool closed")


async def get_pool_status():
    """Get current connection pool status"""
    pool = engine.pool
    return {
        "size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "total": pool.size() + pool.overflow()
    }

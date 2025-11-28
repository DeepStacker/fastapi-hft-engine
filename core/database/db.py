from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from core.config.settings import get_settings
import logging
import time

settings = get_settings()

# Create async engine with proper connection pooling
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.LOG_LEVEL == "DEBUG",
    pool_size=settings.DB_POOL_SIZE,           # Max connections in pool
    max_overflow=settings.DB_MAX_OVERFLOW,     # Additional connections beyond pool_size
    pool_pre_ping=settings.DB_POOL_PRE_PING,   # Test connections before use
    pool_recycle=settings.DB_POOL_RECYCLE,     # Recycle connections after 1 hour
    connect_args={
        "server_settings": {"jit": "off"},  # Disable JIT for better compatibility
        "command_timeout": 60,               # 60 second timeout
    }
)

# Create async session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Create declarative base
Base = declarative_base()

# Slow query logging
logger = logging.getLogger("stockify.db")

async def get_db_session():
    """FastAPI dependency for database session"""
    async with async_session_factory() as session:
        start_time = time.time()
        try:
            yield session
        finally:
            # Log slow queries
            duration_ms = (time.time() - start_time) * 1000
            if duration_ms > settings.SLOW_QUERY_THRESHOLD_MS:
                logger.warning(f"Slow query detected: {duration_ms:.2f}ms")
            await session.close()

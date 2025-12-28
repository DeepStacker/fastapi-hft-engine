"""
Database initialization script - creates all required tables
Run this to initialize the database schema
"""
import asyncio
from sqlalchemy import text
from core.database.db import async_session_factory, engine
from core.database.models import Base
# Note: api_gateway and analytics services have been removed
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def init_database():
    """Initialize database with all tables"""
    logger.info("Creating all database tables...")
    
    # Create all tables defined in models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("✓ All tables created successfully!")
    
    # Verify system_config table exists
    async with async_session_factory() as session:
        result = await session.execute(
            text("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'system_config'")
        )
        count = result.scalar()
        if count > 0:
            logger.info("✓ system_config table verified")
        else:
            logger.error("✗ system_config table not found!")
    
    logger.info("Database initialization complete!")


if __name__ == "__main__":
    asyncio.run(init_database())

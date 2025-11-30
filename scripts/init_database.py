"""
Database initialization script - creates all required tables
Run this to initialize the database schema
"""
import asyncio
from sqlalchemy import text
from core.database.db import async_session_factory, engine
from core.database.models import Base
from services.api_gateway.models import APIKey
from services.analytics.models import AnalyticsCumulativeOI, AnalyticsPatterns
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def init_database():
    """Initialize database with all tables"""
    logger.info("Creating all database tables...")
    
    # Create all tables defined in models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Execute TimescaleDB setup (must be outside transaction block for continuous aggregates)
    from services.analytics.models import TIMESCALE_SETUP_SQL
    logger.info("Setting up TimescaleDB hypertables and aggregates...")
    
    # Use autocommit for TimescaleDB operations
    async with engine.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        # Split by semicolon to execute statements individually
        for statement in TIMESCALE_SETUP_SQL.split(';'):
            if statement.strip():
                try:
                    await conn.execute(text(statement))
                except Exception as e:
                    # Ignore "already exists" errors
                    if "already exists" in str(e) or "already a hypertable" in str(e):
                        continue
                    logger.warning(f"Error executing statement: {e}")
    
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

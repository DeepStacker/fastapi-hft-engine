"""
Database Index Creation Script

Run this script to create optimized indexes for high-concurrency queries.
Execute via: python -m app.scripts.create_indexes
"""
import asyncio
import logging
from sqlalchemy import text

from app.config.database import engine

logger = logging.getLogger(__name__)

# Indexes for common query patterns
INDEXES = [
    # User lookups by Firebase UID (most common)
    {
        "name": "idx_users_firebase_uid",
        "table": "users",
        "columns": ["firebase_uid"],
        "unique": True,
    },
    # User email lookups
    {
        "name": "idx_users_email",
        "table": "users",
        "columns": ["email"],
        "unique": True,
    },
    # Active users filter
    {
        "name": "idx_users_is_active",
        "table": "users",
        "columns": ["is_active"],
    },
    # Config lookups by key
    {
        "name": "idx_configs_key",
        "table": "configs",
        "columns": ["key"],
        "unique": True,
    },
    # Config category filter
    {
        "name": "idx_configs_category",
        "table": "configs",
        "columns": ["category"],
    },
    # Notifications by user
    {
        "name": "idx_notifications_user_id",
        "table": "notifications",
        "columns": ["user_id"],
    },
    # Unread notifications
    {
        "name": "idx_notifications_user_read",
        "table": "notifications",
        "columns": ["user_id", "read"],
    },
    # Recent notifications
    {
        "name": "idx_notifications_created",
        "table": "notifications",
        "columns": ["created_at DESC"],
    },
]


async def create_index(conn, index_def: dict) -> bool:
    """Create a single index if it doesn't exist"""
    name = index_def["name"]
    table = index_def["table"]
    columns = ", ".join(index_def["columns"])
    unique = "UNIQUE" if index_def.get("unique") else ""
    
    try:
        # Check if index exists
        check_sql = text(f"""
            SELECT 1 FROM pg_indexes 
            WHERE indexname = :name
        """)
        result = await conn.execute(check_sql, {"name": name})
        exists = result.fetchone() is not None
        
        if exists:
            logger.info(f"Index {name} already exists")
            return False
        
        # Create index concurrently (non-blocking)
        create_sql = f"""
            CREATE {unique} INDEX CONCURRENTLY IF NOT EXISTS {name}
            ON {table} ({columns})
        """
        await conn.execute(text(create_sql))
        logger.info(f"Created index: {name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create index {name}: {e}")
        return False


async def create_all_indexes():
    """Create all indexes"""
    created = 0
    
    async with engine.begin() as conn:
        for index_def in INDEXES:
            if await create_index(conn, index_def):
                created += 1
    
    logger.info(f"Created {created} new indexes")
    return created


async def analyze_tables():
    """Run ANALYZE on all tables for query optimizer"""
    tables = ["users", "configs", "notifications"]
    
    async with engine.begin() as conn:
        for table in tables:
            try:
                await conn.execute(text(f"ANALYZE {table}"))
                logger.info(f"Analyzed table: {table}")
            except Exception as e:
                logger.warning(f"Failed to analyze {table}: {e}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    async def main():
        await create_all_indexes()
        await analyze_tables()
    
    asyncio.run(main())

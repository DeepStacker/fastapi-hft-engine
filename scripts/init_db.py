"""
Database Initialization Script

Creates all tables in the database using SQLAlchemy models.
"""
import asyncio
import sys
from core.database.db import engine, Base
from core.database.models import (
    InstrumentDB,
    MarketSnapshotDB,
    OptionContractDB,
    FutureContractDB,
    UserDB,
    APIKeyDB,
    AuditLogDB,
    TradingSessionDB,
    SystemConfigDB,
    AlertRuleDB
)

async def init_database():
    """Initialize database with all tables"""
    try:
        async with engine.begin() as conn:
            print("Creating all tables...")
            await conn.run_sync(Base.metadata.create_all)
            print("✅ All tables created successfully!")
            
            # Print created tables
            from sqlalchemy import text
            result = await conn.execute(text(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
            ))
            tables = result.fetchall()
            print(f"\n📊 Created {len(tables)} tables:")
            for table in tables:
                print(f"  - {table[0]}")
                
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("🚀 Initializing Stockify Database...")
    asyncio.run(init_database())
    print("\n✅ Database initialization complete!")

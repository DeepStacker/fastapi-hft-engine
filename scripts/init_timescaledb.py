import asyncio
from sqlalchemy import text
from core.database.db import engine, Base
from core.database.models import MarketSnapshotDB, OptionContractDB, FutureContractDB, InstrumentDB # Import to register models

async def init_db():
    async with engine.begin() as conn:
        # Enable TimescaleDB extension
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
        
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
        
        # Convert to Hypertables
        # We suppress errors if they are already hypertables
        try:
            await conn.execute(text("SELECT create_hypertable('market_snapshots', 'timestamp', if_not_exists => TRUE);"))
            await conn.execute(text("SELECT create_hypertable('option_contracts', 'timestamp', if_not_exists => TRUE);"))
        except Exception as e:
            print(f"Hypertable creation warning: {e}")

    print("Database initialized successfully.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(init_db())

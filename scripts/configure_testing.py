import asyncio
from core.database.db import async_session_factory
from core.database.models import SystemConfigDB
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

async def enable_test_mode():
    """
    Enable weekend trading and set ingestion interval for testing.
    """
    configs = [
        {"key": "allow_weekend_trading", "value": "true", "data_type": "bool", "description": "Allow ingestion on weekends"},
        {"key": "ingestion_interval", "value": "1.0", "data_type": "float", "description": "Ingestion loop interval in seconds"},
        {"key": "trading_start_time", "value": "00:00", "data_type": "string", "description": "Trading start time"},
        {"key": "trading_end_time", "value": "23:59", "data_type": "string", "description": "Trading end time"}
    ]
    
    async with async_session_factory() as session:
        print("Updating System Configuration...")
        
        for config in configs:
            # Upsert config
            stmt = insert(SystemConfigDB).values(
                key=config["key"],
                value=config["value"],
                data_type=config["data_type"],
                description=config["description"],
                is_encrypted=False
            ).on_conflict_do_update(
                index_elements=['key'],
                set_={"value": config["value"]}
            )
            
            await session.execute(stmt)
            print(f"Set {config['key']} = {config['value']}")
            
        await session.commit()
        print("✅ Configuration updated successfully.")

if __name__ == "__main__":
    asyncio.run(enable_test_mode())

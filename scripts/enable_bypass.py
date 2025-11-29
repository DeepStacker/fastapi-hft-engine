"""
Enable bypass trading hours for testing processor
"""
import asyncio
from core.database.session import AsyncSessionLocal
from core.database.models import SystemConfigDB

async def enable_bypass():
    """Enable bypass trading hours"""
    async with AsyncSessionLocal() as session:
        # Get bypass config
        result = await session.execute(
            "SELECT * FROM system_configs WHERE config_key = 'bypass_trading_hours'"
        )
        config = result.first()
        
        if config:
            config[2] = 'true'  # config_value
            await session.execute(
                "UPDATE system_configs SET config_value = 'true' WHERE config_key = 'bypass_trading_hours'"
            )
            await session.commit()
            print("✅ Bypass trading hours ENABLED")
        else:
            print("❌ Config not found")

if __name__ == "__main__":
    asyncio.run(enable_bypass())

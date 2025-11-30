import asyncio
from sqlalchemy import select, func
from core.database.db import async_session_factory
from core.database.models import InstrumentDB

async def count_instruments():
    async with async_session_factory() as session:
        result = await session.execute(
            select(func.count()).select_from(InstrumentDB).where(InstrumentDB.is_active == True)
        )
        count = result.scalar()
        print(f"Active Instruments: {count}")

if __name__ == "__main__":
    asyncio.run(count_instruments())

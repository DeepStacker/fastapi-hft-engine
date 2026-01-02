
import asyncio
import logging
import sys
import os
from datetime import datetime, timedelta

# Add app directly to path to simulate app root context
sys.path.append(os.path.abspath("services/ocd-backend/app"))
sys.path.append(os.path.abspath("services/ocd-backend"))

from sqlalchemy import select, func, text, and_, asc

# Try imports based on app structure
try:
    from core.database.db import async_session_factory
    from core.database.models import OptionContractDB
except ImportError:
    # Fallback if running from within app folder or different context
    from app.core.database.db import async_session_factory
    from app.core.database.models import OptionContractDB

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("debug_query")

async def test_query():
    symbol_id = 13 # NIFTY
    strike = 24000.0
    option_type = "CE"
    expiry = "1767767400" # 2026-01-08
    
    # Time range
    # Extend end_time significantly to capture potential IST timestamps even if system is UTC
    end_time = datetime.now() + timedelta(hours=10)
    start_time = (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    logger.info(f"Query Range: {start_time} to {end_time}")
    
    async with async_session_factory() as session:
        # 1. Simple count query
        stmt = select(func.count()).filter(
            OptionContractDB.symbol_id == symbol_id,
            OptionContractDB.strike_price == strike,
            OptionContractDB.option_type == option_type,
            OptionContractDB.expiry == expiry
        )
        result = await session.execute(stmt)
        count = result.scalar()
        logger.info(f"Total matching rows (ignoring time): {count}")
        
        # 2. Count with time range
        stmt_time = select(func.count()).filter(
            OptionContractDB.symbol_id == symbol_id,
            OptionContractDB.strike_price == strike,
            OptionContractDB.option_type == option_type,
            OptionContractDB.expiry == expiry,
            OptionContractDB.timestamp >= start_time,
            OptionContractDB.timestamp <= end_time
        )
        result_time = await session.execute(stmt_time)
        count_time = result_time.scalar()
        logger.info(f"Matching rows in time range: {count_time}")
        
        # 3. Check timestamps in DB
        if count > 0:
            sample_stmt = select(OptionContractDB.timestamp, OptionContractDB.oi, OptionContractDB.oi_change).filter(
               OptionContractDB.symbol_id == symbol_id,
               OptionContractDB.strike_price == strike,
               OptionContractDB.option_type == option_type,
               OptionContractDB.expiry == expiry
            ).order_by(OptionContractDB.timestamp.desc()).limit(5)
            rows = (await session.execute(sample_stmt)).all()
            logger.info(f"Sample Rows (Timestamp, OI, OI_Change) in DB: {rows}")

if __name__ == "__main__":
    asyncio.run(test_query())

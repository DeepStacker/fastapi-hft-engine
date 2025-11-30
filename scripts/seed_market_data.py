import asyncio
import logging
from datetime import datetime, timedelta, date
from sqlalchemy import select
from core.database.db import async_session_factory
from services.analytics.models import AnalyticsCumulativeOI
from core.database.models import InstrumentDB

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_market_data")

async def seed_market_data():
    """Seed database with dummy market data for NIFTY (13)"""
    logger.info("Seeding market data...")
    
    symbol_id = 13 # NIFTY
    
    async with async_session_factory() as session:
        # Get current time
        now = datetime.utcnow()
        today = date.today()
        
        # Create dummy data points for the last hour
        data_points = []
        for i in range(60):
            timestamp = now - timedelta(minutes=i)
            
            # Create CE record
            ce_record = AnalyticsCumulativeOI(
                timestamp=timestamp,
                symbol_id=symbol_id,
                strike_price=24000.0,
                option_type="CE",
                expiry=today + timedelta(days=5), # Next expiry
                current_oi=1000000 + (i * 1000),
                opening_oi=1000000,
                cumulative_oi_change=i * 1000,
                cumulative_volume=50000 + (i * 500),
                session_high_oi=1100000,
                session_low_oi=900000,
                oi_change_pct=0.5
            )
            data_points.append(ce_record)
            
            # Create PE record
            pe_record = AnalyticsCumulativeOI(
                timestamp=timestamp,
                symbol_id=symbol_id,
                strike_price=24000.0,
                option_type="PE",
                expiry=today + timedelta(days=5),
                current_oi=800000 + (i * 800),
                opening_oi=800000,
                cumulative_oi_change=i * 800,
                cumulative_volume=40000 + (i * 400),
                session_high_oi=900000,
                session_low_oi=700000,
                oi_change_pct=0.4
            )
            data_points.append(pe_record)
        
        session.add_all(data_points)
        await session.commit()
        logger.info(f"Seeded {len(data_points)} market data records for NIFTY")

if __name__ == "__main__":
    asyncio.run(seed_market_data())

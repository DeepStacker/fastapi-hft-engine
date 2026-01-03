
import asyncio
import os
import sys
from datetime import datetime, time as dt_time
import pytz

# Add app to path
sys.path.append("/app")

from app.config.database import AsyncSessionLocal
from app.repositories.historical import HistoricalDataRepository, get_historical_repository
from core.database.models import OptionContractDB
from sqlalchemy import select

async def main():
    print("Starting Debug Script v3...")
    
    IST = pytz.timezone('Asia/Kolkata')
    
    async with AsyncSessionLocal() as db:
        repo = get_historical_repository(db)
        
        # 1. Get Symbol ID
        symbol_id = await repo.get_symbol_id("NIFTY")
        print(f"Symbol ID for NIFTY: {symbol_id}")
        
        # 2. Timestamp Debugging
        expiry_input = "2026-01-08"
        dt = datetime.strptime(expiry_input, "%Y-%m-%d")
        dt_naive = datetime.combine(dt.date(), dt_time(15, 30))
        print(f"Naive DT: {dt_naive}")
        
        dt_ist = IST.localize(dt_naive)
        print(f"IST DT: {dt_ist}")
        
        unix_val = int(dt_ist.timestamp())
        print(f"Unix Timestamp: {unix_val}")
        
        # Check against DB value
        result = await db.execute(select(OptionContractDB.expiry).where(OptionContractDB.symbol_id == symbol_id).limit(1))
        db_expiry = result.scalar()
        print(f"DB Expiry (First row): {db_expiry}")
        
        if unix_val != db_expiry:
             print(f"MISMATCH! Calculated: {unix_val} vs DB: {db_expiry}")
             diff = unix_val - db_expiry
             print(f"Difference: {diff} seconds ({diff/3600} hours)")

        # 3. Test Query with HARDCODED DB Value (Guaranteed to match if query logic works)
        from datetime import timezone
        
        # Date: 2026-01-03
        # Start: 09:15 IST -> 03:45 UTC
        start_ist_naive = datetime(2026, 1, 3, 9, 15)
        start_ist = IST.localize(start_ist_naive)
        start_utc = start_ist.astimezone(timezone.utc).replace(tzinfo=None)
        
        # End: 12:00 UTC
        end_utc = datetime(2026, 1, 3, 12, 0, 0)
        
        print(f"Query Range UTC: {start_utc} to {end_utc}")
        
        # FORCE USE OF DB EXPIRY
        target_expiry = str(db_expiry)
        print(f"Testing with TARGET EXPIRY: {target_expiry}")
        
        data = await repo.get_option_timeseries(
            symbol_id=symbol_id,
            strike=25000.0,
            option_type="CE",
            expiry=target_expiry,
            field="oi",
            start_time=start_utc,
            end_time=end_utc,
            interval_minutes=5
        )
        
        print(f"Result Count with target expiry: {len(data)}")
        if data:
            print(f"First point: {data[0]}")

if __name__ == "__main__":
    asyncio.run(main())

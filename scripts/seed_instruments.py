import asyncio
import logging
from sqlalchemy import select, update
from core.database.db import async_session_factory
from core.database.models import InstrumentDB

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_instruments")

symbol_list = {
    "NIFTY": 13,
    "BANKNIFTY": 25,
    "FINNIFTY": 27,
    "MIDCPNIFTY": 442,
    "NIFTYNXT50": 38,
    "SENSEX": 51,
    "BANKEX": 69,
    "CRUDEOIL": 294,
    "ADANIENT": 25,
    "ADANIPORTS": 15083,
    "APOLLOHOSP": 157,
    "ASIANPAINT": 236,
    "AXISBANK": 5900,
    "BAJAJ-AUTO": 16669,
    "BAJFINANCE": 317,
    "BAJAJFINSV": 16675,
    "BEL": 383,
    "BPCL": 526,
    "BHARTIARTL": 10604,
    "BRITANNIA": 547,
    "CIPLA": 694,
    "COALINDIA": 20374,
    "DRREDDY": 881,
    "EICHERMOT": 910,
    "GRASIM": 1232,
    "HCLTECH": 7229,
    "HDFCBANK": 1333,
    "HDFCLIFE": 467,
    "HEROMOTOCO": 1348,
    "HINDALCO": 1363,
    "HINDUNILVR": 1394,
    "ICICIBANK": 4963,
    "ITC": 1660,
    "INDUSINDBK": 5258,
    "INFY": 1594,
    "JSWSTEEL": 11723,
    "KOTAKBANK": 1922,
    "LT": 11483,
    "MM": 2031,
    "MARUTI": 10999,
    "NTPC": 11630,
    "NESTLEIND": 17963,
    "ONGC": 2475,
    "POWERGRID": 14977,
    "RELIANCE": 2885,
    "SBILIFE": 21808,
    "SHRIRAMFIN": 4306,
    "SBIN": 3045,
    "SUNPHARMA": 3351,
    "TCS": 11536,
    "TATACONSUM": 3432,
    "TATAMOTORS": 3456,
    "TATASTEEL": 3499,
    "TECHM": 13538,
    "TITAN": 3506,
    "TRENT": 1964,
    "ULTRACEMCO": 11532,
    "WIPRO": 3787,
}

seg_list = {
    "CRUDEOIL": 5,
    "NIFTY": 0,
    "BANKNIFTY": 0,
    "FINNIFTY": 0,
    "MIDCPNIFTY": 0,
    "NIFTYNXT50": 0,
    "SENSEX": 0,
    "BANKEX": 0,
    "SHRIRAMFIN": 1,
    "MM": 1,
    "HDFCLIFE": 1,
    "DIVISLAB": 1,
    "LT": 1,
    "ADANIENT": 1,
    "ADANIPORTS": 1,
    "APOLLOHOSP": 1,
    "ASIANPAINT": 1,
    "AXISBANK": 1,
    "BAJAJ-AUTO": 1,
    "BAJFINANCE": 1,
    "BAJAJFINSV": 1,
    "BEL": 1,
    "BPCL": 1,
    "BHARTIARTL": 1,
    "BRITANNIA": 1,
    "CIPLA": 1,
    "COALINDIA": 1,
    "DRREDDY": 1,
    "EICHERMOT": 1,
    "GRASIM": 1,
    "HCLTECH": 1,
    "HDFCBANK": 1,
    "HDFCLIFE": 1,
    "HEROMOTOCO": 1,
    "HINDALCO": 1,
    "HINDUNILVR": 1,
    "ICICIBANK": 1,
    "ITC": 1,
    "INDUSINDBK": 1,
    "INFY": 1,
    "JSWSTEEL": 1,
    "KOTAKBANK": 1,
    "LT": 1,
    "MARUTI": 1,
    "NTPC": 1,
    "NESTLEIND": 1,
    "ONGC": 1,
    "POWERGRID": 1,
    "RELIANCE": 1,
    "SBILIFE": 1,
    "SHRIRAMFIN": 1,
    "SBIN": 1,
    "SUNPHARMA": 1,
    "TCS": 1,
    "TATACONSUM": 1,
    "TATAMOTORS": 1,
    "TATASTEEL": 1,
    "TECHM": 1,
    "TITAN": 1,
    "TRENT": 1,
    "ULTRACEMCO": 1,
    "WIPRO": 1,
}

async def seed_instruments():
    """Seed database with real instruments"""
    logger.info(f"Starting seed of {len(symbol_list)} instruments...")
    
    async with async_session_factory() as session:
        added_count = 0
        updated_count = 0
        
        for symbol, symbol_id in symbol_list.items():
            segment_id = seg_list.get(symbol)
            
            if segment_id is None:
                logger.warning(f"Skipping {symbol}: No segment ID found")
                continue
                
            # Check if exists
            result = await session.execute(
                select(InstrumentDB).where(InstrumentDB.symbol_id == symbol_id)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                # Update if needed
                if existing.symbol != symbol or existing.segment_id != segment_id:
                    existing.symbol = symbol
                    existing.segment_id = segment_id
                    updated_count += 1
                    logger.info(f"Updated {symbol} (ID: {symbol_id})")
            else:
                # Create new
                new_inst = InstrumentDB(
                    symbol_id=symbol_id,
                    symbol=symbol,
                    segment_id=segment_id,
                    is_active=True  # Default to active
                )
                session.add(new_inst)
                added_count += 1
                logger.info(f"Added {symbol} (ID: {symbol_id})")
        
        await session.commit()
        logger.info(f"Seeding complete! Added: {added_count}, Updated: {updated_count}")

if __name__ == "__main__":
    asyncio.run(seed_instruments())

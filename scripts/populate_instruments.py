"""
Populate Instruments Database

This script inserts all 62 symbols from the old application into the new database.
Source: option-chain-d/Backend/Urls.py

Symbol IDs and Segment IDs are mapped exactly as in the old app.
"""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database.db import async_session_factory
from core.database.models import InstrumentDB
from sqlalchemy import select
from datetime import datetime

# Symbol mapping from old app (Urls.py)
SYMBOL_LIST = {
    # Indices (segment_id = 0)
    "NIFTY": 13,
    "BANKNIFTY": 25,
    "FINNIFTY": 27,
    "MIDCPNIFTY": 442,
    "NIFTYNXT50": 38,
    "SENSEX": 51,
    "BANKEX": 69,
    
    # Commodities (segment_id = 5)
    "CRUDEOIL": 294,
    
    # Stocks (segment_id = 1)
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

# Segment mapping from old app (Urls.py)
SEGMENT_LIST = {
    # Indices
    "NIFTY": 0,
    "BANKNIFTY": 0,
    "FINNIFTY": 0,
    "MIDCPNIFTY": 0,
    "NIFTYNXT50": 0,
    "SENSEX": 0,
    "BANKEX": 0,
    
    # Commodity
    "CRUDEOIL": 5,
    
    # All stocks = 1
    "SHRIRAMFIN": 1,
    "MM": 1,
    "HDFCLIFE": 1,
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

async def populate_instruments():
    """Populate instruments table with all 62 symbols"""
    print("=" * 60)
    print("Populating Instruments Database")
    print("=" * 60)
    
    async with async_session_factory() as session:
        # Check existing instruments
        result = await session.execute(select(InstrumentDB))
        existing = {inst.symbol_id: inst for inst in result.scalars().all()}
        
        print(f"\nFound {len(existing)} existing instruments in database")
        
        added = 0
        updated = 0
        skipped = 0
        
        for symbol, symbol_id in sorted(SYMBOL_LIST.items(), key=lambda x: x[1]):
            segment_id = SEGMENT_LIST.get(symbol, 1)  # Default to stocks if not found
            
            if symbol_id in existing:
                # Update existing if needed
                existing_inst = existing[symbol_id]
                if existing_inst.symbol != symbol or existing_inst.segment_id != segment_id:
                    existing_inst.symbol = symbol
                    existing_inst.segment_id = segment_id
                    existing_inst.updated_at = datetime.utcnow()
                    updated += 1
                    print(f"  ✓ Updated: {symbol:15} (ID: {symbol_id:6}, Segment: {segment_id})")
                else:
                    skipped += 1
                    print(f"  - Skipped: {symbol:15} (ID: {symbol_id:6}, Segment: {segment_id}) - already exists")
            else:
                # Insert new instrument
                new_instrument = InstrumentDB(
                    symbol_id=symbol_id,
                    symbol=symbol,
                    segment_id=segment_id,
                    is_active=True  # Activate all by default
                )
                session.add(new_instrument)
                added += 1
                print(f"  + Added:   {symbol:15} (ID: {symbol_id:6}, Segment: {segment_id})")
        
        # Commit all changes
        await session.commit()
        
        print("\n" + "=" * 60)
        print(f"Summary:")
        print(f"  Added:   {added}")
        print(f"  Updated: {updated}")
        print(f"  Skipped: {skipped}")
        print(f"  Total:   {len(SYMBOL_LIST)}")
        print("=" * 60)
        
        # Verify
        result = await session.execute(select(InstrumentDB))
        total_count = len(result.scalars().all())
        print(f"\nVerification: Database now has {total_count} instruments")
        
        # Show segment breakdown
        result = await session.execute(select(InstrumentDB))
        all_instruments = result.scalars().all()
        
        segment_counts = {0: 0, 1: 0, 5: 0}
        for inst in all_instruments:
            if inst.segment_id in segment_counts:
                segment_counts[inst.segment_id] += 1
        
        print(f"\nBreakdown by segment:")
        print(f"  Indices (0):     {segment_counts[0]}")
        print(f"  Stocks (1):      {segment_counts[1]}")
        print(f"  Commodities (5): {segment_counts[5]}")
        
        return added + updated


if __name__ == "__main__":
    print("\nStarting instrument population...\n")
    try:
        count = asyncio.run(populate_instruments())
        print(f"\n✅ Successfully populated {count} instruments!\n")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)

"""
Direct Database Setup - Create Instruments Table and Populate

Bypasses Alembic to create instruments table directly
"""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from core.database.db import async_engine
from datetime import datetime

# Symbol mapping from old app
SYMBOLS_DATA = [
    # Indices (segment_id = 0)
    (13, "NIFTY", 0),
    (25, "BANKNIFTY", 0),
    (27, "FINNIFTY", 0),
    (442, "MIDCPNIFTY", 0),
    (38, "NIFTYNXT50", 0),
    (51, "SENSEX", 0),
    (69, "BANKEX", 0),
    
    # Commodities (segment_id = 5)
    (294, "CRUDEOIL", 5),
    
    # Stocks (segment_id = 1)
    (25, "ADANIENT", 1),
    (15083, "ADANIPORTS", 1),
    (157, "APOLLOHOSP", 1),
    (236, "ASIANPAINT", 1),
    (5900, "AXISBANK", 1),
    (16669, "BAJAJ-AUTO", 1),
    (317, "BAJFINANCE", 1),
    (16675, "BAJAJFINSV", 1),
    (383, "BEL", 1),
    (526, "BPCL", 1),
    (10604, "BHARTIARTL", 1),
    (547, "BRITANNIA", 1),
    (694, "CIPLA", 1),
    (20374, "COALINDIA", 1),
    (881, "DRREDDY", 1),
    (910, "EICHERMOT", 1),
    (1232, "GRASIM", 1),
    (7229, "HCLTECH", 1),
    (1333, "HDFCBANK", 1),
    (467, "HDFCLIFE", 1),
    (1348, "HEROMOTOCO", 1),
    (1363, "HINDALCO", 1),
    (1394, "HINDUNILVR", 1),
    (4963, "ICICIBANK", 1),
    (1660, "ITC", 1),
    (5258, "INDUSINDBK", 1),
    (1594, "INFY", 1),
    (11723, "JSWSTEEL", 1),
    (1922, "KOTAKBANK", 1),
    (11483, "LT", 1),
    (2031, "MM", 1),
    (10999, "MARUTI", 1),
    (11630, "NTPC", 1),
    (17963, "NESTLEIND", 1),
    (2475, "ONGC", 1),
    (14977, "POWERGRID", 1),
    (2885, "RELIANCE", 1),
    (21808, "SBILIFE", 1),
    (4306, "SHRIRAMFIN", 1),
    (3045, "SBIN", 1),
    (3351, "SUNPHARMA", 1),
    (11536, "TCS", 1),
    (3432, "TATACONSUM", 1),
    (3456, "TATAMOTORS", 1),
    (3499, "TATASTEEL", 1),
    (13538, "TECHM", 1),
    (3506, "TITAN", 1),
    (1964, "TRENT", 1),
    (11532, "ULTRACEMCO", 1),
    (3787, "WIPRO", 1),
]

async def setup_instruments():
    """Create instruments table and populate"""
    print("=" * 60)
    print("Direct Database Setup - Instruments")
    print("=" * 60)
    
    async with async_engine.begin() as conn:
        # Drop existing table if exists
        print("\n1. Dropping existing instruments table (if exists)...")
        await conn.execute(text("DROP TABLE IF EXISTS instruments CASCADE"))
        print("   ✓ Dropped")
        
        # Create new table with correct schema
        print("\n2. Creating instruments table with new schema...")
        await conn.execute(text("""
            CREATE TABLE instruments (
                id SERIAL PRIMARY KEY,
                symbol_id INTEGER UNIQUE NOT NULL,
                symbol VARCHAR(50) NOT NULL,
                segment_id INTEGER NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT chk_valid_segment CHECK (segment_id IN (0, 1, 5))
            )
        """))
        print("   ✓ Created")
        
        # Create indexes
        print("\n3. Creating indexes...")
        await conn.execute(text("""
            CREATE INDEX idx_instrument_active_symbol ON instruments(is_active, symbol_id)
        """))
        await conn.execute(text("""
            CREATE INDEX idx_instrument_segment ON instruments(segment_id)
        """))
        await conn.execute(text("""
            CREATE INDEX idx_instrument_symbol ON instruments(symbol)
        """))
        print("   ✓ Created 3 indexes")
        
        # Insert data
        print("\n4. Inserting 58 symbols...")
        inserted = 0
        for symbol_id, symbol, segment_id in SYMBOLS_DATA:
            try:
                await conn.execute(
                    text("""
                        INSERT INTO instruments (symbol_id, symbol, segment_id, is_active)
                        VALUES (:sid, :sym, :seg, true)
                        ON CONFLICT (symbol_id) DO UPDATE
                        SET symbol = EXCLUDED.symbol,
                            segment_id = EXCLUDED.segment_id,
                            updated_at = CURRENT_TIMESTAMP
                    """),
                    {"sid": symbol_id, "sym": symbol, "seg": segment_id}
                )
                inserted += 1
                print(f"   + {symbol:15} (ID: {symbol_id:6}, Segment: {segment_id})")
            except Exception as e:
                print(f"   ! Error inserting {symbol}: {e}")
        
        print(f"\n   ✓ Inserted {inserted} instruments")
        
        # Verify
        print("\n5. Verifying...")
        result = await conn.execute(text("SELECT COUNT(*) as cnt FROM instruments"))
        count = result.scalar()
        print(f"   ✓ Total instruments in database: {count}")
        
        # Breakdown by segment
        result = await conn.execute(text("""
            SELECT segment_id, COUNT(*) as cnt 
            FROM instruments 
            GROUP BY segment_id 
            ORDER BY segment_id
        """))
        print("\n6. Breakdown by segment:")
        for row in result:
            seg_name = {0: "Indices", 1: "Stocks", 5: "Commodities"}.get(row.segment_id, "Unknown")
            print(f"   {seg_name:15} ({row.segment_id}): {row.cnt}")
        
        print("\n" + "=" * 60)
        print("✅ Instruments table created and populated successfully!")
        print("=" * 60)
        
        return count


if __name__ == "__main__":
    print("\nStarting direct database setup...\n")
    try:
        count = asyncio.run(setup_instruments())
        print(f"\n✅ Successfully set up {count} instruments!\n")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)

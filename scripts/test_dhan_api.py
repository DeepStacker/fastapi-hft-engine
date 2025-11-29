"""
Test Dhan API Connection

Verifies that the updated DhanApiClient can successfully:
1. Fetch expiry dates
2. Fetch option chain data
3. Fetch spot data
"""
import asyncio
import sys
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.ingestion.dhan_client import DhanApiClient

async def test_connection():
    print("=" * 60)
    print("Testing Dhan API Connection")
    print("=" * 60)
    
    client = DhanApiClient()
    
    # Test Symbol: NIFTY (Index)
    symbol = "NIFTY"
    symbol_id = 13
    segment_id = 0
    
    print(f"\n1. Fetching Expiry Dates for {symbol} (ID: {symbol_id}, Seg: {segment_id})...")
    expiries = await client.fetch_expiry_dates(symbol_id, segment_id)
    
    if not expiries:
        print("❌ Failed to fetch expiries!")
        return
        
    print(f"✅ Success! Found {len(expiries)} expiries.")
    print(f"   Nearest: {expiries[0]}")
    print(f"   All: {expiries}")
    
    target_expiry = expiries[0]
    
    print(f"\n2. Fetching Option Chain for {symbol} ({target_expiry})...")
    chain_data = await client.fetch_option_chain(symbol_id, target_expiry, segment_id)
    
    if not chain_data:
        print("❌ Failed to fetch option chain!")
    else:
        # Check if we got valid data structure
        if 'data' in chain_data and 'oc' in chain_data['data']:
            strike_count = len(chain_data['data']['oc'])
            print(f"✅ Success! Received option chain with {strike_count} strikes.")
        else:
            print(f"⚠️ Warning: Unexpected response structure: {list(chain_data.keys())}")
            
    print(f"\n3. Fetching Spot Data for {symbol}...")
    spot_data = await client.fetch_spot_data(symbol_id, segment_id)
    
    if not spot_data:
        print("❌ Failed to fetch spot data!")
    else:
        if 'data' in spot_data and 'Ltp' in spot_data['data']:
            ltp = spot_data['data']['Ltp']
            print(f"✅ Success! Current Spot Price: {ltp}")
        else:
            print(f"⚠️ Warning: Unexpected spot response: {spot_data}")

    print("\n" + "=" * 60)
    print("Test Complete")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_connection())

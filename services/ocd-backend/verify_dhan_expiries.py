
import asyncio
import sys
import os
import json
import logging

# Add parent directory to path
sys.path.append(os.getcwd())

from app.services.dhan_client import DhanClient
from app.config.symbols import get_symbol_id, get_segment_id
from app.config.settings import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.cache.redis import RedisCache, get_redis_connection

async def verify_expiries():
    # Initialize cache to get fresh tokens
    redis_client = await get_redis_connection()
    cache = RedisCache(redis_client)
    
    # Note: get_redis_connection automatically initializes the pool if needed
    
    # Force use of access token if auth token is missing (fallback)
    token = settings.DHAN_AUTH_TOKEN or settings.DHAN_ACCESS_TOKEN
    
    client = DhanClient(cache=cache, auth_token=token)
    symbol = "NIFTY"
    
    # Clear cache to ensure fresh fetch
    from app.cache.redis import CacheKeys
    await cache.delete(CacheKeys.expiry(symbol))
    print(f"Cleared cache for {symbol}")
    
    print(f"\n--- Verifying Expiries for {symbol} ---\n")
    
    # 1. Fetch from current implementation (Futures Endpoint)
    print("1. Fetching from CURRENT implementation (get_expiry_dates / futoptsum)...")
    try:
        # Construct payload manually for futures endpoint
        sid = get_symbol_id(symbol)
        seg = get_segment_id(symbol)
        payload_none = {"Data": {"Seg": seg, "Sid": sid}} # Futures endpoint doesn't take 'Exp'
        
        data_futures = await client._request(settings.DHAN_FUTURES_ENDPOINT, payload_none, use_cache=False)
        raw_futures = data_futures.get("data", {}) or {}
        opsum = raw_futures.get("opsum", {}) or {}
        
        print(f"Current Expiries Count (Keys): {len(opsum.keys())}")
        keys = list(opsum.keys())
        print(f"Current Expiries (Keys): {keys}")
        
        if keys:
            first_key = keys[0]
            first_val = opsum[first_key]
            # Print keys of the value to see structure
            print(f"Structure of opsum[{first_key}]: {type(first_val)}")
            if isinstance(first_val, dict):
                print(f"Keys in opsum value: {list(first_val.keys())}")
            else:
                 print(f"Value sample: {str(first_val)[:100]}")
                 
    except Exception as e:
        print(f"Error fetching current expiries: {e}")
        
    # 2. Fetch from Option Chain Endpoint directly
    print("\n2. Fetching from OPTION CHAIN endpoint (/optchain)...")
    try:
        # Construct payload manually
        sid = get_symbol_id(symbol)
        seg = get_segment_id(symbol)
        
        # Try with Exp=None
        print("\n   [Test A] Trying Exp=None...")
        payload_none = {"Data": {"Seg": seg, "Sid": sid, "Exp": None}}
        data_none = await client._request(settings.DHAN_OPTIONS_CHAIN_ENDPOINT, payload_none, use_cache=False)
        explst_none = data_none.get("data", {}).get("explst")
        print(f"   Exp=None result: {explst_none}")

        current_expiries = await client.get_expiry_dates(symbol)
        print(f"Current Expiries Count: {len(current_expiries)}")
        print(f"Current Expiries (First 5): {current_expiries[:5]}")
        
        # Verify years
        if current_expiries:
            from datetime import datetime
            first_dt = datetime.fromtimestamp(current_expiries[0])
            print(f"First Expiry Year: {first_dt.year}")
            if first_dt.year >= 2025:
                 print("\n>>> CONFIRMED: Expiries are now converted to CORRECT year.")
            else:
                 print("\n>>> FAILURE: Expiries are strictly OLD/WRONG year.")
            
            valid_exp = current_expiries[0] # This line was moved from the original `if current_expiries` block
            print(f"\n   [Test B] Trying Exp={valid_exp}...")
            payload_valid = {"Data": {"Seg": seg, "Sid": sid, "Exp": valid_exp}}
            data_valid = await client._request(settings.DHAN_OPTIONS_CHAIN_ENDPOINT, payload_valid, use_cache=False)
            explst_valid = data_valid.get("data", {}).get("explst")
            print(f"   Exp={valid_exp} count: {len(explst_valid) if explst_valid else 0}")
            print(f"   Exp={valid_exp} values: {explst_valid}")
            
            if explst_valid and len(explst_valid) > len(current_expiries):
                print("\n>>> CONFIRMED: Querying with valid expiry returns FULL expiry list.")

        # Test C: Calculated Weekly Expiry
        # Jan 1 2026 is Thursday. Next weekly is Jan 8 2026.
        # 15:30 IST = 10:00 UTC
        from datetime import datetime, timezone
        dt = datetime(2026, 1, 8, 10, 0, 0, tzinfo=timezone.utc)
        weekly_ts = int(dt.timestamp())
        
        print(f"\n   [Test C] Trying Calculated Weekly Exp={weekly_ts} (Jan 8 2026)...")
        payload_weekly = {"Data": {"Seg": seg, "Sid": sid, "Exp": weekly_ts}}
        data_weekly = await client._request(settings.DHAN_OPTIONS_CHAIN_ENDPOINT, payload_weekly, use_cache=False)
        oc_weekly = data_weekly.get("data", {}).get("oc")
        explst_weekly = data_weekly.get("data", {}).get("explst")
        
        print(f"   Weekly Exp Result - OC items: {len(oc_weekly) if oc_weekly else 0}")
        print(f"   Weekly Exp Result - explst: {explst_weekly}")
        
        return
        
        # (Rest of previous code is effectively replaced/truncated by return)
            
    except Exception as e:
        print(f"Error fetching option chain expiries: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(verify_expiries())

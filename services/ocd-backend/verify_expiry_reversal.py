
import asyncio
import os
import sys
from datetime import datetime
import pytz

# Add parent directory to path
sys.path.append(os.getcwd())

from app.services.dhan_client import DhanClient
from app.config.settings import settings

async def verify_reversal():
    print(f"System Timezone: {settings.TIMEZONE}")
    
    # Initialize client (no auth needed for these utility methods)
    # We pass explicit None to avoid cache/auth errors
    client = DhanClient()
    
    # 1. Original Raw Timestamp (from logs)
    # 1452105000 = 2016-01-07 00:00:00 IST	
    raw_ts = 1452105000
    print(f"\n--- Round Trip Verification ---\n")
    print(f"1. Original Raw TS: {raw_ts}")
    
    # Check date of raw
    dt_raw = datetime.fromtimestamp(raw_ts, tz=pytz.timezone(settings.TIMEZONE))
    print(f"   Raw Date: {dt_raw}")
    
    # 2. Convert (simulating get_expiry_dates)
    converted_list = client._convert_expiry_timestamps([raw_ts])
    converted_ts = converted_list[0]
    print(f"2. Converted TS: {converted_ts}")
    
    dt_conv = datetime.fromtimestamp(converted_ts, tz=pytz.timezone(settings.TIMEZONE))
    print(f"   Converted Date: {dt_conv}")
    
    # Verify expected logic (Noon, Jan 6, 2026)
    # 2016-01-07 -> 2026-01-07 -> -1 Day -> 2026-01-06 -> Noon
    if dt_conv.year == 2026 and dt_conv.day == 6 and dt_conv.hour == 12:
        print("   >>> Conversion Logic: PASS (Jan 6, Noon)")
    else:
        print("   >>> Conversion Logic: FAIL/UNEXPECTED")

    # 3. Revert (simulating get_option_chain)
    reverted_ts = client.revert_expiry_timestamp(converted_ts)
    print(f"3. Reverted TS: {reverted_ts}")
    
    dt_rev = datetime.fromtimestamp(reverted_ts, tz=pytz.timezone(settings.TIMEZONE))
    print(f"   Reverted Date: {dt_rev}")
    
    # 4. Compare
    if reverted_ts == raw_ts:
        print("\n>>> SUCCESS: Reverted timestamp matches Original")
    else:
        diff = reverted_ts - raw_ts
        print(f"\n>>> FAILURE: Difference of {diff} seconds")
        print(f"    Expected: {raw_ts}")
        print(f"    Got:      {reverted_ts}")

if __name__ == "__main__":
    asyncio.run(verify_reversal())

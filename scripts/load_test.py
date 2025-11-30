import asyncio
import aiohttp
import random
import time
from datetime import datetime

ADMIN_URL = "http://localhost:8001"
GATEWAY_URL = "http://localhost:8000"
API_KEY = "test-key"

async def login(session):
    """Login to get access token"""
    payload = {
        "username": "admin",
        "password": "admin"
    }
    # Note: OAuth2PasswordRequestForm expects form data, not JSON
    async with session.post(f"{ADMIN_URL}/auth/login", data=payload) as resp:
        if resp.status == 200:
            data = await resp.json()
            return data["access_token"]
        else:
            print(f"Login failed: {resp.status}")
            return None

async def simulate_admin_activity(session, token):
    """Simulate admin creating and updating instruments"""
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}
    print(f"[{datetime.now()}] Starting Admin Activity...")
    
    # 1. List Instruments
    async with session.get(f"{ADMIN_URL}/instruments", headers=headers) as resp:
        print(f"Admin List Instruments: {resp.status}")
        if resp.status == 200:
            instruments = await resp.json()
            
    # 2. Create/Update Random Instrument
    symbol_id = random.randint(1000, 9999)
    payload = {
        "symbol_id": symbol_id,
        "symbol": f"TEST-{symbol_id}",
        "segment_id": 1,
        "is_active": True
    }
    
    # Try creating
    async with session.post(f"{ADMIN_URL}/instruments", json=payload, headers=headers) as resp:
        print(f"Admin Create Instrument {symbol_id}: {resp.status}")
        if resp.status == 200:
            data = await resp.json()
            inst_id = data['id']
            print(f"Created Instrument ID: {inst_id} (Symbol: TEST-{symbol_id})")
            
            # Wait for Ingestion to pick it up
            print("Waiting 5s for ingestion to pick up...")
            await asyncio.sleep(5)
            
            # Deactivate it
            print(f"Deactivating Instrument {inst_id}...")
            update_payload = {"is_active": False}
            async with session.put(f"{ADMIN_URL}/instruments/{inst_id}", json=update_payload, headers=headers) as resp:
                print(f"Admin Deactivate Instrument {inst_id}: {resp.status}")
                
            # Wait to verify it stops
            print("Waiting 10s to verify ingestion stops...")
            await asyncio.sleep(10)
            
            # Do NOT activate it again, to verify persistence
            # async with session.post(f"{ADMIN_URL}/instruments/{inst_id}/activate", headers=headers) as resp:
            #     print(f"Admin Activate Instrument {inst_id}: {resp.status}")

async def simulate_gateway_activity(session):
    """Simulate public API usage"""
    print(f"[{datetime.now()}] Starting Gateway Activity...")
    headers = {"X-API-Key": API_KEY}
    
    async with session.get(f"{GATEWAY_URL}/v1/symbols", headers=headers) as resp:
        # Expect 401 because we are using a test key, but 500 would be bad
        print(f"Gateway Get Symbols: {resp.status}")

async def main():
    async with aiohttp.ClientSession() as session:
        token = await login(session)
        if not token:
            print("Aborting test due to login failure")
            return

        # Run for 30 seconds
        end_time = time.time() + 30
        while time.time() < end_time:
            await asyncio.gather(
                simulate_admin_activity(session, token),
                simulate_gateway_activity(session),
                asyncio.sleep(1) # 1 second delay between bursts
            )

if __name__ == "__main__":
    # Install aiohttp if missing (in the container context it might be, but we run this on host)
    # Assuming user has python installed. If not, we'll see error.
    try:
        asyncio.run(main())
    except ImportError:
        print("aiohttp not installed. Please install it or run in container.")

import asyncio
import httpx
import sys
import os
from datetime import timedelta

# Add project root to path
sys.path.append("/app")

from services.gateway.auth import create_access_token

async def test_api():
    # 1. Generate Token
    token = create_access_token(
        data={"sub": "admin"},
        expires_delta=timedelta(minutes=5)
    )
    headers = {"Authorization": f"Bearer {token}"}
    base_url = "http://localhost:8001"
    
    async with httpx.AsyncClient() as client:
        print(f"Testing API at {base_url} with token...")
        
        # 2. Test GET /config
        print("\n[TEST] GET /config")
        resp = await client.get(f"{base_url}/config", headers=headers)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print(f"Response: {resp.json()[:2]}...") # Show first 2
        else:
            print(f"Error: {resp.text}")
            
        # 3. Test POST /config
        print("\n[TEST] PUT /config/test_key")
        resp = await client.put(
            f"{base_url}/config/test_key", 
            json="test_value", # Body is just the value string? No, query param or body?
            # The endpoint signature is: update_config(key: str, value: str, ...)
            # FastAPI expects query params by default for scalars unless Body() is used.
            # Let's check main.py again.
            params={"value": "test_value"},
            headers=headers
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}")
        
        # 4. Test GET /config AGAIN (Verify Persistence)
        print("\n[TEST] GET /config (After PUT)")
        resp = await client.get(f"{base_url}/config", headers=headers)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}")

        # 5. Test GET /services
        print("\n[TEST] GET /services")
        resp = await client.get(f"{base_url}/services", headers=headers)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            services = resp.json()
            print(f"Found {len(services)} services")
            for s in services:
                print(f"- {s['name']}: {s['status']}")
        else:
            print(f"Error: {resp.text}")

        # 6. Debug: List all containers via aiodocker directly
        print("\n[DEBUG] Listing all containers via aiodocker...")
        import aiodocker
        async with aiodocker.Docker() as docker:
            containers = await docker.containers.list()
            for c in containers:
                names = c._container.get("Names", [])
                state = c._container.get("State", "")
                print(f"Container: {names} - State: {state}")

if __name__ == "__main__":
    asyncio.run(test_api())

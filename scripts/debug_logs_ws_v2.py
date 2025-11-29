import asyncio
import websockets
import json
import requests
import os

# Configuration
API_URL = "http://localhost:8001"
WS_URL = "ws://localhost:8001"
USERNAME = "admin"
PASSWORD = "admin"

async def test_logs_websocket():
    # 1. Login to get token
    print(f"Logging in as {USERNAME}...")
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            data={"username": USERNAME, "password": PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        response.raise_for_status()
        token = response.json()["access_token"]
        print("Login successful, token received.")
    except Exception as e:
        print(f"Login failed: {e}")
        return

    # 2. Get a container ID
    print("Fetching containers...")
    try:
        response = requests.get(
            f"{API_URL}/docker/containers",
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()
        containers = response.json()
        if not containers:
            print("No containers found.")
            return
        
        # Pick redis container
        target_container = next((c for c in containers if 'redis' in c['name']), containers[0])
        container_id = target_container['id']
        container_name = target_container['name']
        print(f"Targeting container: {container_name} ({container_id})")
    except Exception as e:
        print(f"Failed to get containers: {e}")
        return

    # 3. Connect to WebSocket
    ws_endpoint = f"{WS_URL}/logs/ws/{container_id}?token={token}"
    print(f"Connecting to {ws_endpoint}...")
    
    try:
        async with websockets.connect(ws_endpoint) as websocket:
            print("WebSocket connected!")
            
            # Wait for messages
            while True:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    print(f"Received log: {message[:100]}...") # Print first 100 chars
                except asyncio.TimeoutError:
                    print("No logs received for 5 seconds.")
                    break
                except websockets.exceptions.ConnectionClosed as e:
                    print(f"WebSocket closed: {e.code} {e.reason}")
                    break
                    
    except Exception as e:
        print(f"WebSocket connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_logs_websocket())

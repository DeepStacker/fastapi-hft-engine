import asyncio
import websockets
import requests
import json

async def main():
    # 1. Login to get token
    print("Logging in...")
    try:
        response = requests.post(
            "http://localhost:8001/auth/login",
            data={"username": "admin", "password": "admin"}
        )
        response.raise_for_status()
        token = response.json()["access_token"]
        print("Login successful, token obtained.")
    except Exception as e:
        print(f"Login failed: {e}")
        return

    # 2. Get a container ID
    print("Fetching containers...")
    try:
        response = requests.get(
            "http://localhost:8001/docker/containers",
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()
        containers = response.json()
        if not containers:
            print("No containers found.")
            return
        
        # Pick the admin container
        target_container = next((c for c in containers if "admin" in c["name"]), containers[0])
        container_id = target_container["id"]
        print(f"Targeting container: {target_container['name']} ({container_id})")
    except Exception as e:
        print(f"Failed to fetch containers: {e}")
        return

    # 3. Connect to Logs WebSocket
    uri = f"ws://localhost:8001/logs/ws/{container_id}?token={token}"
    print(f"Connecting to WebSocket: {uri}")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to WebSocket!")
            
            # Listen for messages
            try:
                while True:
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    print(f"Received log: {message[:100]}...") # Print first 100 chars
                    # Just read a few lines and exit
                    break
            except asyncio.TimeoutError:
                print("Timeout waiting for logs.")
            
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"WebSocket connection failed: {e.status_code} {e}")
    except Exception as e:
        print(f"WebSocket error: {e}")

if __name__ == "__main__":
    asyncio.run(main())

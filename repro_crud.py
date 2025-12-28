
import requests
import time
import os

BASE_URL = "http://127.0.0.1:8001"
USERNAME = "admin"
PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

def login():
    print(f"Logging in as {USERNAME}...", flush=True)
    try:
        response = requests.post(f"{BASE_URL}/auth/login", data={
            "username": USERNAME,
            "password": PASSWORD
        }, timeout=5)
        if response.status_code != 200:
            print(f"Login failed: {response.text}", flush=True)
            exit(1)
        return response.json()["access_token"]
    except Exception as e:
        print(f"Login connection failed: {e}", flush=True)
        exit(1)

def main():
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create Instrument
    print("\n[1] Creating Instrument...", flush=True)
    payload = {
        "symbol_id": 99999,
        "symbol": "TEST-INSTRUMENT",
        "segment_id": 1,
        "is_active": True
    }
    response = requests.post(f"{BASE_URL}/instruments", json=payload, headers=headers)
    if response.status_code == 200:
        inst = response.json()
        inst_id = inst["id"]
        print(f"Created: {inst}", flush=True)
    else:
        print(f"Create failed: {response.text}", flush=True)
        if "already exists" in response.text:
             # Find existing
             print("Instrument exists, finding it...", flush=True)
             response = requests.get(f"{BASE_URL}/instruments", headers=headers)
             for i in response.json():
                 if i["symbol_id"] == 99999:
                     inst_id = i["id"]
                     print(f"Found exiting ID: {inst_id}", flush=True)
                     break
        else:
            exit(1)

    # 2. Verify creation in List
    print("\n[2] Verifying in List...", flush=True)
    response = requests.get(f"{BASE_URL}/instruments", headers=headers)
    instruments = response.json()
    found = False
    for i in instruments:
        if i["id"] == inst_id:
            print(f"Found in list: {i}", flush=True)
            found = True
            break
    if not found:
        print("ERROR: Instrument not found in list after creation!", flush=True)
        
    # 3. Update Instrument - Using FULL payload like Frontend
    print("\n[3] Updating Instrument with extra fields (Changing Segment ID)...", flush=True)
    # Frontend sends all fields, not just the ones to update
    update_payload = {
        "symbol_id": 99999,
        "symbol": "TEST-UPDATED-FULL",
        "segment_id": 5, # Change to Commodities
        "is_active": False
    }
    response = requests.put(f"{BASE_URL}/instruments/{inst_id}", json=update_payload, headers=headers)
    if response.status_code == 200:
        print(f"Update response: {response.json()}", flush=True)
    else:
        print(f"Update failed: {response.text}", flush=True)
        exit(1)
        
    # 4. Verify Update in List
    print("\n[4] Verifying Update in List...", flush=True)
    response = requests.get(f"{BASE_URL}/instruments", headers=headers)
    instruments = response.json()
    found = False
    for i in instruments:
        if i["id"] == inst_id:
            print(f"Found in list: {i}", flush=True)
            if (i["symbol"] == "TEST-UPDATED-FULL" and 
                i["is_active"] == False and 
                i["segment_id"] == 5):
                print("SUCCESS: List reflects update (Symbol, Active, Segment)", flush=True)
            else:
                print(f"FAILURE: List mismatch. Expected Symbol=TEST-UPDATED-FULL, Active=False, Segment=5. Got {i}", flush=True)
            found = True
            break
            
    # 5. Delete Instrument
    print("\n[5] Deleting Instrument...", flush=True)
    response = requests.delete(f"{BASE_URL}/instruments/{inst_id}", headers=headers)
    if response.status_code == 200:
        print("Delete successful", flush=True)
    else:
        print(f"Delete failed: {response.text}", flush=True)
        
    # 6. Verify Deletion
    print("\n[6] Verifying Deletion...", flush=True)
    response = requests.get(f"{BASE_URL}/instruments", headers=headers)
    instruments = response.json()
    found = False
    for i in instruments:
        if i["id"] == inst_id:
            found = True
            break
    if found:
        print("FAILURE: Instrument still in list after deletion", flush=True)
    else:
        print("SUCCESS: Instrument removed from list", flush=True)

if __name__ == "__main__":
    main()

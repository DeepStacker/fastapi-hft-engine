import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"

def verify_v2():
    print("1. Creating Test Position...")
    payload = {
        "strategy_type": "iron_condor",
        "symbol": "NIFTY",
        "expiry": "2026-02-05",
        "entry_spot": 24813.35,
        "legs": [
            {"strike": 25000.0, "option_type": "CE", "action": "SELL", "qty": 1, "lot_size": 75, "entry_price": 55.35, "iv": 19.9, "expiry": "2026-02-05"},
            {"strike": 25150.0, "option_type": "CE", "action": "BUY", "qty": 1, "lot_size": 75, "entry_price": 25.25, "iv": 20.2, "expiry": "2026-02-05"},
            {"strike": 24650.0, "option_type": "PE", "action": "SELL", "qty": 1, "lot_size": 75, "entry_price": 74.9, "iv": 23.4, "expiry": "2026-02-05"},
            {"strike": 24500.0, "option_type": "PE", "action": "BUY", "qty": 1, "lot_size": 75, "entry_price": 42.05, "iv": 24.5, "expiry": "2026-02-05"}
        ],
        "entry_metrics": {
            "max_profit": 5000,
            "max_loss": 3000,
            "pop": 65.5,
            "atm_strike": 24800.0
        }
    }
    
    try:
        r = requests.post(f"{BASE_URL}/positions", json=payload)
        if r.status_code != 200:
            print(f"Failed to create position: {r.text}")
            return
            
        data = r.json()
        pos_id = data.get("id")
        print(f"Position Created: {pos_id}")
        
        print("\n2. Analyzing Position (Triggering Snapshot)...")
        r2 = requests.post(f"{BASE_URL}/positions/{pos_id}/analyze")
        if r2.status_code != 200:
            print(f"Analysis failed: {r2.text}")
        else:
            print("Analysis Success!")
            analysis = r2.json()
            print(json.dumps(analysis, indent=2))
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_v2()

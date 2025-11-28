import pytest
from datetime import datetime
from core.utils.transform import normalize_dhan_data, extract_market_snapshot, extract_option_contracts

# Sample raw data from Dhan API (Mock)
SAMPLE_DHAN_PAYLOAD = {
    "data": {
        "s_sid": 13,
        "OIC": 1000,
        "OIP": 2000,
        "Rto": 0.5,
        "exch": "NSE",
        "sltp": 15000.0,
        "oc": {
            "15000.0": {
                "ce": {
                    "ltp": 100.0,
                    "vol": 500,
                    "OI": 100,
                    "optgeeks": {"delta": 0.5}
                },
                "pe": {
                    "ltp": 80.0,
                    "vol": 600,
                    "OI": 200,
                    "optgeeks": {"delta": -0.4}
                }
            }
        }
    }
}

def test_extract_market_snapshot():
    snapshot = extract_market_snapshot(SAMPLE_DHAN_PAYLOAD["data"])
    assert snapshot["symbol_id"] == 13
    assert snapshot["total_oi_calls"] == 1000
    assert snapshot["ltp"] == 15000.0

def test_extract_option_contracts():
    options = extract_option_contracts(SAMPLE_DHAN_PAYLOAD["data"])
    assert len(options) == 2 # 1 CE + 1 PE
    
    ce = next(o for o in options if o["option_type"] == "CE")
    assert ce["strike_price"] == 15000.0
    assert ce["ltp"] == 100.0
    assert ce["delta"] == 0.5
    
    pe = next(o for o in options if o["option_type"] == "PE")
    assert pe["strike_price"] == 15000.0
    assert pe["ltp"] == 80.0
    assert pe["delta"] == -0.4

def test_normalize_dhan_data():
    normalized = normalize_dhan_data(SAMPLE_DHAN_PAYLOAD)
    assert "market_snapshot" in normalized
    assert "options" in normalized
    assert len(normalized["options"]) == 2

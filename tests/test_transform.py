import pytest
from datetime import datetime
from core.utils.transform import (
    parse_timestamp,
    parse_expiry_date,
    extract_market_snapshot,
    extract_option_contracts,
    normalize_dhan_data
)

def test_parse_timestamp_unix_seconds():
    """Test parsing Unix timestamp in seconds"""
    timestamp = 1700000000  # Nov 14, 2023
    result = parse_timestamp(timestamp)
    assert isinstance(result, datetime)
    assert result.year == 2023

def test_parse_timestamp_unix_milliseconds():
    """Test parsing Unix timestamp in milliseconds"""
    timestamp = 1700000000000  # Milliseconds
    result = parse_timestamp(timestamp)
    assert isinstance(result, datetime)
    assert result.year == 2023

def test_parse_timestamp_iso_string():
    """Test parsing ISO format string"""
    timestamp = "2023-11-14T10:30:00"
    result = parse_timestamp(timestamp)
    assert isinstance(result, datetime)
    assert result.year == 2023
    assert result.month == 11
    assert result.day == 14

def test_parse_timestamp_date_formats():
    """Test parsing various date formats"""
    # YYYY-MM-DD
    result = parse_timestamp("2023-11-14")
    assert result.year == 2023
    
    # DD-MM-YYYY
    result = parse_timestamp("14-11-2023")
    assert result.day == 14

def test_parse_timestamp_invalid():
    """Test parsing invalid timestamp returns current time"""
    result = parse_timestamp("invalid")
    assert isinstance(result, datetime)

def test_parse_expiry_date_from_list():
    """Test parsing expiry date from list"""
    explst = [1700000000]
    result = parse_expiry_date(explst)
    assert isinstance(result, datetime)
    assert result.year == 2023

def test_parse_expiry_date_from_single_value():
    """Test parsing expiry date from single value"""
    explst = 1700000000
    result = parse_expiry_date(explst)
    assert isinstance(result, datetime)

def test_parse_expiry_date_empty_list():
    """Test parsing empty expiry list returns default"""
    explst = []
    default = datetime(2025, 12, 31)
    result = parse_expiry_date(explst, default)
    assert result == default

def test_parse_expiry_date_invalid():
    """Test parsing invalid expiry returns default"""
    result = parse_expiry_date("invalid")
    assert isinstance(result, datetime)

def test_extract_market_snapshot():
    """Test extracting market snapshot from Dhan response"""
    data = {
        "s_sid": 13,
        "OIC": 1000,
        "OIP": 900,
        "Rto": 0.9,
        "exch": "NSE",
        "seg": "OPT",
        "oinst": "INDEX",
        "atmiv": 0.25,
        "aivperchng": 2.5,
        "sltp": 15000.0,
        "svol": 100000,
        "SPerChng": 1.5,
        "SChng": 225.0,
        "olot": 50,
        "otick": 0.05,
        "dte": 15
    }
    
    result = extract_market_snapshot(data)
    
    assert result["symbol_id"] == 13
    assert result["total_oi_calls"] == 1000
    assert result["total_oi_puts"] == 900
    assert result["pcr_ratio"] == 0.9
    assert result["exchange"] == "NSE"
    assert result["segment"] == "OPT"
    assert result["ltp"] == 15000.0
    assert result["volume"] == 100000

def test_extract_option_contracts():
    """Test extracting option contracts from Dhan response"""
    data = {
        "s_sid": 13,
        "explst": [1700000000],
        "oc": {
            "15000": {
                "ce": {
                    "ltp": 100.0,
                    "vol": 500,
                    "OI": 200,
                    "iv": 0.25,
                    "optgeeks": {
                        "delta": 0.5,
                        "gamma": 0.02,
                        "theta": -0.5,
                        "vega": 0.1
                    }
                },
                "pe": {
                    "ltp": 110.0,
                    "vol": 600,
                    "OI": 250,
                    "iv": 0.26,
                    "optgeeks": {
                        "delta": -0.5,
                        "gamma": 0.02,
                        "theta": -0.5,
                        "vega": 0.1
                    }
                }
            }
        }
    }
    
    result = extract_option_contracts(data)
    
    assert len(result) == 2  # CE and PE
    
    # Check CE
    ce = [o for o in result if o["option_type"] == "CE"][0]
    assert ce["symbol_id"] == 13
    assert ce["strike_price"] == 15000.0
    assert ce["ltp"] == 100.0
    assert ce["volume"] == 500
    assert ce["oi"] == 200
    assert ce["iv"] == 0.25
    assert ce["delta"] == 0.5
    
    # Check PE
    pe = [o for o in result if o["option_type"] == "PE"][0]
    assert pe["ltp"] == 110.0
    assert pe["delta"] == -0.5

def test_extract_option_contracts_invalid_strike():
    """Test handling invalid strike price"""
    data = {
        "s_sid": 13,
        "explst": [1700000000],
        "oc": {
            "invalid": {
                "ce": {"ltp": 100.0}
            }
        }
    }
    
    result = extract_option_contracts(data)
    assert len(result) == 0  # Invalid strike should be skipped

def test_extract_option_contracts_missing_optgeeks():
    """Test handling missing Greeks data"""
    data = {
        "s_sid": 13,
        "explst": [1700000000],
        "oc": {
            "15000": {
                "ce": {
                    "ltp": 100.0,
                    "vol": 500,
                    "OI": 200,
                    "iv": 0.25
                    # No optgeeks
                }
            }
        }
    }
    
    result = extract_option_contracts(data)
    assert len(result) == 1
    assert result[0]["delta"] == 0  # Default value

def test_normalize_dhan_data():
    """Test complete normalization of Dhan API response"""
    raw_payload = {
        "data": {
            "s_sid": 13,
            "OIC": 1000,
            "OIP": 900,
            "sltp": 15000.0,
            "explst": [1700000000],
            "oc": {
                "15000": {
                    "ce": {"ltp": 100.0, "vol": 500, "OI": 200, "iv": 0.25, "optgeeks": {"delta": 0.5}}
                }
            }
        }
    }
    
    result = normalize_dhan_data(raw_payload)
    
    assert "market_snapshot" in result
    assert "options" in result
    assert result["market_snapshot"]["symbol_id"] == 13
    assert len(result["options"]) == 1

def test_normalize_dhan_data_empty():
    """Test normalization with empty data"""
    result = normalize_dhan_data({})
    assert result == {}
    
    result = normalize_dhan_data({"data": {}})
    assert result == {}

def test_normalize_dhan_data_error_handling():
    """Test error handling in data normalization"""
    result = normalize_dhan_data({"invalid": "data"})
    assert result == {}

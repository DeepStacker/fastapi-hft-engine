from datetime import datetime
from typing import Dict, List, Any
from models import IOdata

def parse_timestamp(timestamp: int) -> datetime:
    """Convert Unix timestamp to datetime object"""
    return datetime.fromtimestamp(timestamp)

def extract_market_snapshot(response: Dict[str, Any]) -> Dict[str, Any]:
    """Extract market-wide data from the response"""
    # Access the nested data structure
    data = response.get("data", {})
    return {
        "total_oi_calls": data.get("OIC", 0),
        "total_oi_puts": data.get("OIP", 0),
        "pcr_ratio": data.get("Rto", 0),
        "exchange": data.get("exch", ""),
        "segment": data.get("seg", ""),
        "instrument_type": data.get("oinst", ""),
        "atm_iv": data.get("atmiv", 0),
        "aiv_percent_change": data.get("aivperchng", 0),
        "spot_ltp": data.get("sltp", 0),
        "spot_volume": data.get("svol", 0),
        "spot_percent_change": data.get("SPerChng", 0),
        "spot_change": data.get("SChng", 0),
        "option_lot_size": data.get("olot", 0),
        "option_tick_size": data.get("otick", 0),
        "days_to_expiry": data.get("dte", 0)
    }

def extract_future_contracts(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract futures data from the response"""
    futures = []
    data = response.get("data", {})
    for fut_id, fut_data in data.get("fl", {}).items():
        future = {
            "symbol_id": fut_data.get("sid", 0),
            "symbol": fut_data.get("sym", ""),
            "ltp": fut_data.get("ltp", 0),
            "previous_close": fut_data.get("pc", 0),
            "price_change": fut_data.get("pch", 0),
            "price_change_percent": fut_data.get("prch", 0),
            "volume": fut_data.get("vol", 0),
            "volume_change": fut_data.get("v_chng", 0),
            "volume_change_percent": fut_data.get("v_pchng", 0),
            "open_interest": fut_data.get("oi", 0),
            "oi_change": fut_data.get("oichng", 0),
            "oi_change_percent": fut_data.get("oipchng", 0),
            "previous_volume": fut_data.get("pvol", 0),
            "lot_size": fut_data.get("lot", 0),
            "expiry_type": fut_data.get("exptype", ""),
            "timestamp": datetime.utcnow(),
            "expiry": parse_timestamp(int(fut_id)) if fut_id.isdigit() else None
        }
        futures.append(future)
    return futures

def extract_option_contracts(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract option chain data from the response"""
    options = []
    data = response.get("data", {})
    for strike, strike_data in data.get("oc", {}).items():
        # Process call options
        if "ce" in strike_data:
            ce_data = strike_data["ce"]
            option = {
                "strike_price": float(strike),
                "option_type": "CE",
                "symbol_id": ce_data.get("sid", 0),
                "symbol": ce_data.get("sym", ""),
                "display_symbol": ce_data.get("disp_sym", ""),
                "ltp": ce_data.get("ltp", 0),
                "previous_close": ce_data.get("pc", 0),
                "volume": ce_data.get("vol", 0),
                "volume_change": ce_data.get("v_chng", 0),
                "volume_change_percent": ce_data.get("v_pchng", 0),
                "open_interest": ce_data.get("OI", 0),
                "oi_change": ce_data.get("oichng", 0),
                "oi_change_percent": ce_data.get("oiperchnge", 0),
                "implied_volatility": ce_data.get("iv", 0),
                "previous_volume": ce_data.get("pVol", 0),
                "previous_oi": ce_data.get("p_oi", 0),
                "price_change": ce_data.get("p_chng", 0),
                "price_change_percent": ce_data.get("p_pchng", 0),
                "bid_price": ce_data.get("bid", 0),
                "ask_price": ce_data.get("ask", 0),
                "bid_quantity": ce_data.get("bid_qty", 0),
                "ask_quantity": ce_data.get("ask_qty", 0),
                "moneyness": ce_data.get("mness", ""),
                "buildup_type": ce_data.get("btyp", ""),
                "buildup_name": ce_data.get("BuiltupName", ""),
                "delta": ce_data.get("optgeeks", {}).get("delta", 0),
                "theta": ce_data.get("optgeeks", {}).get("theta", 0),
                "gamma": ce_data.get("optgeeks", {}).get("gamma", 0),
                "rho": ce_data.get("optgeeks", {}).get("rho", 0),
                "vega": ce_data.get("optgeeks", {}).get("vega", 0),
                "theoretical_price": ce_data.get("optgeeks", {}).get("theoryprc", 0),
                "vol_pcr": strike_data.get("volpcr", 0),
                "oi_pcr": strike_data.get("oipcr", 0),
                "max_pain_loss": strike_data.get("mploss", 0),
                "expiry_type": strike_data.get("exptype", ""),
                "timestamp": datetime.utcnow()
            }
            options.append(option)
        
        # Process put options
        if "pe" in strike_data:
            pe_data = strike_data["pe"]
            option = {
                "strike_price": float(strike),
                "option_type": "PE",
                "symbol_id": pe_data.get("sid", 0),
                "symbol": pe_data.get("sym", ""),
                "display_symbol": pe_data.get("disp_sym", ""),
                "ltp": pe_data.get("ltp", 0),
                "previous_close": pe_data.get("pc", 0),
                "volume": pe_data.get("vol", 0),
                "volume_change": pe_data.get("v_chng", 0),
                "volume_change_percent": pe_data.get("v_pchng", 0),
                "open_interest": pe_data.get("OI", 0),
                "oi_change": pe_data.get("oichng", 0),
                "oi_change_percent": pe_data.get("oiperchnge", 0),
                "implied_volatility": pe_data.get("iv", 0),
                "previous_volume": pe_data.get("pVol", 0),
                "previous_oi": pe_data.get("p_oi", 0),
                "price_change": pe_data.get("p_chng", 0),
                "price_change_percent": pe_data.get("p_pchng", 0),
                "bid_price": pe_data.get("bid", 0),
                "ask_price": pe_data.get("ask", 0),
                "bid_quantity": pe_data.get("bid_qty", 0),
                "ask_quantity": pe_data.get("ask_qty", 0),
                "moneyness": pe_data.get("mness", ""),
                "buildup_type": pe_data.get("btyp", ""),
                "buildup_name": pe_data.get("BuiltupName", ""),
                "delta": pe_data.get("optgeeks", {}).get("delta", 0),
                "theta": pe_data.get("optgeeks", {}).get("theta", 0),
                "gamma": pe_data.get("optgeeks", {}).get("gamma", 0),
                "rho": pe_data.get("optgeeks", {}).get("rho", 0),
                "vega": pe_data.get("optgeeks", {}).get("vega", 0),
                "theoretical_price": pe_data.get("optgeeks", {}).get("theoryprc", 0),
                "vol_pcr": strike_data.get("volpcr", 0),
                "oi_pcr": strike_data.get("oipcr", 0),
                "max_pain_loss": strike_data.get("mploss", 0),
                "expiry_type": strike_data.get("exptype", ""),
                "timestamp": datetime.utcnow()
            }
            options.append(option)
    
    return options

def flatten_option_chain(response: Dict[str, Any], instrument_id: str) -> Dict[str, Any]:
    """Transform the option chain data into structured format"""
    # Add safeguards for data access
    if not isinstance(response, dict) or "data" not in response:
        raise ValueError("Invalid response format")
    
    result = {
        "market_snapshot": extract_market_snapshot(response),
        "futures": extract_future_contracts(response),
        "options": extract_option_contracts(response)
    }
    return result


def filter_data(data: List[IOdata]) -> Dict[str, List]:
    """Filter and format the data into lists for chart plotting"""
    filtered_data = {
        "symbol": data[0].symbol,
        "symbol_id": data[0].symbol_id,
        "timestamp": [],
        "ltp": [],
        "oi": [],
        "iv": [],
        "delta": [],
        "theta": [],
        "gamma": [],
        "vega": [],
        "rho": [],
        "price_change": [],
        "price_change_percent": [],
        "volume_change": [],
        "volume_change_percent": [],
        "oi_change": [],
        "oi_change_percent": [],
    }

    for item in data:
        filtered_data["timestamp"].append(
            item.timestamp.isoformat() if item.timestamp else None
        )
        filtered_data["ltp"].append(item.ltp if item.ltp is not None else 0)
        filtered_data["oi"].append(
            item.open_interest if item.open_interest is not None else 0
        )
        filtered_data["iv"].append(
            item.implied_volatility if item.implied_volatility is not None else 0
        )
        filtered_data["delta"].append(item.delta if item.delta is not None else 0)
        filtered_data["theta"].append(item.theta if item.theta is not None else 0)
        filtered_data["gamma"].append(item.gamma if item.gamma is not None else 0)
        filtered_data["vega"].append(item.vega if item.vega is not None else 0)
        filtered_data["rho"].append(item.rho if item.rho is not None else 0)
        filtered_data["price_change"].append(
            item.price_change if item.price_change is not None else 0
        )
        filtered_data["price_change_percent"].append(
            item.price_change_percent if item.price_change_percent is not None else 0
        )
        filtered_data["volume_change"].append(
            item.volume_change if item.volume_change is not None else 0
        )
        filtered_data["volume_change_percent"].append(
            item.volume_change_percent if item.volume_change_percent is not None else 0
        )
        filtered_data["oi_change"].append(
            item.oi_change if item.oi_change is not None else 0
        )
        filtered_data["oi_change_percent"].append(
            item.oi_change_percent if item.oi_change_percent is not None else 0
        )

    return filtered_data

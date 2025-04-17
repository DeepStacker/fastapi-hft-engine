from datetime import datetime
from typing import Dict, List, Any
from models import OptionContract


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
        "days_to_expiry": data.get("dte", 0),
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
            "expiry": parse_timestamp(int(fut_id)) if fut_id.isdigit() else None,
        }
        futures.append(future)
    return futures


def extract_option_contracts(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract CE + PE data per strike in a single dict (row) matching OptionContract model"""
    options = []
    data = response.get("data", {})
    timestamp = datetime.utcnow()
    s_id = data.get("s_sid", 0)

    symbol_exp = data.get("explst",0)
    symbol_exp = list(symbol_exp)[0]

    for strike, strike_data in data.get("oc", {}).items():
        ce_data = strike_data.get("ce", {})
        pe_data = strike_data.get("pe", {})

        option = {
            "timestamp": timestamp,
            "symbol_id": s_id,
            'exp': symbol_exp,
            # CE fields
            "ce_symbol_id": ce_data.get("sid", 0),
            "ce_symbol": ce_data.get("sym", ""),
            "ce_display_symbol": ce_data.get("disp_sym", ""),
            "strike_price": float(strike),
            "ce_option_type": "CE",
            "ce_ltp": ce_data.get("ltp", 0),
            "ce_previous_close": ce_data.get("pc", 0),
            "ce_volume": ce_data.get("vol", 0),
            "ce_volume_change": ce_data.get("v_chng", 0),
            "ce_volume_change_percent": ce_data.get("v_pchng", 0),
            "ce_open_interest": ce_data.get("OI", 0),
            "ce_oi_change": ce_data.get("oichng", 0),
            "ce_oi_change_percent": ce_data.get("oiperchnge", 0),
            "ce_implied_volatility": ce_data.get("iv", 0),
            "ce_previous_volume": ce_data.get("pVol", 0),
            "ce_previous_oi": ce_data.get("p_oi", 0),
            "ce_price_change": ce_data.get("p_chng", 0),
            "ce_price_change_percent": ce_data.get("p_pchng", 0),
            "ce_bid_price": ce_data.get("bid", 0),
            "ce_ask_price": ce_data.get("ask", 0),
            "ce_bid_quantity": ce_data.get("bid_qty", 0),
            "ce_ask_quantity": ce_data.get("ask_qty", 0),
            "ce_moneyness": ce_data.get("mness", ""),
            "ce_buildup_type": ce_data.get("btyp", ""),
            "ce_buildup_name": ce_data.get("BuiltupName", ""),
            "ce_delta": ce_data.get("optgeeks", {}).get("delta", 0),
            "ce_theta": ce_data.get("optgeeks", {}).get("theta", 0),
            "ce_gamma": ce_data.get("optgeeks", {}).get("gamma", 0),
            "ce_rho": ce_data.get("optgeeks", {}).get("rho", 0),
            "ce_vega": ce_data.get("optgeeks", {}).get("vega", 0),
            "ce_theoretical_price": ce_data.get("optgeeks", {}).get("theoryprc", 0),
            "ce_vol_pcr": strike_data.get("volpcr", 0),
            "ce_oi_pcr": strike_data.get("oipcr", 0),
            "ce_max_pain_loss": strike_data.get("mploss", 0),
            "ce_expiry_type": strike_data.get("exptype", ""),
            # PE fields
            "pe_symbol_id": pe_data.get("sid", 0),
            "pe_symbol": pe_data.get("sym", ""),
            "pe_option_type": "PE",
            "pe_ltp": pe_data.get("ltp", 0),
            "pe_previous_close": pe_data.get("pc", 0),
            "pe_volume": pe_data.get("vol", 0),
            "pe_volume_change": pe_data.get("v_chng", 0),
            "pe_volume_change_percent": pe_data.get("v_pchng", 0),
            "pe_open_interest": pe_data.get("OI", 0),
            "pe_oi_change": pe_data.get("oichng", 0),
            "pe_oi_change_percent": pe_data.get("oiperchnge", 0),
            "pe_implied_volatility": pe_data.get("iv", 0),
            "pe_previous_volume": pe_data.get("pVol", 0),
            "pe_previous_oi": pe_data.get("p_oi", 0),
            "pe_price_change": pe_data.get("p_chng", 0),
            "pe_price_change_percent": pe_data.get("p_pchng", 0),
            "pe_bid_price": pe_data.get("bid", 0),
            "pe_ask_price": pe_data.get("ask", 0),
            "pe_bid_quantity": pe_data.get("bid_qty", 0),
            "pe_ask_quantity": pe_data.get("ask_qty", 0),
            "pe_moneyness": pe_data.get("mness", ""),
            "pe_buildup_type": pe_data.get("btyp", ""),
            "pe_buildup_name": pe_data.get("BuiltupName", ""),
            "pe_delta": pe_data.get("optgeeks", {}).get("delta", 0),
            "pe_theta": pe_data.get("optgeeks", {}).get("theta", 0),
            "pe_gamma": pe_data.get("optgeeks", {}).get("gamma", 0),
            "pe_rho": pe_data.get("optgeeks", {}).get("rho", 0),
            "pe_vega": pe_data.get("optgeeks", {}).get("vega", 0),
            "pe_theoretical_price": pe_data.get("optgeeks", {}).get("theoryprc", 0),
            "pe_vol_pcr": strike_data.get("volpcr", 0),
            "pe_oi_pcr": strike_data.get("oipcr", 0),
            "pe_max_pain_loss": strike_data.get("mploss", 0),
            "pe_expiry_type": strike_data.get("exptype", ""),
        }

        options.append(option)

    return options


def flatten_option_chain(
    response: Dict[str, Any], instrument_id: str
) -> Dict[str, Any]:
    """Transform the option chain data into structured format"""
    # Add safeguards for data access
    if not isinstance(response, dict) or "data" not in response:
        raise ValueError("Invalid response format")

    result = {
        "market_snapshot": extract_market_snapshot(response),
        "futures": extract_future_contracts(response),
        "options": extract_option_contracts(response),
    }
    return result


def filter_data(data: List[OptionContract]) -> Dict[str, List]:
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

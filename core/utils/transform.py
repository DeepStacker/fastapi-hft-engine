from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

def parse_timestamp(timestamp: Any) -> datetime:
    """Convert Unix timestamp or string to datetime object"""
    if isinstance(timestamp, (int, float)):
        # Unix timestamp (seconds or milliseconds)
        if timestamp > 1e10:  # Likely milliseconds
            timestamp = timestamp / 1000
        return datetime.fromtimestamp(timestamp)
    if isinstance(timestamp, str):
        try:
            # Try ISO format first
            return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            try:
                # Try common date formats
                for fmt in ['%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d', '%d/%m/%Y']:
                    try:
                        return datetime.strptime(timestamp, fmt)
                    except ValueError:
                        continue
            except Exception:
                pass
    return datetime.utcnow()

def parse_expiry_date(explst: Any, default: Optional[datetime] = None) -> datetime:
    """
    Parse expiry date from Dhan API explst field.
    
    Args:
        explst: Can be a list of timestamps, single timestamp, or date string
        default: Fallback datetime if parsing fails
        
    Returns:
        Parsed datetime object
    """
    if default is None:
        default = datetime.utcnow()
    
    try:
        # Handle list of expiries (take first one)
        if isinstance(explst, list):
            if not explst:
                return default
            expiry_value = explst[0]
        else:
            expiry_value = explst
        
        # Parse the expiry value
        return parse_timestamp(expiry_value)
        
    except Exception as e:
        logger.warning(f"Failed to parse expiry date from {explst}: {e}")
        return default

def extract_market_snapshot(data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract market-wide data from the response"""
    return {
        "symbol_id": data.get("s_sid", 0),
        "total_oi_calls": data.get("OIC", 0),
        "total_oi_puts": data.get("OIP", 0),
        "pcr_ratio": data.get("Rto", 0),
        "exchange": data.get("exch", ""),
        "segment": data.get("seg", ""),
        "instrument_type": data.get("oinst", ""),
        "atm_iv": data.get("atmiv", 0),
        "aiv_percent_change": data.get("aivperchng", 0),
        "ltp": data.get("sltp", 0),
        "volume": data.get("svol", 0),
        "spot_percent_change": data.get("SPerChng", 0),
        "spot_change": data.get("SChng", 0),
        "option_lot_size": data.get("olot", 0),
        "option_tick_size": data.get("otick", 0),
        "days_to_expiry": data.get("dte", 0),
    }

def extract_option_contracts(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract CE + PE data per strike and normalize into separate records.
    Returns a list of dicts matching the OptionContract domain model.
    """
    options = []
    s_id = data.get("s_sid", 0)
    
    # Parse expiry date from explst field
    symbol_exp = data.get("explst", [])
    expiry_timestamp = parse_expiry_date(symbol_exp)
    
    logger.debug(f"Processing options for symbol_id {s_id}, expiry: {expiry_timestamp}")
    
    # Iterate through the option chain
    oc_data = data.get("oc", {})
    
    for strike, strike_data in oc_data.items():
        try:
            strike_price = float(strike)
        except (ValueError, TypeError):
            logger.warning(f"Invalid strike price: {strike}")
            continue

        # Process CE (Call Option)
        ce_data = strike_data.get("ce", {})
        if ce_data and isinstance(ce_data, dict):
            try:
                options.append({
                    "symbol_id": s_id,
                    "expiry": expiry_timestamp,
                    "strike_price": strike_price,
                    "option_type": "CE",
                    "ltp": float(ce_data.get("ltp", 0)),
                    "volume": int(ce_data.get("vol", 0)),
                    "oi": int(ce_data.get("OI", 0)),
                    "iv": float(ce_data.get("iv", 0)),
                    "delta": float(ce_data.get("optgeeks", {}).get("delta", 0)),
                    "gamma": float(ce_data.get("optgeeks", {}).get("gamma", 0)),
                    "theta": float(ce_data.get("optgeeks", {}).get("theta", 0)),
                    "vega": float(ce_data.get("optgeeks", {}).get("vega", 0)),
                })
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse CE option at strike {strike}: {e}")

        # Process PE (Put Option)
        pe_data = strike_data.get("pe", {})
        if pe_data and isinstance(pe_data, dict):
            try:
                options.append({
                    "symbol_id": s_id,
                    "expiry": expiry_timestamp,
                    "strike_price": strike_price,
                    "option_type": "PE",
                    "ltp": float(pe_data.get("ltp", 0)),
                    "volume": int(pe_data.get("vol", 0)),
                    "oi": int(pe_data.get("OI", 0)),
                    "iv": float(pe_data.get("iv", 0)),
                    "delta": float(pe_data.get("optgeeks", {}).get("delta", 0)),
                    "gamma": float(pe_data.get("optgeeks", {}).get("gamma", 0)),
                    "theta": float(pe_data.get("optgeeks", {}).get("theta", 0)),
                    "vega": float(pe_data.get("optgeeks", {}).get("vega", 0)),
                })
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse PE option at strike {strike}: {e}")

    logger.debug(f"Extracted {len(options)} option contracts for symbol_id {s_id}")
    return options

def normalize_dhan_data(raw_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point to transform Dhan API response to enriched format.
    
    Args:
        raw_payload: Raw response from Dhan API
        
    Returns:
        Normalized data with market_snapshot and options
    """
    try:
        data = raw_payload.get("data", {})
        if not data:
            logger.warning("Empty data in Dhan API response")
            return {}

        market_snapshot = extract_market_snapshot(data)
        options = extract_option_contracts(data)
        
        return {
            "market_snapshot": market_snapshot,
            "options": options
        }
    except Exception as e:
        logger.error(f"Failed to normalize Dhan data: {e}", exc_info=True)
        return {}

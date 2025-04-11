import time
import logging
from typing import Optional, Dict, Any, Tuple
import aiohttp
import redis.asyncio as redis

# Assuming Get_oc_data is accessible from this path
from Get_oc_data import get_oc_data, get_symbol_expiry, OptionChainError
from core.redis_client import get_cached_data, set_cached_data
from models.user import UserPreferences
from models.db_models import User as UserInDBModel  # Import DB model

logger = logging.getLogger(__name__)


async def fetch_and_process_option_chain(
    http_session: aiohttp.ClientSession,
    redis_client: Optional[redis.Redis],
    symbol_seg: int,
    symbol_sid: int,
    symbol_exp: Optional[int],
    effective_strike_count: int,
) -> Tuple[Dict[str, Any], bool]:
    """
    Fetches option chain data (from cache or upstream), processes it,
    and returns the response data along with a boolean indicating if it was from cache.

    Raises OptionChainError or other exceptions on failure.
    """
    start_time = time.time()  # Track processing time within the service

    # 1. Auto-detect expiry if needed
    if symbol_exp is None:
        try:
            symbol_expiry_data = await get_symbol_expiry(
                http_session, symbol_seg, symbol_sid
            )
            if (
                symbol_expiry_data
                and isinstance(symbol_expiry_data.get("data"), dict)
                and isinstance(symbol_expiry_data["data"].get("opsum"), dict)
                and symbol_expiry_data["data"]["opsum"]
            ):
                first_expiry_key = next(iter(symbol_expiry_data["data"]["opsum"]))
                symbol_exp = int(first_expiry_key)
                logger.info(f"Service fetched and using first expiry: {symbol_exp}")
            else:
                logger.error(
                    f"Service failed to fetch/parse expiry data for {symbol_seg}:{symbol_sid}"
                )
                # Raise a specific error or return None/empty to be handled by the route
                raise OptionChainError(
                    "Could not determine expiry date for the symbol."
                )
        except OptionChainError as e:
            logger.error(f"Service error fetching expiry dates for auto-detection: {e}")
            raise  # Re-raise the specific error
        except Exception as e:
            logger.error(
                f"Service unexpected error during expiry auto-detection: {e}",
                exc_info=True,
            )
            raise OptionChainError(
                f"Error auto-detecting expiry date: {e}"
            )  # Wrap unexpected errors

    # 2. Check Cache
    cache_key = f"oc:{symbol_seg}:{symbol_sid}:{symbol_exp}"
    cached_data = await get_cached_data(redis_client, cache_key)
    if cached_data:
        # Apply filtering based on effective_strike_count
        if len(cached_data.get("data", [])) > effective_strike_count:
            cached_data["data"] = cached_data["data"][:effective_strike_count]
            cached_data["metadata"]["total_strikes"] = len(cached_data["data"])
        # Update metadata for cache hit
        cached_data["metadata"]["from_cache"] = True
        cached_data["metadata"]["cache_time"] = (
            time.time() - start_time
        )  # Recalculate time spent in service
        logger.info(f"Service cache hit for {cache_key}")
        return cached_data, True  # Return data and cache status

    # 3. Fetch Fresh Data
    logger.info(f"Service cache miss for {cache_key}, fetching fresh data.")
    data = await get_oc_data(
        http_session, symbol_seg, symbol_sid, symbol_exp
    )  # Raises OptionChainError on failure

    # 4. Process Data
    records = []
    if (
        data
        and isinstance(data.get("data"), dict)
        and isinstance(data["data"].get("oc"), dict)
    ):
        for strike, details in data["data"]["oc"].items():
            # ... (existing record processing logic) ...
            ce_details = details.get("ce", {})
            pe_details = details.get("pe", {})
            ce_optgeeks = ce_details.get("optgeeks", {})
            pe_optgeeks = pe_details.get("optgeeks", {})
            record = {
                str(float(strike)): {
                    "CE": {
                        k.replace(" ", "_"): v
                        for k, v in {
                            "OI": ce_details.get("OI", 0),
                            "OI_Change": ce_details.get("oichng", 0),
                            "Implied_Volatility": ce_details.get("iv", 0.0),
                            "Last_Traded_Price": ce_details.get("ltp", 0.0),
                            "Volume": ce_details.get("vol", 0),
                            "Delta": ce_optgeeks.get("delta", 0.0),
                            "Theta": ce_optgeeks.get("theta", 0.0),
                            "Gamma": ce_optgeeks.get("gamma", 0.0),
                            "Vega": ce_optgeeks.get("vega", 0.0),
                            "Rho": ce_optgeeks.get("rho", 0.0),
                            "Theoretical_Price": ce_optgeeks.get("theoryprc", 0.0),
                            "Bid_Price": ce_details.get("bid", 0.0),
                            "Ask_Price": ce_details.get("ask", 0.0),
                            "Bid_Quantity": ce_details.get("bid_qty", 0),
                            "Ask_Quantity": ce_details.get("ask_qty", 0),
                            "Moneyness": ce_details.get("mness"),
                        }.items()
                    },
                    "PE": {
                        k.replace(" ", "_"): v
                        for k, v in {
                            "Open Interest": pe_details.get("OI", 0),
                            "OI_Change": pe_details.get("oichng", 0),
                            "Implied_Volatility": pe_details.get("iv", 0.0),
                            "Last_Traded_Price": pe_details.get("ltp", 0.0),
                            "Volume": pe_details.get("vol", 0),
                            "Delta": pe_optgeeks.get("delta", 0.0),
                            "Theta": pe_optgeeks.get("theta", 0.0),
                            "Gamma": pe_optgeeks.get("gamma", 0.0),
                            "Vega": pe_optgeeks.get("vega", 0.0),
                            "Rho": pe_optgeeks.get("rho", 0.0),
                            "Theoretical_Price": pe_optgeeks.get("theoryprc", 0.0),
                            "Bid_Price": pe_details.get("bid", 0.0),
                            "Ask_Price": pe_details.get("ask", 0.0),
                            "Bid_Quantity": pe_details.get("bid_qty", 0),
                            "Ask_Quantity": pe_details.get("ask_qty", 0),
                            "Moneyness": pe_details.get("mness"),
                        }.items()
                    },
                    "OI_PCR": details.get("oipcr", 0.0),
                    "Volume_PCR": details.get("volpcr", 0.0),
                    "Max_Pain_Loss": details.get("mploss", 0.0),
                    "Expiry_Type": details.get("exptype"),
                }
            }
            records.append(record)
    else:
        logger.error(
            f"Service received invalid data structure from get_oc_data for {symbol_seg}:{symbol_sid}:{symbol_exp}"
        )
        raise OptionChainError("Received invalid data structure from upstream service.")

    # Filter based on effective_strike_count
    if len(records) > effective_strike_count:
        records = records[:effective_strike_count]

    # Process fut_data
    raw_fut_data = data.get("data", {}).get("fl", {})
    keys_to_keep_fut = {
        "v_chng",
        "v_pchng",
        "sid",
        "ltp",
        "pc",
        "vol",
        "sym",
        "oi",
        "oichng",
        "pvol",
        "oipchng",
    }
    fut_data = {}
    if isinstance(raw_fut_data, dict):
        for fut_key, fut_details in raw_fut_data.items():
            if isinstance(fut_details, dict):
                fut_data[fut_key] = {
                    k: fut_details[k] for k in keys_to_keep_fut if k in fut_details
                }

    # 5. Construct Response
    market_data_raw = data.get("data", {})
    response_data = {
        "status": "success",
        "data": records,
        "fut_data": fut_data,
        "market_data": {
            "lot_size": market_data_raw.get("olot", 0),
            "atm_iv": market_data_raw.get("atmiv", 0.0),
            "iv_change": market_data_raw.get("aivperchng", 0.0),
            "spot_price": market_data_raw.get("sltp", 0.0),
            "spot_change": market_data_raw.get("SChng", 0.0),
            "spot_change_percent": market_data_raw.get("SPerChng", 0.0),
            "OI_call": market_data_raw.get("OIC", 0),
            "OI_put": market_data_raw.get("OIP", 0),
            "io_ratio": market_data_raw.get("Rto", 0.0),
            "days_to_expiry": market_data_raw.get("dte", 0),
        },
        "metadata": {
            "symbol_seg": symbol_seg,
            "symbol_sid": symbol_sid,
            "symbol_exp": symbol_exp,
            "total_strikes": len(records),
            "processing_time": f"{time.time() - start_time:.3f}s",  # Use service processing time
            "from_cache": False,
            "cached_at": int(time.time()),
        },
    }

    # 6. Cache Result
    await set_cached_data(redis_client, cache_key, response_data)
    return response_data, False  # Return data and cache status

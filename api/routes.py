from fastapi import APIRouter, HTTPException, Query, Depends, Request, status
from typing import Optional, Dict, Any
import time
import logging

# Assuming Get_oc_data is in the parent directory or PYTHONPATH is configured
from Get_oc_data import get_oc_data, get_symbol_expiry, OptionChainError
# Import caching functions from the core module
from core.redis_client import get_cached_data, set_cached_data
# Import limiter instance from the new core module
from core.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

@router.get("/api/option-chain", response_model=Dict[str, Any])
@limiter.limit("100/minute")
async def get_option_chain(
    request: Request,
    symbol_seg: int = Query(..., description="Symbol segment"),
    symbol_sid: int = Query(..., description="Symbol ID"),
    symbol_exp: Optional[int] = Query(None, description="Expiry timestamp"),
):
    """Get option chain data for a symbol with Redis caching"""
    start_time = time.time()
    cache_key = f"oc:{symbol_seg}:{symbol_sid}:{symbol_exp}"
    redis_client = request.app.state.redis # Access Redis client from app state
    http_session = request.app.state.http_session # Access shared HTTP session

    # Check if http_session is available (it should be, based on lifespan)
    if not http_session:
        logger.error("HTTP session not available in application state.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal configuration error: HTTP session missing")

    try:
        cached_data = await get_cached_data(redis_client, cache_key)
        if cached_data:
            cached_data["metadata"]["from_cache"] = True
            cached_data["metadata"]["cache_time"] = time.time() - start_time
            return cached_data

        # Pass the shared session to the data fetching function
        data = await get_oc_data(http_session, symbol_seg, symbol_sid, symbol_exp)
        # Process the data (Consider moving this processing logic to a separate function/module if complex)
        records = []
        # Added check for data existence and structure before processing
        if data and isinstance(data.get("data"), dict) and isinstance(data["data"].get("oc"), dict):
            for strike, details in data["data"]["oc"].items():
                ce_details = details.get("ce", {})
                pe_details = details.get("pe", {})
                ce_optgeeks = ce_details.get("optgeeks", {})
                pe_optgeeks = pe_details.get("optgeeks", {})

                record = {
                    "Strike_Price": float(strike),
                    "CE": {
                        "Symbol": ce_details.get("disp_sym"),
                        "Open_Interest": ce_details.get("OI", 0),
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
                    },
                    "PE": {
                        "Symbol": pe_details.get("disp_sym"),
                        "Open_Interest": pe_details.get("OI", 0),
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
                    },
                    "OI_PCR": details.get("oipcr", 0.0),
                    "Volume_PCR": details.get("volpcr", 0.0),
                    "Max_Pain_Loss": details.get("mploss", 0.0),
                    "Expiry_Type": details.get("exptype"),
                }
                records.append(record)
        else:
             # Handle case where data structure is not as expected after fetch
             logger.error(f"Invalid or missing data structure received from get_oc_data for {symbol_seg}:{symbol_sid}:{symbol_exp}. Data: {data}")
             raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Received invalid data structure from upstream service."
            )

        response_data = {
            "status": "success",
            "data": records,
            "metadata": {
                "symbol_seg": symbol_seg,
                "symbol_sid": symbol_sid,
                "symbol_exp": symbol_exp,
                "total_strikes": len(records),
                "processing_time": f"{time.time() - start_time:.3f}s",
                "from_cache": False,
                "cached_at": int(time.time())
            }
        }

        await set_cached_data(redis_client, cache_key, response_data)
        return response_data

    except OptionChainError as e:
         logger.error(f"Option Chain Error for {symbol_seg}:{symbol_sid}:{symbol_exp}: {e}")
         # Use 503 for service unavailable or 502 if it's an error from the upstream API
         status_code = status.HTTP_503_SERVICE_UNAVAILABLE if "unavailable" in str(e).lower() else status.HTTP_502_BAD_GATEWAY
         raise HTTPException(status_code=status_code, detail=str(e))
    except HTTPException as e:
        # Re-raise HTTPExceptions to let FastAPI handle them
        raise e
    except Exception as e:
        logger.error(f"Error processing option chain request: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/api/expiry-dates", response_model=Dict[str, Any])
@limiter.limit("100/minute")
async def get_expiry_dates(
    request: Request,
    symbol_seg: int = Query(..., description="Symbol segment"),
    symbol_sid: int = Query(..., description="Symbol ID")
):
    """Get expiry dates for a symbol with Redis caching"""
    start_time = time.time()
    cache_key = f"exp:{symbol_seg}:{symbol_sid}"
    redis_client = request.app.state.redis # Access Redis client from app state
    http_session = request.app.state.http_session # Access shared HTTP session

    # Check if http_session is available
    if not http_session:
        logger.error("HTTP session not available in application state.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal configuration error: HTTP session missing")

    try:
        cached_data = await get_cached_data(redis_client, cache_key)
        if cached_data:
            cached_data["metadata"]["from_cache"] = True
            cached_data["metadata"]["cache_time"] = time.time() - start_time
            return cached_data

        # Pass the shared session to the data fetching function
        data = await get_symbol_expiry(http_session, symbol_seg, symbol_sid)

        # Process data (Consider moving this processing logic)
        expiry_data = []
        # Added check for data existence and structure before processing
        if data and isinstance(data.get("data"), dict) and isinstance(data["data"].get("opsum"), dict):
             for value in data["data"]["opsum"].values():
                 expiry_data.append(
                    {
                        "expiry_timestamp": value.get("exp", 0),
                        "pcr": value.get("pcr", 0.0),
                        "total_ce_oi": value.get("tcoi", 0),
                        "total_pe_oi": value.get("tpoi", 0),
                        "days_to_expiry": value.get("daystoexp", 0),
                    }
                 )
        else:
             # Handle case where data structure is not as expected after fetch
             logger.error(f"Invalid or missing data structure received from get_symbol_expiry for {symbol_seg}:{symbol_sid}. Data: {data}")
             raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Received invalid data structure from upstream service."
            )

        # Check if expiry_data is empty after processing potentially valid but empty opsum
        if not expiry_data and isinstance(data.get("data", {}).get("opsum"), dict):
             logger.warning(f"No expiry dates found in opsum for {symbol_seg}:{symbol_sid}, though structure was valid.")
             # Decide whether to return 404 or empty success
             # Returning 404 might be more accurate if no expiries exist
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No expiry data found for the symbol."
             )

        response_data = {
            "status": "success",
            "data": expiry_data,
            "metadata": {
                "symbol_seg": symbol_seg,
                "symbol_sid": symbol_sid,
                "total_expiries": len(expiry_data),
                "processing_time": f"{time.time() - start_time:.3f}s",
                "from_cache": False,
                "cached_at": int(time.time())
            }
        }

        await set_cached_data(redis_client, cache_key, response_data)
        return response_data

    except OptionChainError as e:
         logger.error(f"Expiry Data Error for {symbol_seg}:{symbol_sid}: {e}")
         # Use 503 for service unavailable or 502 if it's an error from the upstream API
         status_code = status.HTTP_503_SERVICE_UNAVAILABLE if "unavailable" in str(e).lower() else status.HTTP_502_BAD_GATEWAY
         raise HTTPException(status_code=status_code, detail=str(e))
    except HTTPException as e:
        # Re-raise HTTPExceptions
        raise e
    except Exception as e:
        logger.error(f"Error processing expiry dates request: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


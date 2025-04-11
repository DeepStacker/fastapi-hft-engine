from fastapi import APIRouter, HTTPException, Query, Depends, Request, status
from fastapi.responses import JSONResponse
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

    try:
        cached_data = await get_cached_data(redis_client, cache_key)
        if cached_data:
            cached_data["metadata"]["from_cache"] = True
            cached_data["metadata"]["cache_time"] = time.time() - start_time
            return cached_data

        data = await get_oc_data(symbol_seg, symbol_sid, symbol_exp)
        if not data or "data" not in data or "oc" not in data["data"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No option chain data found"
            )

        # Process the data (Consider moving this processing logic to a separate function/module if complex)
        records = []
        for strike, details in data["data"]["oc"].items():
            ce_details = details.get("ce", {})
            pe_details = details.get("pe", {})
            ce_optgeeks = ce_details.get("optgeeks", {})
            pe_optgeeks = pe_details.get("optgeeks", {})

            record = {
                "Strike Price": float(strike),
                "CE": {
                    "Symbol": ce_details.get("disp_sym"),
                    "Open Interest": ce_details.get("OI", 0),
                    "OI Change": ce_details.get("oichng", 0),
                    "Implied Volatility": ce_details.get("iv", 0.0),
                    "Last Traded Price": ce_details.get("ltp", 0.0),
                    "Volume": ce_details.get("vol", 0),
                    "Delta": ce_optgeeks.get("delta", 0.0),
                    "Theta": ce_optgeeks.get("theta", 0.0),
                    "Gamma": ce_optgeeks.get("gamma", 0.0),
                    "Vega": ce_optgeeks.get("vega", 0.0),
                    "Rho": ce_optgeeks.get("rho", 0.0),
                    "Theoretical Price": ce_optgeeks.get("theoryprc", 0.0),
                    "Bid Price": ce_details.get("bid", 0.0),
                    "Ask Price": ce_details.get("ask", 0.0),
                    "Bid Quantity": ce_details.get("bid_qty", 0),
                    "Ask Quantity": ce_details.get("ask_qty", 0),
                    "Moneyness": ce_details.get("mness"),
                },
                "PE": {
                    "Symbol": pe_details.get("disp_sym"),
                    "Open Interest": pe_details.get("OI", 0),
                    "OI Change": pe_details.get("oichng", 0),
                    "Implied Volatility": pe_details.get("iv", 0.0),
                    "Last Traded Price": pe_details.get("ltp", 0.0),
                    "Volume": pe_details.get("vol", 0),
                    "Delta": pe_optgeeks.get("delta", 0.0),
                    "Theta": pe_optgeeks.get("theta", 0.0),
                    "Gamma": pe_optgeeks.get("gamma", 0.0),
                    "Vega": pe_optgeeks.get("vega", 0.0),
                    "Rho": pe_optgeeks.get("rho", 0.0),
                    "Theoretical Price": pe_optgeeks.get("theoryprc", 0.0),
                    "Bid Price": pe_details.get("bid", 0.0),
                    "Ask Price": pe_details.get("ask", 0.0),
                    "Bid Quantity": pe_details.get("bid_qty", 0),
                    "Ask Quantity": pe_details.get("ask_qty", 0),
                    "Moneyness": pe_details.get("mness"),
                },
                "OI PCR": details.get("oipcr", 0.0),
                "Volume PCR": details.get("volpcr", 0.0),
                "Max Pain Loss": details.get("mploss", 0.0),
                "Expiry Type": details.get("exptype"),
            }
            records.append(record)

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
         logger.error(f"Option Chain Error: {e}")
         raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
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

    try:
        cached_data = await get_cached_data(redis_client, cache_key)
        if cached_data:
            cached_data["metadata"]["from_cache"] = True
            cached_data["metadata"]["cache_time"] = time.time() - start_time
            return cached_data

        data = await get_symbol_expiry(symbol_seg, symbol_sid)
        if not data or "data" not in data or "opsum" not in data["data"]:
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No expiry data found"
            )

        # Process data (Consider moving this processing logic)
        expiry_data = [
            {
                "expiry_timestamp": value.get("exp", 0),
                "pcr": value.get("pcr", 0.0),
                "total_ce_oi": value.get("tcoi", 0),
                "total_pe_oi": value.get("tpoi", 0),
                "days_to_expiry": value.get("daystoexp", 0),
            }
            for value in data["data"]["opsum"].values()
        ]

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
         logger.error(f"Expiry Data Error: {e}")
         raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except HTTPException as e:
        # Re-raise HTTPExceptions
        raise e
    except Exception as e:
        logger.error(f"Error processing expiry dates request: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


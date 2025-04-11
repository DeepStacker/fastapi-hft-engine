import time
import logging
from typing import Optional, Dict, Any, List, Tuple
import aiohttp
import redis.asyncio as redis

from Get_oc_data import get_symbol_expiry, OptionChainError
from core.redis_client import get_cached_data, set_cached_data

logger = logging.getLogger(__name__)

async def fetch_and_process_expiry_dates(
    http_session: aiohttp.ClientSession,
    redis_client: Optional[redis.Redis],
    symbol_seg: int,
    symbol_sid: int
) -> Tuple[Dict[str, Any], bool]:
    """
    Fetches expiry dates (from cache or upstream), processes them,
    and returns the response data along with a boolean indicating if it was from cache.

    Raises OptionChainError or other exceptions on failure.
    """
    start_time = time.time()
    cache_key = f"exp:{symbol_seg}:{symbol_sid}"

    # 1. Check Cache
    cached_data = await get_cached_data(redis_client, cache_key)
    if cached_data:
        cached_data["metadata"]["from_cache"] = True
        cached_data["metadata"]["cache_time"] = time.time() - start_time
        logger.info(f"Service cache hit for {cache_key}")
        return cached_data, True

    # 2. Fetch Fresh Data
    logger.info(f"Service cache miss for {cache_key}, fetching fresh data.")
    data = await get_symbol_expiry(http_session, symbol_seg, symbol_sid) # Raises OptionChainError on failure

    # 3. Process Data
    expiry_data = []
    if (
        data
        and isinstance(data.get("data"), dict)
        and isinstance(data["data"].get("opsum"), dict)
    ):
        expiry_data = [
            value.get("exp", 0)
            for value in data["data"]["opsum"].values()
            if value.get("exp") is not None
        ]
        expiry_data.sort()
    else:
        logger.error(f"Service received invalid data structure from get_symbol_expiry for {symbol_seg}:{symbol_sid}")
        raise OptionChainError("Received invalid data structure from upstream service.")

    if not expiry_data:
        logger.warning(f"Service found no expiry dates in opsum for {symbol_seg}:{symbol_sid}")
        # Let the route handler decide the HTTP status (e.g., 404)
        # Returning empty list here is valid data structure wise
        # raise OptionChainError("No expiry data found for the symbol.") # Or raise specific error

    # 4. Construct Response
    response_data = {
        "status": "success",
        "data": expiry_data,
        "metadata": {
            "symbol_seg": symbol_seg, "symbol_sid": symbol_sid,
            "curr_exp": expiry_data[0] if expiry_data else None,
            "total_expiries": len(expiry_data),
            "processing_time": f"{time.time() - start_time:.3f}s",
            "from_cache": False, "cached_at": int(time.time()),
        },
    }

    # 5. Cache Result
    await set_cached_data(redis_client, cache_key, response_data)
    return response_data, False


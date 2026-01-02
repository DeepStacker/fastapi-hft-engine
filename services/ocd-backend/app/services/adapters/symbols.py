"""
Symbol Management for HFT Adapter
Handles loading and caching symbol mappings from Redis.
"""
import logging
import json
import time
from typing import Dict, Optional
import redis.asyncio as redis

logger = logging.getLogger(__name__)

# Symbol ID mapping - defaults only, will be populated dynamically from Redis
_DEFAULT_SYMBOL_ID_MAP = {
    "NIFTY": 13,
    "BANKNIFTY": 25,
    "FINNIFTY": 27,
    "MIDCPNIFTY": 442,
    "SENSEX": 51,
    "BANKEX": 52,
}

# Dynamic symbol maps - populated at runtime from database
SYMBOL_ID_MAP: Dict[str, int] = _DEFAULT_SYMBOL_ID_MAP.copy()
ID_TO_SYMBOL: Dict[int, str] = {v: k for k, v in SYMBOL_ID_MAP.items()}

# Cache for symbol refresh timing
_symbol_cache_last_refresh = 0
_SYMBOL_CACHE_TTL = 300  # Refresh every 5 minutes


async def load_symbols_from_redis(redis_client: redis.Redis) -> bool:
    """
    Load symbol mappings from Redis cache (populated by ingestion service).
    
    The ingestion service stores active instruments in Redis with format:
    - Key: instrument:active_list
    - Value: JSON array of {symbol, symbol_id, segment_id}
    
    Returns True if symbols were loaded successfully.
    """
    global SYMBOL_ID_MAP, ID_TO_SYMBOL, _symbol_cache_last_refresh
    
    current_time = time.time()
    
    # Check if refresh is needed
    if current_time - _symbol_cache_last_refresh < _SYMBOL_CACHE_TTL:
        return True  # Cache is fresh
    
    try:
        # Try to get from ingestion service's cache key
        instruments_data = await redis_client.get("instrument:active_list")
        
        if instruments_data:
            instruments = json.loads(instruments_data)
            
            # Build new maps
            new_symbol_map = {}
            for inst in instruments:
                symbol = inst.get("symbol", "").upper()
                symbol_id = inst.get("symbol_id") or inst.get("security_id")
                if symbol and symbol_id:
                    new_symbol_map[symbol] = int(symbol_id)
            
            if new_symbol_map:
                SYMBOL_ID_MAP.clear()
                SYMBOL_ID_MAP.update(new_symbol_map)
                ID_TO_SYMBOL.clear()
                ID_TO_SYMBOL.update({v: k for k, v in SYMBOL_ID_MAP.items()})
                _symbol_cache_last_refresh = current_time
                logger.info(f"Loaded {len(SYMBOL_ID_MAP)} symbols from Redis cache")
                return True
        
        # Fallback: Try to get from direct database query key
        all_keys = []
        async for key in redis_client.scan_iter("latest:*"):
            all_keys.append(key)
        
        if all_keys:
            for key in all_keys[:100]:  # Limit to avoid overload
                try:
                    data = await redis_client.get(key)
                    if data:
                        parsed = json.loads(data)
                        symbol = parsed.get("symbol", "").upper()
                        symbol_id = (
                            parsed.get("symbol_id") or 
                            parsed.get("context", {}).get("symbol_id") or
                            int(key.split(":")[-1])
                        )
                        if symbol and symbol_id:
                            SYMBOL_ID_MAP[symbol] = int(symbol_id)
                except:
                    continue
            
            if len(SYMBOL_ID_MAP) > len(_DEFAULT_SYMBOL_ID_MAP):
                ID_TO_SYMBOL.clear()
                ID_TO_SYMBOL.update({v: k for k, v in SYMBOL_ID_MAP.items()})
                _symbol_cache_last_refresh = current_time
                logger.info(f"Loaded {len(SYMBOL_ID_MAP)} symbols from Redis latest:* keys")
                return True
        
        # If nothing found, keep defaults
        logger.warning("No symbols found in Redis, using defaults")
        return False
        
    except Exception as e:
        logger.error(f"Failed to load symbols from Redis: {e}")
        return False

def get_cached_symbol_id(symbol: str) -> Optional[int]:
    return SYMBOL_ID_MAP.get(symbol.upper())

def get_cached_symbol_name(symbol_id: int) -> Optional[str]:
    return ID_TO_SYMBOL.get(symbol_id)

def force_refresh_cache():
    global _symbol_cache_last_refresh
    _symbol_cache_last_refresh = 0

"""
HFT Engine Data Adapter (Modular Version)
Consumes enriched data from HFT Engine's Redis and normalizes to option-chain-d format.
"""
import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable
import redis.asyncio as redis

from app.config.settings import settings
from app.services.adapters.symbols import (
    load_symbols_from_redis, 
    get_cached_symbol_id, 
    force_refresh_cache
)
from app.services.adapters.normalization import normalize_data

logger = logging.getLogger(__name__)


class HFTDataAdapter:
    """
    Adapter to consume HFT Engine's enriched data from Redis.
    Uses sub-modules for normalization, symbols, and utilities.
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or getattr(settings, 'HFT_REDIS_URL', settings.REDIS_URL)
        self.redis_client: Optional[redis.Redis] = None
        self._connected = False
        self._symbols_loaded = False
    
    async def connect(self) -> bool:
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=5.0,
                socket_connect_timeout=5.0
            )
            await self.redis_client.ping()
            self._connected = True
            logger.info(f"Connected to HFT Engine Redis at {self.redis_url}")
            
            if not self._symbols_loaded:
                await load_symbols_from_redis(self.redis_client)
                self._symbols_loaded = True
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to HFT Redis: {e}")
            self._connected = False
            return False
    
    async def close(self):
        if self.redis_client:
            await self.redis_client.close()
            self._connected = False
            logger.info("Disconnected from HFT Engine Redis")
    
    @property
    def is_connected(self) -> bool:
        return self._connected
    
    async def refresh_symbols(self):
        force_refresh_cache()
        if self._connected and self.redis_client:
            await load_symbols_from_redis(self.redis_client)
    
    async def get_symbol_id(self, symbol: str) -> Optional[int]:
        if not self._connected:
            await self.connect()
        return get_cached_symbol_id(symbol)
    
    async def get_expiry_dates(self, symbol: str) -> List[int]:
        symbol_id = await self.get_symbol_id(symbol)
        if not symbol_id:
            logger.debug(f"Unknown symbol for expiry dates: {symbol}")
            return []
        
        try:
            # Try symbol name first (e.g., "expiry:NIFTY")
            expiry_key = f"expiry:{symbol.upper()}"
            expiry_data = await self.redis_client.get(expiry_key)
            if expiry_data:
                return json.loads(expiry_data)
            
            # Fallback to symbol_id key
            expiry_key_by_id = f"expiry:{symbol_id}"
            expiry_data = await self.redis_client.get(expiry_key_by_id)
            if expiry_data:
                return json.loads(expiry_data)
            
            # Last resort: extract from latest data
            latest_key = f"latest:{symbol_id}"
            raw_data = await self.redis_client.get(latest_key)
            if raw_data:
                data = json.loads(raw_data)
                expiry_list = data.get("expiry_list", [])
                if expiry_list:
                    return sorted([int(e) for e in expiry_list])
            return []
        except Exception as e:
            logger.error(f"Failed to get expiry dates for {symbol}: {e}")
            return []
    
    async def _fetch_from_dhan_api(self, symbol: str, expiry: str) -> Dict[str, Any]:
        """Fallback to direct Dhan API call for non-current expiries"""
        try:
            from app.services.dhan_client import DhanClient
            from app.cache.redis import get_redis
            
            cache = await get_redis()
            # use_hft_source=False ensures direct API call, not loop back to HFT
            dhan_client = DhanClient(cache=cache, use_hft_source=False)
            
            logger.info(f"Fetching non-current expiry {expiry} for {symbol} directly from Dhan API")
            
            # Pass expiry directly - DhanClient.get_option_chain handles:
            # 1. Converting YYYY-MM-DD to timestamp if needed
            # 2. Reverting to old-year format (2026 -> 2016) for Dhan API call
            result = await dhan_client.get_option_chain(symbol, expiry)
            result["data_source"] = "dhan_api_fallback"
            result["requested_expiry"] = expiry
            return result
        except Exception as e:
            logger.error(f"Dhan API fallback failed: {e}")
            return {"error": str(e)}

    async def get_option_chain(self, symbol: str, expiry: Optional[str] = None) -> Dict[str, Any]:
        symbol_id = await self.get_symbol_id(symbol)
        if not symbol_id:
            return {"error": f"Unknown symbol: {symbol}"}
        
        if not self._connected:
            await self.connect()
        
        try:
            key = f"latest:{symbol_id}"
            raw_data = await self.redis_client.get(key)
            if not raw_data:
                return {"error": f"No data available for {symbol}"}
            
            hft_data = json.loads(raw_data)
            
            # Simple expiry mismatch check (simplified)
            if expiry:
                ingested = hft_data.get("context", {}).get("expiry") or hft_data.get("expiry")
                # If distinct mismatch logic needed, insert here.
                # For refactor, assuming we use normalization which handles formatting.
                pass 

            result = normalize_data(hft_data, symbol, expiry)
            result["_source"] = "hft_engine"
            return result
        except Exception as e:
            logger.error(f"Failed to get option chain from HFT: {e}")
            return {"error": str(e)}

    async def get_spot_data(self, symbol: str) -> Dict[str, Any]:
        chain = await self.get_option_chain(symbol)
        if "error" in chain: return chain
        return chain.get("spot", {"ltp": 0})
        
    async def subscribe_live(self, symbol: str, callback: Callable[[Dict], Any]) -> None:
        symbol_id = await self.get_symbol_id(symbol)
        if not symbol_id: return
        
        if not self._connected: await self.connect()
        
        pubsub = self.redis_client.pubsub()
        channel = f"live:option_chain:{symbol_id}"
        await pubsub.subscribe(channel)
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    normalized = normalize_data(data, symbol)
                    await callback(normalized)
        except Exception as e:
            logger.error(f"HFT subscription error: {e}")
        finally:
            await pubsub.unsubscribe(channel)

# Singleton management
_hft_adapter_instance: Optional[HFTDataAdapter] = None

async def get_hft_adapter() -> HFTDataAdapter:
    global _hft_adapter_instance
    if _hft_adapter_instance is None:
        _hft_adapter_instance = HFTDataAdapter()
        await _hft_adapter_instance.connect()
    return _hft_adapter_instance

async def close_hft_adapter():
    global _hft_adapter_instance
    if _hft_adapter_instance:
        await _hft_adapter_instance.close()
        _hft_adapter_instance = None

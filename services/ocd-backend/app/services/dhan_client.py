"""
Dhan API Client
Handles all communication with Dhan trading API
"""
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
import asyncio

import httpx

from app.config.settings import settings
from app.config.symbols import (
    SYMBOL_LIST, get_symbol_id, get_segment_id, 
    get_instrument_type, is_valid_symbol
)
from app.core.exceptions import ExternalAPIException, ValidationException
from app.cache.redis import RedisCache, CacheKeys
from app.utils.data_processing import (
    modify_oc_keys, filter_oc_strikes, fetch_percentage, filter_expiry_data
)

logger = logging.getLogger(__name__)

# Global shared client for connection pooling
_shared_client: Optional[httpx.AsyncClient] = None


class DhanClient:
    """
    Async HTTP client for Dhan API.
    Features:
    - Connection pooling with limits for high concurrency
    - Retry with exponential backoff
    - Response caching with Redis
    - Full data processing (percentages, filtering)
    - Dynamic auth token support
    """
    
    # Default headers for Dhan API
    DEFAULT_HEADERS = {
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.7",
        "content-type": "application/json",
        "origin": "https://web.dhan.co",
        "referer": "https://web.dhan.co/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    }
    
    # Lot sizes for major indices
    LOT_SIZES = {
        "NIFTY": 75,
        "BANKNIFTY": 15,
        "FINNIFTY": 40,
        "MIDCPNIFTY": 75,
        "SENSEX": 10,
        "BANKEX": 15,
    }
    
    def __init__(
        self, 
        cache: Optional[RedisCache] = None,
        auth_token: Optional[str] = None,
        use_hft_source: Optional[bool] = None  # HFT mode toggle
    ):
        self.base_url = settings.DHAN_API_BASE_URL
        self.timeout = settings.DHAN_API_TIMEOUT
        self.retry_count = settings.DHAN_API_RETRY_COUNT
        self.retry_delay = settings.DHAN_API_RETRY_DELAY
        self.cache = cache
        self._static_token = auth_token  # Token passed at init (may be stale)
        self._client: Optional[httpx.AsyncClient] = None
        self._current_token: Optional[str] = None  # Currently active token
        
        # HFT Engine integration - use setting if not explicitly passed
        self.use_hft_source = use_hft_source if use_hft_source is not None else settings.USE_HFT_DATA_SOURCE
        self._hft_adapter = None  # Lazy initialization
    
    async def _get_auth_token(self) -> str:
        """Get auth token from Redis dhan:tokens -> config service -> settings fallback"""
        try:
            # First try to get token from Redis dhan:tokens key (fastest, most up-to-date)
            if self.cache:
                try:
                    import json
                    token_data = await self.cache.get("dhan:tokens")
                    if token_data:
                        tokens = json.loads(token_data) if isinstance(token_data, str) else token_data
                        if tokens and tokens.get("auth_token"):
                            logger.debug("Got auth token from Redis dhan:tokens")
                            return tokens["auth_token"]
                except Exception as e:
                    logger.warning(f"Failed to get token from Redis dhan:tokens: {e}")
            
            # Fallback to config service (SystemConfigDB)
            from app.services.config_service import get_config
            token = await get_config("DHAN_AUTH_TOKEN", self._static_token, self.cache)
            return token or self._static_token or ""
        except Exception as e:
            logger.warning(f"Failed to get token from config service: {e}")
            return self._static_token or settings.DHAN_AUTH_TOKEN or ""
    
    async def _get_hft_adapter(self):
        """Get or create HFT Engine data adapter (lazy initialization)"""
        if self._hft_adapter is None:
            from app.services.hft_adapter import HFTDataAdapter
            self._hft_adapter = HFTDataAdapter()
            await self._hft_adapter.connect()
            logger.info("HFT Engine adapter initialized")
        return self._hft_adapter
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with connection pooling for high concurrency"""
        global _shared_client
        
        # Get current token from config service
        token = await self._get_auth_token()
        
        # Check if token changed - need new client
        token_changed = self._current_token is not None and self._current_token != token
        if token_changed:
            logger.info(f"Auth token changed, recreating HTTP client")
            if _shared_client and not _shared_client.is_closed:
                await _shared_client.aclose()
            _shared_client = None
        
        if _shared_client is None or _shared_client.is_closed:
            headers = dict(self.DEFAULT_HEADERS)
            # Add auth token if available
            if token:
                headers["auth"] = token
                self._current_token = token
            
            logger.info("Initializing new global HTTP client pool")
            _shared_client = httpx.AsyncClient(
                timeout=self.timeout,
                headers=headers,
                limits=httpx.Limits(
                    max_connections=100,  # Increased for high traffic
                    max_keepalive_connections=50,
                    keepalive_expiry=30
                ),
            )
        
        self._client = _shared_client
        return self._client
    
    async def close(self):
        """
        Close the HTTP client. 
        Only use this if you explicitly want to tear down the shared pool (e.g. on auth error).
        """
        global _shared_client
        if self._client and self._client == _shared_client:
            if not self._client.is_closed:
                await self._client.aclose()
            _shared_client = None
            self._client = None
    
    def _get_segment(self, symbol: str) -> int:
        """Get segment code for symbol using imported function"""
        return get_segment_id(symbol)
    
    def _get_symbol_id(self, symbol: str) -> int:
        """Get Dhan API symbol ID"""
        return get_symbol_id(symbol)
    
    def _get_lot_size(self, symbol: str) -> int:
        """Get lot size for symbol"""
        return self.LOT_SIZES.get(symbol.upper(), 1)
    
    def _validate_symbol(self, symbol: str) -> None:
        """Validate symbol exists in mapping"""
        if not is_valid_symbol(symbol):
            raise ValidationException(
                f"Invalid symbol: {symbol}. Valid: {list(SYMBOL_LIST.keys())[:10]}..."
            )
    
    async def _request(
        self,
        endpoint: str,
        payload: Dict[str, Any],
        use_cache: bool = True,
        cache_ttl: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Make a request to Dhan API with retry logic.
        
        Args:
            endpoint: API endpoint
            payload: Request payload
            use_cache: Whether to use cache
            cache_ttl: Cache TTL in seconds (0 or None = no caching for real-time)
            
        Returns:
            API response data
        """
        url = f"{self.base_url}{endpoint}"
        cache_key = None
        
        # Determine effective TTL - use provided or default from settings
        effective_ttl = cache_ttl if cache_ttl is not None else settings.REDIS_OPTIONS_CACHE_TTL
        
        # Only use cache if enabled AND TTL > 0 (TTL=0 means real-time, no caching)
        should_cache = use_cache and self.cache and effective_ttl > 0
        
        # Check cache if caching is enabled
        if should_cache:
            cache_key = f"dhan:{endpoint}:{hash(str(payload))}"
            cached = await self.cache.get_json(cache_key)
            if cached:
                logger.debug(f"Cache hit for {endpoint}")
                return cached
        
        # Make request with retries
        last_error = None
        
        for attempt in range(self.retry_count):
            # Ensure we have a valid client (recreates if closed)
            client = await self._get_client()
            
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                
                # Cache successful response only if TTL > 0
                if should_cache and cache_key:
                    await self.cache.set_json(cache_key, data, effective_ttl)
                
                return data
                
            except httpx.TimeoutException as e:
                last_error = e
                logger.warning(f"Timeout on attempt {attempt + 1} for {endpoint}")
                
            except httpx.HTTPStatusError as e:
                last_error = e
                logger.warning(f"HTTP error {e.response.status_code} on attempt {attempt + 1}")
                
                # If 401 Unauthorized, reset client to clear any stale session/cookies
                if e.response.status_code == 401:
                    logger.warning("Received 401 Unauthorized - resetting HTTP client session")
                    await self.close()
                    # Continue to next attempt which will create a fresh client
                    continue
                
            except Exception as e:
                last_error = e
                logger.error(f"Error on attempt {attempt + 1}: {e}")
            
            # Wait before retry (exponential backoff)
            if attempt < self.retry_count - 1:
                await asyncio.sleep(self.retry_delay * (2 ** attempt))
        
        raise ExternalAPIException(
            service="Dhan API",
            detail=f"Request failed after {self.retry_count} attempts: {last_error}"
        )
    
    async def get_expiry_dates(self, symbol: str) -> List[Dict[str, Any]]:
        """
        Get available expiry dates for a symbol.
        
        Args:
            symbol: Trading symbol (e.g., "NIFTY")
            
        Returns:
            List of expiry date objects
        """
        # ====== HFT ENGINE MODE ======
        if self.use_hft_source:
            adapter = await self._get_hft_adapter()
            return await adapter.get_expiry_dates(symbol)
        
        # ====== DIRECT DHAN API MODE ======
        seg = self._get_segment(symbol)
        sid = self._get_symbol_id(symbol)
        
        # Check cache first
        if self.cache:
            cache_key = CacheKeys.expiry(symbol)
            cached = await self.cache.get_json(cache_key)
            if cached:
                return cached
        
        # Fetch option chain to get expiry dates
        payload = {
            "Data": {
                "Seg": seg,
                "Sid": sid,
            }
        }
        
        try:
            # Use futures endpoint which has opsum with real-time expiry dates
            data = await self._request(
                settings.DHAN_FUTURES_ENDPOINT,
                payload,
                use_cache=True,
                cache_ttl=settings.REDIS_EXPIRY_CACHE_TTL
            )
            
            # Get expiry from opsum keys (expiry timestamps are the keys in opsum dict)
            raw_data = data.get("data", {}) or {}
            opsum = raw_data.get("opsum", {}) or {}
            
            logger.info(f"Dhan Futures API opsum keys count: {len(opsum.keys())}")
            logger.info(f"Dhan Futures API opsum sample keys: {list(opsum.keys())[:5]}")
            
            # opsum keys are the expiry timestamps as strings
            exp_list = list(opsum.keys())
            
            # Convert to integers - accept all valid numeric values
            int_exp_list = []
            for exp in exp_list:
                try:
                    exp_int = int(exp)
                    int_exp_list.append(exp_int)
                except (ValueError, TypeError):
                    continue
            
            # Sort expiry dates (ascending - nearest first)
            int_exp_list.sort()
            
            logger.info(f"Found {len(int_exp_list)} valid expiry dates for {symbol}")
            if int_exp_list:
                logger.info(f"First expiry: {int_exp_list[0]}, Last: {int_exp_list[-1]}")
            
            # Cache result
            if self.cache and int_exp_list:
                await self.cache.set_json(
                    CacheKeys.expiry(symbol),
                    int_exp_list,
                    settings.REDIS_EXPIRY_CACHE_TTL
                )
            
            return int_exp_list
            
        except Exception as e:
            logger.error(f"Failed to get expiry dates for {symbol}: {e}")
            raise
    
    async def get_option_chain(
        self,
        symbol: str,
        expiry: str
    ) -> Dict[str, Any]:
        """
        Get option chain data for a symbol and expiry.
        
        If USE_HFT_DATA_SOURCE is enabled, fetches from HFT Engine's Redis.
        Otherwise, fetches directly from Dhan API.
        """
        # ====== HFT ENGINE MODE ======
        if self.use_hft_source:
            adapter = await self._get_hft_adapter()
            return await adapter.get_option_chain(symbol, expiry)
        
        # ====== DIRECT DHAN API MODE ======
        seg = self._get_segment(symbol)
        sid = self._get_symbol_id(symbol)

        # Ensure expiry is an integer (timestamp)
        if expiry and str(expiry).lower() not in ('null', 'none', ''):
            try:
                expiry = int(expiry)
            except ValueError:
                # If conversion fails, let it fall through or fallback
                pass

        if not expiry:
            expiry_list = await self.get_expiry_dates(symbol)
            if not expiry_list:
                raise ExternalAPIException(
                    service="Dhan API",
                    detail=f"No expiry dates available for {symbol}. Please check your Dhan API token."
                )
            expiry = expiry_list[0]
        
        payload = {
            "Data": {
                "Seg": seg,
                "Sid": sid,
                "Exp": expiry,
            }
        }
        
        data = await self._request(
            settings.DHAN_OPTIONS_CHAIN_ENDPOINT,
            payload,
            use_cache=True,
            cache_ttl=settings.REDIS_OPTIONS_CACHE_TTL
        )
        
        result = self._transform_option_chain(data, symbol)
        # Include the resolved expiry in response (important when auto-fetched)
        result["expiry"] = expiry
        return result
    
    async def get_spot_data(self, symbol: str) -> Dict[str, Any]:
        """Get spot/index data"""
        # ====== HFT ENGINE MODE ======
        if self.use_hft_source:
            adapter = await self._get_hft_adapter()
            return await adapter.get_spot_data(symbol)
        
        # ====== DIRECT DHAN API MODE ======
        seg = self._get_segment(symbol)
        sid = str(self._get_symbol_id(symbol)) # Spot endpoint might behave differently? using ID for safety
        # Urls.py create_spot_payload uses symbol (ID)
        
        payload = {
            "Data": {
                "Seg": seg,
                "Secid": sid, # Note: Secid not Sid for spot
            }
        }
        
        data = await self._request(
            settings.DHAN_SPOT_ENDPOINT,
            payload,
            use_cache=True,
            cache_ttl=5
        )
        
        return self._transform_spot_data(data, symbol)
    
    async def get_futures_data(self, symbol: str) -> List[Dict[str, Any]]:
        """Get futures data"""
        # ====== HFT ENGINE MODE ======
        if self.use_hft_source:
            adapter = await self._get_hft_adapter()
            return await adapter.get_futures_data(symbol)
        
        # ====== DIRECT DHAN API MODE ======
        seg = self._get_segment(symbol)
        sid = self._get_symbol_id(symbol)
        
        payload = {
            "Data": {
                "Seg": seg,
                "Sid": sid,
            }
        }
        
        data = await self._request(
            settings.DHAN_FUTURES_ENDPOINT,
            payload,
            use_cache=True,
            cache_ttl=5
        )
        
        return self._transform_futures_data(data, symbol)
    
    def _transform_option_chain(
        self,
        data: Dict[str, Any],
        symbol: str
    ) -> Dict[str, Any]:
        """Transform raw API response to standardized format"""
        result = {
            "symbol": symbol,
            "timestamp": datetime.utcnow().isoformat(),
            "spot": {},
            "strikes": [],
            "oc": {},
            "data": {}  # Preserve raw data structure for options.py
        }
        
        if "data" not in data:
            return result
        
        raw = data["data"]
        
        # Preserve raw data for access in options.py
        result["data"] = raw
        
        # Extract spot data - Dhan uses SChng/SPerChng (case-sensitive!)
        if "sltp" in raw:
            result["spot"] = {
                "ltp": raw.get("sltp", 0),
                "change": raw.get("SChng", raw.get("schng", 0)),  # Handle both cases
                "change_percent": raw.get("SPerChng", raw.get("spchng", 0)),
            }
        
        # Extract option chain
        if "oc" in raw:
            result["oc"] = raw["oc"]
            result["strikes"] = list(raw["oc"].keys())
        
        # Extract future data - key is 'fl' not 'fut'
        if "fl" in raw:
            result["future"] = raw["fl"]
        
        # Extract important top-level fields
        result["atmiv"] = raw.get("atmiv", 0)
        result["atmiv_change"] = raw.get("aivperchng", 0)
        result["u_id"] = raw.get("u_id", 0)
        result["dte"] = raw.get("dte", 0)  # Days to expiry from Dhan
        result["max_pain_strike"] = raw.get("mxpn_strk", 0)
        result["total_call_oi"] = raw.get("OIC", 0)
        result["total_put_oi"] = raw.get("OIP", 0)
        result["pcr_ratio"] = raw.get("Rto", 0)
        result["lot_size"] = raw.get("olot", 75)
        result["expiry_list"] = raw.get("explst", [])
        
        return result
    
    def _transform_spot_data(
        self,
        data: Dict[str, Any],
        symbol: str
    ) -> Dict[str, Any]:
        """Transform spot data response"""
        if "data" not in data:
            return {"symbol": symbol, "ltp": 0}
        
        raw = data["data"]
        return {
            "symbol": symbol,
            "ltp": raw.get("Ltp", 0),  # Capital L in Ltp!
            "open": raw.get("op", 0),  # Dhan uses 'op' not 'open'
            "high": raw.get("hg", 0),  # Dhan uses 'hg' not 'high'
            "low": raw.get("lo", 0),   # Dhan uses 'lo' not 'low'
            "close": raw.get("cl", 0), # Dhan uses 'cl' not 'close'
            "change": raw.get("ch", 0),  # Dhan uses 'ch' not 'chng'
            "change_percent": raw.get("p_ch", 0),  # Dhan uses 'p_ch' not 'pchng'
            "u_id": raw.get("u_id", 0),
        }
    
    def _transform_futures_data(
        self,
        data: Dict[str, Any],
        symbol: str
    ) -> List[Dict[str, Any]]:
        """Transform futures data response"""
        if "data" not in data:
            return []
        
        futures = []
        for item in data.get("data", []):
            futures.append({
                "symbol": symbol,
                "expiry": item.get("exp", ""),
                "ltp": item.get("ltp", 0),
                "change": item.get("chng", 0),
                "change_percent": item.get("pchng", 0),
                "oi": item.get("oi", 0),
                "volume": item.get("vol", 0),
            })
        
        return futures


# Factory function for dependency injection
async def get_dhan_client(cache: Optional[RedisCache] = None) -> DhanClient:
    """Get Dhan client instance with optional cache"""
    return DhanClient(cache=cache, auth_token=settings.DHAN_AUTH_TOKEN)

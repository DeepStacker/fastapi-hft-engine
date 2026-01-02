"""
Dhan API Client
Handles all communication with Dhan trading API
"""
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import asyncio

import httpx
import pytz # Added for timezone conversion

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
from app.utils.timezone import get_ist_isoformat

logger = logging.getLogger(__name__)

# Global shared client for connection pooling
_shared_client: Optional[httpx.AsyncClient] = None


from core.clients.dhan import BaseDhanClient

class DhanClient(BaseDhanClient):
    """
    Service-specific Dhan Client (OCD Backend).
    Extends BaseDhanClient with:
    - HFT Engine fallback logic
    - Service-specific data transformation
    - Configuration service integration
    """
    
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
        use_hft_source: Optional[bool] = None
    ):
        super().__init__(cache, auth_token)
        
        # OCD-specific HFT integration
        self.use_hft_source = use_hft_source if use_hft_source is not None else settings.USE_HFT_DATA_SOURCE
        self._hft_adapter = None
    
    # Override _get_auth_token to use ConfigService (OCD specific)
    async def _get_auth_token(self) -> str:
        # Try parent method first (Redis "dhan:tokens")
        token = await super()._get_auth_token()
        if token and token != self._static_token:
             return token
             
        # Fallback to ConfigService
        try:
            from app.services.config_service import get_config
            # Note: passing self.cache which is expected to be OCD's RedisCache
            conf_token = await get_config("DHAN_AUTH_TOKEN", self._static_token, self.cache)
            return conf_token or self._static_token or ""
        except Exception as e:
            logger.warning(f"ConfigService token fetch failed: {e}")
            return self._static_token or ""
            
    async def _get_hft_adapter(self):
        """Get or create HFT Engine data adapter (lazy initialization)"""
        if self._hft_adapter is None:
            from app.services.hft_adapter import get_hft_adapter
            self._hft_adapter = await get_hft_adapter()
            logger.debug("HFT Engine adapter retrieved (singleton)")
        return self._hft_adapter
        
    # Alias for backward compatibility if needed, or simply use request()
    async def _request(self, *args, **kwargs):
        """Wrapper for parent request method"""
        return await self.request(*args, **kwargs)

    
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
            data = await adapter.get_expiry_dates(symbol)
            if data and len(data) > 0:
                return data
            logger.warning(f"No expiries from HFT Engine for {symbol}, falling back to Direct API")
        
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
            
            # Sort expiry dates (ascending - nearest first)
            int_exp_list.sort()
            
            # Convert timestamps to current year (fixes 2016 date issue)
            int_exp_list = self._convert_expiry_timestamps(int_exp_list)
            int_exp_list.sort() # Sort again after conversion just in case
            
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
    
    def _convert_expiry_timestamps(self, timestamps: List[int]) -> List[int]:
        """
        Converts expiry timestamps from Dhan API to ensure they are in the current year.
        Dhan API sometimes returns expiry dates with a 2016 year, which needs correction.
        """
        converted = []
        current_year = datetime.now(pytz.timezone(settings.TIMEZONE)).year
        
        for old_ts in timestamps:
            try:
                # Convert timestamp to datetime object in IST
                old_dt = datetime.fromtimestamp(old_ts, tz=pytz.timezone(settings.TIMEZONE))
                
                # If the year is in the past (e.g. 2016-2020), shift it to current era
                # Dhan mock data often starts in 2016. We preserve the relative spacing.
                BASE_MOCK_YEAR = 2016
                if old_dt.year < current_year:
                    # Calculate offset (e.g. 2016->0, 2017->1)
                    offset = max(0, old_dt.year - BASE_MOCK_YEAR)
                    target_year = current_year + offset
                    
                    try:
                        new_dt = old_dt.replace(year=target_year)
                    except ValueError:
                        # Handle leap years (e.g. Feb 29 2016 -> Feb 28 2026)
                        new_dt = old_dt.replace(year=target_year, day=28)
                else:
                    new_dt = old_dt
                
                # Normalize to Noon IST to avoid timezone edge cases
                # The raw timestamps are typically 00:00 IST.
                # Setting to 12:00 noon ensures the same calendar day in both UTC and IST.
                new_dt = new_dt.replace(hour=12, minute=0, second=0, microsecond=0)
                
                new_ts = int(new_dt.timestamp())
                converted.append(new_ts)
            except Exception as e:
                logger.warning(f"Failed to convert expiry {old_ts}: {e}")
                continue
                
        logger.info(f"Converted {len(timestamps)} timestamps to {len(converted)} valid dates (Current Year: {current_year})")
        return converted
        
    def revert_expiry_timestamp(self, timestamp: int) -> int:
        """
        Reverts a converted timestamp back to the original Dhan API format (2016-era).
        Undoes the 12:00 IST normalization and year shifting.
        """
        try:
            current_year = datetime.now(pytz.timezone(settings.TIMEZONE)).year
            BASE_MOCK_YEAR = 2016
            
            # Convert timestamp to datetime object in IST
            dt = datetime.fromtimestamp(timestamp, tz=pytz.timezone(settings.TIMEZONE))
            
            # 1. Undo the Time Normalization (Set to 00:00:00)
            dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # 2. Undo the Year Shift
            if dt.year >= current_year:
                offset = dt.year - current_year
                original_year = BASE_MOCK_YEAR + offset
                
                try:
                    dt = dt.replace(year=original_year)
                except ValueError:
                     # Handle leap years reverse (Feb 28 2026 -> Feb 29 2016)
                    dt = dt.replace(year=original_year, day=29)
            
            original_ts = int(dt.timestamp())
            # logger.debug(f"Reverted {timestamp} ({datetime.fromtimestamp(timestamp)}) -> {original_ts} ({dt})")
            return original_ts
            
        except Exception as e:
            logger.warning(f"Failed to revert expiry {timestamp}: {e}")
            return timestamp

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
        # ====== HFT ENGINE MODE (with fallback) ======
        logger.info(f"get_option_chain called for {symbol} with expiry={expiry} (type: {type(expiry)})")
        if self.use_hft_source:
            adapter = await self._get_hft_adapter()
            
            # Check if requested expiry is available in HFT Engine
            # HFT only has data for the CURRENT (weekly) expiry
            use_hft_for_this_request = False
            
            if not expiry:
                # No specific expiry requested - use HFT (current/weekly expiry)
                use_hft_for_this_request = True
            else:
                # Get the ACTUAL expiry date from HFT data (not from cached expiry list)
                try:
                    hft_chain = await adapter.get_option_chain(symbol, None)
                    hft_current_expiry = hft_chain.get("expiry", "")  # e.g., "2026-01-06"
                    
                    if hft_current_expiry:
                        expiry_str = str(expiry)
                        
                        # Case 1: Requested expiry is a date string (YYYY-MM-DD)
                        if "-" in expiry_str:
                            if hft_current_expiry == expiry_str:
                                use_hft_for_this_request = True
                                logger.debug(f"Expiry {expiry} matches HFT current expiry")
                        # Case 2: Requested expiry is a timestamp
                        else:
                            try:
                                exp_ts = int(float(expiry))
                                exp_date = datetime.fromtimestamp(exp_ts, tz=pytz.timezone(settings.TIMEZONE))
                                exp_date_str = exp_date.strftime("%Y-%m-%d")
                                
                                hft_date_obj = datetime.strptime(hft_current_expiry, "%Y-%m-%d").date()
                                exp_date_obj = exp_date.date()
                                
                                delta_days = abs((hft_date_obj - exp_date_obj).days)
                                
                                if delta_days <= 1:
                                    use_hft_for_this_request = True
                                    logger.debug(f"Expiry ts {expiry} -> {exp_date_str} matches HFT ({hft_current_expiry}) within 1 day")
                                else:
                                    logger.info(f"Expiry {expiry} -> {exp_date_str} != HFT ({hft_current_expiry}) diff={delta_days} days")
                            except (ValueError, TypeError) as e:
                                logger.debug(f"Could not convert expiry {expiry} to date: {e}")
                        
                        if not use_hft_for_this_request:
                            logger.info(f"Expiry {expiry} != HFT current ({hft_current_expiry}), falling back to Dhan API")
                    else:
                        logger.warning(f"HFT data has no expiry field, using HFT anyway")
                        use_hft_for_this_request = True
                except Exception as e:
                    logger.warning(f"Failed to check HFT expiry: {e}, falling back to Dhan API")
            
            if use_hft_for_this_request:
                return await adapter.get_option_chain(symbol, expiry)
        
        # ====== DIRECT DHAN API MODE ======
        seg = self._get_segment(symbol)
        sid = self._get_symbol_id(symbol)

        # Convert expiry back to int if string
        try:
            exp_ts = int(float(expiry))
            # REVERT expiry to original format for API call
            original_exp_ts = self.revert_expiry_timestamp(exp_ts)
            logger.info(f"Reverted expiry for API call: {exp_ts} -> {original_exp_ts}")
        except (ValueError, TypeError):
             logger.warning(f"Invalid expiry format received: {expiry}")
             # Pass through if we can't parse it (might be empty or invalid)
             original_exp_ts = expiry

        # Ensure expiry is an integer (timestamp)
        # This block now processes the 'original_exp_ts' if 'expiry' was valid,
        # or uses the potentially invalid 'expiry' directly if conversion failed.
        # The 'expiry' variable here will be the one used for the payload.
        if original_exp_ts and str(original_exp_ts).lower() not in ('null', 'none', ''):
            try:
                expiry = int(original_exp_ts)
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
            "timestamp": get_ist_isoformat(),
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

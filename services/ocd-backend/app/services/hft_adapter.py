"""
HFT Engine Data Adapter

Consumes enriched data from HFT Engine's Redis and normalizes
to option-chain-d's expected format.

This adapter allows option-chain-d to use HFT Engine as its data source
instead of directly calling Dhan API.
"""
import logging
from typing import Dict, Any, Optional, List, Callable
import json
from datetime import datetime
import math

import redis.asyncio as redis

from app.config.settings import settings

logger = logging.getLogger(__name__)


# ============================================================================
# Dynamic Greeks Calculation Functions (Black-Scholes Approximation)
# These are used as fallbacks when HFT Engine / Dhan API doesn't provide values
# ============================================================================

def _calculate_iv_approximation(
    ltp: float, 
    spot_price: float, 
    strike: float, 
    dte: float, 
    option_type: str,
    risk_free_rate: float = 0.065
) -> float:
    """
    Calculate approximate IV using Brenner-Subrahmanyam formula.
    This is a quick estimation, not exact Black-Scholes inversion.
    
    Returns IV as a percentage (e.g., 15.0 for 15%)
    """
    if ltp <= 0 or spot_price <= 0 or dte <= 0:
        return 12.0  # Default IV when calculation not possible
    
    try:
        # Time to expiry in years
        t = max(dte / 365.0, 1/365.0)  # Minimum 1 day
        
        # Approximate IV using modified Brenner formula
        # For ATM options: IV ≈ (Premium / Spot) * sqrt(2π / T)
        moneyness = strike / spot_price
        
        # Adjust for ITM/OTM
        if option_type.upper() == "CE":
            intrinsic = max(0, spot_price - strike)
        else:
            intrinsic = max(0, strike - spot_price)
        
        time_value = max(0.01, ltp - intrinsic)
        
        # Brenner-Subrahmanyam approximation
        iv = (time_value / spot_price) * math.sqrt(2 * math.pi / t) * 100
        
        # Apply moneyness adjustment
        if moneyness < 0.95 or moneyness > 1.05:
            # Far from ATM, adjust for volatility smile
            skew_factor = 1.0 + abs(1 - moneyness) * 0.3
            iv *= skew_factor
        
        # Clamp to reasonable range (5% to 100%)
        return max(5.0, min(100.0, iv))
        
    except Exception:
        return 12.0  # Default on error


def _calculate_delta_approximation(
    spot_price: float,
    strike: float,
    option_type: str,
    dte: float,
    iv: float
) -> float:
    """
    Calculate approximate Delta using log-normal distribution approximation.
    
    Returns delta (e.g., 0.55 for CE ITM, -0.55 for PE ITM)
    """
    if spot_price <= 0 or strike <= 0 or dte <= 0 or iv <= 0:
        # Return simple moneyness-based delta
        if option_type.upper() == "CE":
            return 0.5 if spot_price >= strike else 0.3
        else:
            return -0.5 if strike >= spot_price else -0.3
    
    try:
        # Time to expiry in years
        t = max(dte / 365.0, 1/365.0)
        sigma = iv / 100.0  # Convert percentage to decimal
        
        # Calculate d1
        d1 = (math.log(spot_price / strike) + (0.065 + 0.5 * sigma * sigma) * t) / (sigma * math.sqrt(t))
        
        # Approximate N(d1) using error function
        # N(x) ≈ 0.5 * (1 + erf(x / sqrt(2)))
        nd1 = 0.5 * (1 + math.erf(d1 / math.sqrt(2)))
        
        if option_type.upper() == "CE":
            return round(nd1, 4)
        else:
            return round(nd1 - 1, 4)  # PE delta = N(d1) - 1
            
    except Exception:
        if option_type.upper() == "CE":
            return 0.5
        else:
            return -0.5


def _format_expiry_date(expiry: str, expiry_list: List[int] = None) -> str:
    """
    Format expiry date for display. 
    If we have a valid expiry list, use the nearest expiry.
    
    Args:
        expiry: Raw expiry string from HFT (could be date or timestamp)
        expiry_list: List of Unix timestamps for available expiries
        
    Returns:
        Formatted expiry string (YYYY-MM-DD)
    """
    try:
        # If it looks like a date string already
        if expiry and len(str(expiry)) == 10 and '-' in str(expiry):
            # Validate it's not an old date
            exp_date = datetime.strptime(str(expiry), "%Y-%m-%d")
            if exp_date.year >= 2024:
                return str(expiry)
        
        # Try to parse as timestamp
        if expiry and str(expiry).isdigit():
            ts = int(expiry)
            if ts > 1700000000:  # Valid Unix timestamp (after 2023)
                return datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
        
        # Use first expiry from list if available
        if expiry_list and len(expiry_list) > 0:
            # Find nearest future expiry
            now_ts = datetime.now().timestamp()
            future_expiries = [e for e in expiry_list if e > now_ts]
            if future_expiries:
                nearest = min(future_expiries)
                return datetime.fromtimestamp(nearest).strftime("%Y-%m-%d")
        
        # Return empty string if no valid expiry found
        # Do not default to today as it creates "Ghost Expiries"
        return ""
        
    except Exception:
        return ""

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


async def _load_symbols_from_redis(redis_client: redis.Redis) -> bool:
    """
    Load symbol mappings from Redis cache (populated by ingestion service).
    
    The ingestion service stores active instruments in Redis with format:
    - Key: instrument:active_list
    - Value: JSON array of {symbol, symbol_id, segment_id}
    
    Returns True if symbols were loaded successfully.
    """
    global SYMBOL_ID_MAP, ID_TO_SYMBOL, _symbol_cache_last_refresh
    
    import time
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
        # (in case ingestion uses different cache pattern)
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


class HFTDataAdapter:
    """
    Adapter to consume HFT Engine's enriched data from Redis.
    
    HFT Engine stores data in Redis with keys:
    - latest:{symbol_id} - Latest enriched snapshot (JSON)
    - live:option_chain:{symbol_id} - Pub/Sub channel for live updates
    
    This adapter normalizes the HFT format to match what option-chain-d expects.
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize the adapter.
        
        Args:
            redis_url: HFT Engine's Redis URL. Defaults to settings.HFT_REDIS_URL
        """
        self.redis_url = redis_url or getattr(settings, 'HFT_REDIS_URL', settings.REDIS_URL)
        self.redis_client: Optional[redis.Redis] = None
        self._connected = False
        self._symbols_loaded = False
    
    async def connect(self) -> bool:
        """
        Connect to HFT Engine's Redis instance.
        
        Returns:
            True if connected successfully
        """
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=5.0,
                socket_connect_timeout=5.0
            )
            # Test connection
            await self.redis_client.ping()
            self._connected = True
            logger.info(f"Connected to HFT Engine Redis at {self.redis_url}")
            
            # Load symbols on first connect
            if not self._symbols_loaded:
                await _load_symbols_from_redis(self.redis_client)
                self._symbols_loaded = True
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to HFT Redis: {e}")
            self._connected = False
            return False
    
    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            self._connected = False
            logger.info("Disconnected from HFT Engine Redis")
    
    @property
    def is_connected(self) -> bool:
        return self._connected
    
    async def refresh_symbols(self):
        """Force refresh of symbol mappings from Redis"""
        global _symbol_cache_last_refresh
        _symbol_cache_last_refresh = 0  # Reset cache
        if self._connected and self.redis_client:
            await _load_symbols_from_redis(self.redis_client)
    
    async def get_symbol_id(self, symbol: str) -> Optional[int]:
        """Get symbol ID from symbol name (ensures symbols are loaded)"""
        if not self._connected:
            await self.connect()
        return SYMBOL_ID_MAP.get(symbol.upper())
    
    def _get_symbol_name(self, symbol_id: int) -> Optional[str]:
        """Get symbol name from ID"""
        return ID_TO_SYMBOL.get(symbol_id)
    
    async def get_expiry_dates(self, symbol: str) -> List[int]:
        """
        Get available expiry dates from HFT Engine.
        
        HFT Engine may store this in a separate key or within the enriched data.
        
        Args:
            symbol: Trading symbol
            
        Returns:
            List of expiry timestamps (sorted, nearest first)
        """
        symbol_id = await self.get_symbol_id(symbol)
        if not symbol_id:
            logger.debug(f"Unknown symbol for expiry dates: {symbol}")
            return []
        
        try:
            # Try to get expiry list from dedicated key
            # HFT Engine stores at 'expiry:{symbol_id}' (singular, not plural!)
            expiry_key = f"expiry:{symbol_id}"
            expiry_data = await self.redis_client.get(expiry_key)
            
            if expiry_data:
                return json.loads(expiry_data)
            
            # Fallback: Get from latest enriched data
            latest_key = f"latest:{symbol_id}"
            raw_data = await self.redis_client.get(latest_key)
            
            if raw_data:
                data = json.loads(raw_data)
                # HFT Engine might store expiry_list in context
                expiry_list = data.get("expiry_list", [])
                if expiry_list:
                    return sorted([int(e) for e in expiry_list])
            
            return []
            
        except Exception as e:
            logger.error(f"Failed to get expiry dates for {symbol}: {e}")
            return []
    
    async def _fetch_from_dhan_api(
        self, 
        symbol: str, 
        expiry: str
    ) -> Dict[str, Any]:
        """
        Fallback: Fetch option chain directly from Dhan API.
        
        Used when the requested expiry doesn't match the current ingested expiry.
        Creates a DhanClient with HFT mode disabled to make direct API call.
        
        Args:
            symbol: Trading symbol (e.g., "NIFTY")
            expiry: Expiry date string or timestamp
            
        Returns:
            Option chain data in normalized format
        """
        try:
            # Import here to avoid circular import
            from app.services.dhan_client import DhanClient
            from app.cache.redis import get_redis
            
            # Create DhanClient with HFT mode DISABLED (direct API mode)
            cache = await get_redis()
            dhan_client = DhanClient(cache=cache, use_hft_source=False)
            
            logger.info(f"Fetching non-current expiry {expiry} for {symbol} directly from Dhan API")
            
            # Convert expiry to timestamp and then to OLD year format for Dhan API
            # Dhan API uses old year timestamps (2015-2020) as expiry identifiers
            expiry_ts = expiry
            original_expiry_display = expiry
            
            if isinstance(expiry, str) and "-" in expiry:
                # Convert "YYYY-MM-DD" to timestamp
                expiry_dt = datetime.strptime(expiry, "%Y-%m-%d")
                # Set to 3:30 PM IST for expiry time
                expiry_dt = expiry_dt.replace(hour=15, minute=30, second=0)
                
                # Convert BACK to old year for Dhan API
                # Map current year to base year (2025/2026 -> 2015/2016)
                current_year = datetime.now().year
                if expiry_dt.year == current_year:
                    old_year = 2015
                elif expiry_dt.year == current_year + 1:
                    old_year = 2016
                else:
                    # For years further in future, keep subtracting
                    old_year = expiry_dt.year - 10
                
                try:
                    old_expiry_dt = expiry_dt.replace(year=old_year)
                except ValueError:
                    # Handle Feb 29
                    old_expiry_dt = expiry_dt.replace(year=old_year, day=28)
                
                expiry_ts = int(old_expiry_dt.timestamp())
                logger.info(f"Converted expiry {expiry} -> old format {old_expiry_dt.strftime('%Y-%m-%d')} (ts: {expiry_ts})")
            
            elif isinstance(expiry, (int, str)):
                # If already a timestamp, try to convert it to old year if needed
                try:
                    ts = int(expiry)
                    dt = datetime.fromtimestamp(ts)
                    current_year = datetime.now().year
                    
                    # If year is current/future, convert to old year
                    if dt.year >= current_year:
                        if dt.year == current_year:
                            old_year = 2015
                        elif dt.year == current_year + 1:
                            old_year = 2016
                        else:
                            old_year = dt.year - 10
                        
                        try:
                            old_dt = dt.replace(year=old_year)
                        except ValueError:
                            old_dt = dt.replace(year=old_year, day=28)
                        
                        expiry_ts = int(old_dt.timestamp())
                        logger.info(f"Converted timestamp {expiry} -> old format {old_dt.strftime('%Y-%m-%d')} (ts: {expiry_ts})")
                    else:
                        expiry_ts = ts  # Already old year format
                except:
                    expiry_ts = expiry
            
            # Fetch from Dhan API with the old-year timestamp
            result = await dhan_client.get_option_chain(symbol, expiry_ts)
            
            # Add source indicator and the user's requested expiry
            result["data_source"] = "dhan_api_fallback"
            result["requested_expiry"] = original_expiry_display
            
            logger.info(f"Successfully fetched {symbol} data for expiry {original_expiry_display} from Dhan API fallback")
            return result
            
        except Exception as e:
            logger.error(f"Dhan API fallback failed for {symbol} expiry {expiry}: {e}")
            return {"error": f"Failed to fetch data for expiry {expiry}: {str(e)}"}
    
    async def get_option_chain(
        self, 
        symbol: str, 
        expiry: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get option chain data from HFT Engine.
        
        Args:
            symbol: Trading symbol (e.g., "NIFTY")
            expiry: Expiry timestamp (optional - uses nearest if not provided)
            
        Returns:
            Normalized option chain in option-chain-d format
        """
        symbol_id = await self.get_symbol_id(symbol)
        if not symbol_id:
            logger.debug(f"Unknown symbol for option chain: {symbol}")
            return {"error": f"Unknown symbol: {symbol}"}
        
        if not self._connected:
            await self.connect()
        
        try:
            # Get latest enriched data from Redis
            # HFT Engine stores by symbol_id
            key = f"latest:{symbol_id}"
            raw_data = await self.redis_client.get(key)
            
            if not raw_data:
                logger.warning(f"No HFT data for {symbol} (key: {key})")
                return {"error": f"No data available for {symbol}"}
            
            hft_data = json.loads(raw_data)
            
            # ======== EXPIRY FALLBACK LOGIC ========
            # Check if requested expiry matches the ingested (current) expiry
            # If not, fallback to direct Dhan API call for the requested expiry
            # Note: Compare MONTH-DAY only since years are converted (2025→2015, 2026→2016)
            if expiry:
                # Get the ingested expiry from the data
                ingested_expiry = hft_data.get("context", {}).get("expiry") or hft_data.get("expiry")
                
                # Convert requested expiry to month-day string for comparison
                try:
                    requested_month_day = None
                    if isinstance(expiry, str):
                        # Handle date string format "YYYY-MM-DD"
                        if "-" in expiry:
                            parts = expiry.split("-")
                            if len(parts) == 3:
                                requested_month_day = f"{parts[1]}-{parts[2]}"  # MM-DD
                        else:
                            # Handle timestamp string
                            dt = datetime.fromtimestamp(int(expiry))
                            requested_month_day = dt.strftime("%m-%d")
                    else:
                        dt = datetime.fromtimestamp(int(expiry))
                        requested_month_day = dt.strftime("%m-%d")
                    
                    # Get ingested expiry month-day
                    ingested_month_day = None
                    if ingested_expiry:
                        if "-" in str(ingested_expiry):
                            parts = str(ingested_expiry).split("-")
                            if len(parts) == 3:
                                ingested_month_day = f"{parts[1]}-{parts[2]}"  # MM-DD
                        else:
                            try:
                                dt = datetime.fromtimestamp(int(ingested_expiry))
                                ingested_month_day = dt.strftime("%m-%d")
                            except:
                                ingested_month_day = None
                    
                    # If month-day don't match, user is requesting a different expiry -> fallback to Dhan API
                    if requested_month_day and ingested_month_day and requested_month_day != ingested_month_day:
                        logger.info(f"Expiry mismatch for {symbol}: requested={expiry} (MM-DD: {requested_month_day}), ingested={ingested_expiry} (MM-DD: {ingested_month_day}). Falling back to Dhan API.")
                        return await self._fetch_from_dhan_api(symbol, expiry)
                    else:
                        logger.debug(f"Expiry matches for {symbol}: {requested_month_day} == {ingested_month_day}, using HFT data")
                    
                except Exception as e:
                    logger.warning(f"Error comparing expiries: {e}")
                    # Continue with HFT data on error
            
            # ======== END FALLBACK LOGIC ========
            
            # Fetch expiry list from Redis (stored separately)
            expiry_list = []
            try:
                expiry_key = f"expiry:{symbol_id}"
                expiry_data = await self.redis_client.get(expiry_key)
                if expiry_data:
                    raw_expiries = json.loads(expiry_data)
                    
                    # Convert old year timestamps to current/future year
                    # Dhan returns timestamps from 2015-2020 with correct month/day
                    current_year = datetime.now().year
                    now = datetime.now()
                    
                    converted_expiries = []
                    for old_ts in raw_expiries:
                        if isinstance(old_ts, int) and old_ts > 0:
                            old_dt = datetime.fromtimestamp(old_ts)
                            
                            # Replace year with current year
                            try:
                                new_dt = old_dt.replace(year=current_year)
                            except ValueError:
                                # Handle Feb 29 in non-leap years
                                new_dt = old_dt.replace(year=current_year, day=28)
                            
                            # If the date is in the past, use next year
                            if new_dt < now:
                                try:
                                    new_dt = old_dt.replace(year=current_year + 1)
                                except ValueError:
                                    new_dt = old_dt.replace(year=current_year + 1, day=28)
                            
                            new_ts = int(new_dt.timestamp())
                            converted_expiries.append(new_ts)
                    
                    # Sort and deduplicate
                    converted_expiries = sorted(set(converted_expiries))
                    
                    if converted_expiries:
                        # Store both raw timestamps and formatted for frontend
                        hft_data["expiry_list"] = converted_expiries
                        hft_data["expiry_dates"] = [
                            datetime.fromtimestamp(e).strftime("%Y-%m-%d") 
                            for e in converted_expiries[:10]  # Show up to 10 expiries
                        ]
                        logger.debug(f"Converted {len(converted_expiries)} expiry dates for {symbol}: {hft_data['expiry_dates'][:3]}...")
            except Exception as e:
                logger.warning(f"Failed to fetch expiry list for {symbol}: {e}")
            
            # Normalize to option-chain-d format
            return self._normalize_data(hft_data, symbol, expiry)
            
        except Exception as e:
            logger.error(f"Failed to get option chain from HFT: {e}")
            return {"error": str(e)}
    
    def _normalize_data(
        self, 
        hft_data: Dict, 
        symbol: str,
        requested_expiry: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transform HFT Engine's enriched data to option-chain-d format.
        
        HFT Engine Format:
        {
            "symbol": "NIFTY",
            "symbol_id": 13,
            "expiry": "1734451200",
            "timestamp": "2024-12-17T10:30:00Z",
            "context": {
                "spot_price": 24500,
                "spot_change": 150,
                "total_call_oi": 10000000,
                ...
            },
            "futures": {...},
            "options": [  # Flat list!
                {"strike": 24000, "option_type": "CE", "ltp": 550, ...},
                {"strike": 24000, "option_type": "PE", "ltp": 50, ...},
                ...
            ],
            "analyses": {...}
        }
        
        option-chain-d Format:
        {
            "symbol": "NIFTY",
            "spot": {"ltp": 24500, "change": 150, ...},
            "oc": {
                "24000": {
                    "ce": {"ltp": 550, "OI": ..., "optgeeks": {...}},
                    "pe": {"ltp": 50, "OI": ..., "optgeeks": {...}}
                },
                ...
            },
            ...
        }
        """
        context = hft_data.get("context", {})
        options = hft_data.get("options", [])
        futures_data = hft_data.get("futures")
        analyses = hft_data.get("analyses", {})
        
        # Extract context values for Greeks calculation
        spot_price = context.get("spot_price", 0) or 0
        dte = context.get("days_to_expiry", 1) or 1  # Default 1 day if missing
        
        # Get expiry list for date formatting
        expiry_list = hft_data.get("expiry_list", [])
        
        # Build option chain structure (grouped by strike)
        # HFT has flat list, option-chain-d needs nested by strike
        oc = {}
        for opt in options:
            strike = opt.get("strike")
            if strike is None:
                continue
                
            strike_str = str(int(strike))
            
            if strike_str not in oc:
                oc[strike_str] = {"ce": {}, "pe": {}}
            
            option_type = opt.get("option_type", "").upper()
            leg_key = "ce" if option_type == "CE" else "pe"
            # Pass spot_price and dte for dynamic Greeks calculation
            oc[strike_str][leg_key] = self._normalize_option_leg(opt, spot_price, dte)
        
        # Build future structure (option-chain-d expects nested by expiry)
        future_dict = {}
        raw_expiry = hft_data.get("expiry", requested_expiry or "")
        # Format expiry date properly (handles Unix timestamps and invalid dates)
        expiry = _format_expiry_date(raw_expiry, expiry_list)
        
        if futures_data:
            future_dict[str(expiry)] = {
                "ltp": futures_data.get("ltp", 0),
                "oi": futures_data.get("oi", 0),
                "oichng": futures_data.get("oi_change", 0),
                "vol": futures_data.get("volume", 0),
                "sym": futures_data.get("symbol", f"{symbol}FUT"),
            }
        
        # Get sorted strikes
        strikes = sorted(oc.keys(), key=lambda x: float(x))
        
        # ═══════════════════════════════════════════════════════════════
        # REVERSAL CALCULATION AT STRIKE LEVEL
        # Reversal values indicate support/resistance based on OI concentration
        # ═══════════════════════════════════════════════════════════════
        if strikes and spot_price > 0:
            # Find max OI for normalization
            max_oi = 1
            for s_key in strikes:
                s = oc[s_key]
                ce_oi = s.get("ce", {}).get("OI", 0) or s.get("ce", {}).get("oi", 0) or 0
                pe_oi = s.get("pe", {}).get("OI", 0) or s.get("pe", {}).get("oi", 0) or 0
                max_oi = max(max_oi, ce_oi, pe_oi)
            
            for strike_str in strikes:
                strike_val = float(strike_str)
                s = oc[strike_str]
                
                ce = s.get("ce", {})
                pe = s.get("pe", {})
                
                # Get OI and Greeks
                ce_oi = ce.get("OI", 0) or ce.get("oi", 0) or 0
                pe_oi = pe.get("OI", 0) or pe.get("oi", 0) or 0
                ce_vol = ce.get("vol", 0) or ce.get("volume", 0) or 0
                pe_vol = pe.get("vol", 0) or pe.get("volume", 0) or 0
                ce_gamma = abs(ce.get("gamma", 0) or 0)
                pe_gamma = abs(pe.get("gamma", 0) or 0)
                ce_iv = ce.get("iv", 0) or 0
                pe_iv = pe.get("iv", 0) or 0
                
                # Calculate reversal strength score
                # Formula: (OI * 0.7 + Volume * 0.3) * (1 + Gamma * 50) * (1 + IV/100)
                ce_gamma_mult = 1 + (ce_gamma * 50)
                pe_gamma_mult = 1 + (pe_gamma * 50)
                ce_iv_mult = 1 + (ce_iv / 100)
                pe_iv_mult = 1 + (pe_iv / 100)
                
                ce_strength = (ce_oi * 0.7 + ce_vol * 0.3) * ce_gamma_mult * ce_iv_mult
                pe_strength = (pe_oi * 0.7 + pe_vol * 0.3) * pe_gamma_mult * pe_iv_mult
                
                # Normalize to reasonable values (percentage of spot)
                total_strength = max(ce_strength, pe_strength, 1)
                
                # Reversal value = strike adjusted by strength ratio
                # For resistance (CE): strike * (1 + strength_factor)
                # For support (PE): strike * (1 - strength_factor)
                oi_ratio = (ce_oi + pe_oi) / (max_oi * 2 + 0.001)
                strength_factor = min(0.02, oi_ratio * 0.05)  # Max 2% adjustment
                
                # Primary reversal: based on current day's data
                if strike_val > spot_price:  # Resistance zone
                    reversal = strike_val * (1 - strength_factor * 0.5)  # Slightly below strike
                else:  # Support zone
                    reversal = strike_val * (1 + strength_factor * 0.5)  # Slightly above strike
                
                # Weekly reversal: more conservative, closer to actual strike
                wkly_factor = strength_factor * 0.3
                wkly_reversal = strike_val * (1 + wkly_factor if strike_val < spot_price else 1 - wkly_factor)
                
                # Futures reversal: uses futures LTP if available
                fut_ltp = futures_data.get("ltp", spot_price) if futures_data else spot_price
                fut_factor = strength_factor * 0.4
                if strike_val > fut_ltp:
                    fut_reversal = strike_val * (1 - fut_factor * 0.5)
                else:
                    fut_reversal = strike_val * (1 + fut_factor * 0.5)
                
                # Add reversal values to the strike data
                oc[strike_str]["reversal"] = round(reversal, 2)
                oc[strike_str]["wkly_reversal"] = round(wkly_reversal, 2)
                oc[strike_str]["fut_reversal"] = round(fut_reversal, 2)
                
                # Also add strength scores for frontend use
                oc[strike_str]["ce_strength"] = round(ce_strength, 2)
                oc[strike_str]["pe_strength"] = round(pe_strength, 2)
        
        # Calculate ATM strike
        atm_strike = 0
        if strikes and spot_price > 0:
            atm_strike = min(strikes, key=lambda x: abs(float(x) - spot_price))
        
        return {
            "symbol": symbol.upper(),
            "expiry": expiry,
            "timestamp": hft_data.get("timestamp", datetime.utcnow().isoformat()),
            
            # Spot data
            "spot": {
                "ltp": context.get("spot_price", 0),
                "change": context.get("spot_change", 0),
                "change_percent": context.get("spot_change_pct", 0),
            },
            
            # Futures
            "future": future_dict,
            "fl": future_dict,  # Alias for frontend compatibility
            
            # Option chain (main payload)
            "oc": oc,
            "strikes": strikes,
            
            # Summary metrics
            "atm_strike": float(atm_strike) if atm_strike else spot_price,
            "atmiv": context.get("atm_iv", 0),
            "atmiv_change": context.get("atm_iv_change", 0),
            "u_id": hft_data.get("symbol_id", context.get("symbol_id", 0)),
            "dte": context.get("days_to_expiry", 0),
            "days_to_expiry": context.get("days_to_expiry", 0),  # Alias
            "max_pain_strike": context.get("max_pain_strike", 0),
            "total_ce_oi": context.get("total_call_oi", 0),
            "total_call_oi": context.get("total_call_oi", 0),  # Alias
            "total_pe_oi": context.get("total_put_oi", 0),
            "total_put_oi": context.get("total_put_oi", 0),  # Alias
            "pcr": context.get("pcr_ratio", 0),  # Frontend expects 'pcr'
            "pcr_ratio": context.get("pcr_ratio", 0),  # Keep for compatibility
            "lot_size": context.get("lot_size", 75),
            "expiry_list": hft_data.get("expiry_list", []),
            "expiry_dates": hft_data.get("expiry_dates", []),  # Formatted dates for dropdown
            
            # Spot data aliases for frontend (sltp, schng)
            "sltp": context.get("spot_price", 0),
            "schng": context.get("spot_change", 0),
            "sperchng": context.get("spot_change_pct", 0),
            
            # Include HFT's advanced analyses as bonus
            # These provide extra features like gamma_exposure, iv_skew
            "hft_analyses": analyses,
            
            # Data quality from HFT
            "data_quality": hft_data.get("data_quality", {}),
            
            # Flag indicating data came from HFT
            "_source": "hft_engine",
        }
    
    def _normalize_option_leg(
        self, 
        opt: Dict, 
        spot_price: float = 0, 
        dte: float = 1
    ) -> Dict:
        """
        Normalize single option leg (CE or PE) to option-chain-d format.
        
        HFT Engine fields → option-chain-d expected field names:
        - change_oi → oichng
        - oi → OI (uppercase for frontend)
        - delta/gamma/theta/vega → optgeeks.{field}
        
        If IV or Delta are missing/null, we calculate them dynamically.
        
        Args:
            opt: Option data from HFT
            spot_price: Current spot price for IV/Delta calculation
            dte: Days to expiry for IV/Delta calculation
        """
        option_type = opt.get("option_type", "CE").upper()
        strike = opt.get("strike", 0) or 0
        ltp = opt.get("ltp", 0) or 0
        
        # IV normalization: HFT may store as decimal (0.15), option-chain-d expects percent (15)
        raw_iv = opt.get("iv")
        if raw_iv is not None and raw_iv > 0:
            if 0 < raw_iv < 1:
                iv = raw_iv * 100  # Convert 0.15 → 15
            elif raw_iv > 1:
                iv = raw_iv  # Already percentage
            else:
                iv = None
        else:
            iv = None
        
        # Delta from HFT
        raw_delta = opt.get("delta")
        if raw_delta is not None and raw_delta != 0:
            delta = raw_delta
        else:
            delta = None
        
        # Calculate IV dynamically if missing
        if iv is None or iv <= 0:
            if spot_price > 0 and ltp > 0 and dte > 0:
                iv = _calculate_iv_approximation(ltp, spot_price, strike, dte, option_type)
            else:
                # Default fallback IVs based on option type
                iv = 15.0  # Reasonable default
        
        # Calculate Delta dynamically if missing
        if delta is None or delta == 0:
            if spot_price > 0 and strike > 0 and iv > 0:
                delta = _calculate_delta_approximation(spot_price, strike, option_type, dte, iv)
            else:
                # Simple moneyness-based fallback
                if option_type == "CE":
                    delta = 0.5 if spot_price >= strike else 0.3
                else:
                    delta = -0.5 if strike >= spot_price else -0.3
        
        # Moneyness type normalization
        # HFT uses 'ITM', 'OTM', 'ATM'; option-chain-d uses 'I', 'O', 'A'
        mness = opt.get("moneyness_type", "OTM")
        if mness and len(mness) > 1:
            mness = mness[0]  # 'ITM' → 'I'
        
        # Get OI - HFT stores as 'oi'
        oi_value = opt.get("oi", 0) or 0
        
        # Get OI change - HFT stores as 'change_oi' (NOT 'oi_change')
        oi_change = opt.get("change_oi", 0) or opt.get("oi_change", 0) or 0
        
        # Get gamma/theta/vega with sensible defaults
        gamma = opt.get("gamma", 0) or 0
        theta = opt.get("theta", 0) or 0
        vega = opt.get("vega", 0) or 0
        
        # Approximate gamma/theta/vega if missing (basic approximations)
        if gamma == 0 and spot_price > 0 and iv > 0:
            # Simplified gamma approximation
            time_to_exp = max(dte / 365.0, 1/365.0)
            gamma = 0.01 / (spot_price * (iv / 100) * math.sqrt(time_to_exp) + 0.001)
            gamma = min(0.01, gamma)  # Cap at reasonable value
        
        if theta == 0 and iv > 0 and dte > 0:
            # Simplified theta approximation (time decay)
            theta = -(ltp * (iv / 100) / (2 * math.sqrt(max(dte, 1)))) * 0.1
            if option_type == "PE":
                theta = abs(theta) * -1  # Theta always negative
        
        if vega == 0 and iv > 0 and dte > 0:
            # Simplified vega approximation
            vega = spot_price * math.sqrt(max(dte / 365.0, 1/365.0)) * 0.001
        
        return {
            # Prices
            "ltp": ltp,
            "atp": opt.get("avg_traded_price", 0) or 0,
            "pc": opt.get("prev_close", 0) or 0,
            "bid": opt.get("bid") or 0,
            "ask": opt.get("ask") or 0,
            "bid_qty": opt.get("bid_qty", 0) or 0,
            "ask_qty": opt.get("ask_qty", 0) or 0,
            
            # Volume - HFT stores as 'volume'
            "vol": opt.get("volume", 0) or 0,
            "volume": opt.get("volume", 0) or 0,
            "pVol": opt.get("prev_volume", 0) or 0,
            
            # Open Interest - Frontend expects BOTH 'OI' and 'oi'
            "OI": oi_value,
            "oi": oi_value,
            "oichng": oi_change,  # Frontend expects this spelling
            "oi_change": oi_change,  # Alias
            "oiperchnge": opt.get("oi_change_pct", 0) or 0,
            "p_oi": opt.get("prev_oi", 0) or 0,
            
            # Price changes
            "p_chng": opt.get("price_change", 0) or 0,
            "p_pchng": opt.get("price_change_pct", 0) or 0,
            "change": opt.get("price_change", 0) or 0,
            
            # IV (calculated if missing)
            "iv": round(iv, 2),
            
            # Buildup signals
            "btyp": opt.get("buildup_type", "NT") or "NT",
            "BuiltupName": opt.get("buildup_name", "NEUTRAL") or "NEUTRAL",
            
            # Moneyness
            "mness": mness or "O",
            
            # Greeks (calculated if missing)
            "delta": round(delta, 4) if isinstance(delta, float) else delta,
            "gamma": round(gamma, 6) if gamma else 0,
            "theta": round(theta, 4) if theta else 0,
            "vega": round(vega, 4) if vega else 0,
            "optgeeks": {
                "delta": round(delta, 4) if isinstance(delta, float) else delta,
                "gamma": round(gamma, 6) if gamma else 0,
                "theta": round(theta, 4) if theta else 0,
                "vega": round(vega, 4) if vega else 0,
                "rho": opt.get("rho", 0) or 0,
            },
            
            # Symbol info
            "sym": opt.get("symbol", ""),
            "sid": opt.get("symbol_id", 0) or 0,
            
            # HFT quality flags
            "is_liquid": opt.get("is_liquid", True),
            "is_valid": opt.get("is_valid", True),
        }
    
    async def subscribe_live(
        self, 
        symbol: str, 
        callback: Callable[[Dict], Any]
    ) -> None:
        """
        Subscribe to live updates via Redis pub/sub.
        
        HFT Engine publishes to channels like:
        - live:option_chain:{symbol_id}
        
        Args:
            symbol: Trading symbol
            callback: Async function to call with normalized data
        """
        symbol_id = await self.get_symbol_id(symbol)
        if not symbol_id:
            logger.error(f"Cannot subscribe: unknown symbol {symbol}")
            return
        
        if not self._connected:
            await self.connect()
        
        pubsub = self.redis_client.pubsub()
        channel = f"live:option_chain:{symbol_id}"
        
        await pubsub.subscribe(channel)
        logger.info(f"Subscribed to HFT channel: {channel}")
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        normalized = self._normalize_data(data, symbol)
                        await callback(normalized)
                    except Exception as e:
                        logger.error(f"Error processing HFT message: {e}")
        except Exception as e:
            logger.error(f"HFT subscription error: {e}")
        finally:
            await pubsub.unsubscribe(channel)
    
    async def get_spot_data(self, symbol: str) -> Dict[str, Any]:
        """
        Get spot/index data from HFT Engine.
        
        Args:
            symbol: Trading symbol
            
        Returns:
            Spot data dict
        """
        chain = await self.get_option_chain(symbol)
        if "error" in chain:
            return chain
        return chain.get("spot", {"ltp": 0})
    
    async def get_futures_data(self, symbol: str) -> List[Dict[str, Any]]:
        """
        Get futures data from HFT Engine.
        
        Args:
            symbol: Trading symbol
            
        Returns:
            List of futures contracts
        """
        chain = await self.get_option_chain(symbol)
        if "error" in chain:
            return []
        
        future_dict = chain.get("future", {})
        return [
            {
                "expiry": exp,
                **data
            }
            for exp, data in future_dict.items()
        ]


# Singleton instance for app-wide use
_hft_adapter_instance: Optional[HFTDataAdapter] = None


async def get_hft_adapter() -> HFTDataAdapter:
    """
    Get or create the HFT adapter singleton.
    
    Returns:
        HFTDataAdapter instance
    """
    global _hft_adapter_instance
    
    if _hft_adapter_instance is None:
        _hft_adapter_instance = HFTDataAdapter()
        await _hft_adapter_instance.connect()
    
    return _hft_adapter_instance


async def close_hft_adapter():
    """Close the HFT adapter singleton"""
    global _hft_adapter_instance
    
    if _hft_adapter_instance:
        await _hft_adapter_instance.close()
        _hft_adapter_instance = None

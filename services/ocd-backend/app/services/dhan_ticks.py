"""
Dhan Ticks Service - Chart OHLCV Data
Fetches candlestick data from Dhan ticks API
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Dhan ticks API endpoints
DHAN_TICKS_URL = "https://ticks.dhan.co/getData"      # For minute/hour charts
DHAN_TICKS_URL_S = "https://ticks.dhan.co/getDataS"   # For second charts

# ═══════════════════════════════════════════════════════════════════
# Dynamic Instrument Loading with In-Memory Cache
# Loads from Redis (populated from DB) with fallback to static map
# ═══════════════════════════════════════════════════════════════════

# Static fallback map (used when Redis unavailable)
_STATIC_INSTRUMENT_MAP = {
    "NIFTY": {"SEC_ID": 13, "TYPE": "IDX"},
    "BANKNIFTY": {"SEC_ID": 25, "TYPE": "IDX"},
    "FINNIFTY": {"SEC_ID": 27, "TYPE": "IDX"},
    "SENSEX": {"SEC_ID": 51, "TYPE": "IDX"},
    "BANKEX": {"SEC_ID": 69, "TYPE": "IDX"},
}

# Dynamic cache (loaded from Redis)
_instrument_cache: dict = {}
_cache_loaded: bool = False


async def _load_instruments_from_redis() -> dict:
    """Load instrument mappings from Redis cache (populated from DB)"""
    global _instrument_cache, _cache_loaded
    
    try:
        from app.cache.redis import get_redis
        import json
        
        cache = await get_redis()
        if not cache:
            return _STATIC_INSTRUMENT_MAP
        
        # Try to get instruments from Redis
        instruments_data = await cache.get("instruments:ticks_map")
        if instruments_data:
            _instrument_cache = json.loads(instruments_data) if isinstance(instruments_data, str) else instruments_data
            _cache_loaded = True
            logger.info(f"Loaded {len(_instrument_cache)} instruments from Redis cache")
            return _instrument_cache
        
        # If not in Redis, load from DB and cache
        from app.config.database import AsyncSessionLocal
        from sqlalchemy import select
        from core.database.models import InstrumentDB
        
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(InstrumentDB).where(InstrumentDB.is_active == True)
            )
            instruments = result.scalars().all()
            
            for inst in instruments:
                # Determine TYPE based on segment_id
                if inst.segment_id == 0:
                    inst_type = "IDX"
                elif inst.segment_id == 5:
                    inst_type = "COM"  # Commodity
                else:
                    inst_type = "EQ"
                
                _instrument_cache[inst.symbol] = {
                    "SEC_ID": inst.symbol_id,
                    "TYPE": inst_type
                }
            
            # Cache in Redis for 1 hour
            if _instrument_cache:
                await cache.set("instruments:ticks_map", json.dumps(_instrument_cache), ttl=3600)
                _cache_loaded = True
                logger.info(f"Loaded {len(_instrument_cache)} instruments from DB and cached")
        
        return _instrument_cache if _instrument_cache else _STATIC_INSTRUMENT_MAP
        
    except Exception as e:
        logger.warning(f"Failed to load instruments dynamically: {e}, using static fallback")
        return _STATIC_INSTRUMENT_MAP


def get_instrument_map() -> dict:
    """Get current instrument map (cached or static fallback)"""
    if _cache_loaded and _instrument_cache:
        return _instrument_cache
    return _STATIC_INSTRUMENT_MAP

# Interval mapping from frontend to Dhan format
# Format: (base_interval, aggregation_factor, use_seconds_endpoint)
# Native API intervals: 15S, 1, 5, 15, 60, D, W
# Custom intervals aggregate from nearest base: 2=1*2, 3=1*3, 10=5*2, 30=15*2
INTERVAL_MAP = {
    "15S": ("15S", 1, True),    # 15 seconds - native, getDataS
    "1": ("1", 1, False),       # 1 minute - native
    "2": ("1", 2, False),       # 2 minutes = 2 x 1min
    "3": ("1", 3, False),       # 3 minutes = 3 x 1min
    "5": ("5", 1, False),       # 5 minutes - native
    "10": ("5", 2, False),      # 10 minutes = 2 x 5min
    "15": ("15", 1, False),     # 15 minutes - native
    "30": ("15", 2, False),     # 30 minutes = 2 x 15min
    "60": ("60", 1, False),     # 1 hour - native
    "D": ("D", 1, False),       # Daily - native
    "W": ("W", 1, False),       # Weekly - native
}


class DhanTicksService:
    """Service for fetching OHLCV data from Dhan ticks API"""
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        # Get auth token from settings (will be dynamically loaded via ConfigService)
        self._static_auth_token = getattr(settings, 'DHAN_AUTH_TOKEN', '')
        # Authorization token - MUST be set in settings/env
        self.authorization = getattr(settings, 'DHAN_AUTHORIZATION', '')
        self._current_token = None
        logger.info(f"DhanTicksService initialized (token will be loaded dynamically)")
    
    async def _get_auth_token(self) -> str:
        """Get auth token from Redis dhan:tokens -> config service -> settings fallback"""
        try:
            # Try Redis dhan:tokens first (dynamic token)
            try:
                from app.cache.redis import get_redis
                cache = await get_redis()
                import json
                token_data = await cache.get("dhan:tokens")
                if token_data:
                    tokens = json.loads(token_data) if isinstance(token_data, str) else token_data
                    if tokens and tokens.get("auth_token"):
                        # logger.debug("Got ticks auth token from Redis dhan:tokens")
                        return tokens["auth_token"]
            except Exception as e:
                logger.warning(f"Failed to get token from Redis: {e}")

            from app.services.config_service import get_config
            token = await get_config("DHAN_AUTH_TOKEN", self._static_auth_token)
            return token or self._static_auth_token or ""
        except Exception as e:
            logger.warning(f"Failed to get token from config service: {e}")
            return self._static_auth_token or ""
    
    async def _get_headers(self) -> dict:
        """Get headers with current auth token"""
        token = await self._get_auth_token()
        return {
            "Content-Type": "application/json",
            "Accept": "*/*",
            "Origin": "https://tv-web.dhan.co",
            "Referer": "https://tv-web.dhan.co/",
            "Access-Control-Allow-Origin": "true",
            "Auth": token,  # JWT token (dynamically loaded)
            "Authorization": self.authorization,  # API key
            "Bid": getattr(settings, 'DHAN_BID', 'DHN1804'),  # Client broker ID
            "Cid": getattr(settings, 'DHAN_CID', ''),  # Client ID from env
            "Src": "T",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        }
    
    async def get_chart_data(
        self,
        symbol: str,
        interval: str = "15",
        days_back: int = 30
    ) -> Dict[str, Any]:
        """
        Fetch OHLCV chart data for a symbol
        
        Args:
            symbol: Symbol name (NIFTY, BANKNIFTY, etc.)
            interval: Timeframe interval (1, 5, 15, 60, D, etc.)
            days_back: Number of days of historical data
            
        Returns:
            Dict with candles data
        """
        # Load instruments dynamically on first call
        if not _cache_loaded:
            await _load_instruments_from_redis()
        
        instrument_map = get_instrument_map()
        if symbol not in instrument_map:
            logger.warning(f"Unknown symbol: {symbol}, defaulting to NIFTY")
            symbol = "NIFTY"
        
        instrument = instrument_map[symbol]
        
        # Get interval info (base_interval, aggregation_factor, use_seconds_endpoint)
        interval_info = INTERVAL_MAP.get(interval, ("15", 1, False))
        dhan_interval = interval_info[0]
        aggregation_factor = interval_info[1]
        use_seconds_endpoint = interval_info[2]
        
        # Select correct API endpoint
        api_url = DHAN_TICKS_URL_S if use_seconds_endpoint else DHAN_TICKS_URL
        
        # Calculate timestamps
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_back)
        
        # Unix timestamps
        start_ts = int(start_time.timestamp())
        end_ts = int(end_time.timestamp())
        
        # Determine format based on generic instrument type (IDX vs EQ)
        # Using hardcoded user-requested values for non-index (Equity)
        if instrument["TYPE"] == "IDX":
            exch = "IDX"
            seg = "I"
            inst = "IDX"
        else: # EQ
            exch = "NSE"
            seg = "E"
            inst = "EQUITY"
            
        # Format time strings as requested: "Mon Dec 01 2025 00:00:01 GMT+0530 (India Standard Time)"
        # Note: strftime doesn't support generic timezone names easily, so hardcoding suffix as per request
        start_time_str = start_time.strftime("%a %b %d %Y %H:%M:%S GMT+0530 (India Standard Time)")
        end_time_str = end_time.strftime("%a %b %d %Y %H:%M:%S GMT+0530 (India Standard Time)")
        
        payload = {
            "EXCH": exch,
            "SEG": seg,
            "INST": inst,
            "SEC_ID": instrument["SEC_ID"],
            "START": start_ts,
            "END": end_ts,
            "START_TIME": start_time_str,
            "END_TIME": end_time_str,
            "INTERVAL": dhan_interval
        }
        
        logger.info(f"Fetching chart data for {symbol}, interval={interval} ({dhan_interval}), days={days_back}, url={api_url}")
        
        try:
            headers = await self._get_headers()
            response = await self.client.post(
                api_url,
                json=payload,
                headers=headers,
            )
            
            if response.status_code == 200:
                data = response.json()
                # Debug: Log the raw response structure
                logger.info(f"Dhan API raw response type: {type(data)}")
                if isinstance(data, dict):
                    logger.info(f"Dhan API response keys: {data.keys()}")
                elif isinstance(data, list):
                    logger.info(f"Dhan API response is list with {len(data)} items")
                    if len(data) > 0:
                        logger.info(f"First item type: {type(data[0])}, sample: {str(data[0])[:200]}")
                else:
                    logger.info(f"Dhan API response preview: {str(data)[:500]}")
                result = self._format_response(data, symbol)
                # Apply aggregation for custom intervals (factor > 1)
                if aggregation_factor > 1 and result.get("success") and result.get("candles"):
                    result["candles"] = self._aggregate_candles(result["candles"], aggregation_factor)
                    result["count"] = len(result["candles"])
                    logger.info(f"Aggregated to {len(result['candles'])} candles (factor={aggregation_factor})")
                return result
            else:
                logger.error(f"Dhan ticks API error: {response.status_code} - {response.text}")
                return {"success": False, "error": f"API error: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Error fetching chart data: {e}")
            return {"success": False, "error": str(e)}
    
    def _aggregate_candles(self, candles: List[Dict], factor: int) -> List[Dict]:
        """
        Aggregate candles by combining `factor` candles into one.
        Does NOT combine candles from different trading days.
        
        OHLCV Aggregation Rules:
        - Open: First candle's open
        - High: Max of all highs
        - Low: Min of all lows
        - Close: Last candle's close
        - Volume: Sum of all volumes
        - Time: First candle's timestamp
        """
        if factor <= 1 or not candles:
            return candles
        
        aggregated = []
        current_chunk = []
        current_date = None
        
        for candle in candles:
            # Get date from Unix timestamp
            candle_date = datetime.fromtimestamp(candle["time"]).date()
            
            # Check if we need to start a new chunk (day boundary or factor limit)
            if current_date is not None and candle_date != current_date:
                # Day changed - finalize current chunk if any
                if current_chunk:
                    aggregated.append(self._merge_chunk(current_chunk))
                current_chunk = [candle]
                current_date = candle_date
            elif len(current_chunk) >= factor:
                # Factor limit reached - finalize and start new
                aggregated.append(self._merge_chunk(current_chunk))
                current_chunk = [candle]
                current_date = candle_date
            else:
                # Add to current chunk
                current_chunk.append(candle)
                if current_date is None:
                    current_date = candle_date
        
        # Finalize last chunk
        if current_chunk:
            aggregated.append(self._merge_chunk(current_chunk))
        
        return aggregated
    
    def _merge_chunk(self, chunk: List[Dict]) -> Dict:
        """Merge a chunk of candles into one aggregated candle"""
        return {
            "time": chunk[0]["time"],  # First timestamp
            "open": chunk[0]["open"],  # First open
            "high": max(c["high"] for c in chunk),
            "low": min(c["low"] for c in chunk),
            "close": chunk[-1]["close"],  # Last close
            "volume": sum(c.get("volume", 0) for c in chunk),
        }
    
    def _format_response(self, data: Any, symbol: str) -> Dict[str, Any]:
        """Format Dhan response to standard OHLCV format"""
        try:
            candles = []
            
            # Dhan returns format: {success: true, data: {o:[], h:[], l:[], c:[], v:[], t:[]}}
            if isinstance(data, dict):
                if data.get("success") and "data" in data:
                    ohlcv = data["data"]
                    opens = ohlcv.get("o", [])
                    highs = ohlcv.get("h", [])
                    lows = ohlcv.get("l", [])
                    closes = ohlcv.get("c", [])
                    volumes = ohlcv.get("v", [])
                    timestamps = ohlcv.get("t", [])
                    
                    # Build candles from parallel arrays
                    for i in range(len(timestamps)):
                        candles.append({
                            "time": timestamps[i],  # Unix timestamp
                            "open": float(opens[i]) if i < len(opens) else 0,
                            "high": float(highs[i]) if i < len(highs) else 0,
                            "low": float(lows[i]) if i < len(lows) else 0,
                            "close": float(closes[i]) if i < len(closes) else 0,
                            "volume": float(volumes[i]) if i < len(volumes) else 0,
                        })
                    
                    logger.info(f"Parsed {len(candles)} candles for {symbol}")
                else:
                    logger.warning(f"Dhan API returned: success={data.get('success')}, has data={('data' in data)}")
            else:
                logger.warning(f"Unexpected response type: {type(data)}")
            
            return {
                "success": True,
                "symbol": symbol,
                "candles": candles,
                "count": len(candles),
            }
        except Exception as e:
            logger.error(f"Error formatting response: {e}")
            return {"success": False, "error": f"Format error: {e}"}
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


# Singleton instance
_ticks_service: Optional[DhanTicksService] = None


async def get_ticks_service() -> DhanTicksService:
    """Get or create ticks service instance"""
    global _ticks_service
    if _ticks_service is None:
        _ticks_service = DhanTicksService()
    return _ticks_service

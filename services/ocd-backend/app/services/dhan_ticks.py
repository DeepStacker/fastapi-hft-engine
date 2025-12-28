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

# Instrument mappings - includes indices and equities
# Type: "IDX" for indices, "EQ" for equities
INSTRUMENT_MAP = {
    # INDICES (use EXCH=IDX, SEG=I, INST=IDX)
    "NIFTY": {"SEC_ID": 13, "TYPE": "IDX"},
    "BANKNIFTY": {"SEC_ID": 25, "TYPE": "IDX"},
    "FINNIFTY": {"SEC_ID": 27, "TYPE": "IDX"},
    "MIDCPNIFTY": {"SEC_ID": 442, "TYPE": "IDX"},
    "NIFTYNXT50": {"SEC_ID": 38, "TYPE": "IDX"},
    "SENSEX": {"SEC_ID": 51, "TYPE": "IDX"},
    "BANKEX": {"SEC_ID": 69, "TYPE": "IDX"},
    
    # EQUITIES (use EXCH=NSE, SEG=E, INST=EQUITY)
    "RELIANCE": {"SEC_ID": 2885, "TYPE": "EQ"},
    "TCS": {"SEC_ID": 11536, "TYPE": "EQ"},
    "HDFCBANK": {"SEC_ID": 1333, "TYPE": "EQ"},
    "INFY": {"SEC_ID": 1594, "TYPE": "EQ"},
    "ICICIBANK": {"SEC_ID": 4963, "TYPE": "EQ"},
    "HINDUNILVR": {"SEC_ID": 1394, "TYPE": "EQ"},
    "ITC": {"SEC_ID": 1660, "TYPE": "EQ"},
    "SBIN": {"SEC_ID": 3045, "TYPE": "EQ"},
    "BHARTIARTL": {"SEC_ID": 10604, "TYPE": "EQ"},
    "KOTAKBANK": {"SEC_ID": 1922, "TYPE": "EQ"},
    "LT": {"SEC_ID": 11483, "TYPE": "EQ"},
    "AXISBANK": {"SEC_ID": 5900, "TYPE": "EQ"},
    "ASIANPAINT": {"SEC_ID": 236, "TYPE": "EQ"},
    "MARUTI": {"SEC_ID": 10999, "TYPE": "EQ"},
    "SUNPHARMA": {"SEC_ID": 3351, "TYPE": "EQ"},
    "TITAN": {"SEC_ID": 3506, "TYPE": "EQ"},
    "BAJFINANCE": {"SEC_ID": 317, "TYPE": "EQ"},
    "WIPRO": {"SEC_ID": 3787, "TYPE": "EQ"},
    "HCLTECH": {"SEC_ID": 7229, "TYPE": "EQ"},
    "ULTRACEMCO": {"SEC_ID": 11532, "TYPE": "EQ"},
    "TATAMOTORS": {"SEC_ID": 3456, "TYPE": "EQ"},
    "TATASTEEL": {"SEC_ID": 3499, "TYPE": "EQ"},
    "NTPC": {"SEC_ID": 11630, "TYPE": "EQ"},
    "POWERGRID": {"SEC_ID": 14977, "TYPE": "EQ"},
    "ONGC": {"SEC_ID": 2475, "TYPE": "EQ"},
    "COALINDIA": {"SEC_ID": 20374, "TYPE": "EQ"},
    "JSWSTEEL": {"SEC_ID": 11723, "TYPE": "EQ"},
    "MM": {"SEC_ID": 2031, "TYPE": "EQ"},
    "TECHM": {"SEC_ID": 13538, "TYPE": "EQ"},
    "INDUSINDBK": {"SEC_ID": 5258, "TYPE": "EQ"},
    "HINDALCO": {"SEC_ID": 1363, "TYPE": "EQ"},
    "ADANIPORTS": {"SEC_ID": 15083, "TYPE": "EQ"},
    "ADANIENT": {"SEC_ID": 25, "TYPE": "EQ"},
    "DRREDDY": {"SEC_ID": 881, "TYPE": "EQ"},
    "CIPLA": {"SEC_ID": 694, "TYPE": "EQ"},
    "GRASIM": {"SEC_ID": 1232, "TYPE": "EQ"},
    "BRITANNIA": {"SEC_ID": 547, "TYPE": "EQ"},
    "APOLLOHOSP": {"SEC_ID": 157, "TYPE": "EQ"},
    "EICHERMOT": {"SEC_ID": 910, "TYPE": "EQ"},
    "HEROMOTOCO": {"SEC_ID": 1348, "TYPE": "EQ"},
    "NESTLEIND": {"SEC_ID": 17963, "TYPE": "EQ"},
    "BAJAJ-AUTO": {"SEC_ID": 16669, "TYPE": "EQ"},
    "BAJAJFINSV": {"SEC_ID": 16675, "TYPE": "EQ"},
    "BPCL": {"SEC_ID": 526, "TYPE": "EQ"},
    "BEL": {"SEC_ID": 383, "TYPE": "EQ"},
    "HDFCLIFE": {"SEC_ID": 467, "TYPE": "EQ"},
    "SBILIFE": {"SEC_ID": 21808, "TYPE": "EQ"},
    "SHRIRAMFIN": {"SEC_ID": 4306, "TYPE": "EQ"},
    "TATACONSUM": {"SEC_ID": 3432, "TYPE": "EQ"},
    "TRENT": {"SEC_ID": 1964, "TYPE": "EQ"},
}

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
        # Authorization token (from env or hardcoded for now)
        self.authorization = getattr(settings, 'DHAN_AUTHORIZATION', 'RFC8mfDnhwK86NPfnQ1T94inmIIDATYT+OhOSKa7j0/Mi22GZoIYM67t8Zk0zPUCnfXk4tpC3pHrrRaw+uok/w==')
        self._current_token = None
        logger.info(f"DhanTicksService initialized (token will be loaded dynamically)")
    
    async def _get_auth_token(self) -> str:
        """Get auth token from config service (Redis -> DB -> settings fallback)"""
        try:
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
            "Bid": "DHN1804",
            "Cid": "7209683699",
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
        if symbol not in INSTRUMENT_MAP:
            logger.warning(f"Unknown symbol: {symbol}, defaulting to NIFTY")
            symbol = "NIFTY"
        
        instrument = INSTRUMENT_MAP[symbol]
        
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

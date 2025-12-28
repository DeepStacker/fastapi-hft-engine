import httpx
import asyncio
import json
from core.config.settings import get_settings
from core.logging.logger import get_logger
from core.utils.circuit_breaker import dhan_api_breaker, CircuitBreakerOpenError
from typing import Optional, Dict, Any, List

settings = get_settings()
logger = get_logger("dhan_client")


class DhanApiClient:
    """
    Client for Dhan API (ScanX) with circuit breaker protection.
    Uses TokenCacheManager for high-performance token access.
    """
    
    def __init__(self, token_cache=None):
        self.base_url = "https://scanx.dhan.co/scanx"
        self.token_cache = token_cache
        
        # Initialize with default token (will be updated async)
        self.auth_token = self._get_default_auth_token()
        
        # Headers - only use 'auth' header like option-chain-d implementation
        self.headers = {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7",
            "auth": self.auth_token,
            "content-type": "application/json",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "origin": "https://web.dhan.co",
            "referer": "https://web.dhan.co/",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        }
        
        # OPTIMIZATION: Persistent HTTP client with connection pooling
        # Reuses TCP connections for 50-100ms savings per request
        self.client = httpx.AsyncClient(
            limits=httpx.Limits(
                max_connections=50,
                max_keepalive_connections=20
            ),
            timeout=30.0
        )
    
    async def initialize(self):
        """Load tokens from cache (called after construction)."""
        if self.token_cache:
            await self._reload_tokens()
    
    async def _reload_tokens(self):
        """Reload auth token from cache (ultra-fast L1 access)."""
        if not self.token_cache:
            logger.warning("No token cache available, using default token")
            return
        
        tokens = await self.token_cache.get_dhan_tokens()
        self.auth_token = tokens["auth_token"]
        
        # Update auth header only
        self.headers["auth"] = self.auth_token
        
        # Debug: show token prefix to verify correct token is loaded
        logger.debug(f"Token reloaded - auth prefix: {self.auth_token[:50]}...")
    
    async def close(self):
        """Clean up HTTP client resources"""
        if hasattr(self, 'client') and self.client:
            await self.client.aclose()
            logger.info("HTTP client closed")
    
    def _get_default_auth_token(self):
        """Get default auth token (updated Nov 30, 2025)"""
        return "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwiZXhwIjoxNzY0NTM0ODgzLCJjbGllbnRfaWQiOiIxMTAwMjExMTIwIn0.Ka1DziA0M2U0UO0O8JWWBPvWZvd1uNPJK_4OfLfW4wdomRyaijkZZcXNKrHqHYSlfK5QC6f5JLkM8SMN6KawKQ"
    
    def _get_default_authorization_token(self):
        """Get default authorization token (updated Nov 30, 2025)"""
        return "Token eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI3MjA5NjgzNjk5Iiwicm9sZSI6IkFkbWluIiwiZXhwIjoxNzY0NTYzNjgzfQ.w8ypo185JaWrrL3zvqbh9leO6kVRknQF37oYy9wqss2sw7r5BWpxcxMw7FSh3ICmOju2OTll4aWJwpEoKPANAA"
        
    def update_tokens(self, auth_token: str = None, authorization_token: str = None):
        """Update API tokens dynamically"""
        if auth_token:
            self.auth_token = auth_token
            self.headers["auth"] = auth_token
        if authorization_token:
            self.authorization_token = authorization_token
            self.headers["authorisation"] = authorization_token
        logger.info("Dhan API tokens updated successfully")
        
    def _create_payload(self, symbol_id: int, exp: int, seg: int) -> Dict:
        return {"Data": {"Seg": seg, "Sid": symbol_id, "Exp": exp}}

    def _create_spot_payload(self, symbol_id: int, seg: int) -> Dict:
        return {"Data": {"Seg": seg, "Secid": symbol_id}}

    def _create_fut_payload(self, symbol_id: int, seg: int) -> Dict:
        return {"Data": {"Seg": seg, "Sid": symbol_id}}

    @dhan_api_breaker.call
    async def fetch_expiry_dates(self, symbol_id: int, segment_id: int) -> List[int]:
        """
        Fetch expiry dates for a symbol
        """
        # Reload tokens before each request to ensure freshness
        await self._reload_tokens()
        
        url = f"{self.base_url}/futoptsum"
        payload = self._create_fut_payload(symbol_id, segment_id)
        
        try:
            # Use persistent client with updated headers (includes fresh tokens)
            response = await self.client.post(url, headers=self.headers, json=payload, timeout=10.0)
            
            if response.status_code != 200:
                logger.error(f"Error fetching expiry for {symbol_id}: {response.status_code}")
                return []
            
            data = response.json()
            if not data or 'data' not in data:
                return []
            
            # Extract expiry list from 'opsum' keys (logic from Utils.filter_fut_data)
            # The API returns expiries as keys in 'opsum' dictionary
            response_data = data.get('data', {})
            if isinstance(response_data, str):
                logger.warning(f"Unexpected data format for {symbol_id}: {response_data}")
                return []
                
            opsum = response_data.get('opsum', {})
            if not opsum:
                return []
                
            # Extract keys and convert to current/future year
            # Dhan returns old year timestamps (2015-2020) with correct month/day
            from datetime import datetime
            current_year = datetime.now().year
            now = datetime.now()
            
            expiries = []
            for key in opsum.keys():
                if key.isdigit():
                    old_ts = int(key)
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
                    expiries.append(new_ts)
            
            # Sort expiries by date
            expiries.sort()
            
            return expiries
            
        except Exception as e:
            logger.error(f"Exception fetching expiry for {symbol_id}: {e}")
            return []

    @dhan_api_breaker.call
    async def fetch_option_chain(self, symbol_id: int, exp: int, seg: int) -> Dict:
        """
        Fetch option chain data from Dhan API.
        
        Args:
            symbol_id: Symbol ID (e.g., 13 for NIFTY)
            exp: Expiry timestamp (Unix timestamp in seconds)
            seg: Segment ID (0=Indices, 1=Equity, 2=Currency, 3=Commodity)
        
        Returns:
            Dict containing option chain data
        """
        # Reload tokens before each request to ensure freshness
        await self._reload_tokens()
        
        url = f"{self.base_url}/optchain"
        payload = self._create_payload(symbol_id, exp, seg)
        
        try:
            # OPTIMIZED: Use persistent client (connection pooling)
            response = await self.client.post(
                url,
                json=payload,
                headers=self.headers
            )
            return response.json()
        except CircuitBreakerOpenError:
            logger.error(f"Circuit breaker open, skipping {symbol_id}")
            return None
        except Exception as e:
            logger.error(f"Error fetching option chain for {symbol_id}: {e}")
            return None

    @dhan_api_breaker.call
    async def fetch_spot_data(self, symbol_id: int, segment_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch spot price data
        """
        # Reload tokens before each request to ensure freshness
        await self._reload_tokens()
        
        url = f"{self.base_url}/rtscrdt"
        payload = self._create_spot_payload(symbol_id, segment_id)
        
        try:
            # Use persistent client with updated headers (includes fresh tokens)
            response = await self.client.post(url, headers=self.headers, json=payload, timeout=10.0)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching spot data for {symbol_id}: {e}")
            return None

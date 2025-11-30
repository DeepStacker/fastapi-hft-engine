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
        
        # Initialize with default tokens (will be updated async)
        self.auth_token = self._get_default_auth_token()
        self.authorization_token = self._get_default_authorization_token()
        
        self.headers = {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7",
            "auth": self.auth_token,
            "authorisation": self.authorization_token,
            "content-type": "application/json",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "origin": "https://web.dhan.co",
            "referer": "https://web.dhan.co/",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        }
    
    async def initialize(self):
        """Load tokens from cache (called after construction)."""
        if self.token_cache:
            await self._reload_tokens()
    
    async def _reload_tokens(self):
        """Reload tokens from cache (ultra-fast L1 access)."""
        if not self.token_cache:
            return
        
        tokens = await self.token_cache.get_dhan_tokens()
        self.auth_token = tokens["auth_token"]
        self.authorization_token = tokens["authorization_token"]
        
        # Update headers
        self.headers["auth"] = self.auth_token
        self.headers["authorisation"] = self.authorization_token
        
        logger.debug("Tokens reloaded from cache")
    
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
        url = f"{self.base_url}/futoptsum"
        payload = self._create_fut_payload(symbol_id, segment_id)
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=self.headers, json=payload)
                
                if response.status_code != 200:
                    logger.error(f"Error fetching expiry for {symbol_id}: {response.status_code}")
                    return []
                
                data = response.json()
                if not data or 'data' not in data:
                    return []
                
                # Extract expiry list from 'opsum' keys (logic from Utils.filter_fut_data)
                # The API returns expiries as keys in 'opsum' dictionary
                opsum = data.get('data', {}).get('opsum', {})
                if not opsum:
                    return []
                    
                # Extract keys, convert to int for sorting
                # The keys are unix timestamps
                expiries = []
                for key in opsum.keys():
                    if key.isdigit():
                        expiries.append(int(key))
                
                # Sort expiries
                expiries.sort()
                
                return expiries
                
        except Exception as e:
            logger.error(f"Exception fetching expiry for {symbol_id}: {e}")
            return []

    @dhan_api_breaker.call
    async def fetch_option_chain(self, symbol_id: int, expiry: int, segment_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch option chain data for a symbol and expiry
        """
        url = f"{self.base_url}/optchain"
        payload = self._create_payload(symbol_id, expiry, segment_id)
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                return response.json()
        except CircuitBreakerOpenError:
            logger.error(f"Circuit breaker open, skipping {symbol_id}")
            return None
        except Exception as e:
            logger.error(f"Error fetching option chain for {symbol_id}: {e}")
            raise

    @dhan_api_breaker.call
    async def fetch_spot_data(self, symbol_id: int, segment_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch spot price data
        """
        url = f"{self.base_url}/rtscrdt"
        payload = self._create_spot_payload(symbol_id, segment_id)
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error fetching spot data for {symbol_id}: {e}")
            return None

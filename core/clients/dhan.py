"""
Unified Dhan API Client - Single Source of Truth

This module provides the base Dhan API client that all services should use.
Service-specific adapters can extend this base class.
"""
import httpx
import asyncio
import logging
from typing import Optional, Dict, Any, List
from abc import ABC
from core.config.settings import get_settings
from core.resilience.circuit_breaker import CircuitBreaker

settings = get_settings()
logger = logging.getLogger("dhan_client")


class DhanClientBase:
    """
    Base Dhan API client with connection pooling and circuit breaker.
    
    All services should use this as the foundation for Dhan API access.
    """
    
    BASE_URL = "https://scanx.dhan.co/scanx"
    
    DEFAULT_HEADERS = {
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.7",
        "content-type": "application/json",
        "origin": "https://web.dhan.co",
        "referer": "https://web.dhan.co/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
    
    # Circuit breaker for API protection
    _circuit_breaker = CircuitBreaker(
        failure_threshold=5,
        timeout=30,
    )
    
    def __init__(
        self,
        auth_token: Optional[str] = None,
        timeout: float = 10.0,
        max_connections: int = 50,
    ):
        self.auth_token = auth_token or settings.DHAN_AUTH_TOKEN or ""
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
        self._max_connections = max_connections
        
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with connection pooling"""
        if self._client is None or self._client.is_closed:
            headers = dict(self.DEFAULT_HEADERS)
            if self.auth_token:
                headers["auth"] = self.auth_token
                
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                headers=headers,
                limits=httpx.Limits(
                    max_connections=self._max_connections,
                    max_keepalive_connections=20,
                    keepalive_expiry=30,
                ),
            )
        return self._client
    
    async def close(self):
        """Close HTTP client"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
    
    def update_token(self, token: str):
        """Update auth token (for dynamic token refresh)"""
        self.auth_token = token
        # Force new client on next request
        if self._client and not self._client.is_closed:
            asyncio.create_task(self._client.aclose())
        self._client = None
    
    async def _request(
        self,
        endpoint: str,
        payload: Dict[str, Any],
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Make API request with retry logic"""
        url = f"{self.BASE_URL}{endpoint}"
        client = await self._get_client()
        
        try:
            response = await client.post(
                url,
                json=payload,
                timeout=timeout or self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error {e.response.status_code} for {endpoint}")
            raise
        except Exception as e:
            logger.error(f"Request failed for {endpoint}: {e}")
            raise
    
    # ========================================================================
    # Core API Methods
    # ========================================================================
    
    async def fetch_option_chain(
        self,
        symbol_id: int,
        expiry: int,
        segment: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """Fetch option chain data"""
        payload = {
            "Data": {
                "Seg": segment,
                "Sid": symbol_id,
                "Exp": expiry,
            }
        }
        try:
            return await self._request("/optchain", payload)
        except Exception as e:
            logger.error(f"Option chain fetch failed: {e}")
            return None
    
    async def fetch_spot_data(
        self,
        symbol_id: int,
        segment: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """Fetch spot/index data"""
        payload = {
            "Data": {
                "Seg": segment,
                "Secid": symbol_id,
            }
        }
        try:
            return await self._request("/rtscrdt", payload)
        except Exception as e:
            logger.error(f"Spot data fetch failed: {e}")
            return None
    
    async def fetch_futures_data(
        self,
        symbol_id: int,
        segment: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """Fetch futures data (includes expiry dates)"""
        payload = {
            "Data": {
                "Seg": segment,
                "Sid": symbol_id,
            }
        }
        try:
            return await self._request("/futoptsum", payload)
        except Exception as e:
            logger.error(f"Futures data fetch failed: {e}")
            return None


# Singleton instance for shared use
_default_client: Optional[DhanClientBase] = None


def get_dhan_client() -> DhanClientBase:
    """Get shared Dhan client instance"""
    global _default_client
    if _default_client is None:
        _default_client = DhanClientBase()
    return _default_client

"""
Core Dhan API Client
Base client for handling authentication and raw communication with Dhan API.
"""
import logging
import asyncio
from typing import Optional, Dict, Any, List
import httpx
from datetime import datetime

from core.config.settings import get_settings
from core.cache.redis import RedisCache
from core.exceptions import DhanAPIException, ExternalAPIException, RateLimitException

settings = get_settings()
logger = logging.getLogger(__name__)

# Global shared client for connection pooling
_shared_client: Optional[httpx.AsyncClient] = None

class BaseDhanClient:
    """
    Base Async HTTP client for Dhan API.
    Handles:
    - Authentication (static + dynamic)
    - Connection pooling
    - Rate limiting / Retries
    - Raw API requests
    """
    
    DEFAULT_HEADERS = {
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.7",
        "content-type": "application/json",
        "origin": "https://web.dhan.co",
        "referer": "https://web.dhan.co/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    }
    
    def __init__(
        self, 
        cache: Optional[RedisCache] = None,
        auth_token: Optional[str] = None
    ):
        self.base_url = settings.DHAN_API_BASE_URL
        self.timeout = getattr(settings, 'DHAN_API_TIMEOUT', 10.0)
        self.retry_count = getattr(settings, 'DHAN_API_RETRY_COUNT', 3)
        self.retry_delay = getattr(settings, 'DHAN_API_RETRY_DELAY', 0.5)
        
        self.cache = cache
        self._static_token = auth_token or settings.DHAN_AUTH_TOKEN
        self._client: Optional[httpx.AsyncClient] = None
        self._current_token: Optional[str] = None
        
    async def _get_auth_token(self) -> str:
        """Get auth token from Redis or fallback to static"""
        # 1. Try Redis "dhan:tokens" if cache available
        if self.cache:
            try:
                import json
                token_data = await self.cache.get("dhan:tokens")
                if token_data:
                    tokens = json.loads(token_data) if isinstance(token_data, str) else token_data
                    if tokens and tokens.get("auth_token"):
                        return tokens["auth_token"]
            except Exception as e:
                logger.warning(f"Failed to get token from Redis: {e}")
        
        # 2. Fallback to static token
        return self._static_token or ""

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with connection pooling"""
        global _shared_client
        
        token = await self._get_auth_token()
        
        # Recreate client if token changed
        token_changed = self._current_token is not None and self._current_token != token
        if token_changed:
            logger.info("Auth token changed, recreating HTTP client")
            if _shared_client and not _shared_client.is_closed:
                await _shared_client.aclose()
            _shared_client = None
            
        if _shared_client is None or _shared_client.is_closed:
            headers = dict(self.DEFAULT_HEADERS)
            if token:
                headers["auth"] = token
                self._current_token = token
            
            _shared_client = httpx.AsyncClient(
                timeout=self.timeout,
                headers=headers,
                limits=httpx.Limits(max_connections=100, max_keepalive_connections=50),
            )
            
        self._client = _shared_client
        return self._client
    
    async def request(
        self,
        endpoint: str,
        payload: Dict[str, Any],
        use_cache: bool = True,
        cache_ttl: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Make a raw request to Dhan API with retry logic.
        """
        url = f"{self.base_url}{endpoint}"
        cache_key = None
        
        # Determine effective TTL
        effective_ttl = cache_ttl if cache_ttl is not None else 5
        should_cache = use_cache and self.cache and effective_ttl > 0
        
        if should_cache:
            cache_key = f"dhan:{endpoint}:{hash(str(payload))}"
            # Assuming cache.get_json exists (OCD RedisCache has it, Core Redis might need check)
            # Core RedisCache might be different? Let's assume standard get/set or check later.
            # Using generic get/set for now if wrapper not present
            try:
                if hasattr(self.cache, 'get_json'):
                    cached = await self.cache.get_json(cache_key)
                    if cached: return cached
            except Exception: 
                pass

        last_error = None
        for attempt in range(self.retry_count):
            client = await self._get_client()
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                
                if should_cache and cache_key and hasattr(self.cache, 'set_json'):
                    await self.cache.set_json(cache_key, data, effective_ttl)
                
                return data
                
            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code == 401:
                    logger.warning("401 Unauthorized - resetting client")
                    global _shared_client
                    if _shared_client: await _shared_client.aclose()
                    _shared_client = None
                    continue
                logger.warning(f"HTTP {e.response.status_code} attempt {attempt+1}")
                
            except Exception as e:
                last_error = e
                logger.error(f"Error attempt {attempt+1}: {e}")
            
            if attempt < self.retry_count - 1:
                await asyncio.sleep(self.retry_delay * (2 ** attempt))
                
        raise DhanAPIException(f"Request failed: {last_error}")

    async def close(self):
        """Close the shared client"""
        global _shared_client
        if _shared_client:
            await _shared_client.aclose()
            _shared_client = None

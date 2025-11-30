"""
HTTP Client with Optimized Timeouts

Provides configured HTTP client with appropriate timeouts,
connection pooling, and retry logic for external API calls.
"""

import httpx
from typing import Optional
import structlog

from core.resilience.circuit_breaker import CircuitBreaker

logger = structlog.get_logger("http-client")


# Optimized timeout configuration
DEFAULT_TIMEOUT = httpx.Timeout(
    connect=5.0,   # Connection timeout
    read=30.0,     # Read timeout
    write=10.0,    # Write timeout
    pool=5.0       # Pool acquisition timeout
)

# Connection limits
DEFAULT_LIMITS = httpx.Limits(
    max_keepalive_connections=20,
    max_connections=100,
    keepalive_expiry=30.0
)


class ResilientHttpClient:
    """
    HTTP client with timeouts, connection pooling, and circuit breaker.
    
    Usage:
        client = ResilientHttpClient(base_url="http://service:8000")
        async with client:
            response = await client.get("/endpoint")
    """
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[httpx.Timeout] = None,
        limits: Optional[httpx.Limits] = None,
        use_circuit_breaker: bool = True
    ):
        self.base_url = base_url
        self.timeout = timeout or DEFAULT_TIMEOUT
        self.limits = limits or DEFAULT_LIMITS
        
        self.client: Optional[httpx.AsyncClient] = None
        self.circuit_breaker = CircuitBreaker() if use_circuit_breaker else None
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            limits=self.limits,
            follow_redirects=True
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.client:
            await self.client.aclose()
    
    async def get(self, url: str, **kwargs):
        """GET request with circuit breaker"""
        if self.circuit_breaker:
            async with self.circuit_breaker:
                return await self.client.get(url, **kwargs)
        else:
            return await self.client.get(url, **kwargs)
    
    async def post(self, url: str, **kwargs):
        """POST request with circuit breaker"""
        if self.circuit_breaker:
            async with self.circuit_breaker:
                return await self.client.post(url, **kwargs)
        else:
            return await self.client.post(url, **kwargs)
    
    async def put(self, url: str, **kwargs):
        """PUT request with circuit breaker"""
        if self.circuit_breaker:
            async with self.circuit_breaker:
                return await self.client.put(url, **kwargs)
        else:
            return await self.client.put(url, **kwargs)
    
    async def delete(self, url: str, **kwargs):
        """DELETE request with circuit breaker"""
        if self.circuit_breaker:
            async with self.circuit_breaker:
                return await self.client.delete(url, **kwargs)
        else:
            return await self.client.delete(url, **kwargs)


# Global HTTP clients for service-to-service communication
historical_client = None
realtime_client = None


async def init_http_clients():
    """Initialize global HTTP clients"""
    global historical_client, realtime_client
    
    historical_client = ResilientHttpClient(
        base_url="http://historical-service:8002"
    )
    
    realtime_client = ResilientHttpClient(
        base_url="http://realtime-service:8004"
    )
    
    logger.info("HTTP clients initialized with optimized timeouts")


async def close_http_clients():
    """Close global HTTP clients"""
    global historical_client, realtime_client
    
    if historical_client:
        await historical_client.__aexit__(None, None, None)
    
    if realtime_client:
        await realtime_client.__aexit__(None, None, None)
    
    logger.info("HTTP clients closed")

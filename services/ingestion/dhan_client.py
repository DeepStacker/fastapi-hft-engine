import httpx
import asyncio
from core.config.settings import get_settings
from core.logging.logger import get_logger
from core.utils.circuit_breaker import dhan_api_breaker, CircuitBreakerOpenError
from typing import Optional, Dict, Any

settings = get_settings()
logger = get_logger("dhan_client")


class DhanApiClient:
    """Client for Dhan API with circuit breaker protection"""
    
    def __init__(self):
        self.base_url = "https://api.dhan.co"
        self.client_id = settings.DHAN_CLIENT_ID
        self.access_token = settings.DHAN_ACCESS_TOKEN
        
    @dhan_api_breaker.call
    async def fetch_option_chain(self, symbol_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch option chain data for a symbol with circuit breaker protection
        
        Args:
            symbol_id: The symbol ID to fetch data for
            
        Returns:
            Dict containing option chain data or None on failure
        """
        url = f"{self.base_url}/charts/optionchain/{symbol_id}"
        headers = {
            "access-token": self.access_token,
            "client-id": self.client_id
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                return response.json()
        except CircuitBreakerOpenError:
            logger.error(f"Circuit breaker open for Dhan API, skipping request for symbol {symbol_id}")
            return None
        except httpx.TimeoutException:
            logger.error(f"Timeout fetching option chain for symbol {symbol_id}")
            raise  # Let circuit breaker count this as failure
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error {e.response.status_code} for symbol {symbol_id}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error fetching option chain: {e}")
            raise

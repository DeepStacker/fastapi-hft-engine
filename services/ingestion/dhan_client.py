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
    Matches the implementation from option-chain-d/Backend/Urls.py
    """
    
    def __init__(self):
        self.base_url = "https://scanx.dhan.co/scanx"
        # Token provided by user
        self.auth_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwiZXhwIjoxNzY0NDc2Nzg2LCJjbGllbnRfaWQiOiIxMTAwMjExMTIwIn0.wIWBFdg9q5MmQm7H3t7d8_jR-XQ7OYEb2_N7u5yXkfUleX9kXys826HgIKx2saLFqvkAdqwJopvDVW90Yzc9xg"
        
        self.headers = {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "en-US,en;q=0.7",
            "auth": self.auth_token,
            "content-type": "application/json",
            "origin": "https://web.dhan.co",
            "referer": "https://web.dhan.co/",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        }
        
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

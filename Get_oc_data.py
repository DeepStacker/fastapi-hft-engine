import os
import logging
from typing import Optional, Dict, Any, Tuple
import httpx
import asyncio
from httpx import Timeout
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables once
load_dotenv()

# Constants
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
BASE_URL = "https://scanx.dhan.co/scanx"

class OptionChainError(Exception):
    """Custom exception for option chain related errors"""
    pass

def get_required_env_vars() -> Tuple[str, str]:
    """Get required environment variables for authentication"""
    auth_token = os.getenv("AUTH_TOKEN")
    authorization_token = os.getenv("AUTHORIZATION_TOKEN")
    
    if not auth_token or not authorization_token:
        raise ValueError("AUTH_TOKEN and AUTHORIZATION_TOKEN environment variables must be set")
    
    return auth_token, authorization_token

# Initialize headers once
auth_token, authorization_token = get_required_env_vars()
headers = {
    "accept": "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.7",
    "content-type": "application/json",
    "auth": auth_token,
    "authorisation": authorization_token,
    "origin": "https://www.dhan.co",
    "referer": "https://www.dhan.co/",
    "sec-ch-ua": '"Not.A/Brand";v="8", "Chromium";v="118", "Google Chrome";v="118"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
}

async def make_request(session: httpx.AsyncClient, url: str, payload: dict) -> Dict[str, Any]:
    """Make HTTP request with retry logic"""
    timeout = Timeout(timeout=REQUEST_TIMEOUT)
    
    for attempt in range(MAX_RETRIES):
        try:
            response = await session.post(url, headers=headers, json=payload, timeout=timeout)
            
            if response.status_code == 200:
                return response.json()
                
            error_text = response.text
            content_type = response.headers.get('content-type', 'unknown')
            logger.error(f"API Error: Status {response.status_code}, Content-Type: {content_type}, Body: {error_text}")
            raise OptionChainError(f"API Error: {response.status_code}")
            
        except httpx.RequestError as e:
            logger.warning(f"Attempt {attempt + 1}/{MAX_RETRIES} failed: {str(e)}")
            if attempt == MAX_RETRIES - 1:
                raise OptionChainError(f"Service unavailable after {MAX_RETRIES} retries: {str(e)}")
            await asyncio.sleep(1 * (2**attempt))
            
        except Exception as e:
            logger.error("Unexpected error during request", exc_info=True)
            raise OptionChainError(f"An unexpected error occurred: {e}")

async def get_symbol_expiry(session: httpx.AsyncClient, symbol_seg: int, symbol_sid: int) -> Dict[str, Any]:
    """Get expiry dates for a symbol"""
    url = f"{BASE_URL}/futoptsum"
    payload = {"Data": {"Seg": symbol_seg, "Sid": symbol_sid}}
    
    data = await make_request(session, url, payload)
    logger.info(f"Successfully fetched expiry data for {symbol_seg}:{symbol_sid}")
    return data

async def get_oc_data(
    session: httpx.AsyncClient,
    symbol_seg: Optional[int],
    symbol_sid: int, 
    symbol_exp: Optional[int]
) -> Dict[str, Any]:
    """Get option chain data for a symbol"""
    # symbol_seg = 0  # Default segment
    
    if symbol_exp is None:
        try:
            expiry_data = await get_symbol_expiry(session, symbol_seg, symbol_sid)
            if (expiry_data and 
                isinstance(expiry_data.get("data"), dict) and 
                isinstance(expiry_data["data"].get("opsum"), dict) and 
                expiry_data["data"]["opsum"]):
                
                symbol_exp = int(next(iter(expiry_data["data"]["opsum"])))
                logger.info(f"Using first available expiry: {symbol_exp}")
            else:
                raise OptionChainError("Could not determine expiry date")
                
        except Exception as e:
            logger.error("Error during expiry auto-detection", exc_info=True)
            raise OptionChainError(f"Failed to auto-detect expiry: {e}")
    
    url = f"{BASE_URL}/optchain"
    payload = {"Data": {"Seg": symbol_seg, "Sid": symbol_sid, "Exp": symbol_exp}}
    
    data = await make_request(session, url, payload)
    logger.info(f"Successfully fetched OC data for {symbol_seg}:{symbol_sid}:{symbol_exp}")
    return data

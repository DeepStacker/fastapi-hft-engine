import os
from dotenv import load_dotenv
import aiohttp
import asyncio
from typing import Optional, Dict, Any
import logging
from aiohttp import ClientTimeout
from aiohttp.client_exceptions import ClientError
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Constants
REQUEST_TIMEOUT = 30  # seconds
MAX_RETRIES = 3

class OptionChainError(Exception):
    """Custom exception for option chain related errors"""
    pass

# Load environment variables from .env file
load_dotenv()

url = "https://scanx.dhan.co/scanx/optchain"
exp_url = "https://scanx.dhan.co/scanx/futoptsum"

def get_required_env_vars() -> tuple[str, str]:
    auth_token = os.getenv("AUTH_TOKEN")
    authorization_token = os.getenv("AUTHORIZATION_TOKEN")

    if not auth_token or not authorization_token:
        raise ValueError(
            "AUTH_TOKEN and AUTHORIZATION_TOKEN environment variables must be set"
        )

    return auth_token, authorization_token

auth_token, authorization_token = get_required_env_vars()

headers = {
    "accept": "*/*",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    "auth": auth_token,
    "authorisation": authorization_token,
    "origin": "https://www.dhan.co",
    "referer": "https://www.dhan.co/",
    "sec-ch-ua": '"Not.A/Brand";v="8", "Chromium";v="118", "Google Chrome";v="118"',
    "sec-ch-ua-mobile": "?0",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
}

# Remove any None values from headers
headers = {k: v for k, v in headers.items() if v is not None}

async def get_oc_data(
    session: aiohttp.ClientSession,
    symbol_seg: int,
    symbol_sid: int,
    symbol_exp: int
) -> Dict[str, Any]:
    # Configure timeout - keep this per-request if needed, or rely on session default
    timeout = ClientTimeout(total=REQUEST_TIMEOUT)

    payload = {
        "Data": {
            "Seg": symbol_seg,
            "Sid": symbol_sid,
            "Exp": symbol_exp,
        }
    }

    for attempt in range(MAX_RETRIES):
        try:
            # Use the passed-in session directly
            async with session.post(url, headers=headers, json=payload, timeout=timeout) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"Successfully fetched OC data for {symbol_seg}:{symbol_sid}:{symbol_exp}")
                    return data
                # Handle potential JSON decoding errors
                elif response.content_type != 'application/json':
                     text = await response.text()
                     logger.error(f"API Error: Unexpected content type {response.content_type}. Status: {response.status}, Body: {text}")
                     raise OptionChainError(f"API Error: {response.status} - Unexpected content type")
                else:
                    try:
                        error_data = await response.json()
                        logger.error(f"API Error: {response.status}, Response: {error_data}")
                    except Exception as json_err:
                        text = await response.text()
                        logger.error(f"API Error: {response.status}, Failed to decode JSON: {json_err}, Body: {text}")
                    raise OptionChainError(f"API Error: {response.status}")

        except (ClientError, asyncio.TimeoutError) as e:
            logger.warning(f"Attempt {attempt + 1}/{MAX_RETRIES} failed for OC data {symbol_seg}:{symbol_sid}:{symbol_exp}: {str(e)}")
            if attempt == MAX_RETRIES - 1:
                logger.error(f"Failed OC data fetch after {MAX_RETRIES} attempts: {str(e)}")
                raise OptionChainError(f"Service unavailable after multiple retries: {str(e)}")
            await asyncio.sleep(1 * (2**attempt)) # Exponential backoff with initial 1s delay
        except Exception as e: # Catch unexpected errors during request processing
             logger.error(f"Unexpected error during OC data fetch {symbol_seg}:{symbol_sid}:{symbol_exp}: {e}", exc_info=True)
             raise OptionChainError(f"An unexpected error occurred: {e}")

async def get_symbol_expiry(
    session: aiohttp.ClientSession,
    symbol_seg: int,
    symbol_sid: int
) -> Dict[str, Any]:
    # Configure timeout - keep this per-request if needed, or rely on session default
    timeout = ClientTimeout(total=REQUEST_TIMEOUT)

    payload = {
        "Data": {
            "Seg": symbol_seg,
            "Sid": symbol_sid,
        }
    }

    for attempt in range(MAX_RETRIES):
        try:
            # Use the passed-in session directly
            async with session.post(exp_url, headers=headers, json=payload, timeout=timeout) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"Successfully fetched expiry data for {symbol_seg}:{symbol_sid}")
                    return data
                # Handle potential JSON decoding errors
                elif response.content_type != 'application/json':
                     text = await response.text()
                     logger.error(f"API Error: Unexpected content type {response.content_type}. Status: {response.status}, Body: {text}")
                     raise OptionChainError(f"API Error: {response.status} - Unexpected content type")
                else:
                    try:
                        error_data = await response.json()
                        logger.error(f"API Error: {response.status}, Response: {error_data}")
                    except Exception as json_err:
                        text = await response.text()
                        logger.error(f"API Error: {response.status}, Failed to decode JSON: {json_err}, Body: {text}")
                    raise OptionChainError(f"API Error: {response.status}")

        except (ClientError, asyncio.TimeoutError) as e:
            logger.warning(f"Attempt {attempt + 1}/{MAX_RETRIES} failed for expiry data {symbol_seg}:{symbol_sid}: {str(e)}")
            if attempt == MAX_RETRIES - 1:
                logger.error(f"Failed expiry data fetch after {MAX_RETRIES} attempts: {str(e)}")
                raise OptionChainError(f"Service unavailable after multiple retries: {str(e)}")
            await asyncio.sleep(1 * (2**attempt)) # Exponential backoff with initial 1s delay
        except Exception as e: # Catch unexpected errors during request processing
             logger.error(f"Unexpected error during expiry data fetch {symbol_seg}:{symbol_sid}: {e}", exc_info=True)
             raise OptionChainError(f"An unexpected error occurred: {e}")

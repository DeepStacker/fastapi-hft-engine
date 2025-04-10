import os
from dotenv import load_dotenv
import aiohttp
import pandas as pd
import asyncio
from typing import Optional, Dict, Any, Union, Callable
import logging
from aiohttp import ClientTimeout
from cachetools import TTLCache
from datetime import datetime
import time
from dataclasses import dataclass
from aiohttp.client_exceptions import ClientError
from pathlib import Path
import numpy as np

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Constants
REQUEST_TIMEOUT = 30  # seconds
RATE_LIMIT_CALLS = 100  # calls
RATE_LIMIT_PERIOD = 60  # seconds
CACHE_TTL = 300  # 5 minutes
MAX_RETRIES = 3

# Add this after other constants
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# Initialize cache
cache = TTLCache(maxsize=100, ttl=CACHE_TTL)


@dataclass
class RateLimiter:
    max_calls: int
    time_period: int
    calls: Dict[str, list] = None

    def __post_init__(self):
        self.calls = {}

    async def acquire(self, key: str) -> bool:
        current_time = time.time()
        if key not in self.calls:
            self.calls[key] = []

        # Remove old timestamps
        self.calls[key] = [
            t for t in self.calls[key] if current_time - t < self.time_period
        ]

        if len(self.calls[key]) >= self.max_calls:
            return False

        self.calls[key].append(current_time)
        return True


rate_limiter = RateLimiter(RATE_LIMIT_CALLS, RATE_LIMIT_PERIOD)


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
    symbol_seg: int, symbol_sid: int, symbol_exp: int
) -> Dict[str, Any]:
    # Generate cache key
    cache_key = f"{symbol_seg}:{symbol_sid}:{symbol_exp}"

    # Check cache
    if cache_key in cache:
        logger.info(f"Cache hit for {cache_key}")
        return cache[cache_key]

    # Rate limiting
    if not await rate_limiter.acquire(cache_key):
        raise OptionChainError("Rate limit exceeded")

    # Configure timeout
    timeout = ClientTimeout(total=REQUEST_TIMEOUT)

    payload = {
        "Data": {
            "Seg": symbol_seg,
            "Sid": symbol_sid,
            "Exp": symbol_exp,
        }
    }

    connector = aiohttp.TCPConnector(limit=100)  # Connection pooling

    for attempt in range(MAX_RETRIES):
        try:
            async with aiohttp.ClientSession(
                connector=connector, timeout=timeout
            ) as session:
                async with session.post(url, headers=headers, json=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Store in cache
                        cache[cache_key] = data
                        logger.info(f"Successfully fetched data for {cache_key}")
                        return data
                    else:
                        text = await response.text()
                        logger.error(f"API Error: {response.status}, {text}")
                        raise OptionChainError(f"API Error: {response.status}")

        except (ClientError, asyncio.TimeoutError) as e:
            if attempt == MAX_RETRIES - 1:
                logger.error(f"Failed after {MAX_RETRIES} attempts: {str(e)}")
                raise OptionChainError(f"Service unavailable: {str(e)}")
            await asyncio.sleep(2**attempt)  # Exponential backoff


async def get_symbol_expiry(symbol_seg: int, symbol_sid: int) -> Dict[str, Any]:
    # Generate cache key
    cache_key = f"{symbol_seg}:{symbol_sid}"

    # Check cache
    if cache_key in cache:
        logger.info(f"Cache hit for {cache_key}")
        return cache[cache_key]

    # Rate limiting
    if not await rate_limiter.acquire(cache_key):
        raise OptionChainError("Rate limit exceeded")

    # Configure timeout
    timeout = ClientTimeout(total=REQUEST_TIMEOUT)

    payload = {
        "Data": {
            "Seg": symbol_seg,
            "Sid": symbol_sid,
        }
    }

    connector = aiohttp.TCPConnector(limit=100)  # Connection pooling

    for attempt in range(MAX_RETRIES):
        try:
            async with aiohttp.ClientSession(
                connector=connector, timeout=timeout
            ) as session:
                async with session.post(
                    exp_url, headers=headers, json=payload
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Store in cache
                        cache[cache_key] = data
                        logger.info(f"Successfully fetched data for {cache_key}")
                        return data
                    else:
                        text = await response.text()
                        logger.error(f"API Error: {response.status}, {text}")
                        raise OptionChainError(f"API Error: {response.status}")

        except (ClientError, asyncio.TimeoutError) as e:
            if attempt == MAX_RETRIES - 1:
                logger.error(f"Failed after {MAX_RETRIES} attempts: {str(e)}")
                raise OptionChainError(f"Service unavailable: {str(e)}")
            await asyncio.sleep(2**attempt)  # Exponential backoff


# Add these helper functions
def safe_convert(value: Any, converter: Callable, default: Any = 0) -> Any:
    """Safely convert value using the provided converter function"""
    try:
        if value is None or value == "":
            return default
        return converter(value)
    except (ValueError, TypeError):
        return default


def validate_numeric(value: Union[int, float]) -> bool:
    """Validate if value is within reasonable bounds"""
    return isinstance(value, (int, float)) and -1e10 <= value <= 1e10


async def process_expiry_data(exp_data: Dict[str, Any], symbol_sid: int) -> None:
    """Process expiry data asynchronously"""
    try:
        opsum_data = exp_data.get("data", {}).get("opsum", {})
        if not opsum_data:
            logger.error("Invalid expiry data structure")
            return

        # Define fields with validation and default values
        fields_map = {
            "expiry_timestamp": ("exp", lambda x: safe_convert(x, int, 0)),
            "pcr": ("pcr", lambda x: min(max(safe_convert(x, float, 0.0), 0.0), 100.0)),
            "atmiv": (
                "atmiv",
                lambda x: min(max(safe_convert(x, float, 0.0), 0.0), 500.0),
            ),
            "avol": ("avol", lambda x: max(safe_convert(x, int, 0), 0)),
            "ivperchnge": ("ivperchnge", lambda x: safe_convert(x, float, 0.0)),
            "lot_size": ("lot", lambda x: max(safe_convert(x, int, 1), 1)),
            "ioi": ("ioi", lambda x: max(safe_convert(x, int, 0), 0)),
            "ioi_change": ("ioichnge", lambda x: safe_convert(x, int, 0)),
            "ioi_percent_change": ("ioiperchng", lambda x: safe_convert(x, float, 0.0)),
            "open_interest": ("ooi", lambda x: max(safe_convert(x, int, 0), 0)),
            "oi_change": ("ooichnge", lambda x: safe_convert(x, int, 0)),
            "oi_percent_change": ("ooiperchng", lambda x: safe_convert(x, float, 0.0)),
            "total_ce_oi": ("tcoi", lambda x: max(safe_convert(x, int, 0), 0)),
            "total_pe_oi": ("tpoi", lambda x: max(safe_convert(x, int, 0), 0)),
            "expiry_type": ("exptype", lambda x: str(x) if x else "Unknown"),
            "symbol_id": ("sid", lambda x: safe_convert(x, int, 0)),
            "exchange": ("xch", lambda x: str(x).upper() if x else "Unknown"),
            "segment": ("seg", lambda x: str(x).upper() if x else "Unknown"),
            "display_symbol": ("d_sym", lambda x: str(x) if x else ""),
            "days_to_expiry": ("daystoexp", lambda x: max(safe_convert(x, int, 0), 0)),
            "tick_size": (
                "ticksize",
                lambda x: max(safe_convert(x, float, 0.05), 0.01),
            ),
        }

        # Process data with validation
        expiry_dates = []
        for key, value in opsum_data.items():
            try:
                record = {}
                for field, (key_name, converter) in fields_map.items():
                    val = value.get(key_name)
                    converted_val = converter(val)

                    # Additional validation for numeric fields
                    if isinstance(converted_val, (int, float)) and not validate_numeric(
                        converted_val
                    ):
                        logger.warning(f"Invalid value for {field}: {val}")
                        converted_val = fields_map[field][1](None)  # Use default

                    record[field] = converted_val

                # Add only if essential fields are valid
                if record["expiry_timestamp"] > 0 and record["symbol_id"] > 0:
                    expiry_dates.append(record)

            except Exception as e:
                logger.warning(f"Error processing record: {e}")
                continue

        if not expiry_dates:
            logger.warning("No valid expiry dates found")
            return

        # Create DataFrame with optimized dtypes
        df_exp = pd.DataFrame(expiry_dates).astype(
            {
                "pcr": "float32",
                "atmiv": "float32",
                "avol": "int32",
                "lot_size": "int16",
                "expiry_timestamp": "int64",
                "open_interest": "int32",
                "days_to_expiry": "int8",
                "tick_size": "float32",
            }
        )

        # Sort and optimize
        df_exp.sort_values("expiry_timestamp", inplace=True)

        # Use asyncio to write file without blocking
        output_file = OUTPUT_DIR / f"{symbol_sid}_exp_date_data.csv"
        try:
            await asyncio.to_thread(
                df_exp.to_csv,
                output_file,
                index=False,
                float_format="%.4f",  # Increased precision for financial data
                compression=(
                    "gzip" if df_exp.memory_usage(deep=True).sum() > 1e6 else None
                ),  # Compress if large
            )
            logger.info(f"Expiry data saved to {output_file}")
        except Exception as e:
            logger.error(f"Failed to save expiry data: {e}")

    except Exception as e:
        logger.error(f"Error processing expiry data: {str(e)}")
        raise


async def main():
    try:
        start_time = time.time()
        symbol_seg = 0
        symbol_sid = 13
        symbol_exp = 1429295400

        # Get both data concurrently
        oc_task = asyncio.create_task(get_oc_data(symbol_seg, symbol_sid, symbol_exp))
        exp_task = asyncio.create_task(get_symbol_expiry(symbol_seg, symbol_sid))

        # Wait for both tasks to complete
        oc_data, exp_data = await asyncio.gather(
            oc_task, exp_task, return_exceptions=True
        )

        # Process option chain data (existing code)
        if isinstance(oc_data, dict):
            if oc_data and "data" in oc_data and "oc" in oc_data["data"]:
                try:
                    option_chain = oc_data["data"]["oc"]

                    # Convert to DataFrame
                    df_oc = pd.DataFrame(
                        [
                            {
                                "Strike Price": float(strike),
                                # Call Option (CE) Data
                                "CE Symbol": details["ce"]["disp_sym"],
                                "CE Open Interest": details["ce"]["OI"],
                                "CE OI Change": details["ce"]["oichng"],
                                "CE Implied Volatility": details["ce"]["iv"],
                                "CE Last Traded Price": details["ce"]["ltp"],
                                "CE Volume": details["ce"]["vol"],
                                "CE Delta": details["ce"]["optgeeks"]["delta"],
                                "CE Theta": details["ce"]["optgeeks"]["theta"],
                                "CE Gamma": details["ce"]["optgeeks"]["gamma"],
                                "CE Vega": details["ce"]["optgeeks"]["vega"],
                                "CE Rho": details["ce"]["optgeeks"]["rho"],
                                "CE Theoretical Price": details["ce"]["optgeeks"][
                                    "theoryprc"
                                ],
                                "CE Bid Price": details["ce"]["bid"],
                                "CE Ask Price": details["ce"]["ask"],
                                "CE Bid Quantity": details["ce"]["bid_qty"],
                                "CE Ask Quantity": details["ce"]["ask_qty"],
                                "CE Moneyness": details["ce"]["mness"],
                                # Put Option (PE) Data
                                "PE Symbol": details["pe"]["disp_sym"],
                                "PE Open Interest": details["pe"]["OI"],
                                "PE OI Change": details["pe"]["oichng"],
                                "PE Implied Volatility": details["pe"]["iv"],
                                "PE Last Traded Price": details["pe"]["ltp"],
                                "PE Volume": details["pe"]["vol"],
                                "PE Delta": details["pe"]["optgeeks"]["delta"],
                                "PE Theta": details["pe"]["optgeeks"]["theta"],
                                "PE Gamma": details["pe"]["optgeeks"]["gamma"],
                                "PE Vega": details["pe"]["optgeeks"]["vega"],
                                "PE Rho": details["pe"]["optgeeks"]["rho"],
                                "PE Theoretical Price": details["pe"]["optgeeks"][
                                    "theoryprc"
                                ],
                                "PE Bid Price": details["pe"]["bid"],
                                "PE Ask Price": details["pe"]["ask"],
                                "PE Bid Quantity": details["pe"]["bid_qty"],
                                "PE Ask Quantity": details["pe"]["ask_qty"],
                                "PE Moneyness": details["pe"]["mness"],
                                # Additional Metrics
                                "Open Interest PCR": details["oipcr"],
                                "Volume PCR": details["volpcr"],
                                "Max Pain Loss": details["mploss"],
                                "Expiry Type": details["exptype"],
                            }
                            for strike, details in option_chain.items()
                        ]
                    )

                    # Save to CSV
                    output_file = OUTPUT_DIR / f"{symbol_sid}_oc_data.csv"
                    await asyncio.to_thread(df_oc.to_csv, output_file, index=False)
                    logger.info(f"Option chain data saved to {output_file}")
                except Exception as e:
                    logger.error(f"Error processing option chain data: {str(e)}")

        # Process expiry data
        if isinstance(exp_data, dict):
            await process_expiry_data(exp_data, symbol_sid)

        total_time = time.time() - start_time
        logger.info(f"All requests completed in {total_time:.2f} seconds")

    except OptionChainError as e:
        logger.error(f"Option chain error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")


if __name__ == "__main__":
    asyncio.run(main())

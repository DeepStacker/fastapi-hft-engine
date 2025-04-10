import asyncio
from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from typing import Optional, Dict, Any
import uvicorn
from pydantic import BaseModel, Field
import pandas as pd
import redis.asyncio as redis
import prometheus_client
import prometheus_fastapi_instrumentator
import logging
import time
import orjson
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import aiohttp
from Get_oc_data import (
    get_oc_data,
    get_symbol_expiry,
    OptionChainError,
    OUTPUT_DIR,
)

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Redis setup with timeout
REDIS_URLS = [
    "redis://localhost:6379",  # Default Redis/Memurai
    "redis://127.0.0.1:6379",  # Alternative localhost
    "redis://172.17.0.1:6379"  # WSL2 default IP
]
REDIS_TIMEOUT = 5  # seconds
REDIS_CACHE_TTL = 300  # 5 minutes cache

async def get_redis_connection():
    """Try multiple Redis connection URLs with timeout"""
    last_error = None
    for url in REDIS_URLS:
        try:
            pool = redis.ConnectionPool.from_url(
                url,
                max_connections=100,
                socket_timeout=REDIS_TIMEOUT,
                socket_connect_timeout=REDIS_TIMEOUT,
            )
            client = redis.Redis(connection_pool=pool)
            # Test connection
            await asyncio.wait_for(client.ping(), timeout=REDIS_TIMEOUT)
            logger.info(f"Successfully connected to Redis at {url}")
            return client
        except (redis.ConnectionError, asyncio.TimeoutError) as e:
            last_error = e
            logger.warning(f"Failed to connect to Redis at {url}: {e}")
            continue
        except Exception as e:
            last_error = e
            logger.error(f"Unexpected error connecting to Redis at {url}: {e}")
            continue

    logger.error(f"Could not connect to any Redis server: {last_error}")
    return (
        None  # Return None instead of raising error to allow app to run without Redis
    )


async def get_cached_data(redis_client: redis.Redis, cache_key: str) -> Optional[Dict]:
    """Get data from Redis cache with improved error handling"""
    if not redis_client:
        return None
    try:
        data = await redis_client.get(cache_key)
        if data:
            logger.info(f"Cache hit for {cache_key}")
            return orjson.loads(data)
        logger.info(f"Cache miss for {cache_key}")
        return None
    except Exception as e:
        logger.error(f"Redis get error: {e}")
        return None

async def set_cached_data(redis_client: redis.Redis, cache_key: str, data: Dict):
    """Set data in Redis cache with compression"""
    if not redis_client:
        return
    try:
        # Compress and cache the data
        compressed_data = orjson.dumps(data)
        await redis_client.setex(cache_key, REDIS_CACHE_TTL, compressed_data)
        logger.info(f"Cached data for {cache_key}")
    except Exception as e:
        logger.error(f"Redis set error: {e}")


# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

# Prometheus metrics
REQUEST_TIME = prometheus_client.Summary(
    "request_processing_seconds", "Time spent processing request"
)
REQUESTS_TOTAL = prometheus_client.Counter("requests_total", "Total requests")


# Lifecycle events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up application...")
    try:
        app.state.redis = await get_redis_connection()
    except ConnectionError as e:
        logger.warning(f"Redis unavailable: {e}. Running without cache.")
        app.state.redis = None

    app.state.http_session = aiohttp.ClientSession()
    yield

    # Shutdown
    logger.info("Shutting down application...")
    if app.state.redis:
        await app.state.redis.close()
    await app.state.http_session.close()


app = FastAPI(
    title="Option Chain API",
    description="Production-ready API for fetching option chain and expiry data",
    version="1.0.0",
    lifespan=lifespan,
    default_response_class=JSONResponse,
)

# Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

# Metrics instrumentation
Prometheus = prometheus_fastapi_instrumentator.Instrumentator()
Prometheus.instrument(app).expose(app, include_in_schema=False)


# Input validation models
class SymbolParams(BaseModel):
    symbol_seg: int = Field(..., description="Symbol segment", ge=0)
    symbol_sid: int = Field(..., description="Symbol ID", ge=0)
    symbol_exp: Optional[int] = Field(None, description="Expiry timestamp")

    class Config:
        json_encoders = {pd.DataFrame: lambda df: df.to_dict(orient="records")}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/api/option-chain", response_model=Dict[str, Any])
@limiter.limit("100/minute")
async def get_option_chain(
    request: Request,
    symbol_seg: int = Query(..., description="Symbol segment"),
    symbol_sid: int = Query(..., description="Symbol ID"),
    symbol_exp: Optional[int] = Query(None, description="Expiry timestamp"),
):
    """Get option chain data for a symbol with Redis caching"""
    start_time = time.time()
    cache_key = f"oc:{symbol_seg}:{symbol_sid}:{symbol_exp}:{int(time.time() // 5)}"

    try:
        # Try to get from cache first
        cached_data = await get_cached_data(request.app.state.redis, cache_key)
        if cached_data:
            cached_data["metadata"]["from_cache"] = True
            cached_data["metadata"]["cache_time"] = time.time() - start_time
            return cached_data

        # Get fresh data if not in cache
        data = await get_oc_data(symbol_seg, symbol_sid, symbol_exp)
        if not data or "data" not in data or "oc" not in data["data"]:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "No option chain data found"}
            )

        # Process the data
        records = []
        for strike, details in data["data"]["oc"].items():
            record = {
                "Strike Price": float(strike),
                "CE": {
                    "Symbol": details["ce"]["disp_sym"],
                    "Open Interest": details["ce"]["OI"],
                    "OI Change": details["ce"]["oichng"],
                    "Implied Volatility": details["ce"]["iv"],
                    "Last Traded Price": details["ce"]["ltp"],
                    "Volume": details["ce"]["vol"],
                    "Delta": details["ce"]["optgeeks"]["delta"],
                    "Theta": details["ce"]["optgeeks"]["theta"],
                    "Gamma": details["ce"]["optgeeks"]["gamma"],
                    "Vega": details["ce"]["optgeeks"]["vega"],
                    "Rho": details["ce"]["optgeeks"]["rho"],
                    "Theoretical Price": details["ce"]["optgeeks"]["theoryprc"],
                    "Bid Price": details["ce"]["bid"],
                    "Ask Price": details["ce"]["ask"],
                    "Bid Quantity": details["ce"]["bid_qty"],
                    "Ask Quantity": details["ce"]["ask_qty"],
                    "Moneyness": details["ce"]["mness"],
                },
                "PE": {
                    "Symbol": details["pe"]["disp_sym"],
                    "Open Interest": details["pe"]["OI"],
                    "OI Change": details["pe"]["oichng"],
                    "Implied Volatility": details["pe"]["iv"],
                    "Last Traded Price": details["pe"]["ltp"],
                    "Volume": details["pe"]["vol"],
                    "Delta": details["pe"]["optgeeks"]["delta"],
                    "Theta": details["pe"]["optgeeks"]["theta"],
                    "Gamma": details["pe"]["optgeeks"]["gamma"],
                    "Vega": details["pe"]["optgeeks"]["vega"],
                    "Rho": details["pe"]["optgeeks"]["rho"],
                    "Theoretical Price": details["pe"]["optgeeks"]["theoryprc"],
                    "Bid Price": details["pe"]["bid"],
                    "Ask Price": details["pe"]["ask"],
                    "Bid Quantity": details["pe"]["bid_qty"],
                    "Ask Quantity": details["pe"]["ask_qty"],
                    "Moneyness": details["pe"]["mness"],
                },
                "OI PCR": details["oipcr"],
                "Volume PCR": details["volpcr"],
                "Max Pain Loss": details["mploss"],
                "Expiry Type": details["exptype"],
            }
            records.append(record)

        # Create response with cache metadata
        response_data = {
            "status": "success",
            "data": records,
            "metadata": {
                "symbol_seg": symbol_seg,
                "symbol_sid": symbol_sid,
                "symbol_exp": symbol_exp,
                "total_strikes": len(records),
                "processing_time": f"{time.time() - start_time:.3f}s",
                "from_cache": False,
                "cached_at": int(time.time())
            }
        }

        # Cache the response
        await set_cached_data(request.app.state.redis, cache_key, response_data)
        return response_data

    except Exception as e:
        logger.error(f"Error: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )


@app.get("/api/expiry-dates", response_model=Dict[str, Any])
@limiter.limit("100/minute")
async def get_expiry_dates(
    request: Request,
    symbol_seg: int = Query(..., description="Symbol segment"),
    symbol_sid: int = Query(..., description="Symbol ID")
):
    """Get expiry dates for a symbol with Redis caching"""
    start_time = time.time()
    cache_key = f"exp:{symbol_seg}:{symbol_sid}:{int(time.time() // 5)}"

    try:
        # Try to get from cache first
        cached_data = await get_cached_data(request.app.state.redis, cache_key)
        if cached_data:
            cached_data["metadata"]["from_cache"] = True
            cached_data["metadata"]["cache_time"] = time.time() - start_time
            return cached_data

        # Get data from API
        data = await get_symbol_expiry(symbol_seg, symbol_sid)
        if not data or "data" not in data or "opsum" not in data["data"]:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "No expiry data found"},
            )

        # Process data
        expiry_data = [
            {
                "expiry_timestamp": value.get("exp", 0),
                "pcr": value.get("pcr", 0.0),
                "total_ce_oi": value.get("tcoi", 0),
                "total_pe_oi": value.get("tpoi", 0),
                "days_to_expiry": value.get("daystoexp", 0),
            }
            for value in data["data"]["opsum"].values()
        ]

        # Create response with cache metadata
        response_data = {
            "status": "success",
            "data": expiry_data,
            "metadata": {
                "symbol_seg": symbol_seg,
                "symbol_sid": symbol_sid,
                "total_expiries": len(expiry_data),
                "processing_time": f"{time.time() - start_time:.3f}s",
                "from_cache": False,
                "cached_at": int(time.time())
            }
        }

        # Cache the response
        await set_cached_data(request.app.state.redis, cache_key, response_data)
        return response_data

    except Exception as e:
        logger.error(f"Error: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )


async def save_to_csv(data: list, symbol_sid: int, data_type: str):
    """Save data to CSV file asynchronously"""
    try:
        df = pd.DataFrame(data)
        filename = f"{symbol_sid}_{data_type}_data.csv"
        await asyncio.to_thread(df.to_csv, OUTPUT_DIR / filename, index=False)
        logger.info(f"Data saved to {filename}")
    except Exception as e:
        logger.error(f"Error saving CSV: {e}")


# Exception handlers
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": str(exc),
            "type": exc.__class__.__name__,
        },
    )


if __name__ == "__main__":
    import multiprocessing
    import platform
    import signal

    # Determine optimal worker count based on platform
    workers = min(multiprocessing.cpu_count() * 2 + 1, 8)  # Cap at 8 workers

    # Windows-specific configuration
    config_args = {
        "app": "app:app",
        "host": "0.0.0.0",
        "port": 8000,
        "workers": (
            1 if platform.system() == "Windows" else workers
        ),  # Single worker on Windows
        "loop": "asyncio",  # Use asyncio instead of uvloop
        "http": "httptools",
        "limit_concurrency": 500,
        "limit_max_requests": 50000,
        "timeout_keep_alive": 30,
        "access_log": True,
        "log_level": "info",
        "proxy_headers": True,
        "forwarded_allow_ips": "*",
        "reload": True,  # Enable auto-reload during development
    }

    try:
        uvicorn.run(**config_args)
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise

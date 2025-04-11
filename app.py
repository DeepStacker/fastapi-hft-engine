import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
# Removed unused imports like HTTPException, Query, Depends, BaseModel, Field, pd
import uvicorn
# Removed redis.asyncio import, now handled in core.redis_client
import prometheus_client
import prometheus_fastapi_instrumentator
import logging
# Removed time import if not used directly here
import orjson # Keep if used for default response class or elsewhere
# Remove Limiter import from slowapi here if only used for definition
from slowapi import _rate_limit_exceeded_handler # Import handler directly
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import aiohttp

# Import from new modules
from core.redis_client import get_redis_connection # Import connection function
from core.limiter import limiter # Import the limiter instance
from api.routes import router as api_router # Import the API router
from utils.csv_saver import save_to_csv # Import utility function if needed globally

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Prometheus metrics (keep as is)
REQUEST_TIME = prometheus_client.Summary(
    "request_processing_seconds", "Time spent processing request"
)
REQUESTS_TOTAL = prometheus_client.Counter("requests_total", "Total requests")


# Lifecycle events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up application...")
    # Use imported function for Redis connection
    app.state.redis = await get_redis_connection()
    if not app.state.redis:
         logger.warning("Redis unavailable. Running without cache.")
    # Keep aiohttp session management
    app.state.http_session = aiohttp.ClientSession()
    yield

    # Shutdown
    logger.info("Shutting down application...")
    if app.state.redis:
        await app.state.redis.close()
    if app.state.http_session: # Check if session exists before closing
        await app.state.http_session.close()


app = FastAPI(
    title="Option Chain API",
    description="Production-ready API for fetching option chain and expiry data",
    version="1.0.0",
    lifespan=lifespan,
    default_response_class=JSONResponse, # Consider OrjsonResponse for performance
)

# Middleware setup (keep as is)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

# Metrics instrumentation (keep as is)
Prometheus = prometheus_fastapi_instrumentator.Instrumentator()
Prometheus.instrument(app).expose(app, include_in_schema=False)

# Include the API router
app.include_router(api_router)

# Exception handlers
# Use the imported handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True) # Log stack trace
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "An unexpected internal server error occurred.",
            # Optionally include error type in non-production environments
            # "type": exc.__class__.__name__,
            # "detail": str(exc)
        },
    )


if __name__ == "__main__":
    import multiprocessing
    import platform
    # Removed signal import if not used

    # Determine optimal worker count based on platform
    workers = min(multiprocessing.cpu_count() * 2 + 1, 8)  # Cap at 8 workers

    # Windows-specific configuration (keep as is)
    config_args = {
        "app": "app:app", # Uvicorn needs the app instance location
        "host": "0.0.0.0",
        "port": 8000,
        "workers": (
            1 if platform.system() == "Windows" else workers
        ),
        "loop": "asyncio", # Consider 'uvloop' on Linux for performance
        "http": "httptools",
        "limit_concurrency": 500,
        "limit_max_requests": 50000,
        "timeout_keep_alive": 30,
        "access_log": True,
        "log_level": "info",
        "proxy_headers": True,
        "forwarded_allow_ips": "*",
        "reload": True, # Set to False for production
    }

    try:
        uvicorn.run(**config_args)
    except Exception as e:
        logger.error(f"Server startup error: {e}", exc_info=True)
        raise

import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
# Removed JSONResponse import if not needed directly
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import uvicorn
import prometheus_client
import prometheus_fastapi_instrumentator
import logging
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import aiohttp
import os # Added for environment variables
import json # Added for JSON parsing
from core.config import settings # Import settings from your configuration module

# Import Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials, auth

# Import from new modules
from core.redis_client import get_redis_connection
from api.routes import router as api_router
from api.auth import router as auth_router # Keep auth router for /users/me
# Import database engine and Base for table creation
from core.database import engine, Base
# Import your DB models so Base knows about them
from models import db_models
# Import limiter
from core.limiter import limiter

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


# --- Function to Create Tables ---
async def init_db():
    async with engine.begin() as conn:
        # This creates tables based on models inheriting from Base
        # Use drop_all cautiously only during development if needed
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    # Dispose engine is usually not needed here as lifespan manages connections
    # await engine.dispose()
    logger.info("Database tables checked/created.")


async def init_firebase(app: FastAPI):
    """Initialize Firebase Admin SDK with service account credentials"""
    try:
        # Check if we have the service account credentials in settings
        if settings.FIREBASE_CREDENTIALS_JSON:
            try:
                cred_dict = {
                    "type": "service_account",
                    "project_id": settings.FIREBASE_PROJECT_ID,
                    "private_key": settings.FIREBASE_PRIVATE_KEY.replace('\\n', '\n'),
                    "client_email": settings.FIREBASE_CLIENT_EMAIL,
                    "client_id": settings.FIREBASE_CLIENT_ID,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": settings.FIREBASE_CLIENT_CERT_URL,
                    "universe_domain": "googleapis.com"
                }
                
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin SDK initialized successfully with service account.")
                app.state.firebase_initialized = True
                
                # Store client config for frontend
                app.state.firebase_config = {
                    'apiKey': settings.FIREBASE_API_KEY,
                    'authDomain': settings.FIREBASE_AUTH_DOMAIN,
                    'projectId': settings.FIREBASE_PROJECT_ID,
                    'storageBucket': settings.FIREBASE_STORAGE_BUCKET,
                    'messagingSenderId': settings.FIREBASE_MESSAGING_SENDER_ID,
                    'appId': settings.FIREBASE_APP_ID,
                    'measurementId': settings.FIREBASE_MEASUREMENT_ID
                }
                return
            except Exception as e:
                logger.error(f"Failed to initialize Firebase with service account: {e}", exc_info=True)
        
        logger.warning("Firebase credentials not found in settings.")
        app.state.firebase_initialized = False

    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}", exc_info=True)
        app.state.firebase_initialized = False


# Lifecycle events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up application...")

    # Initialize Firebase Admin SDK
    await init_firebase(app)

    # Create DB tables
    await init_db()

    # Use imported function for Redis connection
    app.state.redis = await get_redis_connection()
    if not app.state.redis:
         logger.warning("Redis unavailable. Running without cache.")
    # Keep aiohttp session management
    app.state.http_session = aiohttp.ClientSession()
    logger.info("Application startup complete.") # Move log after setup
    yield

    # Shutdown
    logger.info("Shutting down application...")
    if hasattr(app.state, 'redis') and app.state.redis:
        await app.state.redis.close()
    if hasattr(app.state, 'http_session') and app.state.http_session: # Check if session exists before closing
        await app.state.http_session.close()
    # Dispose of the engine pool on shutdown (good practice)
    await engine.dispose()
    logger.info("Application shutdown complete.")


app = FastAPI(
    title="Option Chain API",
    description="Production-ready API for fetching option chain and expiry data with Firebase Auth",
    version="1.1.0",
    lifespan=lifespan,
    # default_response_class=JSONResponse, # Consider OrjsonResponse for performance
)

# Attach limiter state to app
app.state.limiter = limiter

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

# Include the API routers
app.include_router(auth_router, tags=["Authentication"]) # Keep for /users/me
app.include_router(api_router, tags=["Option Chain"]) # Add existing routes

# Exception handlers
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True) # Log stack trace
    # Avoid importing JSONResponse if not used elsewhere
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "An unexpected internal server error occurred.",
        },
    )


if __name__ == "__main__":
    import multiprocessing
    import platform

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

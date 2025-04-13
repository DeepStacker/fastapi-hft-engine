from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
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
from core.config import settings

# Import Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials, auth

# Import from new modules
from core.redis_client import get_redis_connection
from api.routes import router as api_router
from api.auth import router as auth_router
from core.database import engine, Base

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
        # await conn.run_sync(Base.metadata.drop_all)  # Uncommented to allow dropping tables
        await conn.run_sync(Base.metadata.create_all)
    # Dispose engine is usually not needed here as lifespan manages connections
    # await engine.dispose()
    logger.info("Database tables checked/created.")


async def init_firebase(app: FastAPI):
    """Initialize Firebase Admin SDK with service account credentials"""
    try:
        # Check if we have the service account credentials in settings
        if settings:
            try:
                cred_dict = {
                    "type": "service_account",
                    "project_id": "true-false-c6b46",
                    "private_key_id": "6834fad60b83c663e4f5601bfbb8ca8e034c2490",
                    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCmvS3/WG4jGxyk\njCe+colmHQnGLznEdpjmd/AmFuGsDU7UE5KlA2wUk7ekR77eCleWI4XwbPu+5Orm\nuEdBQF80XzEO5MXHjuraNHuBOrU4dyIi8JKY07alSaI23bIysYoLSwM5QLCaVM5s\n1gB0bw66LXm6hFV86eFaVjpGOS34xAEQmBXlELitM6yw4tMIL3oMywTgpMtj4AMt\nzpibsztA1nm9O55FcO/jQK2cuyJj/YfnupOIJPKZYfp6BEl75BJNmp5INozC31C3\nLw71JnFWZUSSf7iJ/2DesgU0qaBPTzzCEJoOVLy036Pnjv0PlCEE8iWF5N1zDQmq\nVIPTcFi1AgMBAAECggEACZfHvjGdwIpORw9DOBtJ2WShS9QqvClgmZ3b5K0bVbU8\nTEpF/RVp0fM/tQVlr0ukB2DK027Juw1bkGOYweHMuGwjm+pAkL8htuUfF+vDQljk\nT2NM49sGXpMScJqnpm/9c7HgoRoeLvrjF3Lmesxq6f40yyzS6ElibDqaxrCCexXf\n3k/g3zzhRjTKemwyjNxqynt2R/XlIhKmbNKqTwY/PLt7ZPmEarPzhe4UjivyPqxG\n++migXwqD5fSh5oGU4A7egr8EEGsHgaXuoTeBj0j+7HVvvUuA/tLTyGapPWG66BK\n3FFt6elwqCxO9uD5kyW6G6zs+s4ZLsa95fZAsAronwKBgQDkvh8F6mPXzYyfJ1Su\nVY4uKAUtr6LNF7Fh0debp8jBWV79fcvvrIkgaPjzSR+V9594jgi97Y646tJn2vIr\nEeSP2w2euNmR7f6Zx22TQsP8o2LfYp9oJ2MnyMy2xwwPy3vqcfMflRg1Qpyzlxcc\nKs9p6TCGgQEC5wJjUaweVXn0QwKBgQC6m50RiGyL7jYyshOyFhCz4eduVQOvM5Wy\nIZo74QmFRy88ZR/PcZpcO6xq+T0T3eMf3rpTrXvyVxXcmUMTjI2MaM919BH2vo9T\nFq/2lJnpUis0WavDwz0MNi+Zahtzcf0LUhkvbQZyFeRZ2F2BFbNZwjvbQrzQinwx\nc0vpoW5rpwKBgG4wL52X5XTFbaIVPjOkvxL48FWrr88ARNCMV0KCNrD9LkcKXD0e\nbggQySvY48BIQqe+M/PaBdCKPcUNsW6R9fpeWVdGUHh9nxHRAbXYibSfuDdHuOZh\nYuB9WDAL/oF1UkIDlkx2c+zkI7xXYiiNbtDkJh4E8snFIl9ZroIGRvMlAoGBAJUr\nskqCuOq/GPo7mj0BIIb7bgqn0RMr9F16ORXm1bqB5gOsftpQYOmcFj9JUAbimB4w\n6NfdVbiq3uICbjlhYQG+AyGyYu3Q9TehajZ+Ie7+7WSizgjmuJVbd39278zAcVys\nW0+rIrzuPSWJLW30D/QPrdOfrNoz6gWJukRf9Kn/AoGAPDIxTQG2ErOCCqup0Ems\nPUNvNAAt4l9yptRJYUOP34OHGa1xqYor6aHeswBZeyb43nTrxYS+OycSNLNPASp3\nw923U/Ro3jEBE3gcEw/afBtTie9rlG8BkSt+W6X+r0kjfNRgpgM1sJBR7iyZHud0\nk3cxLUccxe58Nz/oYLBMr2g=\n-----END PRIVATE KEY-----\n",
                    "client_email": "firebase-adminsdk-9x6kb@true-false-c6b46.iam.gserviceaccount.com",
                    "client_id": "115808014897084923435",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-9x6kb%40true-false-c6b46.iam.gserviceaccount.com",
                    "universe_domain": "googleapis.com",
                }

                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                logger.info(
                    "Firebase Admin SDK initialized successfully with service account."
                )
                app.state.firebase_initialized = True

                # Store client config for frontend
                app.state.firebase_config = {
                    "apiKey": settings.FIREBASE_API_KEY,
                    "authDomain": settings.FIREBASE_AUTH_DOMAIN,
                    "projectId": settings.FIREBASE_PROJECT_ID,
                    "storageBucket": settings.FIREBASE_STORAGE_BUCKET,
                    "messagingSenderId": settings.FIREBASE_MESSAGING_SENDER_ID,
                    "appId": settings.FIREBASE_APP_ID,
                    "measurementId": settings.FIREBASE_MEASUREMENT_ID,
                }
                return
            except Exception as e:
                logger.error(
                    f"Failed to initialize Firebase with service account: {e}",
                    exc_info=True,
                )

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
    logger.info("Application startup complete.")  # Move log after setup
    yield

    # Shutdown
    logger.info("Shutting down application...")
    if hasattr(app.state, "redis") and app.state.redis:
        await app.state.redis.close()
    if (
        hasattr(app.state, "http_session") and app.state.http_session
    ):  # Check if session exists before closing
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
app.include_router(auth_router, tags=["Authentication"])  # Keep for /users/me
app.include_router(api_router, tags=["Option Chain"])  # Add existing routes

# Exception handlers
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)  # Log stack trace
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
        "app": "app:app",  # Uvicorn needs the app instance location
        "host": "0.0.0.0",
        "port": 8000,
        "workers": (1 if platform.system() == "Windows" else workers),
        "loop": "asyncio",  # Consider 'uvloop' on Linux for performance
        "http": "httptools",
        "limit_concurrency": 500,
        "limit_max_requests": 50000,
        "timeout_keep_alive": 30,
        "access_log": True,
        "log_level": "info",
        "proxy_headers": True,
        "forwarded_allow_ips": "*",
        "reload": True,  # Set to False for production
    }

    try:
        uvicorn.run(**config_args)
    except Exception as e:
        logger.error(f"Server startup error: {e}", exc_info=True)
        raise

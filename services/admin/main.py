"""
Stockify Admin Application - Refactored & Modular

Complete admin panel backend with organized routers and real metrics.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
import os
import logging

# Import routers
from services.admin.routers import (
    system_router,
    kafka_router,
    instruments_router,
    services_router,
    database_router,
    config_router,
    auth_router,
    docker_router,
    logs_router,
    metrics_router,
    deployment_router,
    dhan_tokens_router,
    traders_router,
    audit_router,
    notifications_router
)

# Import services for lifecycle management
from services.admin.services import kafka_manager
from core.database.pool import db_pool
from core.rate_limiting.auth_limiter import get_auth_limiter
import redis.asyncio as redis
from core.config.settings import get_settings

logger = logging.getLogger("stockify.admin")
settings = get_settings()

# Redis client for Pub/Sub
redis_pubsub_client: redis.Redis = None

# Create FastAPI app
admin_app = FastAPI(
    title="Stockify Admin API",
    description="Comprehensive admin dashboard backend",
    version="2.0.0"
)

# CORS is handled by nginx gateway - do not add CORSMiddleware here
# to avoid duplicate Access-Control-Allow-Origin headers

# Include routers (auth first - has public endpoints)
admin_app.include_router(auth_router)  # Public login endpoint
admin_app.include_router(system_router)
admin_app.include_router(kafka_router)
admin_app.include_router(instruments_router)
admin_app.include_router(services_router)
admin_app.include_router(database_router)
admin_app.include_router(config_router)
admin_app.include_router(docker_router)
admin_app.include_router(logs_router)
admin_app.include_router(metrics_router)
admin_app.include_router(deployment_router)
admin_app.include_router(dhan_tokens_router)
admin_app.include_router(traders_router)
admin_app.include_router(audit_router)
admin_app.include_router(notifications_router)

# Root endpoint
@admin_app.get("/")
async def root():
    """API root information"""
    return {
        "app": "Stockify Admin API",
        "version": "2.0.0",
        "frontend": "http://localhost:3000",
        "docs": "/docs",
        "status": "operational"
    }

# Health check
@admin_app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

# Startup event
@admin_app.on_event("startup")
async def startup():
    """Initialize services on startup"""
    global redis_pubsub_client
    
    logger.info("Starting Stockify Admin Application...")
    
    try:
        # Initialize Database Pool
        await db_pool.initialize()
        logger.info("Database pool initialized")
        
        # Seed default configurations
        try:
            from services.admin.services.seed_configs import seed_default_configs
            result = await seed_default_configs()
            if result["created"] > 0:
                logger.info(f"Seeded {result['created']} default configurations")
        except Exception as seed_error:
            logger.warning(f"Configuration seeding failed: {seed_error}")
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {e}")
        # Critical failure - let it crash or handle graceful degradation?
        # For admin, maybe better to crash so it's noticed immediately.
        # But for now logging is enough as we have other services.
    
    try:
        # Initialize Redis for pub/sub
        redis_pubsub_client = await redis.from_url(settings.REDIS_URL)
        logger.info("Redis connection established")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
    
    try:
        # Initialize Kafka manager
        await kafka_manager.connect()
        logger.info("Kafka manager initialized")
    except Exception as e:
        logger.warning(f"Kafka manager initialization failed: {e}")
    
    try:
        # Initialize auth rate limiter
        auth_limiter = get_auth_limiter(settings.REDIS_URL)
        await auth_limiter.init_redis()
        logger.info("Auth rate limiter initialized")
    except Exception as e:
        logger.warning(f"Auth rate limiter initialization failed: {e}")
    
    logger.info("Admin application startup complete")

# Shutdown event
@admin_app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    global redis_pubsub_client
    
    logger.info("Shutting down Admin Application...")
    
    if redis_pubsub_client:
        await redis_pubsub_client.close()
        logger.info("Redis connection closed")
        
    try:
        await db_pool.close()
        logger.info("Database pool closed")
    except Exception as e:
        logger.warning(f"Database pool cleanup failed: {e}")
    
    try:
        await kafka_manager.close()
        logger.info("Kafka manager closed")
    except Exception as e:
        logger.warning(f"Kafka manager cleanup failed: {e}")
    
    try:
        # Cleanup auth rate limiter
        auth_limiter = get_auth_limiter()
        await auth_limiter.close()
        logger.info("Auth rate limiter closed")
    except Exception as e:
        logger.warning(f"Auth rate limiter cleanup failed: {e}")
    
    logger.info("Admin application shutdown complete")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(admin_app, host="0.0.0.0", port=8001, log_level="info")

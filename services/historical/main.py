"""
Historical Service - Time-Series Data API

Provides REST API for querying stored analytics data.
Optimized for charting and visualization.

Key Features:
- Time-range queries
- Continuous aggregates (1m, 5m, 15m, 1h)
- Intelligent caching
- Pagination for large datasets
"""

from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import Optional, List
import structlog

from core.config.settings import settings
from core.logging.logger import configure_logger, get_logger
from services.historical.routers import oi_change, velocity, distribution, opportunities

configure_logger()
logger = get_logger("historical-service")

# Create FastAPI app
app = FastAPI(
    title="Historical Service",
    description="Time-series analytics data API",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(oi_change.router, prefix="/oi-change", tags=["OI Change"])
app.include_router(velocity.router, prefix="/velocity", tags=["Velocity"])
app.include_router(distribution.router, prefix="/distribution", tags=["Distribution"])
app.include_router(opportunities.router, prefix="/opportunities", tags=["Opportunities"])


@app.on_event("startup")
async def startup():
    """Initialize services on startup"""
    from services.historical.cache import cache
    await cache.initialize()
    logger.info("Historical Service started")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    logger.info("Historical Service shutting down")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "historical"}


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Historical Service",
        "version": "1.0.0",
        "description": "Time-series analytics data API",
        "endpoints": {
            "oi_change": "/oi-change",
            "velocity": "/velocity",
            "distribution": "/distribution",
            "opportunities": "/opportunities",
            "docs": "/docs"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "services.historical.main:app",
        host="0.0.0.0",
        port=8002,
        reload=False
    )

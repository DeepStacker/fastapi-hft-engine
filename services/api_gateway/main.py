"""
API Gateway Main Service

Public-facing API gateway for external clients.
Handles authentication, rate limiting, and proxying to internal services.
"""

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime
import structlog

from core.config.settings import settings
from core.logging.logger import configure_logger, get_logger
from services.api_gateway.middleware.auth import verify_api_key, check_endpoint_permission, check_symbol_permission
from services.api_gateway.models import APIKey
from services.api_gateway.rate_limiter import initialize_redis
from services.api_gateway.routers import public_api, admin_api

configure_logger()
logger = get_logger("api-gateway")

# Create FastAPI app
app = FastAPI(
    title="HFT Data Engine API",
    description="B2B API for real-time and historical option chain analytics",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS for external clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Initialize services on startup"""
    await initialize_redis()
    # Start WebSocket broadcast loop
    from services.api_gateway.websocket_manager import manager
    import asyncio
    asyncio.create_task(manager.broadcast_loop())
    logger.info("API Gateway started")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    logger.info("API Gateway shutting down")


# Include routers
app.include_router(
    public_api.router,
    prefix="/v1",
    tags=["Public API"]
)

app.include_router(
    admin_api.router,
    prefix="/admin",
    tags=["Admin"]
)


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "HFT Data Engine API",
        "version": "1.0.0",
        "description": "B2B API for real-time and historical option chain analytics",
        "documentation": "/docs",
        "authentication": "API Key required (X-API-Key header)",
        "endpoints": {
            "real-time": "/v1/option-chain/latest/{symbol}",
            "historical": "/v1/historical/oi-change/{symbol}/{strike}",
            "analytics": "/v1/analytics/patterns/{symbol}",
            "metadata": "/v1/symbols"
        },
        "support": "support@yourdomain.com"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint (no auth required)"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom error responses"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "status_code": 500,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# WebSocket Endpoint
from services.api_gateway.websocket_manager import manager
from fastapi import WebSocket, WebSocketDisconnect, Query, status
from jose import JWTError, jwt

@app.websocket("/ws/{symbol_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    symbol_id: str,
    token: str = Query(None, description="JWT authentication token")
):
    """
    WebSocket endpoint for real-time market data.
    
    Authentication via JWT token in query parameter.
    Example: ws://localhost:8003/ws/13?token=YOUR_JWT_TOKEN
    """
    # Authenticate
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing authentication token")
        return
    
    try:
        # Verify token (using same secret as auth system)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return
    
    # Connection authenticated, proceed
    connected = await manager.connect(websocket, symbol_id, username)
    if not connected:
        return  # Connection rejected (limit exceeded)
    
    try:
        while True:
            # Keep connection open and handle any incoming messages
            # We can implement client-to-server messages here if needed (e.g. subscription updates)
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, symbol_id)



    import uvicorn
    uvicorn.run(
        "services.api_gateway.main:app",
        host="0.0.0.0",
        port=8003,
        reload=False
    )

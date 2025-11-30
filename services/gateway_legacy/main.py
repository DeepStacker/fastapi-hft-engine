"""
Gateway Service - Complete Production Implementation

FastAPI application serving as the main API gateway with REST endpoints and WebSocket support.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Response, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from services.gateway.auth import create_access_token, get_current_user, authenticate_user, get_password_hash
from services.gateway.websocket_manager import manager
from services.gateway.middleware import RequestLoggingMiddleware, SecurityHeadersMiddleware
from core.config.settings import get_settings
from core.models.schemas import Token, UserLogin, UserCreate, User, HealthCheck
import asyncio
from datetime import datetime, timedelta
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
import redis.asyncio as redis
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import httpx
import brotli

# Import performance optimizations
from core.database.cache_layer import cache_manager
from core.utils.redis_pipeline import RedisPipeline

settings = get_settings()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Redis connection pool (singleton)
redis_pool = None

# Query cache instances
snapshot_cache = None
historical_cache = None
redis_pipeline = None

async def get_redis_pool():
    """Get or create Redis connection pool"""
    global redis_pool
    if redis_pool is None:
        redis_pool = redis.ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=50
        )
    return redis.Redis(connection_pool=redis_pool)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown"""
    global snapshot_cache, historical_cache, redis_pipeline
    
    # Startup
    asyncio.create_task(manager.broadcast_loop())
    
    # Initialize caches
    snapshot_cache = cache_manager.get_cache("snapshots", maxsize=5000, ttl=30)
    historical_cache = cache_manager.get_cache("historical", maxsize=1000, ttl=300)
    
    # Initialize Redis pipeline
    redis_client = await get_redis_pool()
    redis_pipeline = RedisPipeline(redis_client)
    
    yield
    
    # Shutdown
    global redis_pool
    if redis_pool:
        await redis_pool.disconnect()
    await cache_manager.clear_all()


# Create FastAPI app
app = FastAPI(
    title="Stockify API",
    description="Real-time Market Data Platform",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add middlewares (order matters!)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add GZip compression middleware
try:
    from fastapi.middleware.gzip import GZipMiddleware
    app.add_middleware(
        GZipMiddleware,
        minimum_size=1000,  # Compress responses > 1KB
        compresslevel=6  # Balance speed/compression
    )
except ImportError:
    pass





@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/token", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Authenticate user and return JWT token.
    
    Rate limited to 5 attempts per minute.
    """
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/register", response_model=User)
@limiter.limit("3/hour")
async def register(request: Request, user_data: UserCreate):
    """
    Register a new user.
    
    Rate limited to 3 registrations per hour per IP.
    """
    from core.database.db import async_session_factory
    from core.database.models import UserDB
    from sqlalchemy import select
    
    async with async_session_factory() as session:
        # Check if user already exists
        result = await session.execute(
            select(UserDB).where(
                (UserDB.username == user_data.username) | (UserDB.email == user_data.email)
            )
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already registered"
            )
        
        # Create new user
        new_user = UserDB(
            username=user_data.username,
            email=user_data.email,
            hashed_password=get_password_hash(user_data.password)
        )
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)
        
        return new_user


@app.get("/health", response_model=HealthCheck)
async def health():
    """
    Comprehensive health check endpoint.
    
    Checks connectivity to all dependencies: Redis, TimescaleDB, Kafka
    """
    services_status = {}
    overall_status = "healthy"
    
    # Check Redis
    try:
        redis_client = await get_redis_pool()
        await redis_client.ping()
        services_status["redis"] = "up"
    except Exception as e:
        services_status["redis"] = f"down: {str(e)}"
        overall_status = "degraded"
    
    # Check TimescaleDB
    try:
        from core.database.db import async_session_factory
        from sqlalchemy import text
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        services_status["database"] = "up"
    except Exception as e:
        services_status["database"] = f"down: {str(e)}"
        overall_status = "degraded"
    
    # Check Kafka
    try:
        from aiokafka import AIOKafkaProducer
        producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            request_timeout_ms=5000
        )
        await asyncio.wait_for(producer.start(), timeout=5)
        await producer.stop()
        services_status["kafka"] = "up"
    except asyncio.TimeoutError:
        services_status["kafka"] = "down: timeout"
        overall_status = "degraded"
    except Exception as e:
        services_status["kafka"] = f"down: {str(e)}"
        overall_status = "degraded"
    
    services_status["api"] = "up"
    
    return {
        "status": overall_status,
        "timestamp": datetime.utcnow(),
        "services": services_status
    }


@app.websocket("/ws/{symbol_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    symbol_id: str,
    token: str = Query(None, description="JWT authentication token")
):
    """
    WebSocket endpoint for real-time market data.
    
    Authentication via JWT token in query parameter.
    Example: ws://localhost:8000/ws/13?token=YOUR_JWT_TOKEN
    """
    # Authenticate
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing authentication token")
        return
    
    from jose import JWTError, jwt
    try:
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
            data = await websocket.receive_text()
            # Could implement commands here (subscribe to additional symbols, etc.)
    except WebSocketDisconnect:
        manager.disconnect(websocket, symbol_id)


@app.get("/snapshot/{symbol_id}")
@limiter.limit("100/minute")
async def get_snapshot(request: Request, symbol_id: str):
    """
    Get the latest market snapshot for a symbol.
    
    Uses query caching for optimal performance.
    Rate limited to 100 requests per minute.
    """
    cache_key = f"snapshot:{symbol_id}"
    
    async def fetch_snapshot():
        redis_client = await get_redis_pool()
        try:
            import json
            data = await redis_client.get(f"latest:{symbol_id}")
            if not data:
                # Fallback to database
                from core.database.db import async_session_factory
                from core.database.models import MarketSnapshotDB
                from sqlalchemy import select, desc
                
                async with async_session_factory() as session:
                    stmt = select(MarketSnapshotDB).where(
                        MarketSnapshotDB.symbol_id == int(symbol_id)
                    ).order_by(desc(MarketSnapshotDB.timestamp)).limit(1)
                    
                    result = await session.execute(stmt)
                    snapshot = result.scalar_one_or_none()
                    
                    if snapshot:
                        return {
                            "symbol_id": snapshot.symbol_id,
                            "ltp": float(snapshot.ltp),
                            "volume": snapshot.volume,
                            "oi": snapshot.oi,
                            "timestamp": snapshot.timestamp.isoformat()
                        }
                
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No data found for symbol {symbol_id}"
                )
            
            return json.loads(data)
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error fetching snapshot: {str(e)}"
            )
    
    # Use query cache
    return await snapshot_cache.get_or_fetch(cache_key, fetch_snapshot)


@app.get("/historical/{symbol_id}")
@limiter.limit("50/minute")
async def get_historical(request: Request, symbol_id: int, limit: int = 100):
    """
    Get historical snapshots from TimescaleDB.
    
    Rate limited to 50 requests per minute.
    """
    from core.database.db import async_session_factory
    from core.database.models import MarketSnapshotDB
    from sqlalchemy import select, desc

    # Validate limit
    if limit > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit cannot exceed 1000"
        )

    async with async_session_factory() as session:
        stmt = select(MarketSnapshotDB).where(
            MarketSnapshotDB.symbol_id == symbol_id
        ).order_by(desc(MarketSnapshotDB.timestamp)).limit(limit)
        
        result = await session.execute(stmt)
        snapshots = result.scalars().all()
        
        return [
            {
                "timestamp": s.timestamp.isoformat(),
                "ltp": float(s.ltp),
                "volume": s.volume,
                "oi": s.oi
            }
            for s in snapshots
        ]


@app.get("/stats")
async def get_stats():
    """
    Get system statistics with async parallelization.
    
    Uses asyncio.gather() for concurrent queries.
    """
    from core.database.db import async_session_factory
    from sqlalchemy import select, func, text
    from core.database.models import MarketSnapshotDB, InstrumentDB
    
    async with async_session_factory() as session:
        # Execute all queries in parallel
        tasks = [
            session.execute(select(func.count()).select_from(MarketSnapshotDB)),
            session.execute(select(func.count()).select_from(InstrumentDB)),
            session.execute(text("SELECT pg_database_size(current_database())")),
        ]
        
        results = await asyncio.gather(*tasks)
        
        snapshot_count = results[0].scalar()
        instrument_count = results[1].scalar()
        db_size = results[2].scalar()
        
        return {
            "total_snapshots": snapshot_count,
            "total_instruments": instrument_count,
            "database_size_bytes": db_size,
            "timestamp": datetime.utcnow().isoformat()
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

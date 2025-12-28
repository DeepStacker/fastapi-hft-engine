"""
Enhanced Realtime Service with WebSocket Support

Broadcasts real-time data for:
- Option Chain updates  
- PCR (Put-Call Ratio)
- Market Mood Index
- Overall OI/COI metrics
- Support/Resistance levels
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import redis.asyncio as redis
from typing import Dict, Set
import structlog

from core.config.settings import get_settings
from core.logging.logger import configure_logger, get_logger

configure_logger()
logger = get_logger("websocket-server")
settings = get_settings()

app = FastAPI(
    title="Realtime WebSocket Service",
    description="WebSocket server for real-time market data streaming",
    version="3.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
connections: Dict[str, Set[WebSocket]] = {
    "option_chain": set(),
    "pcr": set(),
    "market_mood": set(),
    "overall_metrics": set(),
    "sr_levels": set()
}

# Redis client for pub/sub
redis_client = None


async def broadcast_to_channel(channel: str, message: dict):
    """Broadcast message to all WebSocket clients subscribed to a channel"""
    if channel not in connections:
        return
    
    disconnected = set()
    for websocket in connections[channel]:
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending to WebSocket: {e}")
            disconnected.add(websocket)
    
    # Remove disconnected clients
    connections[channel] -= disconnected


async def redis_subscriber(channel_pattern: str, websocket_channel: str):
    """Subscribe to Redis pub/sub and broadcast to WebSocket clients"""
    pubsub = redis_client.pubsub()
    await pubsub.psubscribe(channel_pattern)
    
    logger.info(f"Subscribed to Redis pattern: {channel_pattern}")
    
    try:
        async for message in pubsub.listen():
            if message['type'] == 'pmessage':
                data = json.loads(message['data'])
                await broadcast_to_channel(websocket_channel, data)
    except Exception as e:
        logger.error(f"Redis subscriber error: {e}")
    finally:
        await pubsub.unsubscribe(channel_pattern)


@app.on_event("startup")
async def startup():
    """Initialize Redis connection and start subscribers"""
    global redis_client
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    
    # Start Redis subscriber tasks for each channel
    asyncio.create_task(redis_subscriber("live:option_chain:*", "option_chain"))
    asyncio.create_task(redis_subscriber("live:pcr:*", "pcr"))
    asyncio.create_task(redis_subscriber("live:market_mood:*", "market_mood"))
    asyncio.create_task(redis_subscriber("live:overall_metrics:*", "overall_metrics"))
    asyncio.create_task(redis_subscriber("live:sr_levels:*", "sr_levels"))
    
    logger.info("WebSocket server started with Phase 3 channels")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    if redis_client:
        await redis_client.close()
    logger.info("WebSocket server shut down")


@app.websocket("/ws/option-chain/{symbol_id}")
async def websocket_option_chain(
    websocket: WebSocket,
    symbol_id: int
):
    """
    WebSocket endpoint for real-time option chain updates.
    
    **Usage:**
    ```javascript
    const ws = new WebSocket('ws://localhost:8001/ws/option-chain/13');
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Option chain update:', data);
    };
    ```
    """
    await websocket.accept()
    connections["option_chain"].add(websocket)
    
    try:
        await websocket.send_json({
            "type": "connected",
            "channel": "option_chain",
            "symbol_id": symbol_id,
            "message": "Connected to option chain stream"
        })
        
        # Keep connection alive
        while True:
            # Wait for client ping/message
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from option_chain channel")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        connections["option_chain"].discard(websocket)


@app.websocket("/ws/pcr/{symbol_id}")
async def websocket_pcr(
    websocket: WebSocket,
    symbol_id: int,
    expiry: str = Query(...)
):
    """
    WebSocket endpoint for real-time PCR updates.
    
    Streams PCR OI and Volume in real-time.
    """
    await websocket.accept()
    connections["pcr"].add(websocket)
    
    try:
        await websocket.send_json({
            "type": "connected",
            "channel": "pcr",
            "symbol_id": symbol_id,
            "expiry": expiry
        })
        
        while True:
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        pass
    finally:
        connections["pcr"].discard(websocket)


@app.websocket("/ws/market-mood/{symbol_id}")
async def websocket_market_mood(
    websocket: WebSocket,
    symbol_id: int
):
    """
    WebSocket endpoint for real-time Market Mood Index updates.
    
    Streams mood score and sentiment changes every minute.
    """
    await websocket.accept()
    connections["market_mood"].add(websocket)
    
    try:
        await websocket.send_json({
            "type": "connected",
            "channel": "market_mood",
            "symbol_id": symbol_id
        })
        
        while True:
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        pass
    finally:
        connections["market_mood"].discard(websocket)


@app.websocket("/ws/overall-metrics/{symbol_id}")
async def websocket_overall_metrics(
    websocket: WebSocket,
    symbol_id: int
):
    """
    WebSocket endpoint for real-time overall OI/COI aggregate updates.
    
    Streams aggregated metrics across all strikes.
    """
    await websocket.accept()
    connections["overall_metrics"].add(websocket)
    
    try:
        await websocket.send_json({
            "type": "connected",
            "channel": "overall_metrics",
            "symbol_id": symbol_id
        })
        
        while True:
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        pass
    finally:
        connections["overall_metrics"].discard(websocket)


@app.websocket("/ws/sr-levels/{symbol_id}")
async def websocket_sr_levels(
    websocket: WebSocket,
    symbol_id: int,
    expiry: str = Query(...)
):
    """
    WebSocket endpoint for real-time Support/Resistance level updates.
    
    Streams level changes and breach notifications.
    """
    await websocket.accept()
    connections["sr_levels"].add(websocket)
    
    try:
        await websocket.send_json({
            "type": "connected",
            "channel": "sr_levels",
            "symbol_id": symbol_id,
            "expiry": expiry
        })
        
        while True:
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        pass
    finally:
        connections["sr_levels"].discard(websocket)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "websocket-server",
        "version": "3.0.0",
        "active_connections": {
            channel: len(conns)
            for channel, conns in connections.items()
        }
    }


@app.get("/")
async def root():
    """Root endpoint with WebSocket information"""
    return {
        "service": "Realtime WebSocket Service",
        "version": "3.0.0",
        "websocket_channels": {
            "option_chain": "/ws/option-chain/{symbol_id}",
            "pcr": "/ws/pcr/{symbol_id}?expiry={expiry}",
            "market_mood": "/ws/market-mood/{symbol_id}",
            "overall_metrics": "/ws/overall-metrics/{symbol_id}",
            "sr_levels": "/ws/sr-levels/{symbol_id}?expiry={expiry}"
        },
        "active_connections": {
            channel: len(conns)
            for channel, conns in connections.items()
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "services.realtime.websocket_server:app",
        host="0.0.0.0",
        port=8001,
        reload=False
    )

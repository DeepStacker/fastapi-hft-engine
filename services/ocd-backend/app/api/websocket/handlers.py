"""
WebSocket Event Handlers - HFT Redis Streaming Edition
Streams live data directly from HFT Engine's Redis for high performance.
No expiry required - uses latest data for any symbol.
"""
import logging
import asyncio
from datetime import datetime
from uuid import uuid4
from typing import Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect

from app.api.websocket.manager import manager
from app.services.hft_adapter import HFTDataAdapter, SYMBOL_ID_MAP
from app.services.options import OptionsService
from app.services.dhan_client import DhanClient
from app.cache.redis import get_redis_connection, RedisCache
from app.config.settings import settings

logger = logging.getLogger(__name__)

# Active streaming tasks
_streaming_tasks: Dict[str, asyncio.Task] = {}

# HFT adapter instance (shared)
_hft_adapter: Optional[HFTDataAdapter] = None


async def get_hft_adapter() -> HFTDataAdapter:
    """Get or create HFT adapter singleton."""
    global _hft_adapter
    if _hft_adapter is None:
        _hft_adapter = HFTDataAdapter()
        await _hft_adapter.connect()
    return _hft_adapter


async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint handler.
    Handles connection, subscription, and live data streaming.
    """
    # Validate origin for WebSocket (CORS doesn't apply to WS upgrade)
    origin = websocket.headers.get("origin", "")
    allowed_origins = settings.CORS_ORIGINS
    
    # In development, allow all origins
    if not settings.is_development:
        if origin and origin not in allowed_origins:
            logger.warning(f"WebSocket connection rejected from origin: {origin}")
            await websocket.close(code=1008)  # Policy violation
            return
    
    client_id = str(uuid4())
    
    # Accept connection
    if not await manager.connect(websocket, client_id):
        return
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            message_type = data.get("type", "")
            
            if message_type == "subscribe":
                await handle_subscribe(client_id, data)
                
            elif message_type == "unsubscribe":
                await handle_unsubscribe(client_id)
                
            elif message_type == "ping":
                await manager.send_personal_message(
                    {"type": "pong"},
                    client_id
                )
            
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
    finally:
        # Cleanup
        await handle_unsubscribe(client_id)
        await manager.disconnect(client_id)


async def handle_subscribe(client_id: str, data: dict):
    """
    Handle subscription request.
    Now works without expiry - streams latest HFT data for the symbol.
    """
    symbol = data.get("sid", data.get("symbol", "NIFTY")).upper()
    expiry = data.get("exp_sid", data.get("expiry", ""))  # Optional now
    
    # Validate symbol is known
    # Use adapter to check validity (ensures symbols are loaded)
    adapter = await get_hft_adapter()
    symbol_id = await adapter.get_symbol_id(symbol)
    
    if not symbol_id:
        await manager.send_personal_message(
            {"type": "error", "message": f"Unknown symbol: {symbol}"},
            client_id
        )
        return
    
    # Subscribe client (expiry optional)
    await manager.subscribe(client_id, symbol, expiry or "latest")
    
    # Send subscription confirmation immediately
    await manager.send_personal_message(
        {"type": "subscribed", "symbol": symbol, "expiry": expiry or "latest"},
        client_id
    )
    
    # Start streaming if not already running for this symbol
    # KEY CHANGE: Stream by symbol, not symbol:expiry
    group_key = symbol  # Simplified - one stream per symbol
    
    if group_key not in _streaming_tasks or _streaming_tasks[group_key].done():
        task = asyncio.create_task(
            stream_hft_data(symbol)
        )
        _streaming_tasks[group_key] = task
        logger.info(f"Started HFT Redis streaming for {symbol}")


async def handle_unsubscribe(client_id: str):
    """
    Handle unsubscription request.
    Stops streaming if no more subscribers.
    """
    subscription = manager.get_subscription(client_id)
    
    if subscription:
        await manager.unsubscribe(client_id)
        
        # Check if streaming should stop
        symbol = subscription.symbol
        
        # Check all groups for this symbol
        has_subscribers = False
        for group_key, clients in manager.subscription_groups.items():
            if group_key.startswith(symbol) and clients:
                has_subscribers = True
                break
        
        if not has_subscribers:
            # No more subscribers, cancel streaming task
            if symbol in _streaming_tasks:
                _streaming_tasks[symbol].cancel()
                del _streaming_tasks[symbol]
                logger.info(f"Stopped HFT streaming for {symbol}")


async def stream_hft_data(symbol: str):
    """
    Stream live data from HFT Engine's Redis.
    Polls the HFT Redis key (latest:{symbol_id}) at high frequency.
    
    This is the HIGH PERFORMANCE path:
    - No DhanClient API calls
    - No OptionsService processing overhead
    - Pure Redis reads at ~100ms intervals (10 updates/sec)
    """
    # Get HFT adapter
    adapter = await get_hft_adapter()
    
    symbol_id = await adapter.get_symbol_id(symbol)
    if not symbol_id:
        logger.error(f"Unknown symbol for streaming: {symbol}")
        return
    
    # Streaming interval (milliseconds) - adjustable
    interval = getattr(settings, 'HFT_STREAM_INTERVAL', 0.1)  # 100ms = 10 updates/sec (was 0.25)
    
    logger.info(f"HFT Redis streaming started for {symbol} (symbol_id={symbol_id}) at {interval}s intervals")
    
    consecutive_errors = 0
    MAX_CONSECUTIVE_ERRORS = 10
    last_data_hash = None
    # Initialize to past to trigger immediate save on first tick
    last_save_time = datetime.fromtimestamp(0)
    
    try:
        while True:
            # Check if there are still subscribers for this symbol
            has_subscribers = any(
                key.startswith(symbol) and clients
                for key, clients in manager.subscription_groups.items()
            )
            if not has_subscribers:
                logger.info(f"No subscribers left for {symbol}, stopping stream")
                break
            
            try:
                # Direct Redis read - FAST
                data = await adapter.get_option_chain(symbol, None)
                
                if "error" in data:
                    consecutive_errors += 1
                    if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                        logger.error(f"HFT Redis streaming failed for {symbol}: {data['error']}")
                        await broadcast_to_symbol(symbol, {"type": "error", "message": data['error']})
                    await asyncio.sleep(interval)
                    continue
                
                # Success - reset error counter
                consecutive_errors = 0
                
                # PERSISTENCE: Save snapshot every minute
                current_time = datetime.now()
                if (current_time - last_save_time).total_seconds() >= 60:
                    asyncio.create_task(persist_snapshot(data))
                    last_save_time = current_time
                
                # Broadcast to all clients subscribed to this symbol
                await broadcast_to_symbol(symbol, data)
                
            except Exception as e:
                consecutive_errors += 1
                logger.warning(f"HFT streaming error for {symbol} ({consecutive_errors}/{MAX_CONSECUTIVE_ERRORS}): {e}")
                
                if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                    await broadcast_to_symbol(symbol, {"type": "error", "message": f"Stream error: {str(e)}"})
            
            await asyncio.sleep(interval)
            
    except asyncio.CancelledError:
        logger.info(f"HFT streaming cancelled for {symbol}")
    finally:
        logger.info(f"HFT streaming stopped for {symbol}")


async def persist_snapshot(data: dict):
    """
    Persist market snapshot to TimescaleDB.
    Creates a dedicated session for the operation.
    """
    from app.config.database import AsyncSessionLocal
    
    try:
        async with AsyncSessionLocal() as session:
            # Create minimal service instance just for saving
            service = OptionsService(dhan_client=None, cache=None, db=session)
            await service.save_snapshot(data)
    except Exception as e:
        logger.error(f"Failed to persist snapshot in background: {e}")


async def broadcast_to_symbol(symbol: str, data: dict):
    """
    Broadcast data to all clients subscribed to a symbol.
    Handles multiple expiry groups under the same symbol.
    """
    for group_key, client_ids in list(manager.subscription_groups.items()):
        if group_key.startswith(symbol) or group_key == symbol:
            for client_id in list(client_ids):
                try:
                    await manager.send_personal_message(data, client_id)
                except Exception as e:
                    logger.warning(f"Failed to send to client {client_id}: {e}")


async def get_streaming_status() -> dict:
    """Get status of all streaming tasks"""
    status = {}
    
    for symbol, task in _streaming_tasks.items():
        subscriber_count = sum(
            len(clients) for key, clients in manager.subscription_groups.items()
            if key.startswith(symbol) or key == symbol
        )
        status[symbol] = {
            "running": not task.done(),
            "subscribers": subscriber_count
        }
    
    return {
        "total_connections": manager.connection_count,
        "total_subscriptions": manager.subscription_count,
        "streams": status,
        "source": "hft_redis"
    }

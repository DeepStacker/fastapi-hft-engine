"""
Charts WebSocket Handlers - Real-time OHLCV streaming
Streams chart data at 250ms intervals with msgpack compression
"""
import logging
import asyncio
from uuid import uuid4
from typing import Dict, Set, Optional
from dataclasses import dataclass
import msgpack

from fastapi import WebSocket, WebSocketDisconnect

from app.services.dhan_ticks import get_ticks_service
from app.config.settings import settings

logger = logging.getLogger(__name__)


@dataclass
class ChartSubscription:
    """Chart subscription info"""
    symbol: str
    interval: str
    client_id: str


class ChartsConnectionManager:
    """
    Manages WebSocket connections for chart data.
    Supports multiple symbols/intervals with efficient broadcasting.
    Uses Redis Pub/Sub for horizontal scaling.
    """
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.subscriptions: Dict[str, ChartSubscription] = {}
        self.subscription_groups: Dict[str, Set[str]] = {}  # group_key -> set of client_ids
        self._lock = asyncio.Lock()
    
    @property
    def connection_count(self) -> int:
        return len(self.active_connections)
    
    async def connect(self, websocket: WebSocket, client_id: str) -> bool:
        """Accept and register a new WebSocket connection"""
        try:
            await websocket.accept()
            async with self._lock:
                self.active_connections[client_id] = websocket
            logger.info(f"Charts WS connected: {client_id} (total: {self.connection_count})")
            return True
        except Exception as e:
            logger.error(f"Charts WS connection failed: {e}")
            return False
    
    async def disconnect(self, client_id: str) -> None:
        """Disconnect and cleanup a client"""
        async with self._lock:
            self.active_connections.pop(client_id, None)
            sub = self.subscriptions.pop(client_id, None)
            
            if sub:
                group_key = f"{sub.symbol}:{sub.interval}"
                if group_key in self.subscription_groups:
                    self.subscription_groups[group_key].discard(client_id)
                    if not self.subscription_groups[group_key]:
                        del self.subscription_groups[group_key]
        
        logger.info(f"Charts WS disconnected: {client_id} (total: {self.connection_count})")
    
    async def subscribe(self, client_id: str, symbol: str, interval: str) -> bool:
        """Subscribe a client to a symbol/interval channel"""
        async with self._lock:
            websocket = self.active_connections.get(client_id)
            if not websocket:
                return False
            
            # Remove from previous subscription
            old_sub = self.subscriptions.get(client_id)
            if old_sub:
                old_key = f"{old_sub.symbol}:{old_sub.interval}"
                if old_key in self.subscription_groups:
                    self.subscription_groups[old_key].discard(client_id)
            
            # Add new subscription
            group_key = f"{symbol}:{interval}"
            self.subscriptions[client_id] = ChartSubscription(
                symbol=symbol.upper(),
                interval=interval,
                client_id=client_id
            )
            
            if group_key not in self.subscription_groups:
                self.subscription_groups[group_key] = set()
            self.subscription_groups[group_key].add(client_id)
        
        logger.info(f"Charts WS {client_id} subscribed to {symbol}:{interval}")
        
        # Send confirmation
        await self.send_personal_message(
            {"type": "subscribed", "symbol": symbol.upper(), "interval": interval},
            client_id
        )
        return True
    
    async def send_personal_message(self, data: dict, client_id: str) -> bool:
        """Send JSON message to a specific client"""
        websocket = self.active_connections.get(client_id)
        if websocket:
            try:
                await websocket.send_json(data)
                return True
            except Exception as e:
                logger.warning(f"Charts WS send failed for {client_id}: {e}")
        return False
    
    async def broadcast_to_group(self, symbol: str, interval: str, data: dict) -> int:
        """Broadcast msgpack data to all clients subscribed to symbol/interval"""
        group_key = f"{symbol}:{interval}"
        
        async with self._lock:
            clients = self.subscription_groups.get(group_key, set()).copy()
        
        if not clients:
            return 0
        
        # Encode to msgpack once for all clients
        packed_data = msgpack.packb(data)
        
        sent_count = 0
        disconnected = []
        
        for client_id in clients:
            websocket = self.active_connections.get(client_id)
            if websocket:
                try:
                    await websocket.send_bytes(packed_data)
                    sent_count += 1
                except Exception as e:
                    logger.warning(f"Charts broadcast error for {client_id}: {e}")
                    disconnected.append(client_id)
        
        # Cleanup disconnected
        for client_id in disconnected:
            await self.disconnect(client_id)
        
        return sent_count
    
    def get_subscription(self, client_id: str) -> Optional[ChartSubscription]:
        return self.subscriptions.get(client_id)


# Global manager instance
charts_manager = ChartsConnectionManager()

# Active streaming tasks
_charts_streaming_tasks: Dict[str, asyncio.Task] = {}


async def charts_websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint handler for charts.
    Handles connection, subscription, and live chart streaming.
    """
    # Validate origin
    origin = websocket.headers.get("origin", "")
    allowed_origins = settings.CORS_ORIGINS
    
    if not settings.is_development:
        if origin and origin not in allowed_origins:
            logger.warning(f"Charts WS rejected from origin: {origin}")
            await websocket.close(code=1008)
            return
    
    client_id = str(uuid4())
    
    # Accept connection
    if not await charts_manager.connect(websocket, client_id):
        return
    
    try:
        # Send connected confirmation
        await charts_manager.send_personal_message(
            {"type": "connected", "client_id": client_id},
            client_id
        )
        
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            message_type = data.get("type", "")
            
            if message_type == "subscribe":
                symbol = data.get("symbol", "NIFTY").upper()
                interval = data.get("interval", "1")
                
                await charts_manager.subscribe(client_id, symbol, interval)
                
                # Start streaming if not already running for this group
                group_key = f"{symbol}:{interval}"
                if group_key not in _charts_streaming_tasks or _charts_streaming_tasks[group_key].done():
                    task = asyncio.create_task(stream_chart_data(symbol, interval))
                    _charts_streaming_tasks[group_key] = task
                    logger.info(f"Started charts streaming for {group_key}")
            
            elif message_type == "unsubscribe":
                await handle_charts_unsubscribe(client_id)
            
            elif message_type == "ping":
                await charts_manager.send_personal_message({"type": "pong"}, client_id)
    
    except WebSocketDisconnect:
        logger.info(f"Charts WS {client_id} disconnected")
    except Exception as e:
        logger.error(f"Charts WS error for {client_id}: {e}")
    finally:
        await handle_charts_unsubscribe(client_id)
        await charts_manager.disconnect(client_id)


async def handle_charts_unsubscribe(client_id: str):
    """Handle unsubscription and cleanup streaming if no more subscribers"""
    subscription = charts_manager.get_subscription(client_id)
    
    if subscription:
        group_key = f"{subscription.symbol}:{subscription.interval}"
        
        # Check if streaming should stop
        if group_key in charts_manager.subscription_groups:
            if len(charts_manager.subscription_groups[group_key]) <= 1:  # Only this client
                if group_key in _charts_streaming_tasks:
                    _charts_streaming_tasks[group_key].cancel()
                    del _charts_streaming_tasks[group_key]
                    logger.info(f"Stopped charts streaming for {group_key}")


async def stream_chart_data(symbol: str, interval: str):
    """
    Stream chart data to all subscribers of a symbol/interval.
    Runs continuously until cancelled.
    """
    group_key = f"{symbol}:{interval}"
    broadcast_interval = getattr(settings, 'WS_CHARTS_BROADCAST_INTERVAL', 0.25)
    
    logger.info(f"Charts streaming started for {group_key} at {broadcast_interval}s intervals")
    
    ticks_service = await get_ticks_service()
    last_candle_time = None
    
    try:
        while True:
            # Check if there are still subscribers
            if group_key not in charts_manager.subscription_groups:
                break
            if not charts_manager.subscription_groups[group_key]:
                break
            
            try:
                # Fetch latest candle data (just last few candles for real-time)
                result = await ticks_service.get_chart_data(
                    symbol=symbol,
                    interval=interval,
                    days_back=1  # Only need recent data for live updates
                )
                
                if result.get("success") and result.get("candles"):
                    candles = result["candles"]
                    last_candle = candles[-1] if candles else None
                    
                    if last_candle:
                        # Send tick update
                        data = {
                            "type": "tick",
                            "symbol": symbol,
                            "interval": interval,
                            "candle": last_candle,
                            "is_new": last_candle["time"] != last_candle_time
                        }
                        
                        await charts_manager.broadcast_to_group(symbol, interval, data)
                        last_candle_time = last_candle["time"]
            
            except Exception as e:
                logger.warning(f"Charts streaming error for {group_key}: {e}")
            
            # Wait for next interval
            await asyncio.sleep(broadcast_interval)
    
    except asyncio.CancelledError:
        logger.info(f"Charts streaming cancelled for {group_key}")
    finally:
        logger.info(f"Charts streaming stopped for {group_key}")


async def get_charts_streaming_status() -> dict:
    """Get status of all chart streaming tasks"""
    status = {}
    
    for group_key, task in _charts_streaming_tasks.items():
        status[group_key] = {
            "running": not task.done(),
            "subscribers": len(charts_manager.subscription_groups.get(group_key, set()))
        }
    
    return {
        "total_connections": charts_manager.connection_count,
        "streams": status
    }

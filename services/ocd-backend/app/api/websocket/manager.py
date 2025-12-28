"""
WebSocket Connection Manager
Handles WebSocket connections and broadcasting with Redis Pub/Sub for horizontal scaling
"""
import logging
import asyncio
from typing import Dict, Set, Optional
from dataclasses import dataclass, field

from fastapi import WebSocket
import msgpack

from app.config.settings import settings

logger = logging.getLogger(__name__)


@dataclass
class ClientSubscription:
    """Client subscription info"""
    websocket: WebSocket
    symbol: str
    expiry: str
    active: bool = True


class ConnectionManager:
    """
    WebSocket connection manager with Redis Pub/Sub support.
    
    Handles:
    - Local client connections and subscriptions
    - Cross-instance broadcasting via Redis Pub/Sub
    - Graceful fallback to local-only when Redis unavailable
    """
    
    def __init__(self):
        # Active connections: client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Client subscriptions: client_id -> subscription info
        self.subscriptions: Dict[str, ClientSubscription] = {}
        
        # Symbol/Expiry based groups for efficient broadcasting
        # key: "symbol:expiry" -> set of client_ids
        self.subscription_groups: Dict[str, Set[str]] = {}
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
        
        # Redis Pub/Sub manager (lazy initialization)
        self._pubsub = None
        self._pubsub_initialized = False
    
    async def _get_pubsub(self):
        """Lazily initialize Redis Pub/Sub manager"""
        if not self._pubsub_initialized:
            try:
                from app.api.websocket.pubsub import pubsub_manager, init_pubsub
                await init_pubsub()
                self._pubsub = pubsub_manager
                self._pubsub_initialized = True
                logger.info("WebSocket manager connected to Redis Pub/Sub")
            except Exception as e:
                logger.warning(f"Redis Pub/Sub not available, using local-only mode: {e}")
                self._pubsub_initialized = True  # Don't retry
        return self._pubsub
    
    async def connect(self, websocket: WebSocket, client_id: str) -> bool:
        """
        Accept and register a new WebSocket connection.
        
        Args:
            websocket: WebSocket connection
            client_id: Unique client identifier
            
        Returns:
            True if connection accepted
        """
        try:
            await websocket.accept()
            
            async with self._lock:
                self.active_connections[client_id] = websocket
            
            logger.info(f"Client connected: {client_id} (total: {len(self.active_connections)})")
            
            # Send connection confirmation
            await self.send_personal_message(
                {"type": "connected", "client_id": client_id},
                client_id
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Connection error for {client_id}: {e}")
            return False
    
    async def disconnect(self, client_id: str) -> None:
        """
        Disconnect and cleanup a client.
        
        Args:
            client_id: Client identifier
        """
        async with self._lock:
            # Remove from active connections
            self.active_connections.pop(client_id, None)
            
            # Remove subscription
            sub = self.subscriptions.pop(client_id, None)
            
            if sub:
                # Remove from subscription group
                group_key = f"{sub.symbol}:{sub.expiry}"
                if group_key in self.subscription_groups:
                    self.subscription_groups[group_key].discard(client_id)
                    if not self.subscription_groups[group_key]:
                        del self.subscription_groups[group_key]
                        # Unsubscribe from Redis channel if no more local subscribers
                        pubsub = await self._get_pubsub()
                        if pubsub:
                            await pubsub.unsubscribe(sub.symbol, sub.expiry)
        
        logger.info(f"Client disconnected: {client_id} (total: {len(self.active_connections)})")
    
    async def subscribe(
        self,
        client_id: str,
        symbol: str,
        expiry: str
    ) -> bool:
        """
        Subscribe a client to symbol/expiry live data.
        
        Args:
            client_id: Client identifier
            symbol: Trading symbol
            expiry: Expiry timestamp
            
        Returns:
            True if subscribed successfully
        """
        async with self._lock:
            websocket = self.active_connections.get(client_id)
            if not websocket:
                return False
            
            # Remove from previous subscription group
            old_sub = self.subscriptions.get(client_id)
            if old_sub:
                old_key = f"{old_sub.symbol}:{old_sub.expiry}"
                if old_key in self.subscription_groups:
                    self.subscription_groups[old_key].discard(client_id)
            
            # Create new subscription
            self.subscriptions[client_id] = ClientSubscription(
                websocket=websocket,
                symbol=symbol.upper(),
                expiry=expiry,
                active=True
            )
            
            # Add to new subscription group
            group_key = f"{symbol.upper()}:{expiry}"
            is_new_group = group_key not in self.subscription_groups
            if is_new_group:
                self.subscription_groups[group_key] = set()
            self.subscription_groups[group_key].add(client_id)
        
        # Subscribe to Redis channel if this is a new group on this instance
        if is_new_group:
            pubsub = await self._get_pubsub()
            if pubsub:
                await pubsub.subscribe(
                    symbol.upper(), 
                    expiry, 
                    lambda data: self._handle_pubsub_message(symbol.upper(), expiry, data)
                )
        
        logger.info(f"Client {client_id} subscribed to {symbol}:{expiry}")
        
        # Send confirmation
        await self.send_personal_message(
            {
                "type": "subscribed",
                "symbol": symbol.upper(),
                "expiry": expiry
            },
            client_id
        )
        
        return True
    
    async def _handle_pubsub_message(self, symbol: str, expiry: str, data: bytes):
        """Handle message received from Redis Pub/Sub - forward to local clients"""
        await self._broadcast_to_local_clients(symbol, expiry, data)
    
    async def unsubscribe(self, client_id: str) -> bool:
        """
        Unsubscribe a client from live data.
        
        Args:
            client_id: Client identifier
            
        Returns:
            True if unsubscribed successfully
        """
        async with self._lock:
            sub = self.subscriptions.pop(client_id, None)
            
            if sub:
                group_key = f"{sub.symbol}:{sub.expiry}"
                if group_key in self.subscription_groups:
                    self.subscription_groups[group_key].discard(client_id)
        
        if sub:
            logger.info(f"Client {client_id} unsubscribed")
            await self.send_personal_message(
                {"type": "unsubscribed"},
                client_id
            )
            return True
        
        return False
    
    async def send_personal_message(
        self,
        message: dict,
        client_id: str,
        use_msgpack: bool = False
    ) -> bool:
        """
        Send a message to a specific client.
        
        Args:
            message: Message to send
            client_id: Target client
            use_msgpack: Use msgpack encoding
            
        Returns:
            True if sent successfully
        """
        websocket = self.active_connections.get(client_id)
        if not websocket:
            return False
        
        try:
            if use_msgpack:
                await websocket.send_bytes(msgpack.packb(message))
            else:
                await websocket.send_json(message)
            return True
        except Exception as e:
            logger.warning(f"Failed to send to {client_id}: {e}")
            await self.disconnect(client_id)
            return False
    
    async def broadcast_to_group(
        self,
        symbol: str,
        expiry: str,
        data: dict
    ) -> int:
        """
        Broadcast data to all clients subscribed to a symbol/expiry.
        Uses Redis Pub/Sub to reach clients on other instances.
        
        Args:
            symbol: Trading symbol
            expiry: Expiry timestamp
            data: Data to broadcast
            
        Returns:
            Number of LOCAL clients sent to (other instances handled by Redis)
        """
        # Encode once
        packed_data = msgpack.packb(data)
        
        # Publish to Redis for cross-instance broadcast
        pubsub = await self._get_pubsub()
        if pubsub:
            await pubsub.publish(symbol.upper(), expiry, packed_data)
        
        # Also broadcast to local clients directly (in case Redis is slow or unavailable)
        return await self._broadcast_to_local_clients(symbol.upper(), expiry, packed_data)
    
    async def _broadcast_to_local_clients(
        self,
        symbol: str,
        expiry: str,
        packed_data: bytes
    ) -> int:
        """Broadcast pre-packed data to local clients only"""
        group_key = f"{symbol}:{expiry}"
        
        async with self._lock:
            clients = self.subscription_groups.get(group_key, set()).copy()
        
        if not clients:
            return 0
        
        sent_count = 0
        disconnected = []
        
        for client_id in clients:
            websocket = self.active_connections.get(client_id)
            if websocket:
                try:
                    await websocket.send_bytes(packed_data)
                    sent_count += 1
                except Exception as e:
                    logger.warning(f"Broadcast error for {client_id}: {e}")
                    disconnected.append(client_id)
        
        # Cleanup disconnected clients
        for client_id in disconnected:
            await self.disconnect(client_id)
        
        return sent_count
    
    async def broadcast_all(self, message: dict) -> int:
        """
        Broadcast a message to all connected clients.
        
        Args:
            message: Message to broadcast
            
        Returns:
            Number of clients sent to
        """
        async with self._lock:
            clients = list(self.active_connections.items())
        
        sent_count = 0
        
        for client_id, websocket in clients:
            try:
                await websocket.send_json(message)
                sent_count += 1
            except Exception:
                pass
        
        return sent_count
    
    def get_subscription(self, client_id: str) -> Optional[ClientSubscription]:
        """Get client's current subscription"""
        return self.subscriptions.get(client_id)
    
    def get_active_subscriptions(self) -> Dict[str, Set[str]]:
        """Get all active subscription groups"""
        return dict(self.subscription_groups)
    
    @property
    def connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)
    
    @property
    def subscription_count(self) -> int:
        """Get number of active subscriptions"""
        return len(self.subscriptions)


# Global connection manager instance
manager = ConnectionManager()


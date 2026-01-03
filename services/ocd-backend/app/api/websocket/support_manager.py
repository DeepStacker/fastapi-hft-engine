
import logging
import json
from typing import Dict, List
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)

class SupportConnectionManager:
    """
    Manages WebSocket connections for Support System.
    Maps ticket_id -> List of WebSockets.
    """
    def __init__(self):
        # Map ticket_id (str) -> List[WebSocket]
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, ticket_id: str):
        await websocket.accept()
        if ticket_id not in self.active_connections:
            self.active_connections[ticket_id] = []
        self.active_connections[ticket_id].append(websocket)
        logger.debug(f"Client connected to ticket {ticket_id}")

    def disconnect(self, websocket: WebSocket, ticket_id: str):
        if ticket_id in self.active_connections:
            if websocket in self.active_connections[ticket_id]:
                self.active_connections[ticket_id].remove(websocket)
            
            if not self.active_connections[ticket_id]:
                del self.active_connections[ticket_id]
        logger.debug(f"Client disconnected from ticket {ticket_id}")

    async def broadcast(self, ticket_id: str, message: dict):
        """Broadcast a message to all connected clients for a ticket"""
        if ticket_id in self.active_connections:
            payload = json.dumps(message)
            to_remove = []
            for connection in self.active_connections[ticket_id]:
                try:
                    await connection.send_text(payload)
                except Exception as e:
                    logger.warning(f"Failed to send to client: {e}")
                    to_remove.append(connection)
            
            # Cleanup broken connections
            for conn in to_remove:
                self.disconnect(conn, ticket_id)

    async def notify_typing(self, ticket_id: str, user_name: str, is_admin: bool):
        """Broadcast typing event"""
        await self.broadcast(ticket_id, {
            "type": "typing",
            "user": user_name,
            "is_admin": is_admin
        })

# Global instance
manager = SupportConnectionManager()

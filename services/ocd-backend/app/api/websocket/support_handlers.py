
import logging
from typing import Optional
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.websocket.support_manager import manager
from app.core.security import verify_firebase_token
from app.config.database import get_db
from app.models.support import SupportTicket
from sqlalchemy import select

logger = logging.getLogger(__name__)

async def get_ws_user(token: str):
    """
    Authenticate WebSocket connection via Query Token.
    Returns user payload or None.
    Does not hit DB for full user object to keep it light, unless needed.
    """
    if not token:
        return None
    try:
        # Reuse existing verification logic
        payload = verify_firebase_token(token)
        return payload
    except Exception as e:
        logger.warning(f"WS Auth failed: {e}")
        return None

async def support_websocket_endpoint(
    websocket: WebSocket, 
    ticket_id: str,
    token: str = Query(None)
):
    """
    WebSocket endpoint for a specific ticket chat.
    ws://.../ws/support/{ticket_id}?token={firebase_token}
    """
    user = await get_ws_user(token)
    
    if not user:
        # Close with policy violation if unauthorized
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, ticket_id)
    
    try:
        while True:
            # We principally listen for "typing" events or client-side pings
            # Real messages are sent via REST API to ensure persistence and atomicity
            data = await websocket.receive_json()
            
            if data.get("type") == "typing":
                # Broadcast typing status to others
                # We need to know who "I" am. 
                # user['name'] or user['email']
                user_name = user.get("name") or "User"
                # Determine if admin from token claims? 
                # For now, simplistic approach
                is_admin = False # Logic to check if admin role needed if we want distinction
                
                await manager.notify_typing(ticket_id, user_name, is_admin)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, ticket_id)
    except Exception as e:
        logger.error(f"WS Error: {e}")
        manager.disconnect(websocket, ticket_id)

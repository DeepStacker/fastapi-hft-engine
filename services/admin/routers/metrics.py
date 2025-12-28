"""
Metrics Router

WebSocket endpoint for streaming real-time system metrics.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.admin.services.metrics_streaming import metrics_manager
import logging

router = APIRouter(prefix="/metrics", tags=["metrics"])
logger = logging.getLogger("stockify.admin.metrics")


@router.websocket("/ws")
async def websocket_metrics(
    websocket: WebSocket,
    token: str = None
):
    """
    Stream real-time metrics via WebSocket
    """
    # Validate token
    # from services.admin.auth import get_current_admin_user_ws
    
    if not token:
        await websocket.close(code=1008)
        return
        
    try:
        # We need a way to validate token for WS. 
        # Since get_current_admin_user depends on HTTP Bearer, we need manual validation or a WS dependency.
        from core.config.settings import get_settings
        from jose import jwt, JWTError
        settings = get_settings()
        
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("sub") is None:
             await websocket.close(code=1008)
             return
    except Exception as e:
        logger.error(f"WS Auth failed: {e}")
        await websocket.close(code=1008)
        return

    await metrics_manager.connect(websocket)
    
    try:
        while True:
            # Keep connection alive and handle client messages if any
            # We don't expect messages from client, just keep-alive
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        metrics_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        metrics_manager.disconnect(websocket)

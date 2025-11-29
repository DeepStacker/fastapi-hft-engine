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
async def websocket_metrics(websocket: WebSocket):
    """
    Stream real-time metrics via WebSocket
    """
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

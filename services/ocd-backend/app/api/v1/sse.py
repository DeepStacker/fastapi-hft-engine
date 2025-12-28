"""
Server-Sent Events (SSE) Fallback for WebSocket

Provides SSE streaming as a fallback for environments where WebSocket is blocked.
Used when WebSocket connections fail after max retries.
"""
import asyncio
import logging
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse
import json

from app.config.settings import settings
from app.services.options import OptionsService
from app.services.dhan_client import DhanClient

logger = logging.getLogger(__name__)
router = APIRouter()


async def generate_sse_events(
    symbol: str,
    expiry: str,
    request: Request
) -> AsyncGenerator[str, None]:
    """
    Generate SSE events for live options data.
    
    Yields:
        SSE-formatted data strings
    """
    dhan_client = DhanClient()
    options_service = OptionsService(dhan_client)
    
    try:
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                logger.info(f"SSE client disconnected for {symbol}:{expiry}")
                break
            
            try:
                # Fetch live data
                data = await options_service.get_live_data(symbol, expiry)
                
                if data:
                    # Format as SSE event
                    event_data = json.dumps(data, default=str)
                    yield f"event: data\ndata: {event_data}\n\n"
                else:
                    # Send heartbeat if no data
                    yield f"event: heartbeat\ndata: {{}}\n\n"
                    
            except Exception as e:
                logger.error(f"SSE data fetch error: {e}")
                yield f"event: error\ndata: {{\"message\": \"Error fetching data\"}}\n\n"
            
            # Wait before next update (same as WebSocket interval)
            await asyncio.sleep(settings.WS_BROADCAST_INTERVAL)
            
    except asyncio.CancelledError:
        logger.info(f"SSE stream cancelled for {symbol}:{expiry}")
    finally:
        await dhan_client.close()


@router.get("/stream/{symbol}/{expiry}")
async def sse_stream(
    symbol: str,
    expiry: str,
    request: Request
):
    """
    SSE endpoint for live options data streaming.
    
    Use this as a fallback when WebSocket is unavailable.
    
    Args:
        symbol: Trading symbol (e.g., NIFTY)
        expiry: Expiry timestamp
    
    Returns:
        StreamingResponse with SSE events
    """
    logger.info(f"SSE connection started for {symbol}:{expiry}")
    
    return StreamingResponse(
        generate_sse_events(symbol.upper(), expiry, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.get("/poll/{symbol}/{expiry}")
async def poll_data(
    symbol: str,
    expiry: str
):
    """
    Long-polling endpoint as last-resort fallback.
    
    Returns single data snapshot (not streaming).
    Use this when both WebSocket and SSE are unavailable.
    """
    dhan_client = DhanClient()
    options_service = OptionsService(dhan_client)
    
    try:
        data = await options_service.get_live_data(symbol.upper(), expiry)
        return {"success": True, "data": data}
    except Exception as e:
        logger.error(f"Polling error: {e}")
        return {"success": False, "error": str(e)}
    finally:
        await dhan_client.close()

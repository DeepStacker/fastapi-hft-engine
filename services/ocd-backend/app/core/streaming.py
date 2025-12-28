"""
Response Streaming Utilities

Provides streaming responses for large datasets to reduce memory usage
and improve time-to-first-byte for clients.
"""
import asyncio
import json
import logging
from typing import AsyncIterator, Callable, Any, Optional
from functools import wraps

from fastapi import Response
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)


class JSONStreamEncoder:
    """
    Encode data as newline-delimited JSON for streaming.
    
    Format: Each line is a complete JSON object (NDJSON).
    This allows clients to parse incrementally.
    """
    
    @staticmethod
    def encode_line(data: Any) -> bytes:
        """Encode a single data item as JSON + newline."""
        return (json.dumps(data, separators=(',', ':')) + '\n').encode('utf-8')
    
    @staticmethod
    def encode_start(metadata: dict = None) -> bytes:
        """Encode stream start marker with optional metadata."""
        start = {"_stream": "start", "_metadata": metadata or {}}
        return JSONStreamEncoder.encode_line(start)
    
    @staticmethod
    def encode_end(summary: dict = None) -> bytes:
        """Encode stream end marker with optional summary."""
        end = {"_stream": "end", "_summary": summary or {}}
        return JSONStreamEncoder.encode_line(end)


async def stream_json_array(
    items: AsyncIterator[Any],
    chunk_size: int = 100,
    delay_ms: float = 0
) -> AsyncIterator[bytes]:
    """
    Stream items as JSON array chunks.
    
    Args:
        items: Async iterator of items to stream
        chunk_size: Number of items per chunk
        delay_ms: Optional delay between chunks (for rate limiting)
        
    Yields:
        JSON-encoded chunks
    """
    buffer = []
    count = 0
    
    # Start marker
    yield JSONStreamEncoder.encode_start({"chunk_size": chunk_size})
    
    async for item in items:
        buffer.append(item)
        count += 1
        
        if len(buffer) >= chunk_size:
            yield JSONStreamEncoder.encode_line({"data": buffer})
            buffer = []
            
            if delay_ms > 0:
                await asyncio.sleep(delay_ms / 1000)
    
    # Flush remaining items
    if buffer:
        yield JSONStreamEncoder.encode_line({"data": buffer})
    
    # End marker
    yield JSONStreamEncoder.encode_end({"total_items": count})


async def stream_option_chain(
    data: dict,
    strikes_per_chunk: int = 50
) -> AsyncIterator[bytes]:
    """
    Stream option chain data in chunks.
    
    Optimized for large option chains with many strikes.
    """
    yield JSONStreamEncoder.encode_start({
        "symbol": data.get("symbol"),
        "expiry": data.get("expiry"),
        "total_strikes": len(data.get("oc", {}))
    })
    
    # Stream metadata first
    meta = {k: v for k, v in data.items() if k != "oc"}
    yield JSONStreamEncoder.encode_line({"type": "metadata", "data": meta})
    
    # Stream strikes in chunks
    oc_data = data.get("oc", {})
    strikes = list(oc_data.items())
    
    for i in range(0, len(strikes), strikes_per_chunk):
        chunk = dict(strikes[i:i + strikes_per_chunk])
        yield JSONStreamEncoder.encode_line({"type": "strikes", "data": chunk})
        await asyncio.sleep(0.001)  # Yield control
    
    yield JSONStreamEncoder.encode_end({"strikes_sent": len(strikes)})


def create_streaming_response(
    generator: AsyncIterator[bytes],
    media_type: str = "application/x-ndjson"
) -> StreamingResponse:
    """
    Create a FastAPI StreamingResponse from an async generator.
    """
    return StreamingResponse(
        generator,
        media_type=media_type,
        headers={
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "Transfer-Encoding": "chunked",
        }
    )


def streaming_endpoint(chunk_size: int = 100):
    """
    Decorator to convert a list-returning endpoint to streaming.
    
    Usage:
        @app.get("/data")
        @streaming_endpoint(chunk_size=50)
        async def get_data():
            return large_list  # Will be streamed
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            if isinstance(result, list) and len(result) > chunk_size:
                async def generate():
                    for i in range(0, len(result), chunk_size):
                        chunk = result[i:i + chunk_size]
                        yield JSONStreamEncoder.encode_line({"chunk": chunk})
                        await asyncio.sleep(0.001)
                
                return create_streaming_response(generate())
            
            return result
        
        return wrapper
    return decorator


# Example usage in FastAPI router:
"""
from app.core.streaming import stream_option_chain, create_streaming_response

@router.get("/options/stream/{symbol}/{expiry}")
async def stream_options(symbol: str, expiry: str, service = Depends(get_service)):
    data = await service.get_live_data(symbol, expiry)
    return create_streaming_response(stream_option_chain(data))
"""

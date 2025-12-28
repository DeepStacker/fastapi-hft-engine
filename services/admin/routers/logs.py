"""
Log Streaming Router

WebSocket endpoint for streaming Docker container logs.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query
from services.admin.services.docker_manager import docker_manager
from services.admin.auth import get_current_admin_user
import asyncio
import logging

router = APIRouter(prefix="/logs", tags=["logs"])
logger = logging.getLogger("stockify.admin.logs")


@router.websocket("/ws/{container_id}")
async def websocket_logs(
    websocket: WebSocket,
    container_id: str,
    tail: int = 100,
    token: str = Query(None)
):
    """
    Stream container logs via WebSocket
    """
    from core.config.settings import get_settings
    from jose import jwt, JWTError
    from fastapi import status
    
    settings = get_settings()
    
    # Validate token
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("sub") is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    
    try:
        # Get container
        container = docker_manager.get_container(container_id)
        
        if not container:
            await websocket.send_text(f"Error: Container {container_id} not found")
            await websocket.close()
            return
            
        # Create a queue for log lines
        log_queue = asyncio.Queue()
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()
        
        # Flag to stop the thread
        should_stop = False
        
        def read_logs():
            logger.info(f"Thread started reading logs for {container_id}")
            try:
                # Stream logs (blocking)
                log_stream = container.logs(stream=True, follow=True, tail=tail)
                for line in log_stream:
                    if should_stop:
                        break
                    if isinstance(line, bytes):
                        line = line.decode('utf-8')
                    
                    # Put into queue safely
                    asyncio.run_coroutine_threadsafe(log_queue.put(line), loop)
                logger.info(f"Log stream finished for {container_id}")
            except Exception as e:
                logger.error(f"Error reading logs in thread for {container_id}: {e}")
                asyncio.run_coroutine_threadsafe(log_queue.put(f"Error: {str(e)}"), loop)
        
        # Start log reading in a separate thread
        import threading
        log_thread = threading.Thread(target=read_logs, daemon=True)
        log_thread.start()
        logger.info(f"Started log thread for {container_id}")
        
        try:
            while True:
                # Wait for next log line
                line = await log_queue.get()
                await websocket.send_text(line)
                
        except WebSocketDisconnect:
            logger.info(f"Client disconnected from log stream for {container_id}")
        except Exception as e:
            logger.error(f"WebSocket error for {container_id}: {e}")
        finally:
            should_stop = True
            
    except Exception as e:
        logger.error(f"Setup error: {e}")
        try:
            await websocket.close()
        except:
            pass

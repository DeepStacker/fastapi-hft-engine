"""
Metrics Streaming Service

Collects and broadcasts real-time Docker container metrics.
"""
import asyncio
import logging
from typing import List, Dict
from fastapi import WebSocket
from services.admin.services.docker_manager import docker_manager

logger = logging.getLogger("stockify.admin.metrics")


class MetricsManager:
    """Manage real-time metrics streaming"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.is_running = False
        self._task = None
    
    async def connect(self, websocket: WebSocket):
        """Connect a new client"""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # Start background task if not running
        if not self.is_running:
            self.start_collection()
    
    def disconnect(self, websocket: WebSocket):
        """Disconnect a client"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            
        # Stop background task if no clients
        if not self.active_connections and self.is_running:
            self.stop_collection()
    
    def start_collection(self):
        """Start metrics collection task"""
        self.is_running = True
        self._task = asyncio.create_task(self._broadcast_metrics())
        logger.info("Started metrics collection task")
    
    def stop_collection(self):
        """Stop metrics collection task"""
        self.is_running = False
        if self._task:
            self._task.cancel()
        logger.info("Stopped metrics collection task")
    
    async def _broadcast_metrics(self):
        """Collect and broadcast metrics loop"""
        while self.is_running:
            try:
                if not self.active_connections:
                    break
                
                # Collect metrics for all containers
                # Collect metrics for all containers concurrently
                containers = await asyncio.to_thread(docker_manager.list_containers, all=False)
                
                async def get_stats_safe(container):
                    try:
                        # Run blocking docker call in thread pool
                        stats = await asyncio.to_thread(docker_manager.get_container_stats, container['id'])
                        if stats:
                            return {
                                "id": container['id'],
                                "name": container['name'],
                                "stats": stats
                            }
                    except Exception as e:
                        logger.error(f"Error getting stats for {container['name']}: {e}")
                    return None

                # Create tasks for all containers
                tasks = [get_stats_safe(c) for c in containers]
                results = await asyncio.gather(*tasks)
                
                # Filter out None results
                metrics_data = [r for r in results if r]
                
                # Broadcast to all clients
                disconnected = []
                for connection in self.active_connections:
                    try:
                        await connection.send_json({
                            "type": "metrics_update",
                            "timestamp": asyncio.get_event_loop().time(),
                            "data": metrics_data
                        })
                    except Exception:
                        disconnected.append(connection)
                
                # Clean up disconnected clients
                for conn in disconnected:
                    self.disconnect(conn)
                
                # Wait before next update
                await asyncio.sleep(2)  # 2 second interval
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in metrics broadcast: {e}")
                await asyncio.sleep(5)  # Wait longer on error


# Singleton instance
metrics_manager = MetricsManager()

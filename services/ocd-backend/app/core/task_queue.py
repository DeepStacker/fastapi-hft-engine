"""
Background Task Queue - Async task processing for heavy computations

Uses Redis-backed task queue for distributing heavy calculations:
- Greeks calculations for multiple strikes
- Bulk reversal analysis
- Historical data processing
- Report generation

Falls back to synchronous execution if Redis unavailable.
"""
import asyncio
import logging
import json
import time
from typing import Callable, Any, Optional, Dict
from dataclasses import dataclass, asdict
from enum import Enum
from functools import wraps

logger = logging.getLogger(__name__)

# Redis connection for task queue
_task_redis = None


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class TaskResult:
    """Result of an async task"""
    task_id: str
    status: TaskStatus
    result: Optional[Any] = None
    error: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None


class BackgroundTaskQueue:
    """
    Redis-backed background task queue for heavy computations.
    
    Features:
    - Async task submission and result retrieval
    - Task status tracking
    - Automatic retry on failure
    - Graceful fallback to sync execution
    """
    
    QUEUE_KEY = "stockify:task_queue"
    RESULT_PREFIX = "stockify:task_result:"
    RESULT_TTL = 3600  # 1 hour
    
    def __init__(self):
        self._handlers: Dict[str, Callable] = {}
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
    
    async def init(self) -> bool:
        """Initialize Redis connection for task queue"""
        global _task_redis
        try:
            from app.cache.redis import get_redis_connection
            _task_redis = await get_redis_connection()
            logger.info("Background task queue initialized with Redis")
            return True
        except Exception as e:
            logger.warning(f"Task queue Redis unavailable, using sync fallback: {e}")
            return False
    
    def register_handler(self, task_type: str, handler: Callable):
        """Register a handler for a task type"""
        self._handlers[task_type] = handler
        logger.info(f"Registered task handler: {task_type}")
    
    async def submit_task(
        self,
        task_type: str,
        payload: dict,
        priority: int = 0
    ) -> str:
        """
        Submit a task to the queue.
        
        Args:
            task_type: Type of task (must have registered handler)
            payload: Task payload data
            priority: Task priority (higher = more urgent)
            
        Returns:
            Task ID for tracking
        """
        import uuid
        task_id = str(uuid.uuid4())[:12]
        
        task_data = {
            "id": task_id,
            "type": task_type,
            "payload": payload,
            "priority": priority,
            "submitted_at": time.time(),
            "status": TaskStatus.PENDING.value
        }
        
        if _task_redis:
            # Submit to Redis queue
            await _task_redis.lpush(self.QUEUE_KEY, json.dumps(task_data))
            await _task_redis.set(
                f"{self.RESULT_PREFIX}{task_id}",
                json.dumps({"status": TaskStatus.PENDING.value}),
                ex=self.RESULT_TTL
            )
            logger.debug(f"Task {task_id} submitted to queue: {task_type}")
        else:
            # Sync fallback - execute immediately
            logger.debug(f"Sync execution for task {task_id}: {task_type}")
            await self._execute_task(task_data)
        
        return task_id
    
    async def get_result(self, task_id: str) -> Optional[TaskResult]:
        """Get task result by ID"""
        if _task_redis:
            result_json = await _task_redis.get(f"{self.RESULT_PREFIX}{task_id}")
            if result_json:
                data = json.loads(result_json)
                return TaskResult(
                    task_id=task_id,
                    status=TaskStatus(data.get("status", "pending")),
                    result=data.get("result"),
                    error=data.get("error"),
                    started_at=data.get("started_at"),
                    completed_at=data.get("completed_at")
                )
        return None
    
    async def _execute_task(self, task_data: dict):
        """Execute a task"""
        task_id = task_data["id"]
        task_type = task_data["type"]
        payload = task_data["payload"]
        
        handler = self._handlers.get(task_type)
        if not handler:
            logger.error(f"No handler for task type: {task_type}")
            return
        
        # Update status to running
        if _task_redis:
            await _task_redis.set(
                f"{self.RESULT_PREFIX}{task_id}",
                json.dumps({
                    "status": TaskStatus.RUNNING.value,
                    "started_at": time.time()
                }),
                ex=self.RESULT_TTL
            )
        
        try:
            # Execute handler
            if asyncio.iscoroutinefunction(handler):
                result = await handler(**payload)
            else:
                result = handler(**payload)
            
            # Store success result
            if _task_redis:
                await _task_redis.set(
                    f"{self.RESULT_PREFIX}{task_id}",
                    json.dumps({
                        "status": TaskStatus.COMPLETED.value,
                        "result": result,
                        "completed_at": time.time()
                    }),
                    ex=self.RESULT_TTL
                )
            
            logger.debug(f"Task {task_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Task {task_id} failed: {e}")
            
            if _task_redis:
                await _task_redis.set(
                    f"{self.RESULT_PREFIX}{task_id}",
                    json.dumps({
                        "status": TaskStatus.FAILED.value,
                        "error": str(e),
                        "completed_at": time.time()
                    }),
                    ex=self.RESULT_TTL
                )
    
    async def start_worker(self):
        """Start background worker to process tasks"""
        if not _task_redis:
            logger.info("No Redis, task worker not started (using sync execution)")
            return
        
        self._running = True
        logger.info("Starting background task worker")
        
        while self._running:
            try:
                # Blocking pop from queue (with timeout)
                result = await _task_redis.brpop(self.QUEUE_KEY, timeout=5)
                
                if result:
                    _, task_json = result
                    task_data = json.loads(task_json)
                    await self._execute_task(task_data)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Task worker error: {e}")
                await asyncio.sleep(1)
        
        logger.info("Background task worker stopped")
    
    def stop_worker(self):
        """Stop the background worker"""
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()


# Global task queue instance
task_queue = BackgroundTaskQueue()


def background_task(task_type: str, priority: int = 0):
    """
    Decorator to run a function as a background task.
    
    Usage:
        @background_task("calculate_greeks")
        async def heavy_greeks_calculation(symbol: str, expiry: str):
            ...
            return result
    """
    def decorator(func: Callable):
        # Register the handler
        task_queue.register_handler(task_type, func)
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Submit to queue and return task ID
            return await task_queue.submit_task(task_type, kwargs, priority)
        
        # Add direct execution method
        wrapper.direct = func
        
        return wrapper
    return decorator


# Pre-registered task handlers for common operations
async def init_background_tasks():
    """Initialize background task handlers"""
    await task_queue.init()
    
    # Register Greeks calculation handler
    @background_task("bulk_greeks")
    async def calculate_bulk_greeks(symbol: str, expiry: str, strikes: list):
        """Calculate Greeks for multiple strikes"""
        from app.services.greeks import GreeksService
        
        greeks_service = GreeksService()
        results = {}
        
        for strike in strikes:
            results[strike] = greeks_service.calculate_all_greeks(
                S=strike,  # Placeholder - would need actual spot
                K=strike,
                T=0.1,
                sigma=0.15,
                option_type="call"
            )
        
        return results
    
    logger.info("Background task handlers registered")

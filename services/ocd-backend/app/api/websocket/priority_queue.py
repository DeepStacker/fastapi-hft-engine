"""
WebSocket Message Priority Queue

Implements message prioritization and backpressure handling for WebSocket connections.
High-priority messages (alerts, trades) are sent immediately while low-priority
updates are queued and throttled.
"""
import asyncio
import logging
from enum import IntEnum
from typing import Dict, Optional, Any
from dataclasses import dataclass, field
from collections import deque
import time

logger = logging.getLogger(__name__)


class MessagePriority(IntEnum):
    """Message priority levels - lower number = higher priority"""
    CRITICAL = 0    # System alerts, connection issues
    HIGH = 1        # Price alerts, trade confirmations
    NORMAL = 2      # Option chain data updates
    LOW = 3         # Analytics, historical data
    BULK = 4        # Large data transfers, background sync


@dataclass
class PrioritizedMessage:
    """A message with priority metadata"""
    priority: MessagePriority
    data: Any
    timestamp: float = field(default_factory=time.time)
    message_type: str = ""
    
    def __lt__(self, other):
        """Priority queue ordering - lower priority number first, then older first"""
        if self.priority != other.priority:
            return self.priority < other.priority
        return self.timestamp < other.timestamp


class MessagePriorityQueue:
    """
    Priority-based message queue with backpressure handling.
    
    Features:
    - Priority levels for different message types
    - Per-priority queue limits
    - Automatic dropping of low-priority messages under pressure
    - Metrics for monitoring
    """
    
    # Default queue limits per priority level
    DEFAULT_LIMITS = {
        MessagePriority.CRITICAL: 100,
        MessagePriority.HIGH: 500,
        MessagePriority.NORMAL: 1000,
        MessagePriority.LOW: 200,
        MessagePriority.BULK: 50,
    }
    
    def __init__(self, limits: Dict[MessagePriority, int] = None):
        self.limits = limits or self.DEFAULT_LIMITS
        self.queues: Dict[MessagePriority, deque] = {
            p: deque(maxlen=self.limits.get(p, 100))
            for p in MessagePriority
        }
        self.dropped_counts: Dict[MessagePriority, int] = {p: 0 for p in MessagePriority}
        self.sent_counts: Dict[MessagePriority, int] = {p: 0 for p in MessagePriority}
        self._lock = asyncio.Lock()
    
    async def enqueue(
        self,
        data: Any,
        priority: MessagePriority = MessagePriority.NORMAL,
        message_type: str = ""
    ) -> bool:
        """
        Add a message to the queue.
        
        Returns True if queued, False if dropped due to backpressure.
        """
        async with self._lock:
            queue = self.queues[priority]
            
            # Check if queue is at limit
            if len(queue) >= self.limits.get(priority, 100):
                self.dropped_counts[priority] += 1
                
                # Log warnings for high-priority drops
                if priority <= MessagePriority.HIGH:
                    logger.warning(
                        f"Dropped {priority.name} message due to backpressure: {message_type}"
                    )
                return False
            
            msg = PrioritizedMessage(
                priority=priority,
                data=data,
                message_type=message_type
            )
            queue.append(msg)
            return True
    
    async def dequeue(self, batch_size: int = 10) -> list[PrioritizedMessage]:
        """
        Get next batch of messages, prioritized by level.
        
        Higher priority messages are always returned first.
        """
        async with self._lock:
            messages = []
            remaining = batch_size
            
            # Process queues in priority order
            for priority in MessagePriority:
                queue = self.queues[priority]
                while queue and remaining > 0:
                    msg = queue.popleft()
                    messages.append(msg)
                    self.sent_counts[priority] += 1
                    remaining -= 1
                
                if remaining == 0:
                    break
            
            return messages
    
    async def dequeue_by_priority(
        self,
        priority: MessagePriority,
        max_count: int = 10
    ) -> list[PrioritizedMessage]:
        """Get messages from a specific priority queue only."""
        async with self._lock:
            queue = self.queues[priority]
            messages = []
            while queue and len(messages) < max_count:
                messages.append(queue.popleft())
                self.sent_counts[priority] += 1
            return messages
    
    def queue_size(self, priority: Optional[MessagePriority] = None) -> int:
        """Get current queue size, optionally for specific priority."""
        if priority is not None:
            return len(self.queues[priority])
        return sum(len(q) for q in self.queues.values())
    
    def is_under_pressure(self, threshold: float = 0.8) -> bool:
        """Check if any queue is above threshold capacity."""
        for priority, queue in self.queues.items():
            limit = self.limits.get(priority, 100)
            if len(queue) / limit > threshold:
                return True
        return False
    
    def get_stats(self) -> dict:
        """Get queue statistics for monitoring."""
        return {
            "queue_sizes": {p.name: len(q) for p, q in self.queues.items()},
            "dropped": {p.name: c for p, c in self.dropped_counts.items()},
            "sent": {p.name: c for p, c in self.sent_counts.items()},
            "under_pressure": self.is_under_pressure(),
        }
    
    def clear(self, priority: Optional[MessagePriority] = None):
        """Clear queue(s)."""
        if priority is not None:
            self.queues[priority].clear()
        else:
            for queue in self.queues.values():
                queue.clear()


class PrioritizedWebSocketSender:
    """
    Manages prioritized message sending for a WebSocket connection.
    
    Runs a background task that processes the queue and sends messages.
    """
    
    def __init__(
        self,
        websocket,
        client_id: str,
        send_interval: float = 0.05,  # 50ms between sends
        batch_size: int = 5
    ):
        self.websocket = websocket
        self.client_id = client_id
        self.send_interval = send_interval
        self.batch_size = batch_size
        self.queue = MessagePriorityQueue()
        self._running = False
        self._task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start the background sender task."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._sender_loop())
        logger.debug(f"Started prioritized sender for {self.client_id}")
    
    async def stop(self):
        """Stop the background sender task."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.debug(f"Stopped prioritized sender for {self.client_id}")
    
    async def send(
        self,
        data: Any,
        priority: MessagePriority = MessagePriority.NORMAL,
        message_type: str = ""
    ) -> bool:
        """Queue a message for sending."""
        return await self.queue.enqueue(data, priority, message_type)
    
    async def send_immediate(self, data: Any) -> bool:
        """Send a message immediately, bypassing the queue."""
        try:
            import msgpack
            packed = msgpack.packb(data, use_bin_type=True)
            await self.websocket.send_bytes(packed)
            return True
        except Exception as e:
            logger.error(f"Immediate send failed for {self.client_id}: {e}")
            return False
    
    async def _sender_loop(self):
        """Background loop that processes the queue."""
        import msgpack
        
        while self._running:
            try:
                # Get batch of prioritized messages
                messages = await self.queue.dequeue(self.batch_size)
                
                if messages:
                    # Combine messages into single send when possible
                    if len(messages) == 1:
                        packed = msgpack.packb(messages[0].data, use_bin_type=True)
                    else:
                        # Batch multiple messages
                        batch = {
                            "type": "batch",
                            "messages": [m.data for m in messages]
                        }
                        packed = msgpack.packb(batch, use_bin_type=True)
                    
                    await self.websocket.send_bytes(packed)
                
                # Sleep before next iteration
                await asyncio.sleep(self.send_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Sender loop error for {self.client_id}: {e}")
                await asyncio.sleep(0.1)  # Back off on error
    
    def get_stats(self) -> dict:
        """Get sender statistics."""
        return {
            "client_id": self.client_id,
            "running": self._running,
            **self.queue.get_stats()
        }


# Message type to priority mapping
MESSAGE_PRIORITY_MAP = {
    # Critical
    "error": MessagePriority.CRITICAL,
    "disconnect": MessagePriority.CRITICAL,
    "system_alert": MessagePriority.CRITICAL,
    
    # High
    "price_alert": MessagePriority.HIGH,
    "trade_confirmation": MessagePriority.HIGH,
    "order_update": MessagePriority.HIGH,
    "limit_breach": MessagePriority.HIGH,
    
    # Normal
    "option_chain": MessagePriority.NORMAL,
    "live_data": MessagePriority.NORMAL,
    "spot_update": MessagePriority.NORMAL,
    
    # Low
    "analytics": MessagePriority.LOW,
    "greeks_update": MessagePriority.LOW,
    "historical": MessagePriority.LOW,
    
    # Bulk
    "full_sync": MessagePriority.BULK,
    "initial_load": MessagePriority.BULK,
}


def get_message_priority(message_type: str) -> MessagePriority:
    """Get priority for a message type."""
    return MESSAGE_PRIORITY_MAP.get(message_type, MessagePriority.NORMAL)

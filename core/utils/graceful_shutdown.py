"""
Graceful Shutdown Handler

Ensures all services shut down cleanly without data loss.
"""
import asyncio
import signal
from typing import List, Callable
import logging

logger = logging.getLogger("stockify.shutdown")


class GracefulShutdown:
    """Manages graceful shutdown of application"""
    
    def __init__(self):
        self.shutdown_handlers: List[Callable] = []
        self.is_shutting_down = False
        
    def register_handler(self, handler: Callable):
        """Register a shutdown handler"""
        self.shutdown_handlers.append(handler)
        
    async def shutdown(self):
        """Execute all shutdown handlers"""
        if self.is_shutting_down:
            return
            
        self.is_shutting_down = True
        logger.info("Initiating graceful shutdown...")
        
        # Execute all handlers
        for handler in self.shutdown_handlers:
            try:
                logger.info(f"Executing shutdown handler: {handler.__name__}")
                if asyncio.iscoroutinefunction(handler):
                    await handler()
                else:
                    handler()
            except Exception as e:
                logger.error(f"Error in shutdown handler {handler.__name__}: {e}")
        
        logger.info("Graceful shutdown complete")
    
    def setup_signal_handlers(self, loop=None):
        """Setup signal handlers for graceful shutdown"""
        if loop is None:
            loop = asyncio.get_event_loop()
        
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(
                sig,
                lambda: asyncio.create_task(self.shutdown())
            )


# Global shutdown manager
shutdown_manager = GracefulShutdown()

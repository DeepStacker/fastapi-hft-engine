"""
Graceful Shutdown Handler

Ensures clean shutdown of services with buffer flushing and connection cleanup.
"""
import signal
import asyncio
import structlog
from typing import Callable, List, Optional
import sys

logger = structlog.get_logger(__name__)


class GracefulShutdown:
    """
    Graceful shutdown coordinator
    
    Handles SIGTERM and SIGINT to ensure clean service shutdown.
    """
    
    def __init__(self, service_name: str):
        """
        Initialize graceful shutdown handler
        
        Args:
            service_name: Name of the service for logging
        """
        self.service_name = service_name
        self._shutdown_callbacks: List[Callable] = []
        self._is_shutting_down = False
        self._shutdown_event = asyncio.Event()
        
    def register_callback(self, callback: Callable):
        """
        Register a cleanup callback to be called on shutdown
        
        Args:
            callback: Async or sync function to call during shutdown
        """
        self._shutdown_callbacks.append(callback)
        logger.debug(
            f"Registered shutdown callback",
            service=self.service_name,
            callback=callback.__name__
        )
        
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            """Handle shutdown signals"""
            sig_name = signal.Signals(signum).name
            logger.info(
                f"Received shutdown signal",
                service=self.service_name,
                signal=sig_name
            )
            
            if not self._is_shutting_down:
                self._is_shutting_down = True
                # Trigger shutdown event
                asyncio.create_task(self.shutdown())
            else:
                logger.warning(
                    "Shutdown already in progress",
                    service=self.service_name
                )
        
        # Register handlers for graceful shutdown signals
        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)
        
        logger.info(
            "Signal handlers registered",
            service=self.service_name
        )
        
    async def shutdown(self):
        """Execute shutdown sequence"""
        if self._is_shutting_down:
            logger.info(
                "Starting graceful shutdown",
                service=self.service_name,
                callbacks=len(self._shutdown_callbacks)
            )
            
            # Execute all registered callbacks
            for callback in self._shutdown_callbacks:
                try:
                    logger.info(
                        f"Executing shutdown callback",
                        service=self.service_name,
                        callback=callback.__name__
                    )
                    
                    if asyncio.iscoroutinefunction(callback):
                        await callback()
                    else:
                        callback()
                        
                except Exception as e:
                    logger.error(
                        f"Error in shutdown callback",
                        service=self.service_name,
                        callback=callback.__name__,
                        error=str(e),
                        exc_info=e
                    )
            
            logger.info(
                "Graceful shutdown complete",
                service=self.service_name
            )
            
            # Set shutdown event
            self._shutdown_event.set()
            
    async def wait_for_shutdown(self):
        """Wait for shutdown signal"""
        await self._shutdown_event.wait()
        
    @property
    def is_shutting_down(self) -> bool:
        """Check if shutdown is in progress"""
        return self._is_shutting_down


# Global shutdown coordinator instances
_shutdown_coordinators = {}


def get_shutdown_handler(service_name: str) -> GracefulShutdown:
    """
    Get or create shutdown handler for a service
    
    Args:
        service_name: Name of the service
        
    Returns:
        GracefulShutdown instance
    """
    if service_name not in _shutdown_coordinators:
        _shutdown_coordinators[service_name] = GracefulShutdown(service_name)
    return _shutdown_coordinators[service_name]

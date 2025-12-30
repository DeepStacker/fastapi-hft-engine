"""
Unified Logging Configuration

All services should use this configuration for consistent logging.
"""
import structlog
import logging
import sys
from typing import Optional


def configure_logging(
    service_name: str = "stockify",
    log_level: str = "INFO",
    json_format: bool = False
) -> None:
    """
    Configure unified logging for all services.
    
    Args:
        service_name: Name of the service (appears in logs)
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        json_format: Use JSON format (for production) vs colored console (dev)
    """
    
    # Determine log level
    level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Configure structlog processors
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]
    
    if json_format:
        # Production: JSON output
        processors = shared_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ]
    else:
        # Development: Colored console output
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True)
        ]
    
    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Configure root logger
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )
    
    # Silence noisy third-party loggers
    noisy_loggers = [
        "httpcore",
        "httpx",
        "urllib3",
        "asyncio",
        "aiokafka",
        "kafka",
        "sqlalchemy.engine",
    ]
    for logger_name in noisy_loggers:
        logging.getLogger(logger_name).setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.BoundLogger:
    """Get a logger with the given name"""
    return structlog.get_logger(name)


# Service-specific loggers
def get_service_logger(service: str) -> structlog.BoundLogger:
    """Get a logger bound to a service context"""
    return structlog.get_logger().bind(service=service)

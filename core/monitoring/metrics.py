from prometheus_client import Counter, Histogram, start_http_server
from core.config.settings import get_settings
from core.logging.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()

# Standard Metrics
MESSAGES_PROCESSED = Counter(
    "messages_processed_total", 
    "Total number of messages processed",
    ["service", "status"]
)

PROCESSING_TIME = Histogram(
    "processing_seconds",
    "Time spent processing a message",
    ["service"]
)

DB_WRITE_LATENCY = Histogram(
    "db_write_latency_seconds",
    "Time spent writing to database",
    ["table"]
)

def start_metrics_server(port: int = 8000):
    """Start the Prometheus metrics server."""
    try:
        start_http_server(port)
        logger.info(f"Metrics server started on port {port}")
    except Exception as e:
        logger.error(f"Failed to start metrics server: {e}")

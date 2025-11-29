from prometheus_client import Counter, Histogram, Gauge, start_http_server
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

INGESTION_COUNT = Counter(
    "ingestion_messages_total",
    "Total number of messages ingested",
    ["symbol"]
)

INGESTION_ERRORS = Counter(
    "ingestion_errors_total",
    "Total number of ingestion errors",
    ["type"]
)

# Processor Metrics
PROCESSOR_MESSAGES_TOTAL = Counter(
    "processor_messages_total",
    "Total messages processed by processor service",
    ["status"]  # success, error
)

PROCESSOR_ERRORS_TOTAL = Counter(
    "processor_errors_total",
    "Total processor errors",
    ["error_type"]  # processing_error, analysis_error, etc.
)

PROCESSOR_LATENCY = Histogram(
    "processor_latency_seconds",
    "Processor message processing time"
)

DATA_QUALITY_ISSUES = Counter(
    "data_quality_issues_total",
    "Data quality issues detected",
    ["issue_type"]  # no_valid_options, high_illiquidity, etc.
)

def start_metrics_server(port: int = 8000):
    """Start the Prometheus metrics server."""
    try:
        start_http_server(port)
        logger.info(f"Metrics server started on port {port}")
    except Exception as e:
        logger.error(f"Failed to start metrics server: {e}")

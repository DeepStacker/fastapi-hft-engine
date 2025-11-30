"""
Comprehensive Prometheus Metrics

All application metrics for monitoring and observability.
"""

from prometheus_client import Counter, Histogram, Gauge, Info, start_http_server
import time

def start_metrics_server(port: int):
    """Start Prometheus metrics server"""
    start_http_server(port)


# ============================================================================
# REQUEST METRICS
# ============================================================================

# API request counter
api_requests_total = Counter(
    'api_requests_total',
    'Total API requests',
    ['service', 'endpoint', 'method', 'status_code']
)

# Request duration histogram
api_request_duration_seconds = Histogram(
    'api_request_duration_seconds',
    'API request duration in seconds',
    ['service', 'endpoint'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# Rate limit hits
rate_limit_hits_total = Counter(
    'rate_limit_hits_total',
    'Rate limit exceeded count',
    ['tier', 'limit_type']  # limit_type: minute/day
)


# ============================================================================
# BUSINESS METRICS
# ============================================================================

# Pattern detection
patterns_detected_total = Counter(
    'patterns_detected_total',
    'Total patterns detected',
    ['symbol_id', 'pattern_type', 'signal']
)

# Active API keys
api_keys_active = Gauge(
    'api_keys_active',
    'Number of active API keys',
    ['tier']
)

# API usage by tier
api_usage_by_tier = Counter(
    'api_usage_by_tier_total',
    'API requests by tier',
    ['tier']
)


# ============================================================================
# DATABASE METRICS
# ============================================================================

# Database query duration
db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Database query duration',
    ['operation', 'table'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

# Connection pool metrics
db_pool_connections = Gauge(
    'db_pool_connections',
    'Database pool connections',
    ['state']  # state: checked_in/checked_out/total
)

# Database errors
db_errors_total = Counter(
    'db_errors_total',
    'Database errors',
    ['error_type']
)


# ============================================================================
# KAFKA METRICS
# ============================================================================

# Messages processed
kafka_messages_processed_total = Counter(
    'kafka_messages_processed_total',
    'Kafka messages processed',
    ['topic', 'status']  # status: success/failed
)

# Consumer lag
kafka_consumer_lag = Gauge(
    'kafka_consumer_lag',
    'Kafka consumer lag',
    ['topic', 'partition']
)

# DLQ messages
kafka_dlq_messages_total = Counter(
    'kafka_dlq_messages_total',
    'Messages sent to dead letter queue',
    ['topic', 'error_type']
)


# ============================================================================
# REDIS METRICS
# ============================================================================

# Cache operations
cache_operations_total = Counter(
    'cache_operations_total',
    'Cache operations',
    ['operation', 'result']  # operation: get/set, result: hit/miss
)

# Cache hit rate
cache_hit_rate = Gauge(
    'cache_hit_rate_percent',
    'Cache hit rate percentage'
)


# ============================================================================
# CIRCUIT BREAKER METRICS
# ============================================================================

# Circuit breaker state
circuit_breaker_state = Gauge(
    'circuit_breaker_state',
    'Circuit breaker state',
    ['service']  # 0=closed, 1=open, 2=half-open
)

# Circuit breaker transitions
circuit_breaker_transitions_total = Counter(
    'circuit_breaker_transitions_total',
    'Circuit breaker state transitions',
    ['service', 'from_state', 'to_state']
)


# ============================================================================
# ANALYZER METRICS
# ============================================================================

# Analyzer execution time
analyzer_duration_seconds = Histogram(
    'analyzer_duration_seconds',
    'Analyzer execution duration',
    ['analyzer_name'],
    buckets=[0.001, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0]
)

# Options processed
options_processed_total = Counter(
    'options_processed_total',
    'Options processed',
    ['symbol_id', 'option_type']
)


# ============================================================================
# ERROR METRICS
# ============================================================================

# Errors by severity
errors_total = Counter(
    'errors_total',
    'Errors by severity',
    ['service', 'severity', 'error_type']
)

# Exceptions
exceptions_total = Counter(
    'exceptions_total',
    'Unhandled exceptions',
    ['service', 'exception_type']
)


# ============================================================================
# SYSTEM METRICS
# ============================================================================

# Service info
service_info = Info(
    'service_info',
    'Service information'
)

# Uptime
service_uptime_seconds = Gauge(
    'service_uptime_seconds',
    'Service uptime in seconds'
)


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def track_request(service: str, endpoint: str, method: str, status_code: int, duration: float):
    """Track API request metrics"""
    api_requests_total.labels(
        service=service,
        endpoint=endpoint,
        method=method,
        status_code=status_code
    ).inc()
    
    api_request_duration_seconds.labels(
        service=service,
        endpoint=endpoint
    ).observe(duration)


def track_db_query(operation: str, table: str, duration: float):
    """Track database query metrics"""
    db_query_duration_seconds.labels(
        operation=operation,
        table=table
    ).observe(duration)


def track_cache_operation(operation: str, hit: bool):
    """Track cache operation"""
    result = "hit" if hit else "miss"
    cache_operations_total.labels(
        operation=operation,
        result=result
    ).inc()


def track_pattern(symbol_id: int, pattern_type: str, signal: str):
    """Track detected pattern"""
    patterns_detected_total.labels(
        symbol_id=str(symbol_id),
        pattern_type=pattern_type,
        signal=signal
    ).inc()


def update_pool_metrics(pool):
    """Update connection pool metrics"""
    db_pool_connections.labels(state="checked_in").set(pool.checkedin())
    db_pool_connections.labels(state="checked_out").set(pool.checkedout())
    db_pool_connections.labels(state="total").set(pool.size() + pool.overflow())


# ============================================================================
# PROCESSOR METRICS
# ============================================================================

PROCESSOR_MESSAGES_TOTAL = Counter(
    'processor_messages_total',
    'Total messages processed by processor',
    ['status']
)

PROCESSOR_ERRORS_TOTAL = Counter(
    'processor_errors_total',
    'Total processor errors',
    ['error_type']
)

PROCESSOR_LATENCY = Histogram(
    'processor_latency_seconds',
    'Processor message processing latency',
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

DATA_QUALITY_ISSUES = Counter(
    'data_quality_issues_total',
    'Data quality issues encountered',
    ['issue_type']
)

# ============================================================================
# SHARED / LEGACY METRICS
# ============================================================================

MESSAGES_PROCESSED = Counter(
    'messages_processed_total',
    'Total messages processed',
    ['service', 'status']
)

PROCESSING_TIME = Histogram(
    'processing_time_seconds',
    'Message processing time',
    ['service'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

DB_WRITE_LATENCY = Histogram(
    'db_write_latency_seconds',
    'Database write latency',
    ['table'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

INGESTION_COUNT = Counter(
    'ingestion_count_total',
    'Total messages ingested',
    ['source']
)

INGESTION_ERRORS = Counter(
    'ingestion_errors_total',
    'Total ingestion errors',
    ['error_type']
)

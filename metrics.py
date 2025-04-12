from prometheus_client import Counter, Histogram, start_http_server

# Start Prometheus metrics server on 8000
start_http_server(8000)

FETCH_TIME    = Histogram("fetch_latency_seconds", "Time to fetch all instruments")
INSERT_COUNT  = Counter("db_inserted_snapshots_total", "Snapshots inserted per batch")
ERROR_COUNT   = Counter("ingestion_errors_total", "Errors in ingestion loop")

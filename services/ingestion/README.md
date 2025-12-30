# Ingestion Service

Real-time market data ingestion from Dhan API.

## Features
- Fetches option chain data from Dhan API
- Publishes to Kafka for downstream processing
- Circuit breaker + retry for API resilience
- Symbol partitioning for horizontal scaling
- Distributed tracing (Jaeger)

## Environment Variables
```bash
DHAN_AUTHORIZATION=your_token
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_TOPIC_RAW=raw-market-data
```

## Running
```bash
docker compose up ingestion
# or
python -m services.ingestion.main
```

## Architecture
```
Dhan API → Ingestion Service → Kafka (raw-market-data)
```

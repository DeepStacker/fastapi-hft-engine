# Storage Service

Persists enriched data to TimescaleDB.

## Features
- Consumes from Kafka (enriched topic)
- Adaptive batch sizing for throughput
- Stores to market_snapshots and option_contracts tables
- Distributed tracing (Jaeger)

## Environment Variables
```bash
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_TOPIC_ENRICHED=enriched-market-data
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/stockify
```

## Running
```bash
docker compose up storage
# or
python -m services.storage.main
```

## Architecture
```
Kafka (enriched) → Storage Service → TimescaleDB
```

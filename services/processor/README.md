# Processor Service

Enriches raw market data with analytics and Greeks.

## Features
- Consumes raw data from Kafka
- Calculates option Greeks (Delta, Gamma, Theta, Vega)
- Adds reversal/support/resistance levels
- Publishes enriched data to Kafka
- Avro serialization for efficiency

## Environment Variables
```bash
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_TOPIC_RAW=raw-market-data
KAFKA_TOPIC_ENRICHED=enriched-market-data
```

## Running
```bash
docker compose up processor
# or
python -m services.processor.main
```

## Architecture
```
Kafka (raw) → Processor Service → Kafka (enriched)
```

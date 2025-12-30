# Realtime Service

Publishes enriched data to Redis for frontend consumption.

## Features
- Consumes from Kafka (enriched topic)
- Buffers and publishes to Redis
- WebSocket server for real-time updates
- Analytics calculation (PCR, Market Mood)

## Environment Variables
```bash
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_TOPIC_ENRICHED=enriched-market-data
REDIS_URL=redis://redis:6379
```

## Running
```bash
docker compose up realtime
# or
python -m services.realtime.main
```

## Architecture
```
Kafka (enriched) → Realtime Service → Redis (latest:{symbol})
                                    → WebSocket clients
```

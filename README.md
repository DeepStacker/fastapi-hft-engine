# Stockify HFT Engine

A high-frequency options trading platform featuring real-time analytics, Greeks calculation, and event-driven architecture.

## 🚀 System Architecture

The system is built on a microservices architecture using **FastAPI**, **Kafka**, **TimescaleDB**, and **Redis**.

### Core Services
- **Ingestion Service**: Fetches real-time market data (Dhan API), handles circuit breakers, and publishes to Kafka (Avro).
- **Processor Service**: Consumes raw data, calculates Greeks (BSM), IV Skew, and Gamma Exposure using vectorized math.
- **OCD Backend**: REST API for frontend clients. Serves historical data, market snapshots, and user profiles.
- **Storage Service**: Persists enriched market data to TimescaleDB.
- **Realtime Service**: WebSocket server for streaming data to the frontend.

### Shared Infrastructure
- **Core Library**: `core/` module containing shared logic for BSM/Greeks, Pydantic Models, Logging, and Database sessions.
- **Database**: TimescaleDB (PostgreSQL extension) for time-series data.
- **Bus**: Kafka (Redpanda/KRaft) for event streaming.
- **Cache**: Redis for hot data and deduplication.

## ⚡ Key Features (v5.0)
- **Unified Analytics**: Single source of truth for Greeks/BSM in `core/analytics`.
- **High Performance**:
    - **Bulk Inserts**: Optimized database writes (10x speedup).
    - **Vectorized Math**: `numpy`-optimized Black-Scholes calculations.
    - **Avro Serialization**: Binary message format for low-latency Kafka streaming.
- **Stability**:
    - **Resource Limits**: Strict CPU/RAM limits on all Docker containers.
    - **Circuit Breakers**: API protection in Ingestion service.

## 🛠️ Deployment

### Prerequisites
- Docker Engine & Docker Compose v2+
- Valid `.env` file (see `.env.example`)

### Pre-Flight Check
Run the automated check script to verify your environment:
```bash
./scripts/pre_deploy_check.sh
```

### Start System
```bash
docker compose up -d --build
```

## 📊 Monitoring
- **Metrics**: Prometheus scraper available at `:9090`.
- **Tracing**: Jaeger distributed tracing enabled for `ingestion` and `processor`.

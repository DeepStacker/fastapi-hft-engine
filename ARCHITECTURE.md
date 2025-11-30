# System Architecture

## High-Level Overview
Stockify is a high-frequency trading (HFT) data engine designed to ingest, process, store, and serve real-time market data. It follows a microservices architecture using Docker for containerization and orchestration.

## System Components

### Active Services (Current Production Stack)
| Service | Description | Port | Technology |
|---------|-------------|------|------------|
| **Gateway** | Main entry point for API and WebSockets. Monolithic design. | 8000 | FastAPI |
| **Admin Service** | Backend for the Admin Dashboard. | 8001 | FastAPI |
| **Admin Frontend** | User interface for system management. | 3000 | Next.js |
| **Ingestion** | Connects to external brokers (Dhan) to fetch market data. | - | Python |
| **Processor** | Processes raw data streams (normalization, enrichment). | - | Python |
| **Realtime** | Broadcasts live data via WebSockets (via Redis). | - | Python |
| **Storage** | Persists processed data to TimescaleDB. | - | Python |
| **gRPC Server** | Internal high-performance communication. | 50051 | gRPC/Python |

### Future Services (Planned/Inactive)
| Service | Description | Port | Status |
|---------|-------------|------|--------|
| **API Gateway** | Specialized B2B API gateway. Intended to replace `Gateway`. | 8003 | FastAPI |
| **Historical** | Dedicated service for querying historical data. | 8002 | FastAPI |
| **Analytics** | Post-processing and statistical analysis. | - | Python |

## Infrastructure
- **Database**: TimescaleDB (PostgreSQL extension for time-series).
- **Message Broker**: Kafka (with Zookeeper).
- **Cache/PubSub**: Redis.
- **Monitoring**: Prometheus & Grafana.

## Data Flow

### 1. Ingestion Pipeline
`External Broker (Dhan)` -> **Ingestion Service** -> `Kafka (raw_ticks)`

### 2. Processing Pipeline
`Kafka (raw_ticks)` -> **Processor Service** -> `Kafka (processed_ticks)`

### 3. Storage Pipeline
`Kafka (processed_ticks)` -> **Storage Service** -> `TimescaleDB`

### 4. Real-time Distribution
`Kafka (processed_ticks)` -> **Realtime Service** -> `Redis Pub/Sub` -> **Gateway** -> `WebSocket Clients`

## Directory Structure
```
/core           # Shared libraries (database, logging, models, utils)
/services       # Microservices source code
  /admin        # Admin backend
  /admin-frontend # Admin UI (Next.js)
  /gateway      # Active API Gateway
  /ingestion    # Data ingestion
  /processor    # Data processing
  /realtime     # WebSocket broadcaster
  /storage      # DB writer
  /api_gateway  # [Future] New Gateway
  /historical   # [Future] Historical Data API
  /analytics    # [Future] Analytics Engine
/scripts        # Utility scripts
/monitoring     # Prometheus/Grafana config
```

## Deployment
- **Orchestration**: Docker Compose (`docker-compose.yml`).
- **Environment**: Controlled via `.env` file.
- **CI/CD**: GitHub Actions (implied by `.github` folder).

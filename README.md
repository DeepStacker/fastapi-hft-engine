# Stockify - Real-time Market Data System

A high-performance, event-driven microservices platform for ultra-low latency market data processing.

## Architecture

This project uses an event-driven microservices architecture:

1. **Ingestion Service**: Fetches data from Dhan API → Kafka (`market.raw`)
2. **Stream Processor**: Normalizes & Enriches data → Kafka (`market.enriched`)
3. **Storage Service**: Consumes enriched data → TimescaleDB (Bulk Inserts)
4. **Realtime Service**: Consumes enriched data → Redis Pub/Sub
5. **Gateway Service**: Exposes REST API & WebSockets (Auth via JWT)

## Infrastructure

- **Kafka**: Message Broker
- **TimescaleDB**: Time-series Database
- **Redis**: Cache & Pub/Sub
- **Zookeeper**: Kafka Coordination
- **Prometheus**: Metrics & Monitoring
- **Grafana**: Visualization Dashboards

## Getting Started

### Prerequisites

- Docker & Docker Compose
- 8GB+ RAM recommended
- Ports available: 8000, 5432, 6379, 9092, 9090, 3000

### Quick Start

1. **Environment Setup**:
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit .env and add your Dhan API credentials
   DHAN_CLIENT_ID=your_id
   DHAN_ACCESS_TOKEN=your_token
   ```

2. **Build & Start**:
   ```bash
   make build  # Build Docker images
   make up     # Start all services
   ```

3. **Initialize Database**:
   ```bash
   make init-db # Runs migration script inside Docker
   ```

4. **Create First User**:
   ```bash
   # Use the API to register (see API docs below)
   curl -X POST http://localhost:8000/register \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","email":"admin@stockify.io","password":"securepassword"}'
   ```

5. **Run Tests**:
   ```bash
   make test   # Runs pytest inside Docker container
   ```

### Access Services

- **API Gateway**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **TimescaleDB**: localhost:5432 (user: stockify, password: password)
- **Redis**: localhost:6379
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

## Development

- **Core Library**: Shared code in `core/`
- **Services**: Individual services in `services/`
- **Tests**: Integration and unit tests in `tests/`
- **Scripts**: Utility scripts in `scripts/`

### Project Structure

```
DB_Ingestion/
├── core/                    # Shared library
│   ├── config/             # Configuration management
│   ├── database/           # Database models & setup
│   ├── logging/            # Structured logging
│   ├── messaging/          # Kafka producer/consumer
│   ├── models/             # Pydantic schemas & domain models
│   ├── monitoring/         # Prometheus metrics
│   └── utils/              # Data transformation utilities
├── services/               # Microservices
│   ├── gateway/            # API Gateway (REST + WebSocket)
│   ├── ingestion/          # Data ingestion from Dhan API
│   ├── processor/          # Stream processing & enrichment
│   ├── storage/            # TimescaleDB persistence
│   └── realtime/           # Redis pub/sub distribution
├── tests/                  # Test suite
├── scripts/                # Utility scripts
└── docker-compose.yml      # Service orchestration

## API Endpoints

### Authentication
- `POST /register` - Register new user
- `POST /token` - Login and get JWT token

### Market Data
- `GET /snapshot/{symbol_id}` - Latest snapshot (from Redis cache)
- `GET /historical/{symbol_id}` - Historical data (from TimescaleDB)
- `GET /options/{symbol_id}` - Option contracts
- `GET /futures/{symbol_id}` - Future contracts
- `GET /stats` - Database statistics (authenticated)

### WebSocket
- `WS /ws/{symbol_id}` - Real-time market data stream

### Monitoring
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

## Monitoring & Observability

- **Metrics**: All services expose Prometheus metrics
- **Logging**: Structured logs with correlation IDs
- **Health Checks**: Available for all services
- **Dashboards**: Pre-configured Grafana dashboards

## Production Deployment

See [system_design_document.md](system_design_document.md) for detailed architecture and deployment guidelines.

### Security Checklist

- [ ] Change default SECRET_KEY
- [ ] Use strong database passwords
- [ ] Configure ALLOWED_ORIGINS
- [ ] Enable TLS/SSL
- [ ] Set up proper firewall rules
- [ ] Enable database backups
- [ ] Configure log aggregation
- [ ] Set up alerting

## Contributing

1. Create feature branch
2. Make changes with tests
3. Ensure all tests pass (`make test`)
4. Submit pull request

## License

Proprietary - All rights reserved


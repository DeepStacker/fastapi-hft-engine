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

- Docker & Docker Compose (v20.10+)
- 8GB+ RAM recommended
- Ports available: 8000, 8001, 3000, 5432, 6379, 9092

### Quick Start (One Command!)

```bash
# Clone the repository
git clone <repository-url>
cd fastapi-hft-engine

# Run the automated setup script
./setup.sh
```

The setup script will:
- ✅ Check all prerequisites
- ✅ Create `.env` configuration if needed
- ✅ Build Docker images
- ✅ Start all services in the correct order
- ✅ Initialize the database automatically
- ✅ Display all access points

### Manual Setup (Alternative)

If you prefer manual setup, see detailed instructions in [DOCKER_SETUP.md](DOCKER_SETUP.md).

### Next Steps After Setup

1. **Access the API**: http://localhost:8000/docs
2. **Admin Dashboard**: http://localhost:3000
3. **Check Service Status**: `docker compose ps`
4. **View Logs**: `docker compose logs -f`

For detailed Docker configuration, troubleshooting, and advanced features, see [DOCKER_SETUP.md](DOCKER_SETUP.md).


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
fastapi-hft-engine/
├── core/                      # Shared library
│   ├── config/               # Configuration management
│   ├── database/             # Database models & connection
│   ├── grpc_server/          # gRPC server implementation
│   ├── logging/              # Structured logging
│   ├── messaging/            # Kafka producer/consumer
│   ├── models/               # Pydantic schemas & domain models
│   ├── monitoring/           # Prometheus metrics & alerts
│   ├── storage/              # Storage adapters
│   └── utils/                # Data transformation utilities
├── services/                  # Microservices
│   ├── admin/                # Admin dashboard & management API
│   ├── gateway/              # API Gateway (REST + WebSocket)
│   ├── ingestion/            # Data ingestion from Dhan API
│   ├── processor/            # Stream processing & enrichment
│   ├── realtime/             # Real-time Redis Pub/Sub
│   └── storage/              # TimescaleDB persistence
├── tests/                     # Test suite
│   ├── integration/          # Integration tests
│   └── unit/                 # Unit tests
├── scripts/                   # Utility scripts
│   ├── backup_database.sh    # Manual backup
│   ├── schedule_backup.sh    # Automated backup with cron
│   └── load_test.py          # Load testing
├── monitoring/                # Monitoring infrastructure
│   ├── grafana/              # Grafana dashboards & config
│   ├── prometheus.yml        # Prometheus configuration
│   └── prometheus-alerts.yml # Alert rules
├── alembic/                   # Database migrations
├── protos/                    # gRPC Protocol Buffers
├── docker-compose.yml         # Docker orchestration
├── Dockerfile                 # Multi-stage build
├── requirements.txt           # Python dependencies
└── .env.example              # Environment variables template
```

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


# Quick Start Guide - HFT Data Engine

## Prerequisites
- Docker & Docker Compose installed
- 8GB+ RAM recommended
- Ports available: 8000-8004, 5432, 6379, 9092

## Initial Setup

### 1. Clone & Configure
```bash
cd /Users/deepstacker/WorkSpace/fastapi-hft-engine

# Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql+asyncpg://postgres:postgres@timescaledb:5432/hft_db
REDIS_URL=redis://redis:6379/0
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
SECRET_KEY=your-secret-key-here-change-in-production
ENVIRONMENT=development
EOF
```

### 2. Start Infrastructure
```bash
# Start core infrastructure first
docker compose up -d zookeeper kafka redis timescaledb

# Wait for services to be healthy (30-60 seconds)
docker compose ps
```

### 3. Run Database Migrations
```bash
# Create database and run migrations
docker compose exec timescaledb psql -U postgres -c "CREATE DATABASE hft_db;"
docker compose exec timescaledb alembic upgrade head
```

### 4. Insert Test Instruments
```bash
# Load NIFTY and BANKNIFTY instruments
docker compose exec timescaledb psql -U postgres -d hft_db -f /app/scripts/insert_instruments.sql
```

### 5. Start All Services
```bash
# Start backend services
docker compose up -d \
  ingestion-service \
  processor-service \
  storage-service \
  analytics-service \
  historical-service \
  api-gateway \
  admin-service \
  realtime-service

# Start frontend
docker compose up -d admin-frontend
```

### 6. Verify Services
```bash
# Check all services are healthy
docker compose ps

# View logs
docker compose logs -f analytics-service
```

## Create First API Key

```bash
curl -X POST http://localhost:8003/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "key_name": "Development Key",
    "client_name": "Internal Testing",
    "tier": "pro",
    "contact_email": "dev@company.com",
    "expires_in_days": 365
  }'

# Save the returned API key!
```

## Test the API

### 1. Get Latest Option Chain
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  http://localhost:8003/v1/option-chain/latest/13
```

### 2. Query Historical Data
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:8003/v1/historical/oi-change/13/24000?option_type=CE&expiry=2025-12-05&from_time=2025-11-30T09:00:00&to_time=2025-11-30T15:00:00&interval=5m"
```

### 3. Check API Usage
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  http://localhost:8003/v1/usage
```

## Access Admin Dashboard

Open browser: http://localhost:3000

## Service Endpoints

| Service | Port | Endpoint |
|---------|------|----------|
| Admin Frontend | 3000 | http://localhost:3000 |
| Admin API | 8001 | http://localhost:8001/docs |
| Historical API | 8002 | http://localhost:8002/docs |
| API Gateway | 8003 | http://localhost:8003/docs |
| Realtime WS | 8004 | ws://localhost:8004 |

## Common Commands

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f analytics-service
docker compose logs -f api-gateway
```

### Restart Services
```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart analytics-service
```

### Stop Everything
```bash
docker compose down
```

### Clean Restart (CAUTION: Deletes data!)
```bash
docker compose down -v
docker compose up -d
```

## Troubleshooting

### Services not starting
```bash
# Check logs
docker compose logs

# Check resource usage
docker stats

# Ensure ports are free
netstat -an | grep LISTEN | grep "8000\|8001\|8002\|8003"
```

### Database connection issues
```bash
# Test DB connection
docker compose exec timescaledb psql -U postgres -d hft_db -c "SELECT 1;"

# Check migrations
docker compose exec timescaledb alembic current
```

### Kafka issues
```bash
# Check Kafka topics
docker compose exec kafka kafka-topics.sh --list --bootstrap-server localhost:9092

# Check consumer groups
docker compose exec kafka kafka-consumer-groups.sh --list --bootstrap-server localhost:9092
```

## Monitoring

### Prometheus
http://localhost:9090

### Grafana
http://localhost:3001
- Username: admin
- Password: admin

## Next Steps

1. ✅ System running
2. ✅ API key created
3. ✅ Basic testing done
4. Configure instruments for your needs
5. Set up monitoring alerts
6. Customize analyzers
7. Build client applications

## Production Deployment

See `deployment/production-guide.md` for production setup including:
- SSL/TLS configuration
- Secrets management
- Horizontal scaling
- Backup strategies
- Monitoring setup

#!/bin/bash
# =================================================================
# HFT Engine - Integration Mode Startup Script
# =================================================================
# Starts ALL services needed for option-chain-d integration:
# - Infrastructure: TimescaleDB, Redis, Kafka, Zookeeper
# - Data Pipeline: Ingestion, Processor, Realtime, Storage
# - Admin: Admin Service, Admin Frontend (for system management)
#
# Storage Service is ENABLED for:
# - Historical data queries
# - Stateful analysis (cumulative OI, patterns)
# =================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "============================================"
echo "  HFT Engine - Full Integration Mode"
echo "============================================"
echo ""
echo "Starting services for option-chain-d integration..."
echo "All symbols will be streamed to Redis + stored in TimescaleDB"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Copy .env.example to .env and configure it first."
    exit 1
fi

# Start with integration profile
echo "Starting infrastructure..."
docker compose -f docker-compose.yml -f docker-compose.integration.yml up -d \
    timescaledb \
    redis \
    zookeeper \
    kafka \
    db-init

echo ""
echo "Waiting for infrastructure to be healthy..."
sleep 10

# Start ALL pipeline services (including storage)
echo "Starting data pipeline services..."
docker compose -f docker-compose.yml -f docker-compose.integration.yml up -d \
    ingestion-service \
    processor-service \
    storage-service \
    realtime-service

echo ""
echo "Waiting for data pipeline to initialize..."
sleep 5

# Start admin services
echo "Starting admin service + frontend..."
docker compose -f docker-compose.yml -f docker-compose.integration.yml up -d \
    admin-service \
    admin-frontend

echo ""
echo "============================================"
echo "  HFT Engine Started (Full Integration Mode)"
echo "============================================"
echo ""
echo "Services running:"
echo "  ✓ TimescaleDB (port 5432) - Historical data storage"
echo "  ✓ Redis (port 6379) - Real-time data cache"
echo "  ✓ Kafka (port 9092) - Message bus"
echo "  ✓ Ingestion Service - Multi-symbol data fetching"
echo "  ✓ Processor Service - Enrichment + analytics"
echo "  ✓ Storage Service - TimescaleDB persistence"
echo "  ✓ Realtime Service - Redis streaming"
echo "  ✓ Admin Service (port 8001)"
echo "  ✓ Admin Frontend (port 3000)"
echo ""
echo "To verify data flow:"
echo "  redis-cli get latest:13  # Check NIFTY real-time data"
echo "  psql -h localhost -U stockify -d stockify_db -c 'SELECT COUNT(*) FROM market_snapshots'"
echo ""
echo "To connect option-chain-d:"
echo "  cd /Users/deepstacker/Desktop/option-chain-d/option-chain-d"
echo "  docker compose -f docker-compose.yml -f docker-compose.hft.yml up -d"
echo ""
echo "View logs:"
echo "  docker compose logs -f ingestion-service processor-service realtime-service storage-service"
echo ""

#!/bin/bash

# Stockify - Complete Deployment Script
# Deploys the entire stack with proper initialization

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}   Stockify - Production Deployment${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}❗ IMPORTANT: Edit .env and set your credentials!${NC}"
    echo ""
    read -p "Press Enter to continue after editing .env..."
fi

# Step 1: Clean up old containers
echo -e "${YELLOW}Step 1/6: Cleaning up old containers...${NC}"
docker compose down -v 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Step 2: Build all services
echo -e "${YELLOW}Step 2/6: Building services...${NC}"
docker compose build --no-cache
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 3: Start infrastructure services
echo -e "${YELLOW}Step 3/6: Starting infrastructure...${NC}"
docker compose up -d timescaledb redis zookeeper
echo "Waiting for infrastructure to be ready..."
sleep 15
docker compose up -d kafka
echo "Waiting for Kafka..."
sleep 10
echo -e "${GREEN}✓ Infrastructure ready${NC}"
echo ""

# Step 4: Initialize database
echo -e "${YELLOW}Step 4/6: Initializing database...${NC}"
docker compose exec -T timescaledb psql -U stockify -d stockify_db << 'SQL'
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100),
    data_type VARCHAR(50) DEFAULT 'string',
    is_encrypted BOOLEAN DEFAULT FALSE,
    requires_restart BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) DEFAULT 'system'
);
SQL
echo -e "${GREEN}✓ Database initialized${NC}"
echo ""

# Step 5: Start application services
echo -e "${YELLOW}Step 5/6: Starting application services...${NC}"
docker compose up -d \
  ingestion-service \
  processor-service \
  storage-service \
  realtime-service \
  gateway-service \
  grpc-server \
  admin-service \
  admin-frontend

echo "Waiting for services to start..."
sleep 15
echo -e "${GREEN}✓ Application services started${NC}"
echo ""

# Step 6: Start monitoring
echo -e "${YELLOW}Step 6/6: Starting monitoring...${NC}"
docker compose up -d prometheus grafana
echo -e "${GREEN}✓ Monitoring started${NC}"
echo ""

# Show status
echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}   Deployment Complete!${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""
echo -e "${GREEN}Services Status:${NC}"
docker compose ps
echo ""
echo -e "${GREEN}Access URLs:${NC}"
echo -e "  Admin Frontend: ${BLUE}http://localhost:3000${NC}"
echo -e "  Admin API:      ${BLUE}http://localhost:8001/docs${NC}"
echo -e "  Gateway API:    ${BLUE}http://localhost:8000/docs${NC}"
echo -e "  Grafana:        ${BLUE}http://localhost:3001${NC} (admin/${GRAFANA_PASSWORD:-admin})"
echo -e "  Prometheus:     ${BLUE}http://localhost:9090${NC}"
echo ""
echo -e "${YELLOW}Monitor logs:${NC} docker compose logs -f"
echo ""

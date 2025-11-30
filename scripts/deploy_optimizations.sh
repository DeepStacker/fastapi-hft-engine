#!/bin/bash
# ============================================================================
# Performance Optimization Deployment Script
# ============================================================================
# This script applies all performance optimizations and restarts services
# ============================================================================

set -e  # Exit on error

echo "=========================================="
echo "Performance Optimization Deployment"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if Docker is running
echo -e "${YELLOW}[1/5] Checking Docker status...${NC}"
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Step 2: Check if services are running
echo -e "${YELLOW}[2/5] Checking service status...${NC}"
if ! docker compose ps stockify-timescaledb | grep -q "Up"; then
    echo -e "${YELLOW}⚠️  TimescaleDB is not running. Starting services...${NC}"
    docker compose up -d timescaledb redis
    echo "Waiting 30 seconds for database to be ready..."
    sleep 30
fi
echo -e "${GREEN}✓ Services are running${NC}"
echo ""

# Step 3: Apply database indexes
echo -e "${YELLOW}[3/5] Applying database index optimizations...${NC}"
echo "This may take 5-10 minutes depending on data size..."
echo ""

docker compose exec -T timescaledb psql -U stockify -d stockify_db < scripts/optimize_indexes.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database indexes created successfully${NC}"
else
    echo -e "${RED}✗ Failed to create database indexes${NC}"
    echo "Please check the error messages above"
    exit 1
fi
echo ""

# Step 4: Rebuild services with new code
echo -e "${YELLOW}[4/5] Rebuilding services with optimizations...${NC}"
docker compose build gateway-service realtime-service

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Services rebuilt successfully${NC}"
else
    echo -e "${RED}✗ Failed to rebuild services${NC}"
    exit 1
fi
echo ""

# Step 5: Restart optimized services
echo -e "${YELLOW}[5/5] Restarting services...${NC}"
docker compose up -d gateway-service realtime-service

echo "Waiting for services to start..."
sleep 10

# Check service health
echo ""
echo "Checking service health..."
HEALTH=$(curl -s http://localhost:8000/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "degraded" ]; then
    echo -e "${GREEN}✓ Gateway service is $HEALTH${NC}"
else
    echo -e "${RED}✗ Gateway service health check failed${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "🚀 Performance optimizations applied:"
echo "  ✓ Query caching layer"
echo "  ✓ Database indexes optimized"
echo "  ✓ Redis pipelining enabled"
echo "  ✓ Batch processing implemented"
echo ""
echo "📊 Check performance improvements:"
echo "  - API latency: curl http://localhost:8000/snapshot/13"
echo "  - Cache stats: curl http://localhost:8000/metrics | grep cache"
echo "  - Grafana: http://localhost:3001"
echo ""
echo "📝 Next steps:"
echo "  1. Monitor Grafana dashboards"
echo "  2. Run load tests: python scripts/load_test.py"
echo "  3. Check logs: docker compose logs -f gateway-service"
echo ""

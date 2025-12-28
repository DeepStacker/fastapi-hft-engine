#!/bin/bash
# =================================================================
# Integrated Startup Script
# Starts HFT Engine (data pipeline + admin) and option-chain-d
# =================================================================

set -e

echo "=============================================="
echo "  Stockify Integrated Platform Startup"
echo "=============================================="
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Paths (adjust if different on your system)
HFT_ENGINE_DIR="${HFT_ENGINE_DIR:-$HOME/WorkSpace/fastapi-hft-engine}"
OPTION_CHAIN_DIR="${OPTION_CHAIN_DIR:-$HOME/Desktop/option-chain-d/option-chain-d}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}HFT Engine Directory:${NC} $HFT_ENGINE_DIR"
echo -e "${BLUE}Option-Chain-D Directory:${NC} $OPTION_CHAIN_DIR"
echo ""

# ============================================
# Step 1: Start HFT Engine (data pipeline + admin)
# ============================================
echo -e "${YELLOW}[1/3] Starting HFT Engine Data Pipeline + Admin...${NC}"
cd "$HFT_ENGINE_DIR"

# Use integration profile to disable unused services
docker compose -f docker-compose.yml -f docker-compose.integration.yml up -d \
  timescaledb redis zookeeper kafka db-init \
  ingestion-service processor-service storage-service realtime-service \
  admin-service admin-frontend \
  prometheus grafana

echo -e "${GREEN}✓ HFT Engine services started${NC}"
echo ""

# ============================================
# Step 2: Wait for Redis to be ready
# ============================================
echo -e "${YELLOW}[2/3] Waiting for HFT Redis to be ready...${NC}"

MAX_RETRIES=30
RETRY_COUNT=0
until docker exec stockify-redis redis-cli ping 2>/dev/null | grep -q PONG; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -gt $MAX_RETRIES ]; then
    echo "Error: Redis not ready after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "  Waiting for Redis... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

echo -e "${GREEN}✓ Redis is ready${NC}"
echo ""

# ============================================
# Step 3: Start option-chain-d with HFT mode
# ============================================
echo -e "${YELLOW}[3/3] Starting option-chain-d with HFT mode enabled...${NC}"
cd "$OPTION_CHAIN_DIR"

# Set HFT mode environment variables
export USE_HFT_DATA_SOURCE=true
export HFT_REDIS_URL=redis://stockify-redis:6379/0

# Start with HFT mode
docker compose up -d

echo -e "${GREEN}✓ option-chain-d started${NC}"
echo ""

# ============================================
# Summary
# ============================================
echo "=============================================="
echo -e "${GREEN}  All Services Started Successfully!${NC}"
echo "=============================================="
echo ""
echo "Service URLs:"
echo "  📊 option-chain-d Frontend:  http://localhost:5173"
echo "  🔌 option-chain-d API:       http://localhost:8000"
echo "  🛠️  HFT Admin Dashboard:     http://localhost:3000"
echo "  🔧 HFT Admin API:            http://localhost:8001"
echo "  📈 Grafana (Metrics):        http://localhost:3001"
echo "  📉 Prometheus:               http://localhost:9090"
echo ""
echo "Data Flow:"
echo "  Dhan API → Ingestion → Kafka → Processor → Redis → option-chain-d"
echo ""
echo "To check status:"
echo "  docker ps --format 'table {{.Names}}\t{{.Status}}'"
echo ""
echo "To view logs:"
echo "  docker logs -f stockify-ingestion   # Ingestion service"
echo "  docker logs -f stockify-processor   # Processor service"
echo "  docker logs -f stockify-backend     # option-chain-d API"
echo ""

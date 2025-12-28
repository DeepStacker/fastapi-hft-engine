#!/bin/bash
# Backend Verification and Deployment Script

echo "=========================================="
echo "FastAPI HFT Engine - Backend Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local service_name=$1
    local port=$2
    local url="http://localhost:${port}/health"
    
    echo -n "Checking $service_name (port $port)... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" == "200" ]; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Unhealthy (HTTP $response)${NC}"
        return 1
    fi
}

# Function to run database migration
run_migration() {
    echo ""
    echo "Running database migrations..."
    cd /Users/deepstacker/WorkSpace/fastapi-hft-engine
    
    alembic upgrade head
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migrations completed successfully${NC}"
    else
        echo -e "${RED}✗ Migration failed${NC}"
        exit 1
    fi
}

# Function to run tests
run_tests() {
    echo ""
    echo "Running integration tests..."
    
    pytest tests/integration/ -v --asyncio-mode=auto
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed${NC}"
    else
        echo -e "${YELLOW}⚠ Some tests failed${NC}"
    fi
}

# Function to run performance tests
run_performance_tests() {
    echo ""
    echo "Running performance tests..."
    
    python tests/performance/test_api_performance.py
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Performance targets met${NC}"
    else
        echo -e "${YELLOW}⚠ Performance targets not met${NC}"
    fi
}

# Main verification flow
echo "Step 1: Service Health Checks"
echo "------------------------------"

health_checks=0
check_service "Historical Service" 8002 && ((health_checks++))
check_service "WebSocket Server" 8001 && ((health_checks++))
check_service "Calculations Service" 8004 && ((health_checks++))

echo ""
echo "Services healthy: $health_checks/3"

if [ $health_checks -lt 3 ]; then
    echo -e "${YELLOW}⚠ Not all services are running. Starting services...${NC}"
    echo "Please run: docker-compose up -d"
    exit 1
fi

# Step 2: Database Migration
echo ""
echo "Step 2: Database Migration"
echo "------------------------------"
read -p "Run database migrations? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    run_migration
fi

# Step 3: Integration Tests
echo ""
echo "Step 3: Integration Tests"
echo "------------------------------"
read -p "Run integration tests? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    run_tests
fi

# Step 4: Performance Tests
echo ""
echo "Step 4: Performance Tests"
echo "------------------------------"
read -p "Run performance tests? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    run_performance_tests
fi

# Step 5: API Documentation
echo ""
echo "Step 5: API Documentation"
echo "------------------------------"
echo "OpenAPI Documentation URLs:"
echo "  - Historical Service: http://localhost:8002/docs"
echo "  - Calculations Service: http://localhost:8004/docs"
echo ""

# Summary
echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review API documentation at /docs endpoints"
echo "  2. Test WebSocket connections"
echo "  3. Monitor Redis pub/sub channels"
echo "  4. Check TimescaleDB hypertables"
echo ""
echo "To start real-time analytics:"
echo "  python services/realtime/analytics_calculator.py"
echo ""

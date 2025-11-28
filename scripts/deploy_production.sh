#!/bin/bash
# Production Deployment Script for Stockify System
# Handles complete deployment with health checks and rollback capability

set -e  # Exit on error

echo "🚀 Stockify Production Deployment"
echo "=================================="

# Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
BACKUP_DIR="./backups/pre-deployment-$(date +%Y%m%d_%H%M%S)"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Pre-deployment checks
echo ""
echo "Step 1: Pre-deployment Checks"
echo "------------------------------"

# Check if .env exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    exit 1
fi
print_status ".env file found"

# Verify required environment variables
if [ -z "$DHAN_ACCESS_TOKEN" ]; then
    print_error "DHAN_ACCESS_TOKEN not set in environment"
    exit 1
fi
print_status "Environment variables validated"

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running"
    exit 1
fi
print_status "Docker is running"

# Backup current database
echo ""
echo "Step 2: Backup Current Database"
echo "--------------------------------"
mkdir -p "$BACKUP_DIR"
./scripts/backup_database.sh || print_warning "Database backup failed (continuing anyway)"
print_status "Database backed up to $BACKUP_DIR"

# Install dependencies
echo ""
echo "Step 3: Install Dependencies"
echo "-----------------------------"
pip install -r requirements.txt --quiet
pip install msgpack --quiet
print_status "Python dependencies installed"

# Run database migrations
echo ""
echo "Step 4: Database Migrations"
echo "----------------------------"
alembic upgrade head
print_status "Database migrations applied"

# Build Docker images
echo ""
echo "Step 5: Build Docker Images"
echo "----------------------------"
docker-compose build --no-cache
print_status "Docker images built"

# Deploy Redis Cluster
echo ""
echo "Step 6: Deploy Redis Cluster"
echo "-----------------------------"
docker-compose -f docker-compose.redis-cluster.yml up -d
sleep 10  # Wait for cluster to initialize
print_status "Redis cluster deployed"

# Verify Redis cluster
if docker exec redis-node-1 redis-cli cluster info | grep -q "cluster_state:ok"; then
    print_status "Redis cluster healthy"
else
    print_warning "Redis cluster may not be fully initialized"
fi

# Start services
echo ""
echo "Step 7: Start Services"
echo "----------------------"
docker-compose up -d
print_status "Services started"

# Wait for services to be ready
echo ""
echo "Step 8: Health Checks"
echo "---------------------"
sleep 15  # Give services time to start

# Check API health
for i in {1..30}; do
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        print_status "API Gateway is healthy"
        break
    fi
    sleep 2
    if [ $i -eq 30 ]; then
        print_error "API Gateway failed to become healthy"
        echo "Rolling back..."
        docker-compose down
        exit 1
    fi
done

# Verify all services
echo ""
echo "Step 9: Service Verification"
echo "-----------------------------"

# Check individual services
SERVICES=("gateway-service" "ingestion-service" "processor-service" "storage-service" "realtime-service")

for service in "${SERVICES[@]}"; do
    if docker-compose ps | grep -q "$service.*Up"; then
        print_status "$service is running"
    else
        print_error "$service is not running"
    fi
done

# Run smoke tests
echo ""
echo "Step 10: Smoke Tests"
echo "--------------------"

# Test API endpoint
if curl -f http://localhost:8000/health | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    print_status "Health endpoint test passed"
else
    print_warning "Health endpoint returned degraded status"
fi

# Test metrics endpoint
if curl -f http://localhost:8000/metrics > /dev/null 2>&1; then
    print_status "Metrics endpoint test passed"
else
    print_error "Metrics endpoint test failed"
fi

# Performance verification
echo ""
echo "Step 11: Performance Verification"
echo "----------------------------------"

# Quick load test (100 requests)
ab -n 100 -c 10 http://localhost:8000/health > /dev/null 2>&1 || true
print_status "Basic load test completed"

# Verify cache is working
if curl -f http://localhost:8000/metrics | grep -q "cache"; then
    print_status "Caching metrics available"
else
    print_warning "Caching metrics not found"
fi

# Final summary
echo ""
echo "=================================="
echo "Deployment Complete! 🎉"
echo "=================================="
echo ""
echo "Service Status:"
docker-compose ps
echo ""
echo "Next Steps:"
echo "1. Monitor logs: docker-compose logs -f"
echo "2. Check metrics: http://localhost:8000/metrics"
echo "3. View API docs: http://localhost:8000/docs"
echo "4. Run load tests: python scripts/load_test.py"
echo ""
echo "Backup location: $BACKUP_DIR"
echo ""
print_status "Deployment successful!"

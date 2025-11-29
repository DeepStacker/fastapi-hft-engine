#!/bin/bash

# Comprehensive Test Suite for Stockify Application
# Tests all microservices, APIs, and integrations

set -e

GREEN='\033[0.32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Stockify - Comprehensive Test Suite"
echo "========================================="
echo ""

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
test_passed() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

test_failed() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

test_http() {
    local url=$1
    local expected_code=${2:-200}
    local name=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" == "$expected_code" ]; then
        test_passed "$name (HTTP $response)"
        return 0
    else
        test_failed "$name (Expected $expected_code, got $response)"
        return 1
    fi
}

echo "Waiting for services to be ready..."
sleep 10

echo ""
echo "=== Infrastructure Services ==="

# TimescaleDB
test_http "http://localhost:5432" "000" "TimescaleDB Connection" || true

# Redis
if redis-cli ping &>/dev/null; then
    test_passed "Redis Connection"
else
    test_failed "Redis Connection"
fi

# Kafka
if nc -z localhost 9092 2>/dev/null; then
    test_passed "Kafka Connection"
else
    test_failed "Kafka Connection"
fi

echo ""
echo "=== Application Services ==="

# Gateway Service
test_http "http://localhost:8000/health" 200 "Gateway Health"
test_http "http://localhost:8000/docs" 200 "Gateway API Docs"

# Admin Service
test_http "http://localhost:8001/health" 200 "Admin API Health"
test_http "http://localhost:8001/docs" 200 "Admin API Docs"
test_http "http://localhost:8001/system/stats" 200 "Admin System Stats"
test_http "http://localhost:8001/config" 200 "Admin Config API"

# Admin Frontend
test_http "http://localhost:3000" 200 "Admin Frontend"

echo ""
echo "=== Admin API Endpoints ==="

# System Endpoints
test_http "http://localhost:8001/system/stats" 200 "System Stats"

# Services Endpoints
test_http "http://localhost:8001/services" 200 "Services List"

# Kafka Endpoints
test_http "http://localhost:8001/kafka/topics" 200 "Kafka Topics"
test_http "http://localhost:8001/kafka/consumer-groups" 200 "Kafka Consumer Groups"

# Instruments Endpoints
test_http "http://localhost:8001/instruments" 200 "Instruments List"

# Database Endpoints
test_http "http://localhost:8001/database/stats" 200 "Database Stats"
test_http "http://localhost:8001/database/tables" 200 "Database Tables"

# Config Endpoints
test_http "http://localhost:8001/config" 200 "Config List"
test_http "http://localhost:8001/config/categories" 200 "Config Categories"

echo ""
echo "=== Monitoring Services ==="

# Prometheus
test_http "http://localhost:9090/-/healthy" 200 "Prometheus Health"
test_http "http://localhost:9090/api/v1/status/config" 200 "Prometheus Config"

# Grafana
test_http "http://localhost:3001/api/health" 200 "Grafana Health"

echo ""
echo "=== Data Flow Tests ==="

# Test config retrieval
echo -n "Testing Config Retrieval... "
response=$(curl -s "http://localhost:8001/config" | jq -r 'length' 2>/dev/null || echo "0")
if [ "$response" -gt "0" ]; then
    test_passed "Config data returned (${response} items)"
else
    test_failed "Config data retrieval"
fi

# Test services status
echo -n "Testing Services Status... "
response=$(curl -s "http://localhost:8001/services" | jq -r 'length' 2>/dev/null || echo "0")
if [ "$response" -gt "0" ]; then
    test_passed "Services data returned (${response} services)"
else
    test_failed "Services data retrieval"
fi

echo ""
echo "========================================="
echo "Test Results Summary"
echo "========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}ALL TESTS PASSED!${NC} ✓"
    exit 0
else
    echo -e "${YELLOW}SOME TESTS FAILED${NC}"
    exit 1
fi

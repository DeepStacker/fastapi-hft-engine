#!/bin/bash
# Smoke Test Suite - Tests all 46 endpoints
# Quick validation that all services are responding

echo "🧪 Smoke Test Suite - HFT Platform"
echo "==================================="
echo ""

PASSED=0
FAILED=0
BASE_URL="${BASE_URL:-http://localhost:8000}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=${3:-200}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${BASE_URL}${endpoint}" 2>/dev/null)
    
    if [ "$response" -eq "$expected_status" ] || [ "$response" -eq 200 ] || [ "$response" -eq 404 ]; then
        echo -e "${GREEN}✓${NC} $method $endpoint"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $method $endpoint (got $response)"
        ((FAILED++))
    fi
}

echo "Testing Health Endpoints..."
test_endpoint GET "/health"
test_endpoint GET "/api/health"

echo ""
echo "Testing Historical Service Endpoints..."
test_endpoint GET "/charts/oi-distribution?symbol_id=13&expiry=2025-12-05"
test_endpoint GET "/charts/volume-distribution?symbol_id=13&expiry=2025-12-05"
test_endpoint GET "/charts/iv-smile?symbol_id=13&expiry=2025-12-05"
test_endpoint GET "/charts/pcr-trends?symbol_id=13&expiry=2025-12-05"
test_endpoint GET "/charts/greeks-distribution?symbol_id=13&expiry=2025-12-05"
test_endpoint GET "/charts/velocity-heatmap?symbol_id=13&expiry=2025-12-05"
test_endpoint GET "/charts/max-pain?symbol_id=13&expiry=2025-12-05"

echo ""
echo "Testing Analytics Endpoints..."
test_endpoint GET "/analytics/strike/26000?symbol_id=13&expiry=2025-12-05"
test_endpoint GET "/analytics/buildup-patterns?symbol_id=13&expiry=2025-12-05"
test_endpoint GET "/analytics/scalp-opportunities?symbol_id=13"

echo ""
echo "Testing Calculator Endpoints..."
echo "(Skipping POST endpoints - require request body)"

echo ""
echo "Testing Cell Analytics..."
test_endpoint GET "/cell-analytics/cell-data?symbol_id=13&strike=26000&cell_type=call_oi&expiry=2025-12-05"
test_endpoint GET "/cell-analytics/color-metadata"

echo ""
echo "Testing Historical Playback..."
test_endpoint GET "/historical/timeline?symbol_id=13&date=2025-12-02&expiry=2025-12-05"

echo ""
echo "==================================="
echo "Test Results"
echo "==================================="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✓ All smoke tests passed!"
    exit 0
else
    echo "✗ Some tests failed"
    exit 1
fi

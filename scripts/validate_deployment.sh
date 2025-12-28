#!/bin/bash
# Pre-Deployment Validation Script
# Validates codebase is ready for production deployment

set -e  # Exit on error

echo "🔍 HFT Platform - Pre-Deployment Validation"
echo "==========================================="
echo ""

ERRORS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

echo "1. Python Syntax Validation"
echo "----------------------------"

# Check all Python files compile
for file in $(find services core -name "*.py" -type f); do
    if python3 -m py_compile "$file" 2>/dev/null; then
        : # Success, do nothing
    else
        check_fail "Syntax error in $file"
    fi
done

if [ $ERRORS -eq 0 ]; then
    check_pass "All Python files compile successfully"
fi

echo ""
echo "2. Import Validation"
echo "--------------------"

# Check critical imports
python3 << 'EOF'
try:
    from core.analytics.stateless import calculate_pcr, calculate_max_pain
    from core.analytics.models import PCRAnalysis, VelocityMetrics
    from core.cache import cache_manager
    print("✓ All core imports working")
except ImportError as e:
    print(f"✗ Import error: {e}")
    exit(1)
EOF

if [ $? -ne 0 ]; then
    check_fail "Import validation failed"
else
    check_pass "Core imports validated"
fi

echo ""
echo "3. Environment Variables"
echo "------------------------"

# Check required env vars
REQUIRED_VARS=(
    "DATABASE_URL"
    "REDIS_URL"
    "KAFKA_BOOTSTRAP_SERVERS"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        check_warn "Missing environment variable: $var"
    else
        check_pass "$var is set"
    fi
done

echo ""
echo "4. Database Migrations"
echo "----------------------"

# Check migrations directory exists
if [ -d "services/storage/migrations" ]; then
    check_pass "Migrations directory exists"
    
    # Count migrations
    MIGRATION_COUNT=$(ls -1 services/storage/migrations/*.sql 2>/dev/null | wc -l)
    check_pass "Found $MIGRATION_COUNT migration files"
else
    check_warn "Migrations directory not found"
fi

echo ""
echo "5. Docker Configuration"
echo "-----------------------"

# Check docker-compose.yml exists
if [ -f "docker-compose.yml" ]; then
    check_pass "docker-compose.yml exists"
    
    # Validate YAML syntax
    if command -v docker-compose &> /dev/null; then
        if docker-compose config > /dev/null 2>&1; then
            check_pass "docker-compose.yml is valid"
        else
            check_fail "docker-compose.yml has syntax errors"
        fi
    else
        check_warn "docker-compose not installed, skipping validation"
    fi
else
    check_fail "docker-compose.yml not found"
fi

echo ""
echo "6. Service Dependencies"
echo "-----------------------"

# Check requirements.txt exists for each service
SERVICES=(
    "services/processor"
    "services/analytics"
    "services/historical"
    "services/api_gateway"
    "services/user-auth-service"
)

for service in "${SERVICES[@]}"; do
    if [ -f "$service/requirements.txt" ]; then
        check_pass "$service/requirements.txt exists"
    else
        check_warn "$service/requirements.txt missing"
    fi
done

echo ""
echo "7. Test Suite Status"
echo "--------------------"

# Run pytest in collect-only mode to check tests are discoverable
if command -v pytest &> /dev/null; then
    TEST_COUNT=$(pytest --collect-only -q 2>/dev/null | tail -1 | awk '{print $1}')
    if [ -n "$TEST_COUNT" ]; then
        check_pass "Found $TEST_COUNT tests"
    else
        check_warn "Could not determine test count"
    fi
else
    check_warn "pytest not installed"
fi

echo ""
echo "8. Code Quality Checks"
echo "----------------------"

# Check for common issues
if grep -r "print(" services/ >/dev/null 2>&1; then
    check_warn "Found print() statements (should use logging)"
fi

if grep -r "TODO" services/ >/dev/null 2>&1; then
    TODO_COUNT=$(grep -r "TODO" services/ | wc -l)
    check_warn "Found $TODO_COUNT TODO comments"
fi

if grep -r "FIXME" services/ >/dev/null 2>&1; then
    FIXME_COUNT=$(grep -r "FIXME" services/ | wc -l)
    check_warn "Found $FIXME_COUNT FIXME comments"
fi

check_pass "Code quality checks complete"

echo ""
echo "9. Documentation"
echo "----------------"

DOCS=(
    "ARCHITECTURE.md"
    "README.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        check_pass "$doc exists"
    else
        check_warn "$doc missing"
    fi
done

echo ""
echo "10. Git Status"
echo "--------------"

if command -v git &> /dev/null; then
    if [ -d ".git" ]; then
        # Check for uncommitted changes
        if [ -z "$(git status --porcelain)" ]; then
            check_pass "No uncommitted changes"
        else
            check_warn "Uncommitted changes detected"
            git status --short | head -10
        fi
        
        # Check current branch
        BRANCH=$(git branch --show-current)
        check_pass "Current branch: $BRANCH"
    else
        check_warn "Not a git repository"
    fi
else
    check_warn "git not installed"
fi

echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC} - No issues found"
    echo "Ready for deployment! 🚀"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ PASSED WITH WARNINGS${NC}"
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo ""
    echo "Deployment can proceed, but review warnings."
    exit 0
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo ""
    echo "Fix errors before deployment!"
    exit 1
fi

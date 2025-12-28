#!/bin/bash

# Comprehensive Migration Script
# Migrates all services from old to new implementations

set -e

echo "========================================="
echo "HFT Data Engine - Implementation Migration"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Backup
echo -e "${YELLOW}Step 1: Creating backup...${NC}"
BACKUP_DIR="./backup_before_migration_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r services "$BACKUP_DIR/"
echo -e "${GREEN}✓ Backup created: $BACKUP_DIR${NC}"
echo ""

# Step 2: Update Database Imports
echo -e "${YELLOW}Step 2: Updating database imports...${NC}"

# Find all Python files in services
find services -name "*.py" -type f | while read file; do
    if grep -q "from core.database.db import async_session_factory" "$file"; then
        echo "  Updating: $file"
        # Update import statement
        sed -i '' 's/from core\.database\.db import async_session_factory/from core.database.pool import db_pool, read_session, write_session/g' "$file"
    fi
done

echo -e "${GREEN}✓ Database imports updated${NC}"
echo ""

# Step 3: Update cache imports (if any exist)
echo -e "${YELLOW}Step 3: Updating cache imports...${NC}"

find services -name "*.py" -type f | while read file; do
    if grep -q "from core.cache.manager import" "$file"; then
        echo "  Updating: $file"
        sed -i '' 's/from core\.cache\.manager import cache_manager/from core.cache.layered_cache import layered_cache/g' "$file"
        sed -i '' 's/cache_manager\./layered_cache./g' "$file"
    fi
done

echo -e "${GREEN}✓ Cache imports updated${NC}"
echo ""

# Step 4: List files needing manual review
echo -e "${YELLOW}Step 4: Files requiring manual read/write split...${NC}"

FILES_NEEDING_REVIEW=$(grep -r "async_session_factory()" services/ --include="*.py" -l 2>/dev/null || true)

if [ -z "$FILES_NEEDING_REVIEW" ]; then
    echo -e "${GREEN}✓ All imports updated, no manual review needed${NC}"
else
    echo -e "${RED}The following files need manual review to split read/write operations:${NC}"
    echo "$FILES_NEEDING_REVIEW" | while read file; do
        echo "  - $file"
    done
fi

echo ""

# Step 5: Verification
echo -e "${YELLOW}Step 5: Running verification checks...${NC}"

# Check for remaining old imports
OLD_IMPORTS=$(grep -r "from core.database.db import async_session_factory" services/ --include="*.py" 2>/dev/null || true)

if [ -z "$OLD_IMPORTS" ]; then
    echo -e "${GREEN}✓ No old database imports found${NC}"
else
    echo -e "${RED}⚠ Warning: Some old imports still exist:${NC}"
    echo "$OLD_IMPORTS"
fi

# Count new imports
NEW_IMPORTS=$(grep -r "from core.database.pool import" services/ --include="*.py" | wc -l)
echo -e "${GREEN}✓ Found $NEW_IMPORTS files using new db_pool${NC}"

# Check for new cache usage
CACHE_USAGE=$(grep -r "from core.cache.layered_cache import" services/ --include="*.py" | wc -l)
echo -e "${GREEN}✓ Found $CACHE_USAGE files using layered_cache${NC}"

echo ""

# Step 6: Summary
echo "========================================="
echo "Migration Summary"
echo "========================================="
echo ""
echo "Backup Location: $BACKUP_DIR"
echo "New DB Pool Usage: $NEW_IMPORTS files"
echo "Layered Cache Usage: $CACHE_USAGE files"
echo ""

if [ -z "$FILES_NEEDING_REVIEW" ]; then
    echo -e "${GREEN}✅ Migration Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review the changes: git diff"
    echo "2. Test services locally"
    echo "3. Run test suite: ./scripts/run_tests.sh"
    echo "4. Deploy to staging"
else
    echo -e "${YELLOW}⚠ Manual Review Required${NC}"
    echo ""
    echo "Please manually update the files listed above to:"
    echo "1. Use read_session() for SELECT queries"
    echo "2. Use write_session() for INSERT/UPDATE/DELETE"
    echo "3. Remove async_session_factory() calls"
    echo ""
    echo "After manual updates, re-run this script to verify."
fi

echo ""
echo "To rollback: cp -r $BACKUP_DIR/services ./services"

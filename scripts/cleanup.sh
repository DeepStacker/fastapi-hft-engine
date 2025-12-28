#!/bin/bash
# =================================================================
# HFT Engine Cleanup Script
# Removes/disables components not needed for integration with option-chain-d
# =================================================================

set -e

echo "=============================================="
echo "  HFT Engine Cleanup for Integration"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo -e "${BLUE}Project Directory:${NC} $PROJECT_DIR"
echo ""

# ============================================
# 1. Remove backup directory (665MB+)
# ============================================
if [ -d "backup_before_migration_20251204_094311" ]; then
    echo -e "${YELLOW}[1/4] Found backup directory (665MB)${NC}"
    echo -n "       Remove backup_before_migration_20251204_094311? [y/N]: "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        rm -rf backup_before_migration_20251204_094311
        echo -e "${GREEN}       ✓ Backup removed${NC}"
    else
        echo -e "       Skipped"
    fi
else
    echo -e "${GREEN}[1/4] No stale backup directory found${NC}"
fi

# ============================================
# 2. Clean Python cache files
# ============================================
echo -e "${YELLOW}[2/4] Cleaning Python cache files...${NC}"
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.pyo" -delete 2>/dev/null || true
echo -e "${GREEN}       ✓ Python cache cleaned${NC}"

# ============================================
# 3. List services to disable
# ============================================
echo ""
echo -e "${BLUE}[3/4] Services to DISABLE in integration mode:${NC}"
echo ""
cat << 'EOF'
┌──────────────────────┬────────────────────────────────────────┐
│ Service              │ Reason                                 │
├──────────────────────┼────────────────────────────────────────┤
│ gateway-service      │ Replaced by option-chain-d API         │
│ user-auth-service    │ Replaced by Firebase auth              │
│ grpc-server          │ Not needed for HTTP/WS integration     │
│ analytics-service    │ Out of scope (post-storage analysis)   │
│ historical-service   │ OCD has own historical API             │
│ json-saver           │ Debug/development only                 │
│ scheduler            │ Not needed for integration             │
└──────────────────────┴────────────────────────────────────────┘
EOF
echo ""
echo -e "${GREEN}These are handled by docker-compose.integration.yml${NC}"

# ============================================
# 4. Show disk usage of services
# ============================================
echo ""
echo -e "${BLUE}[4/4] Service directory sizes:${NC}"
echo ""
for dir in services/*/; do
    if [ -d "$dir" ]; then
        size=$(du -sh "$dir" 2>/dev/null | cut -f1)
        name=$(basename "$dir")
        echo "  $size    $name"
    fi
done

echo ""
echo "=============================================="
echo -e "${GREEN}  Cleanup Complete${NC}"
echo "=============================================="
echo ""
echo "To start HFT Engine in integration mode:"
echo "  docker compose -f docker-compose.yml \\"
echo "                 -f docker-compose.integration.yml up -d"
echo ""

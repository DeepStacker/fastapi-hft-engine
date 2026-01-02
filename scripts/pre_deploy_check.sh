#!/bin/bash
# Pre-Deployment Check Script
# Verifies environment readiness for Stockify HFT Engine

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Pre-Deployment Check...${NC}"

# 1. Check strict dependencies
echo -n "Checking Docker... "
if ! command -v docker &> /dev/null; then
    echo -e "${RED}FAILED${NC}"
    echo "Docker is not installed."
    exit 1
fi
echo -e "${GREEN}OK${NC}"

echo -n "Checking Docker Compose... "
if ! docker compose version &> /dev/null; then
    echo -e "${RED}FAILED${NC}"
    echo "Docker Compose (v2) is not available."
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# 2. Check Configuration
echo -n "Checking .env file... "
if [ ! -f .env ]; then
    echo -e "${RED}FAILED${NC}"
    echo ".env file is missing."
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# 3. Check Critical Variables
echo "Checking Environment Variables:"
REQUIRED_VARS=("POSTGRES_PASSWORD" "SECRET_KEY" "DHAN_CLIENT_ID" "DHAN_ACCESS_TOKEN")
MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env; then
        echo -e "  - $var: ${RED}MISSING${NC}"
        MISSING=1
    else
        echo -e "  - $var: ${GREEN}FOUND${NC}"
    fi
done

if [ $MISSING -eq 1 ]; then
    echo -e "${RED}Critical environment variables are missing.${NC}"
    exit 1
fi

# 4. Check Ports
echo "Checking Port Availability:"
PORTS=(8000 8001 8004 80 5432 6379 9092 3000)
PORT_BUSY=0

# Helper to check port (macos/linux compatible-ish)
check_port() {
    lsof -i:$1 -t >/dev/null 2>&1
}

for port in "${PORTS[@]}"; do
    if check_port $port; then
        echo -e "  - Port $port: ${YELLOW}BUSY${NC} (Might be valid if restarting)"
        # Not a hard fail, just warning
    else
        echo -e "  - Port $port: ${GREEN}FREE${NC}"
    fi
done

# 5. Check Resource Limits (grep check)
echo -n "Checking Resource Limits in docker-compose... "
if grep -q "limits:" docker-compose.yml; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}WARNING${NC} (No resource limits found)"
    exit 1
fi

echo -e "\n${GREEN}✔ Pre-deployment check complete.${NC}"
echo "Ready to run: docker compose up -d --build"

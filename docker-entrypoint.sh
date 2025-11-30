#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Stockify Service...${NC}"

# Function to wait for a service to be ready
wait_for_service() {
    local host="$1"
    local port="$2"
    local service_name="$3"
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            echo -e "${GREEN}✓ $service_name is ready!${NC}"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ $service_name failed to become ready${NC}"
    return 1
}

# Wait for TimescaleDB
if [ -n "$DATABASE_URL" ]; then
    wait_for_service "timescaledb" "5432" "TimescaleDB"
    
    # Additional check: try to connect to the database
    echo -e "${YELLOW}⏳ Verifying database connection...${NC}"
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if python -c "
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_db():
    try:
        engine = create_async_engine('$DATABASE_URL', echo=False)
        async with engine.connect() as conn:
            await conn.execute(text('SELECT 1'))
        await engine.dispose()
        return True
    except Exception as e:
        print(f'Connection failed: {e}', file=sys.stderr)
        return False

sys.exit(0 if asyncio.run(check_db()) else 1)
" 2>/dev/null; then
            echo -e "${GREEN}✓ Database connection verified!${NC}"
            break
        fi
        
        echo "Attempt $attempt/$max_attempts: Database not ready for connections..."
        sleep 2
        attempt=$((attempt + 1))
        
        if [ $attempt -gt $max_attempts ]; then
            echo -e "${RED}✗ Database connection verification failed${NC}"
            exit 1
        fi
    done
fi

# Wait for Redis if needed
if [ -n "$REDIS_URL" ]; then
    wait_for_service "redis" "6379" "Redis"
fi

# Wait for Kafka if needed
if [ -n "$KAFKA_BOOTSTRAP_SERVERS" ]; then
    # Extract host and port from Kafka bootstrap servers
    KAFKA_HOST=$(echo $KAFKA_BOOTSTRAP_SERVERS | cut -d: -f1)
    KAFKA_PORT=$(echo $KAFKA_BOOTSTRAP_SERVERS | cut -d: -f2)
    
    # Only wait for Kafka if this service needs it (not db-init)
    if [ "$1" != "init-db" ]; then
        wait_for_service "$KAFKA_HOST" "$KAFKA_PORT" "Kafka"
    fi
fi

echo -e "${GREEN}✓ All dependencies ready!${NC}"
echo -e "${GREEN}🎯 Starting application: $@${NC}"

# Execute the main command
exec "$@"

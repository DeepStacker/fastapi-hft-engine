#!/bin/bash
# Docker entrypoint script for HFT Engine services
# Waits for dependencies and runs the service

set -e

# Wait for database if needed
if [ -n "$DATABASE_URL" ]; then
    echo "Waiting for database to be ready..."
    # Extract host and port from DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
        until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
            echo "Database not ready, waiting..."
            sleep 1
        done
        echo "Database is ready!"
    fi
fi

# Wait for Redis if needed
if [ -n "$REDIS_URL" ]; then
    echo "Waiting for Redis to be ready..."
    REDIS_HOST=$(echo $REDIS_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    REDIS_PORT=$(echo $REDIS_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
        until nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; do
            echo "Redis not ready, waiting..."
            sleep 1
        done
        echo "Redis is ready!"
    fi
fi

# Wait for Kafka if needed
if [ -n "$KAFKA_BOOTSTRAP_SERVERS" ]; then
    echo "Waiting for Kafka to be ready..."
    KAFKA_HOST=$(echo $KAFKA_BOOTSTRAP_SERVERS | cut -d: -f1)
    KAFKA_PORT=$(echo $KAFKA_BOOTSTRAP_SERVERS | cut -d: -f2)
    
    if [ -n "$KAFKA_HOST" ] && [ -n "$KAFKA_PORT" ]; then
        until nc -z "$KAFKA_HOST" "$KAFKA_PORT" 2>/dev/null; do
            echo "Kafka not ready, waiting..."
            sleep 1
        done
        echo "Kafka is ready!"
    fi
fi

echo "Starting service..."
exec "$@"

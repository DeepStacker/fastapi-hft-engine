#!/bin/bash
set -e

echo "🔧 Initializing Stockify Database..."

# Parse DATABASE_URL to get connection details
# Convert asyncpg URL to psql-compatible format
DB_URL=$(echo $DATABASE_URL | sed 's/postgresql+asyncpg/postgresql/')
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo "⏳ Waiting for TimescaleDB to be ready..."
echo "Connecting to: $DB_HOST:$DB_PORT/$DB_NAME as $DB_USER"

# Wait for database with proper psql connection string
max_attempts=30
attempt=1
while [ $attempt -le $max_attempts ]; do
  if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; then
    echo "✓ Database connected"
    break
  fi
  echo "Attempt $attempt/$max_attempts: Database not ready, waiting..."
  sleep 2
  attempt=$((attempt + 1))
  
  if [ $attempt -gt $max_attempts ]; then
    echo "✗ Failed to connect to database after $max_attempts attempts"
    exit 1
  fi
done

# Enable TimescaleDB extension
echo "📦 Enabling TimescaleDB extension..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
    SELECT timescaledb_information.timescaledb_version();
EOSQL

echo "✓ TimescaleDB extension enabled"

# Run database migrations
echo "📊 Running database migrations..."
cd /app
alembic upgrade head || {
    echo "⚠️  Migrations failed or already applied, creating tables directly..."
    python -m scripts.init_database
}

echo "✓ Database schema initialized"

# Create admin user if needed
echo "👤 Setting up admin user..."
python -m scripts.create_admin_user || echo "⚠️  Admin user already exists or creation failed"

echo "✅ Database initialization complete!"

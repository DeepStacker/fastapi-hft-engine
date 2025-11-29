#!/bin/bash

# Stockify - Production Initialization Script  
# Ensures clean startup with all required database tables and configurations

set -e

echo "🚀 Initializing Stockify Database..."

# Wait for database to be ready
echo "Waiting for TimescaleDB..."
until psql "$DATABASE_URL" -c '\q' 2>/dev/null; do
  echo "Database not ready, waiting..."
  sleep 2
done

echo "✓ Database connected"

# Create system_config table if not exists
echo "Creating system configuration table..."
psql "$DATABASE_URL" << 'SQL'
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100),
    data_type VARCHAR(50) DEFAULT 'string',
    is_encrypted BOOLEAN DEFAULT FALSE,
    requires_restart BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);
CREATE INDEX IF NOT EXISTS idx_system_config_updated_at ON system_config(updated_at);
SQL

echo "✓ System config table created"

# Run main database initialization
echo "Initializing all tables..."
python -m scripts.init_database

echo "✅ Database initialization complete!"

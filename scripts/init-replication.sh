#!/bin/bash
# Initialize TimescaleDB primary for replication

set -e

# This script runs in docker-entrypoint-initdb.d on primary node initialization

echo "Configuring primary node for replication..."

# Configure pg_hba.conf to allow replication connections
cat >> "${PGDATA}/pg_hba.conf" <<EOF

# Replication connections
host    replication     replicator      0.0.0.0/0               md5
host    all             all             0.0.0.0/0               md5
EOF

# Create replication user
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create replication user if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'replicator') THEN
            CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD '${POSTGRES_REPLICA_PASSWORD}';
        END IF;
    END
    \$\$;
    
    -- Grant necessary permissions
    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO replicator;
    
    -- Create replication slot for each replica
    SELECT pg_create_physical_replication_slot('replica_1_slot');
    SELECT pg_create_physical_replication_slot('replica_2_slot');
    
    -- Show replication status
    SELECT * FROM pg_replication_slots;
EOSQL

echo "Primary node configured for replication"

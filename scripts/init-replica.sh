#!/bin/bash
# Initialize TimescaleDB replica from primary using pg_basebackup

set -e

echo "Initializing replica from primary..."

# Remove existing data directory
rm -rf ${PGDATA}/*

# Perform base backup from primary
PGPASSWORD="${POSTGRES_REPLICA_PASSWORD}" pg_basebackup \
    -h ${POSTGRES_PRIMARY_HOST} \
    -p ${POSTGRES_PRIMARY_PORT} \
    -U replicator \
    -D ${PGDATA} \
    -Fp \
    -Xs \
    -P \
    -R \
    --slot=$(hostname | sed 's/timescaledb-//g' | sed 's/-/_/g')_slot

# Create recovery configuration
cat >> "${PGDATA}/postgresql.auto.conf" <<EOF
# Replica configuration
primary_conninfo = 'host=${POSTGRES_PRIMARY_HOST} port=${POSTGRES_PRIMARY_PORT} user=replicator password=${POSTGRES_REPLICA_PASSWORD}'
primary_slot_name = '$(hostname | sed 's/timescaledb-//g' | sed 's/-/_/g')_slot'
hot_standby = on
EOF

# Set ownership
chown -R postgres:postgres ${PGDATA}
chmod 0700 ${PGDATA}

echo "Replica initialized successfully from primary"

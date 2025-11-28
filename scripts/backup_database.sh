#!/bin/bash
# Automated backup script for TimescaleDB

set -e

# Configuration
BACKUP_DIR="/backups/stockify"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="stockify_backup_${TIMESTAMP}.sql.gz"

# Database connection
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-stockify_db}"
DB_USER="${DATABASE_USER:-stockify}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "Starting backup at $(date)"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# Verify backup was created
if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    echo "Backup successful: ${BACKUP_FILE}"
    echo "Size: $(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)"
else
    echo "ERROR: Backup failed!"
    exit 1
fi

# Remove old backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name "stockify_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Upload to S3 (optional)
if [ -n "$AWS_S3_BUCKET" ]; then
    echo "Uploading backup to S3..."
    aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${AWS_S3_BUCKET}/backups/"
    echo "Backup uploaded to S3"
fi

echo "Backup completed at $(date)"

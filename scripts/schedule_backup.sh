#!/bin/bash

# Stockify - Scheduled Backup Script
# This script is designed to be run by cron for automated database backups

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_database.sh"
LOG_FILE="/var/log/stockify/backup.log"
RETENTION_DAYS=30

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========== Starting Scheduled Backup =========="

# Check if backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
    log "ERROR: Backup script not found at $BACKUP_SCRIPT"
    exit 1
fi

# Run backup
log "Running backup script..."
if bash "$BACKUP_SCRIPT" >> "$LOG_FILE" 2>&1; then
    log "✓ Backup completed successfully"
else
    log "✗ Backup failed with exit code $?"
    exit 1
fi

# Verify backup
log "Verifying latest backup..."
BACKUP_DIR="$PROJECT_ROOT/backups"
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/stockify_backup_*.sql 2>/dev/null | head -n1)

if [ -z "$LATEST_BACKUP" ]; then
    log "ERROR: No backup files found in $BACKUP_DIR"
    exit 1
fi

# Check backup size
BACKUP_SIZE=$(stat -f%z "$LATEST_BACKUP" 2>/dev/null || stat -c%s "$LATEST_BACKUP" 2>/dev/null)
if [ "$BACKUP_SIZE" -lt 1000 ]; then
    log "WARNING: Backup file seems too small ($BACKUP_SIZE bytes): $LATEST_BACKUP"
    exit 1
fi

log "✓ Backup verified: $LATEST_BACKUP ($BACKUP_SIZE bytes)"

# Cleanup old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "stockify_backup_*.sql" -mtime +$RETENTION_DAYS -delete
DELETED_COUNT=$(find "$BACKUP_DIR" -name "stockify_backup_*.sql" -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
log "✓ Cleaned up old backups (retained: last $RETENTION_DAYS days)"

# Count remaining backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/stockify_backup_*.sql 2>/dev/null | wc -l)
log "Total backups: $BACKUP_COUNT"

log "========== Backup Completed Successfully =========="

# Optional: Send notification (uncomment to enable)
# curl -X POST https://your-webhook-url.com/backup-success \
#     -H "Content-Type: application/json" \
#     -d "{\"status\": \"success\", \"backup\": \"$LATEST_BACKUP\", \"size\": $BACKUP_SIZE}"

exit 0

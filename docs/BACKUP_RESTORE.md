# Backup and Restore Guide

## Overview

This guide covers automated backups, manual backups, and restoration procedures for the Stockify TimescaleDB database.

## Backup Strategy

### Automated Backups

**Schedule:** Daily at 2:00 AM (configurable)

**Retention:** 30 days (configurable)

**Location:** `./backups/` directory

#### Setting Up Automated Backups

1. **Using Cron (Linux/Mac)**

```bash
# Edit crontab
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /path/to/fastapi-hft-engine/scripts/schedule_backup.sh

# Verify cron job
crontab -l
```

2. **Using Systemd Timer (Linux)**

Create `/etc/systemd/system/stockify-backup.service`:
```ini
[Unit]
Description=Stockify Database Backup
After=network.target

[Service]
Type=oneshot
User=stockify
ExecStart=/path/to/fastapi-hft-engine/scripts/schedule_backup.sh
```

Create `/etc/systemd/system/stockify-backup.timer`:
```ini
[Unit]
Description=Run Stockify backup daily
Requires=stockify-backup.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:
```bash
sudo systemctl enable stockify-backup.timer
sudo systemctl start stockify-backup.timer
sudo systemctl status stockify-backup.timer
```

3. **Monitoring Backups**

Check backup logs:
```bash
tail -f /var/log/stockify/backup.log
```

List recent backups:
```bash
ls -lh backups/ | head -10
```

### Manual Backups

Run manual backup anytime:
```bash
./scripts/backup_database.sh
```

With custom backup directory:
```bash
BACKUP_DIR=/custom/path ./scripts/backup_database.sh
```

## Backup Verification

The automated backup script performs these verifications:

1. **File exists** - Confirms backup file was created
2. **Minimum size** - File size > 1KB (not empty)
3. **Timestamp** - Recent modification time
4. **Integrity** - Can be listed/read

### Manual Verification

Verify backup integrity:
```bash
# Check if file is valid SQL
head -20 backups/stockify_backup_20251129_020000.sql

# Should see:
# -- PostgreSQL database dump
# -- Dumped from database version...
```

Test restore to temporary database:
```bash
# Create test database
docker-compose exec timescaledb createdb -U stockify stockify_test

# Restore backup
cat backups/stockify_backup_20251129_020000.sql | \
  docker-compose exec -T timescaledb psql -U stockify -d stockify_test

# Verify data
docker-compose exec timescaledb psql -U stockify -d stockify_test -c "\dt"

# Cleanup
docker-compose exec timescaledb dropdb -U stockify stockify_test
```

## Restoration Procedures

### Full Database Restore

⚠️ **WARNING:** This will replace all current data!

1. **Stop all services (except database)**

```bash
docker-compose stop gateway-service ingestion-service processor-service \
  storage-service realtime-service grpc-server admin-service
```

2. **Drop existing database**

```bash
docker-compose exec timescaledb dropdb -U stockify stockify_db
```

3. **Create fresh database**

```bash
docker-compose exec timescaledb createdb -U stockify stockify_db
```

4. **Restore from backup**

```bash
# Use latest backup
LATEST_BACKUP=$(ls -t backups/stockify_backup_*.sql | head -n1)
echo "Restoring from: $LATEST_BACKUP"

cat "$LATEST_BACKUP" | \
  docker-compose exec -T timescaledb psql -U stockify -d stockify_db
```

5. **Verify restoration**

```bash
# Check table count
docker-compose exec timescaledb psql -U stockify -d stockify_db -c "\dt"

# Check row counts
docker-compose exec timescaledb psql -U stockify -d stockify_db -c "
  SELECT 
    schemaname,
    tablename,
    n_live_tup as rows
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
"
```

6. **Restart all services**

```bash
docker-compose up -d
```

7. **Verify application**

```bash
# Check health
curl http://localhost:8000/health

# Check data
curl http://localhost:8000/stats
```

### Point-in-Time Restore

To restore to a specific backup:

```bash
# List available backups
ls -lh backups/stockify_backup_*

# Restore specific backup
cat backups/stockify_backup_20251128_020000.sql | \
  docker-compose exec -T timescaledb psql -U stockify -d stockify_db
```

### Partial Table Restore

To restore only specific tables:

```bash
# Extract specific table from backup
grep -A 10000 "CREATE TABLE market_snapshots" \
  backups/stockify_backup_20251129_020000.sql > market_snapshots_only.sql

# Restore just that table
docker-compose exec timescaledb psql -U stockify -d stockify_db \
  -c "TRUNCATE market_snapshots CASCADE;"

cat market_snapshots_only.sql | \
  docker-compose exec -T timescaledb psql -U stockify -d stockify_db
```

## Disaster Recovery

### Scenario 1: Complete Data Loss

If database is completely lost:

1. Provision new TimescaleDB instance
2. Update `DATABASE_URL` in `.env`
3. Follow "Full Database Restore" procedure above

### Scenario 2: Corrupted Database

If database is corrupted but container is running:

```bash
# Backup current state (even if corrupted)
./scripts/backup_database.sh corrupted

# Drop and recreate database
docker-compose exec timescaledb dropdb -U stockify stockify_db
docker-compose exec timescaledb createdb -U stockify stockify_db

# Restore from last known good backup
cat backups/stockify_backup_YYYYMMDD_HHMMSS.sql | \
  docker-compose exec -T timescaledb psql -U stockify -d stockify_db
```

### Scenario 3: Accidental Data Deletion

To recover deleted data:

1. Identify when data was deleted (check logs/timestamps)
2. Find backup taken before deletion
3. Restore to temporary database
4. Export needed data
5. Import to production database

```bash
# 1. Restore to temp database
docker-compose exec timescaledb createdb -U stockify stockify_recovery

cat backups/stockify_backup_BEFORE_DELETE.sql | \
  docker-compose exec -T timescaledb psql -U stockify -d stockify_recovery

# 2. Export needed data
docker-compose exec timescaledb pg_dump -U stockify -d stockify_recovery \
  -t market_snapshots --data-only > recovered_data.sql

# 3. Import to production
cat recovered_data.sql | \
  docker-compose exec -T timescaledb psql -U stockify -d stockify_db

# 4. Cleanup
docker-compose exec timescaledb dropdb -U stockify stockify_recovery
```

## Backup Best Practices

### Storage

- **Local Backups:** Keep on separate disk/volume
- **Cloud Backup:** Upload to S3/GCS/Azure Blob
- **Off-site:** Copy to different data center
- **Encryption:** Encrypt backups at rest

### Example: Upload to S3

```bash
# Install AWS CLI
pip install awscli

# Configure credentials
aws configure

# Upload latest backup
LATEST_BACKUP=$(ls -t backups/stockify_backup_*.sql | head -n1)
aws s3 cp "$LATEST_BACKUP" s3://your-bucket/stockify-backups/

# Automated upload in schedule_backup.sh
# Add after backup completion:
# aws s3 cp "$LATEST_BACKUP" s3://your-bucket/stockify-backups/
```

### Monitoring

Set up alerts for:
- Backup failures (check logs)
- Backup size anomalies
- Missing daily backups
- Disk space for backup storage

### Testing

**Monthly:** Test restore procedure
```bash
# Automated restore test
./scripts/test_restore.sh
```

**Quarterly:** Full disaster recovery drill

## Backup Configuration

### Environment Variables

```bash
# In scripts/schedule_backup.sh
RETENTION_DAYS=30        # How long to keep backups
LOG_FILE=/var/log/stockify/backup.log

# In scripts/backup_database.sh  
BACKUP_DIR=./backups     # Backup storage location
POSTGRES_USER=stockify
POSTGRES_DB=stockify_db
```

### Customization

Edit `scripts/schedule_backup.sh` to:
- Change retention period
- Add cloud upload
- Send notifications (Slack/email)
- Compress backups (gzip)

## Troubleshooting

### Backup Fails with "Permission Denied"

```bash
# Fix backup script permissions
chmod +x scripts/*.sh

# Fix backup directory permissions
chmod 755 backups/
```

### "Database does not exist" During Restore

```bash
# Create database first
docker-compose exec timescaledb createdb -U stockify stockify_db

# Enable TimescaleDB extension
docker-compose exec timescaledb psql -U stockify -d stockify_db \
  -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

### Restore Takes Too Long

For large databases:
```bash
# Use parallel restore (if using pg_dump -Fc format)
pg_restore -j 4 -d stockify_db backup.dump

# Or optimize PostgreSQL during restore
docker-compose exec timescaledb psql -U stockify -d stockify_db -c "
  SET maintenance_work_mem = '1GB';
  SET max_wal_size = '4GB';
"
```

### Check Backup Cron Job Status

```bash
# View cron log
grep CRON /var/log/syslog | tail -20

# Check if backup script ran
ls -lt /var/log/stockify/backup.log

# Test cron job manually
/path/to/scripts/schedule_backup.sh
```

## Backup Checklist

- [  ] Automated backups configured
- [ ] Cron job verified
- [ ] Backup logs monitored
- [ ] Restoration tested monthly
- [ ] Off-site backup configured
- [ ] Disk space monitored
- [ ] Alert notifications setup
- [ ] Documentation reviewed with team
- [ ] Restore procedure tested
- [ ] Backup encryption enabled (if needed)

## Support

For backup/restore issues:
1. Check `/var/log/stockify/backup.log`
2. Verify database connectivity
3. Check disk space: `df -h`
4. Review Docker logs: `docker-compose logs timescaledb`


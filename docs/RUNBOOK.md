# Stockify Operational Runbook

## Table of Contents
1. [Service Management](#service-management)
2. [Troubleshooting](#troubleshooting)
3. [Database Operations](#database-operations)
4. [Deployment Procedures](#deployment-procedures)
5. [Incident Response](#incident-response)
6. [Monitoring & Alerts](#monitoring--alerts)

---

## Service Management

### Starting All Services
```bash
make up
```

### Stopping All Services
```bash
make down
```

### Restarting a Specific Service
```bash
docker-compose restart gateway-service
docker-compose restart ingestion-service
docker-compose restart storage-service
docker-compose restart realtime-service
docker-compose restart processor-service
```

### Viewing Logs
```bash
# All services
make logs

# Specific service
docker-compose logs -f gateway-service

# Last 100 lines
docker-compose logs --tail=100 gateway-service
```

### Health Check
```bash
curl http://localhost:8000/health
```

---

## Troubleshooting

### Issue: Service Won't Start

**Symptoms**: Service container exits immediately

**Diagnosis**:
```bash
docker-compose logs service-name
docker-compose ps
```

**Common Causes**:
1. **Port already in use**
   - Solution: `lsof -i :8000` and kill the process
   
2. **Missing environment variables**
   - Solution: Check `.env` file exists and has all required variables
   
3. **Database connection failed**
   - Solution: Verify TimescaleDB is running: `docker-compose ps timescaledb`

### Issue: High Memory Usage

**Diagnosis**:
```bash
docker stats
```

**Solutions**:
1. Check for memory leaks in logs
2. Restart the service: `docker-compose restart service-name`
3. Check Redis memory: `redis-cli info memory`
4. Clear Redis cache if needed: `redis-cli FLUSHDB`

### Issue: Kafka Consumer Lag

**Diagnosis**:
```bash
docker-compose exec kafka kafka-consumer-groups.sh \
    --bootstrap-server localhost:9092 \
    --describe --group storage-group
```

**Solutions**:
1. Scale up consumer instances
2. Check for slow database writes
3. Increase batch size in storage service
4. Check for dead letter queue messages

### Issue: WebSocket Connections Dropping

**Diagnosis**:
- Check gateway logs for errors
- Verify Redis pub/sub is working
- Check WebSocket connection limits

**Solutions**:
1. Increase WebSocket timeout
2. Check load balancer timeout settings
3. Verify JWT tokens are valid
4. Check for network issues

---

## Database Operations

### Running Migrations
```bash
# Apply all pending migrations
make migrate-up

# Rollback last migration
make migrate-down

# Check current migration version
make migrate-current
```

### Creating a New Migration
```bash
make migrate-create message="add_new_index"
```

### Backup Database
```bash
# Manual backup
./scripts/backup_database.sh

# Restore from backup
gunzip -c /backups/stockify/backup_file.sql.gz | \
    psql -h localhost -U stockify -d stockify_db
```

### Database Performance

**Check slow queries**:
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Check table sizes**:
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

**Vacuum and analyze**:
```sql
VACUUM ANALYZE;
```

---

## Deployment Procedures

### Blue-Green Deployment

1. **Deploy to Blue Environment**:
   ```bash
   docker-compose -f docker-compose.blue.yml up -d
   ```

2. **Run Health Checks**:
   ```bash
   curl http://blue.stockify.io/health
   ```

3. **Run Smoke Tests**:
   ```bash
   pytest tests/smoke/ --env=blue
   ```

4. **Switch Traffic**:
   ```bash
   # Update load balancer to point to blue
   ./scripts/switch_traffic.sh blue
   ```

5. **Monitor for 15 Minutes**:
   - Watch error rates
   - Check response times
   - Monitor resource usage

6. **Rollback if Needed**:
   ```bash
   ./scripts/switch_traffic.sh green
   ```

### Database Migration Procedure

1. **Backup Database**:
   ```bash
   ./scripts/backup_database.sh
   ```

2. **Test Migration in Staging**:
   ```bash
   ENVIRONMENT=staging make migrate-up
   ```

3. **Apply to Production** (during maintenance window):
   ```bash
   # Enable maintenance mode
   ./scripts/maintenance_mode.sh on
   
   # Run migration
   make migrate-up
   
   # Verify
   make migrate-current
   
   # Disable maintenance mode
   ./scripts/maintenance_mode.sh off
   ```

4. **Rollback if Needed**:
   ```bash
   make migrate-down
   # Restore from backup if necessary
   ```

---

## Incident Response

### Severity Levels

- **P0 (Critical)**: Service completely down, data loss
- **P1 (High)**: Major functionality broken, affecting all users
- **P2 (Medium)**: Minor functionality broken, workaround available
- **P3 (Low)**: Cosmetic issues, no impact on functionality

### P0 Response Procedure

1. **Acknowledge Incident** (< 5 minutes)
   - Create incident channel in Slack
   - Notify on-call engineer
   - Start incident log

2. **Assess Impact** (< 10 minutes)
   - How many users affected?
   - Which services are down?
   - Is data being lost?

3. **Immediate Mitigation** (< 30 minutes)
   - Rollback recent deployment if applicable
   - Scale up resources if capacity issue
   - Switch to backup systems if available

4. **Root Cause Analysis** (After mitigation)
   - Check logs for errors
   - Review recent changes
   - Analyze metrics

5. **Resolution** 
   - Apply fix
   - Verify resolution
   - Monitor for 24 hours

6. **Post-Mortem** (Within 48 hours)
   - Document what happened
   - Identify preventive measures
   - Update runbook

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **API Performance**:
   - Response time (p50, p95, p99)
   - Error rate
   - Request rate

2. **Database**:
   - Connection pool usage
   - Query performance
   - Replication lag

3. **Kafka**:
   - Consumer lag
   - Producer rate
   - Broker health

4. **System Resources**:
   - CPU usage
   - Memory usage
   - Disk usage
   - Network I/O

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API p99 latency | > 500ms | > 1000ms |
| Error rate | > 0.5% | > 1% |
| CPU usage | > 70% | > 90% |
| Memory usage | > 80% | > 95% |
| Disk usage | > 75% | > 90% |
| Kafka lag | > 1000 | > 10000 |

### Accessing Dashboards

- **Grafana**: http://monitoring.stockify.io:3000
- **Prometheus**: http://monitoring.stockify.io:9090
- **Kibana (Logs)**: http://monitoring.stockify.io:5601

---

## Common Commands Cheat Sheet

```bash
# Check service status
docker-compose ps

# View real-time metrics
docker stats

# Check Kafka topics
docker-compose exec kafka kafka-topics.sh --list --bootstrap-server localhost:909 2

# Check Redis memory
redis-cli info memory

# Check database connections
psql -h localhost -U stockify -d stockify_db \
    -c "SELECT count(*) FROM pg_stat_activity;"

# Test API endpoint
curl -X GET http://localhost:8000/snapshot/13 \
    -H "Authorization: Bearer YOUR_TOKEN"

# Run tests
make test

# View coverage
pytest --cov=. --cov-report=html
```

---

## Emergency Contacts

- **On-Call Engineer**: oncall@stockify.io
- **DevOps Team**: devops@stockify.io
- **Database Team**: dba@stockify.io
- **Security Team**: security@stockify.io

**Escalation Path**:
1. On-call engineer (immediate)
2. Team lead (if not resolved in 30 min)
3. CTO (P0 incidents only)

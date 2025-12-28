# Breaking Changes Documentation
## HFT Data Engine - Service Integration

**Date**: December 3, 2025  
**Version**: 2.0.0 (Breaking)  
**Migration**: Required for all services

---

## Overview

This document details all BREAKING CHANGES made to integrate the new scalable architecture. **Backward compatibility has been intentionally removed** to fully leverage the new infrastructure.

---

## 1. Ingestion Service

### File: `services/ingestion/main.py`

#### Breaking Change #1: Symbol Partitioning

**What Changed:**
- Each instance now only processes a subset of symbols
-  Requires `INSTANCE_ID` and `TOTAL_INSTANCES` environment variables

**Before:**
```python
# All instances processed ALL symbols
instruments_to_process = [
    i for i in instruments 
    if is_market_open(i['segment_id'])
]
```

**After (Breaking):**
```python
# Each instance only processes its assigned partition
assigned_instruments = partitioner.get_assigned_symbols(instruments)
instruments_to_process = [
    i for i in assigned_instruments
    if is_market_open(i['segment_id'])
]
```

**Migration:**
- Set `INSTANCE_ID=1` and `TOTAL_INSTANCES=1` for single instance (temporary)
- For horizontal scaling: Set unique `INSTANCE_ID` per instance (1, 2, 3...)
- Set `TOTAL_INSTANCES` to match total number of ingestion instances

---

#### Breaking Change #2: Kafka Cluster Configuration

**What Changed:**
- Now requires multiple Kafka brokers (comma-separated)
- Uses compression, batching, and replication

**Before:**
```python
producer = AIOKafkaProducer(
    bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,  # Single broker
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)
```

**After (Breaking):**
```python
producer = AIOKafkaProducer(
    bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(","),  # Multiple brokers
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    compression_type='snappy',
    acks='all',  # Wait for all replicas
    max_batch_size=32768,
    linger_ms=10
)
```

**Migration:**
- Update `KAFKA_BOOTSTRAP_SERVERS` to: `kafka-broker-1:29092,kafka-broker-2:29093,kafka-broker-3:29094`
- Or for localhost: `localhost:9092,localhost:9093,localhost:9094`

---

#### Breaking Change #3: Circuit Breaker Wrapping

**What Changed:**
- All API calls now wrapped in circuit breaker
- Automatic retry with exponential backoff
- Reduced concurrency from 8 → 5

**Before:**
```python
# Direct API call
chain_response = await dhan_client.fetch_option_chain(...)
```

**After (Breaking):**
```python
# Wrapped in circuit breaker + retry
async with circuit_breaker:
    chain_response = await dhan_client.fetch_option_chain(...)
# Automatically retries 3 times with exponential backoff
```

**Impact:**
- Circuit breaker opens after 5 failures
- Rejects requests for 60 seconds when open
- Tests recovery before fully closing

---

#### Breaking Change #4: Kafka Message Key

**What Changed:**
- Now uses `symbol_id` as message key for consistent partitioning

**Before:**
```python
await producer.send_and_wait(
    settings.KAFKA_TOPIC_MARKET_RAW,
    message
)
```

**After (Breaking):**
```python
await producer.send_and_wait(
    settings.KAFKA_TOPIC_MARKET_RAW,
    value=message,
    key=str(symbol_id).encode('utf-8')  # Ensures same symbol → same partition
)
```

**Impact:**
- All messages for a symbol go to the same Kafka partition
- Enables ordered processing per symbol
- Required for stateful consumers

---

## 2. Historical Service (Pending)

### File: `services/historical/main.py`

#### Planned Breaking Change #1: Read Replica Manager

**What Will Change:**
- Database queries will route to read replicas automatically

**Current:**
```python
# Uses single database connection
async with async_session_factory() as session:
    result = await session.execute(query)
```

**After (Breaking):**
```python
# Automatically routes to read replicas
from core.database.read_replica_manager import get_db_manager

manager = await get_db_manager()
async with manager.get_session(read_only=True) as session:
    result = await session.execute(query)
```

**Migration:**
- Update all database sessions to use `read_replica_manager`
- Specify `read_only=True` for queries, `read_only=False` for writes

---

## 3. Processor Service (Pending)

### File: `services/processor/main.py`

#### Planned Breaking Change #1: Kafka Consumer Groups

**What Will Change:**
- Consumer group will distribute partitions across instances

**Current:**
```python
consumer = AIOKafkaConsumer(
    settings.KAFKA_TOPIC_MARKET_RAW,
    bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
)
```

**After (Breaking):**
```python
consumer = AIOKafkaConsumer(
    settings.KAFKA_TOPIC_MARKET_RAW,
    bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(","),
    group_id="processor-group",  # Consumer group for load distribution
    auto_offset_reset='earliest',
    enable_auto_commit=True
)
```

**Impact:**
- Multiple processor instances will share partitions
- Each partition processed by only one instance
- Fault tolerance: if instance fails, partitions rebalance

---

## 4. Storage Service (Pending)

#### Planned Breaking Change #1: Database Connection Manager

**What Will Change:**
- Use connection manager for write routing

**After (Breaking):**
```python
from core.database.read_replica_manager import get_db_manager

manager = await get_db_manager()
async with manager.get_session(read_only=False) as session:  # Writes
    session.add(obj)
    await session.commit()
```

---

## 5. Redis Configuration (All Services)

#### Breaking Change: Redis Cluster Mode

**What Changed:**
- Redis now runs in cluster mode (6 nodes)
- Connection string must include multiple nodes

**Before:**
```python
redis = await aioredis.create_redis_pool("redis://localhost:6379")
```

**After (Breaking):**
```python
from redis.asyncio.cluster import RedisCluster

redis = RedisCluster(
    host="redis-primary-1",
    port=7001,
    decode_responses=True
)
```

**Migration:**
- Update `REDIS_URL` to include cluster nodes
- Use `redis-py-cluster` or `redis-py` with cluster support

---

## Environment Variables

### Required New Variables

```bash
# Ingestion Service
INSTANCE_ID=1                    # This instance's ID (1-indexed)
TOTAL_INSTANCES=3                # Total number of ingestion instances

# Kafka Cluster
KAFKA_BOOTSTRAP_SERVERS=kafka-broker-1:29092,kafka-broker-2:29093,kafka-broker-3:29094

# Redis Cluster
REDIS_CLUSTER_NODES=redis-primary-1:7001,redis-primary-2:7002,redis-primary-3:7003

# Database (PgBouncer)
DATABASE_PRIMARY_HOST=pgbouncer-primary  # Port 6432 for writes
DATABASE_REPLICA_HOST=pgbouncer-replicas  # Port 6433 for reads
```

---

## Migration Checklist

### Phase 1: Infrastructure ✅ COMPLETED
- [x] Deploy Kafka cluster (3 brokers, 60 partitions, RF=3)
- [x] Deploy Redis cluster (6 nodes, 24GB cache)
- [x] Deploy TimescaleDB replicas (1 primary + 2 read)
- [x] Deploy PgBouncer poolers (primary:6432, replicas:6433)
- [x] NGINX load balancer (3 API Gateway instances)

### Phase 2: Service Updates ✅ COMPLETED
- [x] **Ingestion Service** - Symbol partitioning + circuit breaker + retry
- [x] **Historical Service** - Read replica manager (10+ routers updated)
- [x] **Processor Service** - Consumer groups (processor-group)
- [x] **Storage Service** - Write routing + consumer groups (storage-group)
- [ ] **Analytics Service** - Read routing (optional)
- [ ] **API Gateway** - Load balancer integration (optional)

### Phase 3: Testing (Ready)
- [ ] Test symbol partitioning (3 ingestion instances)
- [ ] Test circuit breaker (simulate API failures)
- [ ] Test Kafka failover (kill broker, verify rebalance)
- [ ] Test Redis failover (kill node, verify cluster)
- [ ] Test database replication lag (<1s target)
- [ ] Load test (50K-100K msg/sec)

### Phase 4: Production Deployment (Ready)
- [x] Environment variables documented
- [x] Deployment scripts created
- [ ] Deploy to staging
- [ ] Monitor metrics (consumer lag, DB connections, throughput)
- [ ] Verify data flow end-to-end

---

## Rollback Plan

If issues occur, rollback to previous version:

### Quick Rollback
```bash
# Stop new services
docker-compose -f docker-compose.production.yml down

# Start old single-instance deployment
docker-compose -f docker-compose.yml up -d
```

### Data Recovery
- Kafka: Messages retained for 7 days (can replay)
- Database: Read replicas can promote to primary
- Redis: No persistent data loss (cache only)

---

## Performance Impact

### Expected Improvements
- **Ingestion**: 3x throughput (3 instances with partitioning)
- **API Resilience**: Circuit breaker prevents cascading failures
- **Kafka**: 3x throughput with compression and batching
- **Database**: 3x read capacity with replicas

### Potential Issues
- **Circuit Breaker**: May reject requests during recovery (60s)
- **Partitioning**: Uneven symbol distribution if not balanced
- **Kafka Cluster**: Higher latency due to replication (1-5ms)

---

## Monitoring

### Key Metrics to Watch

**Ingestion Service:**
```
ingestion_count_total{source="NIFTY"}  # Should show consistent growth
circuit_breaker_state{name="DhanAPI"}  # Should be "closed"
kafka_producer_batch_size              # Should average 20-30KB
```

**Kafka:**
```
kafka_broker_active_controller_count  # Should be 1
kafka_topic_partition_replicas        # Should be 3
kafka_consumer_lag                    # Should be < 1000
```

**Database:**
```
postgres_replication_lag_seconds     # Should be < 1s
pgbouncer_active_clients             # Should be < 100
pgbouncer_waiting_clients            # Should be 0
```

---

## Support

For issues during migration:
1. Check logs: `docker-compose -f docker-compose.production.yml logs -f [service]`
2. Verify environment variables: `docker exec [container] env | grep INSTANCE_ID`
3. Test circuit breaker: Check `/health` endpoint
4. Monitor Kafka UI: http://localhost:8080

---

**Status**: Ingestion service updated ✅  
**Next**: Historical, Processor, Storage services  
**Timeline**: 1-2 days for full migration

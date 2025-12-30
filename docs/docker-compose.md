# Docker Compose Files

This project uses multiple compose files for different scenarios.

## Usage Guide

### Local Development
```bash
docker compose up -d
```
Uses: `docker-compose.yml` (base)

### Production
```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```
Uses: Base + production overrides

### Observability (Jaeger, Prometheus, Grafana)
```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

### Kafka Cluster (3 brokers)
```bash
docker compose -f docker-compose.yml -f docker-compose.kafka-cluster.yml up -d
```

### Redis Cluster (6 nodes)
```bash
docker compose -f docker-compose.yml -f docker-compose.redis-cluster.yml up -d
```

### TimescaleDB Cluster (primary + replicas)
```bash
docker compose -f docker-compose.yml -f docker-compose.timescaledb-cluster.yml up -d
```

### Integration Testing
```bash
docker compose -f docker-compose.integration.yml up -d
```

---

## File Descriptions

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base config - all services for local dev |
| `docker-compose.production.yml` | Production overrides (resources, replicas) |
| `docker-compose.observability.yml` | Jaeger, Prometheus, Grafana |
| `docker-compose.kafka-cluster.yml` | Multi-broker Kafka setup |
| `docker-compose.redis-cluster.yml` | Redis cluster mode |
| `docker-compose.timescaledb-cluster.yml` | TimescaleDB with replicas |
| `docker-compose.nginx.yml` | Nginx reverse proxy |
| `docker-compose.integration.yml` | Minimal setup for CI/CD |

# Docker Setup Guide - Stockify HFT Data Engine

## Quick Start (TL;DR)

```bash
# Clone and setup
git clone <repository-url>
cd fastapi-hft-engine

# One-command setup
./setup.sh
```

That's it! The setup script will guide you through the process.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Running the Application](#running-the-application)
5. [Service Architecture](#service-architecture)
6. [Accessing Services](#accessing-services)
7. [Common Operations](#common-operations)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

### Required Software

- **Docker**: Version 20.10 or higher
  - [Install Docker Desktop](https://docs.docker.com/get-docker/)
- **Docker Compose**: Version 2.0 or higher (included with Docker Desktop)

### System Requirements

- **RAM**: Minimum 8GB, recommended 16GB
- **Disk Space**: Minimum 20GB free space
- **CPU**: 4+ cores recommended for optimal performance

### Required Ports

Ensure these ports are available on your host machine:

| Port  | Service          | Required |
|-------|------------------|----------|
| 5432  | TimescaleDB      | Yes      |
| 6379  | Redis            | Yes      |
| 2181  | Zookeeper        | Yes      |
| 9092  | Kafka            | Yes      |
| 8000  | Gateway Service  | Yes      |
| 8001  | Admin Service    | Yes      |
| 3000  | Admin Frontend   | Yes      |
| 3001  | Grafana          | Optional |
| 9090  | Prometheus       | Optional |
| 50051 | gRPC Server      | Optional |

---

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd fastapi-hft-engine
```

### Step 2: Configure Environment

The `.env.example` file contains all available configuration options. You can either:

**Option A: Use the setup script (Recommended)**
```bash
./setup.sh
```
The script will create `.env` from `.env.example` if it doesn't exist.

**Option B: Manual configuration**
```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Minimum Required Configuration:**
```bash
# Database
DATABASE_URL=postgresql+asyncpg://stockify:stockify123@timescaledb:5432/stockify_db
POSTGRES_DB=stockify_db
POSTGRES_USER=stockify
POSTGRES_PASSWORD=CHANGE_THIS_PASSWORD

# Redis
REDIS_URL=redis://redis:6379/0

# Security (CHANGE THIS!)
SECRET_KEY=GENERATE_A_SECURE_KEY_HERE_MIN_32_CHARS

# Dhan API (if using market data ingestion)
DHAN_CLIENT_ID=your_client_id
DHAN_ACCESS_TOKEN=your_access_token
```

> [!WARNING]
> **Security**: Always change the default `SECRET_KEY` and database passwords in production!

Generate a secure secret key:
```bash
python -c 'import secrets; print(secrets.token_urlsafe(32))'
```

---

## Running the Application

### Using the Setup Script (Recommended)

The easiest way to run the application:

```bash
./setup.sh
```

The script provides interactive options:
1. **Fresh setup** - Clean start with new database
2. **Start services** - Start with existing data
3. **Stop all services**
4. **View logs**
5. **Clean up** - Remove all containers and data

### Manual Startup

#### Option 1: Fresh Start (Recommended for first-time setup)

```bash
# Clean any existing containers/volumes
docker compose down -v

# Build images
docker compose build

# Start infrastructure
docker compose up -d timescaledb redis zookeeper

# Wait 30 seconds for services to initialize
sleep 30

# Start Kafka
docker compose up -d kafka

# Wait 20 seconds for Kafka
sleep 20

# Initialize database
docker compose up db-init

# Start all application services
docker compose up -d
```

#### Option 2: Quick Start (with existing setup)

```bash
docker compose up -d
```

#### Option 3: Using Makefile

```bash
make build  # Build images
make up     # Start services
make logs   # View logs
make down   # Stop services
```

---

## Service Architecture

```mermaid
graph TB
    subgraph "Infrastructure"
        DB[(TimescaleDB)]
        REDIS[(Redis)]
        KAFKA[Kafka]
        ZK[Zookeeper]
    end
    
    subgraph "Initialization"
        INIT[db-init]
    end
    
    subgraph "Application Services"
        GATEWAY[Gateway Service<br/>:8000]
        ADMIN[Admin Service<br/>:8001]
        INGESTION[Ingestion Service]
        PROCESSOR[Processor Service]
        STORAGE[Storage Service]
        REALTIME[Realtime Service]
        GRPC[gRPC Server<br/>:50051]
    end
    
    subgraph "Frontend"
        ADMIN_UI[Admin Dashboard<br/>:3000]
    end
    
    subgraph "Monitoring"
        PROM[Prometheus<br/>:9090]
        GRAF[Grafana<br/>:3001]
    end
    
    INIT --> DB
    INIT --> REDIS
    
    KAFKA --> ZK
    
    INGESTION --> KAFKA
    INGESTION --> DB
    
    PROCESSOR --> KAFKA
    PROCESSOR --> REDIS
    
    STORAGE --> KAFKA
    STORAGE --> DB
    
    REALTIME --> KAFKA
    REALTIME --> REDIS
    
    GATEWAY --> DB
    GATEWAY --> REDIS
    GATEWAY --> KAFKA
    
    ADMIN --> DB
    ADMIN --> REDIS
    
    GRPC --> DB
    GRPC --> REDIS
    
    ADMIN_UI --> ADMIN
    
    PROM --> GATEWAY
    PROM --> ADMIN
    GRAF --> PROM
```

### Service Startup Order

The Docker Compose configuration ensures services start in the correct order:

1. **Infrastructure Layer**
   - TimescaleDB (with health check)
   - Redis (with health check)
   - Zookeeper
   - Kafka (depends on Zookeeper)

2. **Initialization**
   - `db-init` - Runs once to create database schema and admin user

3. **Application Services** (all depend on db-init completion)
   - Gateway Service
   - Admin Service
   - Ingestion Service
   - Processor Service
   - Storage Service
   - Realtime Service
   - gRPC Server

4. **Frontend & Monitoring**
   - Admin Frontend
   - Prometheus
   - Grafana

---

## Accessing Services

Once all services are running (check with `docker compose ps`):

### API Services

- **Gateway Service API**: http://localhost:8000
  - Interactive docs: http://localhost:8000/docs
  - Health check: http://localhost:8000/health
  - Metrics: http://localhost:8000/metrics

- **Admin Service API**: http://localhost:8001
  - Interactive docs: http://localhost:8001/docs
  - Health check: http://localhost:8001/health

### Web Interfaces

- **Admin Dashboard**: http://localhost:3000
  - Modern Next.js admin interface
  - Service management and monitoring

- **Grafana**: http://localhost:3001
  - Default credentials: `admin` / `admin`
  - Pre-configured dashboards

- **Prometheus**: http://localhost:9090
  - Metrics and alerting

### Database Access

```bash
# Connect to TimescaleDB
docker compose exec timescaledb psql -U stockify -d stockify_db

# Or use your favorite PostgreSQL client
Host: localhost
Port: 5432
Database: stockify_db
Username: stockify
Password: (from .env)
```

### Redis Access

```bash
# Connect to Redis CLI
docker compose exec redis redis-cli

# Test connection
docker compose exec redis redis-cli ping
```

---

## Common Operations

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f gateway-service
docker compose logs -f timescaledb

# Last 100 lines
docker compose logs --tail=100

# Service-specific with filter
docker compose logs -f gateway-service | grep ERROR
```

### Restarting Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart gateway-service

# Restart with rebuild
docker compose up -d --build gateway-service
```

### Checking Service Health

```bash
# View all container statuses
docker compose ps

# Check specific service health
docker compose ps gateway-service

# View resource usage
docker stats
```

### Database Operations

```bash
# Run migrations
docker compose exec gateway-service alembic upgrade head

# Create new migration
docker compose exec gateway-service alembic revision --autogenerate -m "description"

# View migration history
docker compose exec gateway-service alembic history

# Rollback one migration
docker compose exec gateway-service alembic downgrade -1
```

### Scaling Services

```bash
# Scale a specific service (if stateless)
docker compose up -d --scale processor-service=3

# View scaled instances
docker compose ps processor-service
```

---

## Troubleshooting

### Services Not Starting

**Issue**: Containers exit immediately or don't start

**Solutions**:
```bash
# Check logs for errors
docker compose logs

# Check specific service
docker compose logs gateway-service

# Verify .env configuration
cat .env

# Ensure ports are not in use
netstat -an | grep LISTEN | grep -E "8000|8001|5432|6379|9092"

# Clean restart
docker compose down -v
./setup.sh  # Choose option 1 for fresh setup
```

### Database Connection Errors

**Issue**: Services can't connect to database

**Symptoms**: Error logs showing "database does not exist" or "connection refused"

**Solutions**:
```bash
# Check if TimescaleDB is healthy
docker compose ps timescaledb

# View database logs
docker compose logs timescaledb

# Verify database exists
docker compose exec timescaledb psql -U stockify -l

# Reinitialize database
docker compose up db-init

# If all else fails, clean restart
docker compose down -v
docker compose up -d timescaledb redis
sleep 30
docker compose up db-init
docker compose up -d
```

### Kafka Connection Issues

**Issue**: Services can't connect to Kafka

**Solutions**:
```bash
# Check Kafka health
docker compose logs kafka

# Verify Kafka topics
docker compose exec kafka kafka-topics.sh --list --bootstrap-server localhost:9092

# Restart Kafka
docker compose restart zookeeper kafka
```

### Out of Memory

**Issue**: Container keeps restarting due to OOM

**Solutions**:
```bash
# Check memory usage
docker stats

# Increase Docker memory limit in Docker Desktop settings
# Recommended: At least 8GB for Docker

# Reduce service replicas if running multiple
docker compose down
# Edit docker-compose.yml to reduce resource limits
docker compose up -d
```

### Port Already in Use

**Issue**: "Port is already allocated" error

**Solutions**:
```bash
# Find process using the port (example for port 8000)
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill the process or change port in docker-compose.yml
# Example: Change gateway port from 8000 to 8080
# ports:
#   - "8080:8000"
```

### Permission Denied Errors

**Issue**: Permission errors when running scripts or accessing files

**Solutions**:
```bash
# Make scripts executable
chmod +x setup.sh
chmod +x docker-entrypoint.sh
chmod +x scripts/*.sh

# Fix file ownership (if needed)
sudo chown -R $USER:$USER .
```

### Container Exits with Code 137

**Issue**: Container killed (usually OOM)

**Solutions**:
- Increase Docker memory allocation
- Reduce service resource limits in docker-compose.yml
- Check logs: `docker compose logs <service-name>`

### Database Migration Errors

**Issue**: Alembic migrations fail

**Solutions**:
```bash
# Check current migration version
docker compose exec gateway-service alembic current

# View migration history
docker compose exec gateway-service alembic history

# Stamp database to specific version (if needed)
docker compose exec gateway-service alembic stamp head

# Manual database initialization
docker compose exec gateway-service python -m scripts.init_database
```

---

## Advanced Configuration

### Custom Network Configuration

Edit `docker-compose.yml`:
```yaml
networks:
  stockify-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.26.0.0/16  # Change subnet if conflicts
```

### Production Deployment

> [!IMPORTANT]
> **Production Checklist**

1. **Security**
   - [ ] Change all default passwords
   - [ ] Generate strong SECRET_KEY
   - [ ] Set up SSL/TLS (use nginx as reverse proxy)
   - [ ] Configure firewall rules
   - [ ] Enable Docker security features

2. **Performance**
   - [ ] Adjust resource limits in docker-compose.yml
   - [ ] Configure database connection pooling
   - [ ] Enable Redis persistent storage
   - [ ] Set up log rotation

3. **Reliability**
   - [ ] Configure automated backups
   - [ ] Set up monitoring and alerting
   - [ ] Enable health checks for all services
   - [ ] Configure restart policies

4. **Data**
   - [ ] Use named volumes for data persistence
   - [ ] Regular database backups
   - [ ] Test disaster recovery procedures

### Environment-Specific Configurations

Create multiple environment files:

```bash
# Development
.env.development

# Staging
.env.staging

# Production
.env.production
```

Use specific environment:
```bash
docker compose --env-file .env.production up -d
```

### Persistent Data Locations

Docker volumes store data in:
- `timescaledb_data` - Database files
- `redis_data` - Redis persistence
- `kafka_data` - Kafka logs
- `grafana_data` - Grafana dashboards
- `prometheus_data` - Metrics data

View volumes:
```bash
docker volume ls
docker volume inspect fastapi-hft-engine_timescaledb_data
```

### Backup and Restore

**Backup Database**:
```bash
# Using provided script
./scripts/backup_database.sh

# Manual backup
docker compose exec timescaledb pg_dump -U stockify stockify_db > backup.sql
```

**Restore Database**:
```bash
# Stop services
docker compose down

# Start only database
docker compose up -d timescaledb

# Restore
docker compose exec -T timescaledb psql -U stockify stockify_db < backup.sql

# Restart all services
docker compose up -d
```

---

## Additional Resources

- **Main README**: [README.md](file:///Users/deepstacker/WorkSpace/fastapi-hft-engine/README.md)
- **API Documentation**: http://localhost:8000/docs (when running)
- **System Design**: [system_design_document.md](file:///Users/deepstacker/WorkSpace/fastapi-hft-engine/system_design_document.md)

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the logs: `docker compose logs -f`
2. Verify your `.env` configuration
3. Try a clean restart: `./setup.sh` → Option 1
4. Review the [Troubleshooting](#troubleshooting) section above

---

**Happy Trading! 📈**

#!/bin/bash

# Stop All Services Script
# Gracefully stops all infrastructure components

set -e

echo "========================================="
echo " Stopping HFT Data Engine"
echo "========================================="
echo ""

# Stop in reverse order of startup
echo "Stopping application services..."
docker-compose -f docker-compose.production.yml down
echo "✓ Application services stopped"

echo ""
echo "Stopping TimescaleDB cluster..."
docker-compose -f docker-compose.timescaledb-cluster.yml down
echo "✓ TimescaleDB stopped"

echo ""
echo "Stopping Redis cluster..."
docker-compose -f docker-compose.redis-cluster.yml down
echo "✓ Redis cluster stopped"

echo ""
echo "Stopping Kafka cluster..."
docker-compose -f docker-compose.kafka-cluster.yml down
echo "✓ Kafka cluster stopped"

echo ""
echo "========================================="
echo " All services stopped"
echo "========================================="
echo ""
echo "To remove volumes (CAUTION: deletes all data):"
echo "  docker-compose -f docker-compose.kafka-cluster.yml down -v"
echo "  docker-compose -f docker-compose.redis-cluster.yml down -v"
echo "  docker-compose -f docker-compose.timescaledb-cluster.yml down -v"
echo ""
echo "To restart:"
echo "  ./scripts/deploy-production.sh"

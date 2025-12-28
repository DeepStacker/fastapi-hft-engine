#!/bin/bash

# Kafka Topic Initialization Script for HFT Data Engine
# Creates topics with optimal partitioning and replication for high throughput
# Must be run after Kafka cluster is healthy

set -e

KAFKA_BROKERS="${KAFKA_BOOTSTRAP_SERVERS:-localhost:9092,localhost:9093,localhost:9094}"
REPLICATION_FACTOR=3
MIN_IN_SYNC_REPLICAS=2
RETENTION_MS=604800000  # 7 days in milliseconds
SEGMENT_MS=3600000      # 1 hour segments
COMPRESSION_TYPE="snappy"

echo "====================================="
echo "HFT Kafka Topic Initialization"
echo "====================================="
echo "Brokers: $KAFKA_BROKERS"
echo "Replication Factor: $REPLICATION_FACTOR"
echo "Min In-Sync Replicas: $MIN_IN_SYNC_REPLICAS"
echo ""

# Wait for Kafka cluster to be ready
echo "Waiting for Kafka cluster to be ready..."
for i in {1..30}; do
    if kafka-broker-api-versions --bootstrap-server $KAFKA_BROKERS &>/dev/null; then
        echo "✓ Kafka cluster is ready"
        break
    fi
    echo "  Attempt $i/30: Waiting..."
    sleep 2
done

# Function to create topic
create_topic() {
    local topic_name=$1
    local partitions=$2
    local description=$3
    
    echo ""
    echo "Creating topic: $topic_name"
    echo "  Description: $description"
    echo "  Partitions: $partitions"
    
    kafka-topics --create \
        --bootstrap-server $KAFKA_BROKERS \
        --topic "$topic_name" \
        --partitions "$partitions" \
        --replication-factor $REPLICATION_FACTOR \
        --config min.insync.replicas=$MIN_IN_SYNC_REPLICAS \
        --config retention.ms=$RETENTION_MS \
        --config segment.ms=$SEGMENT_MS \
        --config compression.type=$COMPRESSION_TYPE \
        --config max.message.bytes=1048576 \
        --config flush.messages=10000 \
        --if-not-exists || echo "  Topic already exists"
    
    echo "✓ Topic $topic_name ready"
}

# Main data pipeline topics
echo ""
echo "Creating main data pipeline topics..."
echo "======================================"

create_topic "market.raw" 60 \
    "Raw market data from ingestion service (6000 symbols, ~100 symbols/partition)"

create_topic "market.enriched" 60 \
    "Enriched market data from processor service (with BSM, PCR, Greeks)"

create_topic "analytics.results" 30 \
    "Analytics results from analytics service (stateful analysis output)"

# Dead letter queue topics
echo ""
echo "Creating dead letter queue topics..."
echo "====================================="

create_topic "market.raw.dlq" 12 \
    "Dead letter queue for failed raw market data processing"

create_topic "market.enriched.dlq" 12 \
    "Dead letter queue for failed enriched data processing"

# Real-time streaming topics
echo ""
echo "Creating real-time streaming topics..."
echo "======================================="

create_topic "realtime.updates" 30 \
    "Real-time updates for WebSocket subscribers"

create_topic "realtime.alerts" 12 \
    "Real-time alerts and notifications"

# Admin and monitoring topics
echo ""
echo "Creating admin and monitoring topics..."
echo "========================================"

create_topic "admin.config.updates" 3 \
    "Dynamic configuration updates from admin service"

create_topic "admin.commands" 3 \
    "Admin commands (e.g., service restart, cache clear)"

create_topic "monitoring.metrics" 12 \
    "Custom application metrics (supplement to Prometheus)"

# List all topics
echo ""
echo "====================================="
echo "Topic Summary"
echo "====================================="
kafka-topics --list --bootstrap-server $KAFKA_BROKERS

# Describe critical topics
echo ""
echo "====================================="
echo "Critical Topic Details"
echo "====================================="

for topic in "market.raw" "market.enriched" "analytics.results"; do
    echo ""
    echo "Topic: $topic"
    echo "-------------------------------------"
    kafka-topics --describe --bootstrap-server $KAFKA_BROKERS --topic $topic
done

# Check consumer groups
echo ""
echo "====================================="
echo "Active Consumer Groups"
echo "====================================="
kafka-consumer-groups --list --bootstrap-server $KAFKA_BROKERS || echo "No active consumer groups yet"

echo ""
echo "✓ Kafka topic initialization complete!"
echo ""
echo "Next steps:"
echo "  1. Update service KAFKA_BOOTSTRAP_SERVERS to include all 3 brokers"
echo "  2. Restart ingestion, processor, storage, analytics services"
echo "  3. Monitor Kafka UI at http://localhost:8080"
echo ""

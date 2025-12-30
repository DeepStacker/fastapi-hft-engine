"""
Scalability Configuration - Production Settings for Millions of Users

This module provides recommended configurations for high-scale deployments.
These settings are guidelines; actual values should be tuned based on
infrastructure capacity and load testing results.

Usage:
    from core.config.scale import ScaleConfig
    
    if settings.is_production:
        config = ScaleConfig.production()
    else:
        config = ScaleConfig.development()
"""

from dataclasses import dataclass
from typing import Optional
import os


@dataclass
class DatabaseScaleConfig:
    """Database connection pool configuration for scale"""
    
    # Primary database pool
    pool_size: int = 100  # Base connections per worker
    max_overflow: int = 200  # Additional connections under load
    pool_timeout: int = 30  # Seconds to wait for connection
    pool_recycle: int = 1800  # Recycle connections after 30 min
    pool_pre_ping: bool = True  # Verify connections before use
    
    # Read replica configuration
    read_replica_enabled: bool = False
    read_replica_pool_size: int = 50
    
    # Connection limits per user type
    max_connections_per_user: int = 5
    max_connections_admin: int = 50


@dataclass
class RedisScaleConfig:
    """Redis configuration for scale"""
    
    # Connection pool
    max_connections: int = 500  # Per Redis node
    socket_timeout: float = 5.0
    socket_connect_timeout: float = 5.0
    retry_on_timeout: bool = True
    
    # Cluster mode
    cluster_enabled: bool = False
    cluster_nodes: Optional[str] = None  # Comma-separated: "host1:port1,host2:port2"
    
    # Memory optimization
    max_memory_policy: str = "allkeys-lru"
    eviction_on_memory_full: bool = True
    
    # Cache TTLs (seconds)
    l1_ttl: int = 5  # In-memory cache
    l2_ttl: int = 60  # Redis cache
    hot_data_ttl: int = 5  # Frequently accessed
    warm_data_ttl: int = 300  # Less frequent
    cold_data_ttl: int = 3600  # Historical


@dataclass
class KafkaScaleConfig:
    """Kafka configuration for scale"""
    
    # Topic partitioning
    default_partitions: int = 12
    replication_factor: int = 3  # For production
    
    # Consumer configuration
    consumer_group_instances: int = 3
    max_poll_records: int = 500
    session_timeout_ms: int = 30000
    heartbeat_interval_ms: int = 10000
    
    # Producer configuration
    batch_size: int = 16384
    linger_ms: int = 5
    compression_type: str = "gzip"
    acks: str = "all"  # Durability
    
    # Partition formula: max(num_symbols, consumers * 3)
    @staticmethod
    def calculate_partitions(num_symbols: int, num_consumers: int) -> int:
        return max(num_symbols, num_consumers * 3)


@dataclass
class WebSocketScaleConfig:
    """WebSocket configuration for millions of connections"""
    
    # Connection limits
    max_connections_total: int = 100000  # Per node
    max_connections_per_user: int = 10
    max_connections_per_ip: int = 100
    
    # Timeouts
    connection_timeout: int = 30
    heartbeat_interval: int = 30
    ping_timeout: int = 10
    
    # Message batching
    batch_size: int = 100
    batch_interval_ms: int = 100
    max_message_size: int = 1024 * 1024  # 1MB
    
    # Backpressure
    send_queue_size: int = 1000
    slow_consumer_threshold: int = 500


@dataclass
class RateLimitScaleConfig:
    """Rate limiting for fair usage"""
    
    # Default limits (requests per minute)
    anonymous_rpm: int = 30
    authenticated_rpm: int = 200
    premium_rpm: int = 1000
    admin_rpm: int = 10000
    
    # Burst limits
    burst_multiplier: float = 2.0
    
    # Endpoint-specific limits
    expensive_endpoint_rpm: int = 10
    websocket_messages_per_second: int = 50


@dataclass
class ScaleConfig:
    """Complete scale configuration"""
    
    database: DatabaseScaleConfig
    redis: RedisScaleConfig
    kafka: KafkaScaleConfig
    websocket: WebSocketScaleConfig
    rate_limit: RateLimitScaleConfig
    
    # Worker configuration
    api_workers: int = 4
    background_workers: int = 2
    
    # Health thresholds
    health_check_interval: int = 10
    circuit_breaker_threshold: int = 5
    circuit_breaker_timeout: int = 60
    
    @classmethod
    def development(cls) -> "ScaleConfig":
        """Development configuration - minimal resources"""
        return cls(
            database=DatabaseScaleConfig(
                pool_size=10,
                max_overflow=20,
            ),
            redis=RedisScaleConfig(
                max_connections=50,
            ),
            kafka=KafkaScaleConfig(
                default_partitions=3,
                replication_factor=1,
            ),
            websocket=WebSocketScaleConfig(
                max_connections_total=1000,
            ),
            rate_limit=RateLimitScaleConfig(),
            api_workers=2,
            background_workers=1,
        )
    
    @classmethod
    def production(cls) -> "ScaleConfig":
        """Production configuration - optimized for scale"""
        return cls(
            database=DatabaseScaleConfig(
                pool_size=100,
                max_overflow=200,
                read_replica_enabled=True,
                read_replica_pool_size=50,
            ),
            redis=RedisScaleConfig(
                max_connections=500,
                cluster_enabled=True,
                cluster_nodes=os.getenv("REDIS_CLUSTER_NODES"),
            ),
            kafka=KafkaScaleConfig(
                default_partitions=12,
                replication_factor=3,
            ),
            websocket=WebSocketScaleConfig(
                max_connections_total=100000,
            ),
            rate_limit=RateLimitScaleConfig(
                authenticated_rpm=200,
                premium_rpm=1000,
            ),
            api_workers=int(os.getenv("API_WORKERS", 8)),
            background_workers=int(os.getenv("BACKGROUND_WORKERS", 4)),
        )
    
    @classmethod
    def enterprise(cls) -> "ScaleConfig":
        """Enterprise configuration - maximum scale"""
        return cls(
            database=DatabaseScaleConfig(
                pool_size=200,
                max_overflow=400,
                read_replica_enabled=True,
                read_replica_pool_size=100,
            ),
            redis=RedisScaleConfig(
                max_connections=1000,
                cluster_enabled=True,
                cluster_nodes=os.getenv("REDIS_CLUSTER_NODES"),
            ),
            kafka=KafkaScaleConfig(
                default_partitions=24,
                replication_factor=3,
                consumer_group_instances=6,
            ),
            websocket=WebSocketScaleConfig(
                max_connections_total=500000,
                max_connections_per_user=20,
            ),
            rate_limit=RateLimitScaleConfig(
                authenticated_rpm=500,
                premium_rpm=5000,
                admin_rpm=50000,
            ),
            api_workers=int(os.getenv("API_WORKERS", 16)),
            background_workers=int(os.getenv("BACKGROUND_WORKERS", 8)),
        )


def get_scale_config() -> ScaleConfig:
    """Get appropriate scale config based on environment"""
    env = os.getenv("ENVIRONMENT", "development").lower()
    
    if env == "production":
        return ScaleConfig.production()
    elif env == "enterprise":
        return ScaleConfig.enterprise()
    else:
        return ScaleConfig.development()


# Pre-computed scaling recommendations
SCALE_RECOMMENDATIONS = {
    "1k_users": {
        "api_workers": 2,
        "db_pool_size": 10,
        "redis_connections": 50,
        "kafka_partitions": 3,
    },
    "10k_users": {
        "api_workers": 4,
        "db_pool_size": 20,
        "redis_connections": 100,
        "kafka_partitions": 6,
    },
    "100k_users": {
        "api_workers": 8,
        "db_pool_size": 50,
        "redis_connections": 200,
        "kafka_partitions": 12,
    },
    "1m_users": {
        "api_workers": 16,
        "db_pool_size": 100,
        "redis_connections": 500,
        "kafka_partitions": 24,
        "notes": "Consider horizontal scaling with load balancer",
    },
    "10m_users": {
        "api_workers": "32+ (per node)",
        "db_pool_size": "200+ with read replicas",
        "redis_connections": "1000+ (cluster mode)",
        "kafka_partitions": "48+",
        "notes": "Requires multi-node deployment, CDN, horizontal scaling",
    },
}

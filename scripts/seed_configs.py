"""
Configuration Seed Script

Populates SystemConfigDB with all discovered hardcoded configurations.
Run this once after database migration to initialize dynamic configuration.
"""
import asyncio
from datetime import datetime
from sqlalchemy import select
from core.database.db import async_session_factory
from core.database.models import SystemConfigDB, AlertRuleDB


# Configuration seed data
CONFIG_SEEDS = [
    # === Ingestion Service ===
    {
        "key": "trading_start_time",
        "value": "09:15",
        "description": "Market trading start time (HH:MM format, IST)",
        "category": "trading",
        "data_type": "string",
        "requires_restart": False
    },
    {
        "key": "trading_end_time",
        "value": "15:30",
        "description": "Market trading end time (HH:MM format, IST)",
        "category": "trading",
        "data_type": "string",
        "requires_restart": False
    },
    {
        "key": "fallback_symbols",
        "value": "[13, 25, 27, 442]",
        "description": "Fallback symbol IDs when DB is empty",
        "category": "ingestion",
        "data_type": "json",
        "requires_restart": False
    },
    {
        "key": "instrument_refresh_interval",
        "value": "60",
        "description": "Interval (seconds) to refresh active instruments from DB",
        "category": "ingestion",
        "data_type": "int",
        "requires_restart": False
    },
    {
        "key": "api_max_retries",
        "value": "3",
        "description": "Maximum retry attempts for API calls",
        "category": "ingestion",
        "data_type": "int",
        "requires_restart": False
    },
    {
        "key": "fetch_interval",
        "value": "1",
        "description": "Interval (seconds) between market data fetches during trading hours",
        "category": "ingestion",
        "data_type": "int",
        "requires_restart": False
    },
    {
        "key": "sleep_outside_hours",
        "value": "60",
        "description": "Sleep duration (seconds) when outside trading hours",
        "category": "ingestion",
        "data_type": "int",
        "requires_restart": False
    },
    
    # === Storage Service ===
    {
        "key": "storage_min_batch_size",
        "value": "100",
        "description": "Minimum batch size for database writes",
        "category": "storage",
        "data_type": "int",
        "requires_restart": False
    },
    {
        "key": "storage_max_batch_size",
        "value": "5000",
        "description": "Maximum batch size for database writes",
        "category": "storage",
        "data_type": "int",
        "requires_restart": False
    },
    {
        "key": "storage_flush_interval",
        "value": "1.0",
        "description": "Time interval (seconds) for flushing storage buffers",
        "category": "storage",
        "data_type": "float",
        "requires_restart": False
    },
    
    # === Realtime Service ===
    {
        "key": "realtime_cache_ttl",
        "value": "3600",
        "description": "Redis cache TTL (seconds) for latest market data",
        "category": "realtime",
        "data_type": "int",
        "requires_restart": False
    },
    
    # === Core Settings ===
    {
        "key": "kafka_compression",
        "value": "gzip",
        "description": "Kafka compression algorithm (gzip, snappy, lz4, none)",
        "category": "performance",
        "data_type": "string",
        "requires_restart": True
    },
    {
        "key": "db_pool_size",
        "value": "20",
        "description": "Database connection pool size",
        "category": "database",
        "data_type": "int",
        "requires_restart": True
    },
    {
        "key": "db_max_overflow",
        "value": "10",
        "description": "Maximum overflow connections for database pool",
        "category": "database",
        "data_type": "int",
        "requires_restart": True
    },
    {
        "key": "redis_max_connections",
        "value": "50",
        "description": "Maximum Redis connection pool size",
        "category": "caching",
        "data_type": "int",
        "requires_restart": True
    },
    {
        "key": "access_token_expire_minutes",
        "value": "30",
        "description": "JWT access token expiration time (minutes)",
        "category": "security",
        "data_type": "int",
        "requires_restart": False
    },
    {
        "key": "max_websocket_per_user",
        "value": "10",
        "description": "Maximum WebSocket connections per user",
        "category": "performance",
        "data_type": "int",
        "requires_restart": False
    },
    {
        "key": "slow_query_threshold_ms",
        "value": "1000",
        "description": "Threshold (milliseconds) for logging slow database queries",
        "category": "performance",
        "data_type": "int",
        "requires_restart": False
    },
    {
        "key": "allowed_origins",
        "value": "[\"http://localhost:3000\", \"http://localhost:8000\", \"http://127.0.0.1:8000\"]",
        "description": "CORS allowed origins (JSON array)",
        "category": "security",
        "data_type": "json",
        "requires_restart": False
    },
    {
        "key": "rate_limit_per_minute",
        "value": "100",
        "description": "API rate limit (requests per minute per user)",
        "category": "security",
        "data_type": "int",
        "requires_restart": False
    },
]


# Alert rule seed data
ALERT_SEEDS = [
    {
        "name": "High CPU Usage",
        "metric": "cpu_percent",
        "condition": ">",
        "threshold": 80.0,
        "severity": "warning",
        "enabled": True,
        "notification_channels": ["email", "dashboard"],
        "created_by": "system"
    },
    {
        "name": "Critical CPU Usage",
        "metric": "cpu_percent",
        "condition": ">",
        "threshold": 95.0,
        "severity": "critical",
        "enabled": True,
        "notification_channels": ["email", "dashboard", "slack"],
        "created_by": "system"
    },
    {
        "name": "High Memory Usage",
        "metric": "memory_percent",
        "condition": ">",
        "threshold": 85.0,
        "severity": "warning",
        "enabled": True,
        "notification_channels": ["email", "dashboard"],
        "created_by": "system"
    },
    {
        "name": "Critical Memory Usage",
        "metric": "memory_percent",
        "condition": ">",
        "threshold": 95.0,
        "severity": "critical",
        "enabled": True,
        "notification_channels": ["email", "dashboard", "slack"],
        "created_by": "system"
    },
    {
        "name": "High Disk Usage",
        "metric": "disk_percent",
        "condition": ">",
        "threshold": 90.0,
        "severity": "warning",
        "enabled": True,
        "notification_channels": ["email", "dashboard"],
        "created_by": "system"
    },
    {
        "name": "Service Error Rate",
        "metric": "error_rate",
        "condition": ">",
        "threshold": 5.0,
        "severity": "critical",
        "enabled": True,
        "notification_channels": ["email", "dashboard", "slack"],
        "created_by": "system"
    },
]


async def seed_configurations():
    """Seed system configurations."""
    print("🌱 Seeding system configurations...")
    
    async with async_session_factory() as session:
        # Check existing configs
        result = await session.execute(select(SystemConfigDB))
        existing = {c.key for c in result.scalars().all()}
        
        new_count = 0
        updated_count = 0
        
        for config_data in CONFIG_SEEDS:
            key = config_data["key"]
            
            if key in existing:
                # Update existing
                result = await session.execute(
                    select(SystemConfigDB).where(SystemConfigDB.key == key)
                )
                config = result.scalar_one()
                
                # Only update if value changed
                if config.value != config_data["value"]:
                    config.value = config_data["value"]
                    config.description = config_data["description"]
                    config.updated_at = datetime.utcnow()
                    config.updated_by = "seed_script"
                    updated_count += 1
                    print(f"  ✏️  Updated: {key}")
            else:
                # Insert new
                config = SystemConfigDB(
                    key=key,
                    value=config_data["value"],
                    description=config_data["description"],
                    category=config_data["category"],
                    data_type=config_data.get("data_type", "string"),
                    is_encrypted=config_data.get("is_encrypted", False),
                    requires_restart=config_data.get("requires_restart", False),
                    updated_by="seed_script"
                )
                session.add(config)
                new_count += 1
                print(f"  ✅ Created: {key}")
        
        await session.commit()
        print(f"\n✅ Configurations seeded: {new_count} new, {updated_count} updated")


async def seed_alert_rules():
    """Seed default alert rules."""
    print("\n🚨 Seeding alert rules...")
    
    async with async_session_factory() as session:
        # Check existing alerts
        result = await session.execute(select(AlertRuleDB))
        existing = {a.name for a in result.scalars().all()}
        
        new_count = 0
        
        for alert_data in ALERT_SEEDS:
            if alert_data["name"] not in existing:
                alert = AlertRuleDB(**alert_data)
                session.add(alert)
                new_count += 1
                print(f"  ✅ Created: {alert_data['name']}")
        
        await session.commit()
        print(f"\n✅ Alert rules seeded: {new_count} new")


async def main():
    """Run all seed tasks."""
    print("=" * 60)
    print("🚀 Starting Configuration Seed")
    print("=" * 60)
    
    try:
        await seed_configurations()
        await seed_alert_rules()
        
        print("\n" + "=" * 60)
        print("✅ Seed completed successfully!")
        print("=" * 60)
    except Exception as e:
        print(f"\n❌ Seed failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())

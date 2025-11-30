"""
Configuration Management Router

Exposes ALL system configurations for admin control including:
- Service timeouts, intervals, limits
- Trading hours
- API retries, batch sizes
- WebSocket limits
- Cache TTLs
- Kafka settings
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from sqlalchemy import select, update
from services.api_gateway.auth import get_current_admin_user
from services.admin.models import ConfigItem, ConfigUpdate
from core.database.db import async_session_factory
from core.database.models import SystemConfigDB
from services.admin.services.cache import cache_service
import redis.asyncio as redis
from core.config.settings import get_settings
import json
import logging

logger = logging.getLogger("stockify.admin.config")
router = APIRouter(prefix="/config", tags=["configuration"])
settings = get_settings()


# Define all configurable parameters with defaults and descriptions
SYSTEM_CONFIGS = {
    # Ingestion Service
    "fetch_interval": {
        "value": "1",
        "description": "Seconds between data fetches from Dhan API",
        "category": "ingestion",
        "data_type": "int",
        "requires_restart": False
    },
    "trading_start_time": {
        "value": "09:15",
        "description": "Trading hours start time (HH:MM)",
        "category": "ingestion",
        "data_type": "string",
        "requires_restart": False
    },
    "trading_end_time": {
        "value": "15:30",
        "description": "Trading hours end time (HH:MM)",
        "category": "ingestion",
        "data_type": "string",
        "requires_restart": False
    },
    "sleep_outside_hours": {
        "value": "60",
        "description": "Seconds to sleep when outside trading hours",
        "category": "ingestion",
        "data_type": "int",
        "requires_restart": False
    },
    "bypass_trading_hours": {
        "value": "false",
        "description": "Force data fetching regardless of time/holiday (Testing Mode)",
        "category": "ingestion",
        "data_type": "bool",
        "requires_restart": False
    },
    "enable_weekend_trading": {
        "value": "false",
        "description": "Allow data fetching on Saturday and Sunday",
        "category": "ingestion",
        "data_type": "bool",
        "requires_restart": False
    },
    "commodity_trading_start_time": {
        "value": "09:00",
        "description": "Commodity trading start time (HH:MM)",
        "category": "ingestion",
        "data_type": "string",
        "requires_restart": False
    },
    "commodity_trading_end_time": {
        "value": "23:55",
        "description": "Commodity trading end time (HH:MM)",
        "category": "ingestion",
        "data_type": "string",
        "requires_restart": False
    },
    "holidays": {
        "value": "[]",
        "description": "List of trading holidays (YYYY-MM-DD)",
        "category": "ingestion",
        "data_type": "json",
        "requires_restart": False
    },
    "api_max_retries": {
        "value": "3",
        "description": "Max retries for Dhan API calls",
        "category": "ingestion",
        "data_type": "int",
        "requires_restart": False
    },
    "api_timeout": {
        "value": "10",
        "description": "Dhan API request timeout in seconds",
        "category": "ingestion",
        "data_type": "int",
        "requires_restart": True
    },
    
    # Processor Service
    "processor_enabled": {
        "value": "true",
        "description": "Enable/disable processor service",
        "category": "processor",
        "data_type": "bool",
        "requires_restart": False
    },
    "risk_free_rate": {
        "value": "0.065",
        "description": "Risk-free rate for BSM calculations (annual rate)",
        "category": "processor",
        "data_type": "float",
        "requires_restart": False
    },
    "india_vix": {
        "value": "12.5",
        "description": "India VIX current value (%)",
        "category": "processor",
        "data_type": "float",
        "requires_restart": False
    },
    "enable_bsm_calculation": {
        "value": "true",
        "description": "Enable Black-Scholes theoretical price calculation",
        "category": "processor",
        "data_type": "bool",
        "requires_restart": False
    },
    "enable_futures_basis": {
        "value": "true",
        "description": "Enable Futures-Spot Basis analysis",
        "category": "processor",
        "data_type": "bool",
        "requires_restart": False
    },
    "enable_vix_divergence": {
        "value": "true",
        "description": "Enable VIX-IV Divergence analysis",
        "category": "processor",
        "data_type": "bool",
        "requires_restart": False
    },
    "enable_gamma_analysis": {
        "value": "true",
        "description": "Enable Gamma Exposure analysis",
        "category": "processor",
        "data_type": "bool",
        "requires_restart": False
    },
    
    # Storage Service
    "storage_min_batch_size": {
        "value": "100",
        "description": "Minimum batch size for database writes",
        "category": "storage",
        "data_type": "int",
        "requires_restart": False
    },
    "storage_max_batch_size": {
        "value": "5000",
        "description": "Maximum batch size for database writes",
        "category": "storage",
        "data_type": "int",
        "requires_restart": False
    },
    "storage_flush_interval": {
        "value": "5",
        "description": "Seconds between forced batch flushes",
        "category": "storage",
        "data_type": "int",
        "requires_restart": False
    },
    
    # Realtime Service
    "realtime_cache_ttl": {
        "value": "3600",
        "description": "Cache TTL for latest market data in seconds",
        "category": "realtime",
        "data_type": "int",
        "requires_restart": False
    },
    
    # Gateway Service
    "max_websocket_connections_per_user": {
        "value": "10",
        "description": "Maximum WebSocket connections per user",
        "category": "gateway",
        "data_type": "int",
        "requires_restart": True
    },
    "gzip_minimum_size": {
        "value": "1000",
        "description": "Minimum response size in bytes for GZip compression",
        "category": "gateway",
        "data_type": "int",
        "requires_restart": True
    },
    "gzip_compression_level": {
        "value": "6",
        "description": "GZip compression level (1-9, higher = better compression)",
        "category": "gateway",
        "data_type": "int",
        "requires_restart": True
    },
    "api_rate_limit": {
        "value": "100/minute",
        "description": "Global API rate limit",
        "category": "gateway",
        "data_type": "string",
        "requires_restart": True
    },
    "websocket_ttl": {
        "value": "300",
        "description": "WebSocket connection tracking TTL in Redis (seconds)",
        "category": "gateway",
        "data_type": "int",
        "requires_restart": False
    },
    
    # Metrics Collector
    "metrics_cache_ttl": {
        "value": "5",
        "description": "Metrics cache TTL in seconds",
        "category": "monitoring",
        "data_type": "int",
        "requires_restart": False
    },
    "prometheus_timeout": {
        "value": "5",
        "description": "Prometheus query timeout in seconds",
        "category": "monitoring",
        "data_type": "int",
        "requires_restart": False
    },
    
    # Database
    "db_connection_pool_size": {
        "value": "50",
        "description": "Database connection pool size",
        "category": "database",
        "data_type": "int",
        "requires_restart": True
    },
    "db_max_overflow": {
        "value": "10",
        "description": "Database connection pool max overflow",
        "category": "database",
        "data_type": "int",
        "requires_restart": True
    },
    
    # Kafka
    "kafka_consumer_group_id": {
        "value": "auto",
        "description": "Kafka consumer group ID prefix",
        "category": "kafka",
        "data_type": "string",
        "requires_restart": True
    },
    "kafka_auto_offset_reset": {
        "value": "latest",
        "description": "Kafka auto offset reset (earliest/latest)",
        "category": "kafka",
        "data_type": "string",
        "requires_restart": True
    }
}


@router.get("", response_model=List[ConfigItem])
async def list_configs(
    category: str = None,
    admin = Depends(get_current_admin_user)
):
    """
    List all configuration items
    
    Optionally filter by category (ingestion, storage, gateway, etc.)
    """
    # Try cache first
    cache_key = f"config:list:{category}"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return [ConfigItem(**item) for item in cached_data]

    async with async_session_factory() as session:
        query = select(SystemConfigDB)
        
        if category:
            query = query.where(SystemConfigDB.category == category)
        
        result = await session.execute(query)
        configs = result.scalars().all()
        
        # Convert to response model
        config_items = []
        for config in configs:
            config_items.append(ConfigItem(
                key=config.key,
                value=config.value,
                description=config.description or "",
                category=config.category or "general",
                data_type=config.data_type or "string",
                requires_restart=config.requires_restart
            ))
        
        # Add any missing default configs
        existing_keys = {c.key for c in configs}
        for key, meta in SYSTEM_CONFIGS.items():
            if key not in existing_keys:
                if category and meta["category"] != category:
                    continue
                    
                config_items.append(ConfigItem(
                    key=key,
                    value=meta["value"],
                    description=meta["description"],
                    category=meta["category"],
                    data_type=meta.get("data_type", "string"),
                    requires_restart=meta["requires_restart"]
                ))
        
        # Cache the result
        await cache_service.set(
            cache_key, 
            [c.dict() for c in config_items], 
            ttl=3600
        )
        
        return config_items


@router.get("/categories")
async def list_categories(admin = Depends(get_current_admin_user)):
    """Get all configuration categories"""
    # Try cache first
    cache_key = "config:categories"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return cached_data

    categories = set()
    
    async with async_session_factory() as session:
        result = await session.execute(
            select(SystemConfigDB.category).distinct()
        )
        for row in result:
            if row[0]:
                categories.add(row[0])
    
    # Add default categories
    for meta in SYSTEM_CONFIGS.values():
        categories.add(meta["category"])
    
    response_data = {"categories": sorted(list(categories))}
    
    # Cache result
    await cache_service.set(cache_key, response_data, ttl=86400)
    
    return response_data


@router.get("/{key}", response_model=ConfigItem)
async def get_config(
    key: str,
    admin = Depends(get_current_admin_user)
):
    """Get a specific configuration item"""
    # Try cache first
    cache_key = f"config:detail:{key}"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return ConfigItem(**cached_data)

    async with async_session_factory() as session:
        result = await session.execute(
            select(SystemConfigDB).where(SystemConfigDB.key == key)
        )
        config = result.scalar_one_or_none()
        
        if config:
            response_data = ConfigItem(
                key=config.key,
                value=config.value,
                description=config.description or "",
                category=config.category or "general",
                data_type=config.data_type or "string",
                requires_restart=config.requires_restart
            )
            await cache_service.set(cache_key, response_data.dict(), ttl=3600)
            return response_data
        
        # Check if it's a default config
        if key in SYSTEM_CONFIGS:
            meta = SYSTEM_CONFIGS[key]
            response_data = ConfigItem(
                key=key,
                value=meta["value"],
                description=meta["description"],
                category=meta["category"],
                data_type=meta.get("data_type", "string"),
                requires_restart=meta["requires_restart"]
            )
            await cache_service.set(cache_key, response_data.dict(), ttl=3600)
            return response_data
        
        raise HTTPException(status_code=404, detail=f"Config '{key}' not found")


@router.put("/{key}")
async def update_config(
    key: str,
    config_update: ConfigUpdate,
    admin = Depends(get_current_admin_user)
):
    """
    Update a configuration value
    
    Broadcasts change via Redis Pub/Sub to all services
    """
    async with async_session_factory() as session:
        # Check if config exists
        result = await session.execute(
            select(SystemConfigDB).where(SystemConfigDB.key == key)
        )
        config = result.scalar_one_or_none()
        
        if config:
            # Update existing
            config.value = config_update.value
            config.updated_by = admin.username
        else:
            # Create new (from default or custom)
            meta = SYSTEM_CONFIGS.get(key, {
                "description": "Custom configuration",
                "category": "custom",
                "requires_restart": False
            })
            
            config = SystemConfigDB(
                key=key,
                value=config_update.value,
                description=meta.get("description", ""),
                category=meta.get("category", "custom"),
                data_type=meta.get("data_type", "string"),
                requires_restart=meta.get("requires_restart", False),
                updated_by=admin.username
            )
            session.add(config)
        
        await session.commit()
        await session.refresh(config)
        
        # Invalidate caches
        await cache_service.delete(f"config:detail:{key}")
        await cache_service.invalidate_pattern("config:list:*")
        
        # Broadcast change via Redis Pub/Sub
        try:
            redis_client = await redis.from_url(settings.REDIS_URL)
            message = json.dumps({
                "key": key,
                "value": config_update.value,
                "action": "update"
            })
            await redis_client.publish("config:updates", message)
            await redis_client.close()
            logger.info(f"Config change broadcasted: {key} = {config_update.value}")
        except Exception as e:
            logger.error(f"Failed to broadcast config change: {e}")
        
        return {
            "message": "Configuration updated successfully",
            "key": key,
            "value": config_update.value,
            "requires_restart": config.requires_restart
        }


@router.post("/initialize")
async def initialize_configs(admin = Depends(get_current_admin_user)):
    """Initialize all default configurations in database"""
    async with async_session_factory() as session:
        created_count = 0
        
        for key, meta in SYSTEM_CONFIGS.items():
            # Check if exists
            result = await session.execute(
                select(SystemConfigDB).where(SystemConfigDB.key == key)
            )
            existing = result.scalar_one_or_none()
            
            if not existing:
                config = SystemConfigDB(
                    key=key,
                    value=meta["value"],
                    description=meta["description"],
                    category=meta["category"],
                    data_type=meta.get("data_type", "string"),
                    requires_restart=meta["requires_restart"],
                    updated_by="system"
                )
                session.add(config)
                created_count += 1
        
        await session.commit()
        logger.info(f"Initialized {created_count} default configurations")
        
        # Invalidate all config caches
        await cache_service.invalidate_pattern("config:*")
        
        return {
            "message": f"Initialized {created_count} configurations",
            "total": len(SYSTEM_CONFIGS)
        }


@router.delete("/{key}")
async def delete_config(
    key: str,
    admin = Depends(get_current_admin_user)
):
    """Delete a custom configuration (resets to default)"""
    async with async_session_factory() as session:
        result = await session.execute(
            select(SystemConfigDB).where(SystemConfigDB.key == key)
        )
        config = result.scalar_one_or_none()
        
        if not config:
            raise HTTPException(status_code=404, detail=f"Config '{key}' not found")
        
        await session.delete(config)
        await session.commit()
        
        # Invalidate caches
        await cache_service.delete(f"config:detail:{key}")
        await cache_service.invalidate_pattern("config:list:*")
        
        # Broadcast deletion
        try:
            redis_client = await redis.from_url(settings.REDIS_URL)
            message = json.dumps({"key": key, "action": "delete"})
            await redis_client.publish("config:updates", message)
            await redis_client.close()
        except Exception as e:
            logger.error(f"Failed to broadcast config deletion: {e}")
        
        return {"message": f"Configuration '{key}' deleted (reset to default)"}


@router.post("/export")
async def export_configs(admin = Depends(get_current_admin_user)):
    """Export all configurations as JSON"""
    async with async_session_factory() as session:
        result = await session.execute(select(SystemConfigDB))
        configs = result.scalars().all()
        
        export_data = {}
        for config in configs:
            export_data[config.key] = {
                "value": config.value,
                "description": config.description,
                "category": config.category,
                "requires_restart": config.requires_restart
            }
        
        return export_data


@router.post("/import")
async def import_configs(
    configs: Dict[str, Dict[str, Any]],
    admin = Depends(get_current_admin_user)
):
    """Import configurations from JSON"""
    async with async_session_factory() as session:
        imported_count = 0
        
        for key, data in configs.items():
            result = await session.execute(
                select(SystemConfigDB).where(SystemConfigDB.key == key)
            )
            config = result.scalar_one_or_none()
            
            if config:
                config.value = data["value"]
                config.updated_by = admin.username
            else:
                config = SystemConfigDB(
                    key=key,
                    value=data["value"],
                    description=data.get("description", ""),
                    category=data.get("category", "custom"),
                    data_type=data.get("data_type", "string"),
                    requires_restart=data.get("requires_restart", False),
                    updated_by=admin.username
                )
                session.add(config)
            
            imported_count += 1
        
        await session.commit()
        
        # Invalidate all config caches
        await cache_service.invalidate_pattern("config:*")
        
        return {"message": f"Imported {imported_count} configurations"}


# WebSocket for real-time Config updates
from fastapi import WebSocket, WebSocketDisconnect, Query, status
from jose import jwt, JWTError
import asyncio
from core.config.settings import get_settings

@router.websocket("/ws")
async def websocket_config(
    websocket: WebSocket,
    token: str = Query(None)
):
    """
    Real-time configuration updates via WebSocket
    """
    settings = get_settings()
    
    # Validate token
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("sub") is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    
    try:
        while True:
            try:
                # Use cache for WebSocket updates too!
                cache_key = "config:list:None"
                cached_data = await cache_service.get(cache_key)
                
                if cached_data:
                    await websocket.send_json({
                        "type": "config_update",
                        "data": cached_data
                    })
                else:
                    # Fallback to DB if cache miss
                    async with async_session_factory() as session:
                        result = await session.execute(select(SystemConfigDB))
                        configs = result.scalars().all()
                        
                        config_items = []
                        for config in configs:
                            config_items.append({
                                "key": config.key,
                                "value": config.value,
                                "description": config.description or "",
                                "category": config.category or "general",
                                "data_type": config.data_type or "string",
                                "requires_restart": config.requires_restart
                            })
                        
                        # Add missing defaults
                        existing_keys = {c.key for c in configs}
                        for key, meta in SYSTEM_CONFIGS.items():
                            if key not in existing_keys:
                                config_items.append({
                                    "key": key,
                                    "value": meta["value"],
                                    "description": meta["description"],
                                    "category": meta["category"],
                                    "data_type": meta.get("data_type", "string"),
                                    "requires_restart": meta["requires_restart"]
                                })
                        
                        # Cache it
                        await cache_service.set(cache_key, config_items, ttl=3600)
                        
                        await websocket.send_json({
                            "type": "config_update",
                            "data": config_items
                        })
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error fetching configs: {e}")
            
            # Poll every 5 seconds
            await asyncio.sleep(5)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error in config: {e}")

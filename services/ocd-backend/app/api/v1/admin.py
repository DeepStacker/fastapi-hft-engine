"""
Admin API Endpoints - Configuration management
"""
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.core.dependencies import CurrentAdmin, Cache
from app.core.exceptions import NotFoundException, ValidationException
from app.services.config_service import ConfigService
from app.models.config import ConfigCategory
from app.repositories.config import ConfigRepository, InstrumentRepository
from app.cache.redis import get_redis, RedisCache
from app.schemas.config import (
    ConfigCreate,
    ConfigUpdate,
    ConfigResponse,
    InstrumentCreate,
    InstrumentUpdate,
    InstrumentResponse,
    CacheClearRequest,
    CacheClearResponse,
)
from app.schemas.common import ResponseModel

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_config_service(
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis)
) -> ConfigService:
    """Dependency to get config service"""
    return ConfigService(db=db, cache=cache)


# ═══════════════════════════════════════════════════════════════════
# Configuration Endpoints
# ═══════════════════════════════════════════════════════════════════

@router.get("/config", response_model=ResponseModel)
async def list_configs(
    current_user: CurrentAdmin,
    category: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    List all configurations (admin only).
    """
    config_repo = ConfigRepository(db)
    
    if category:
        try:
            cat_enum = ConfigCategory(category)
            configs = await config_repo.get_by_category(cat_enum)
        except ValueError:
            raise ValidationException(f"Invalid category: {category}")
    else:
        configs = await config_repo.get_all_active()
    
    return ResponseModel(
        success=True,
        data=[c.to_dict() for c in configs]
    )


@router.get("/config/{key}", response_model=ResponseModel[ConfigResponse])
async def get_config(
    key: str,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Get configuration by key (admin only).
    """
    config_repo = ConfigRepository(db)
    config = await config_repo.get_by_key(key)
    
    if not config:
        raise NotFoundException("Configuration", key)
    
    return ResponseModel(
        success=True,
        data=ConfigResponse.model_validate(config.to_dict(include_sensitive=True))
    )


@router.post("/config", response_model=ResponseModel[ConfigResponse])
async def create_config(
    config_data: ConfigCreate,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis),
):
    """
    Create a new configuration (admin only).
    """
    config_repo = ConfigRepository(db)
    
    # Check if key exists
    if await config_repo.key_exists(config_data.key):
        raise ValidationException(f"Configuration key '{config_data.key}' already exists")
    
    config = await config_repo.create(
        key=config_data.key,
        value=config_data.value,
        category=ConfigCategory(config_data.category),
        description=config_data.description,
        display_name=config_data.display_name,
        is_sensitive=config_data.is_sensitive,
        value_type=config_data.value_type,
        fallback_value=config_data.fallback_value,
        updated_by=current_user.id,
    )
    await db.commit()
    
    logger.info(f"Config '{config_data.key}' created by {current_user.email}")
    
    return ResponseModel(
        success=True,
        message="Configuration created successfully",
        data=ConfigResponse.model_validate(config.to_dict(include_sensitive=True))
    )


@router.put("/config/{key}", response_model=ResponseModel[ConfigResponse])
async def update_config(
    key: str,
    update_data: ConfigUpdate,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis),
):
    """
    Update a configuration (admin only).
    """
    config_repo = ConfigRepository(db)
    config = await config_repo.get_by_key(key)
    
    if not config:
        raise NotFoundException("Configuration", key)
    
    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_by"] = current_user.id
    
    updated_config = await config_repo.update(config.id, update_dict)
    await db.commit()
    
    # Invalidate cache
    await cache.delete(f"config:{key}")
    
    logger.info(f"Config '{key}' updated by {current_user.email}")
    
    return ResponseModel(
        success=True,
        message="Configuration updated successfully",
        data=ConfigResponse.model_validate(updated_config.to_dict(include_sensitive=True))
    )


@router.delete("/config/{key}", response_model=ResponseModel)
async def delete_config(
    key: str,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis),
):
    """
    Delete a configuration (admin only).
    """
    config_repo = ConfigRepository(db)
    config = await config_repo.get_by_key(key)
    
    if not config:
        raise NotFoundException("Configuration", key)
    
    await config_repo.delete(config.id)
    await db.commit()
    
    # Invalidate cache
    await cache.delete(f"config:{key}")
    
    logger.info(f"Config '{key}' deleted by {current_user.email}")
    
    return ResponseModel(
        success=True,
        message="Configuration deleted successfully"
    )


# ═══════════════════════════════════════════════════════════════════
# Instrument Endpoints
# ═══════════════════════════════════════════════════════════════════

@router.get("/instruments", response_model=ResponseModel)
async def list_instruments(
    current_user: CurrentAdmin,
    active_only: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
):
    """
    List all trading instruments (admin only).
    """
    instrument_repo = InstrumentRepository(db)
    
    if active_only:
        instruments = await instrument_repo.get_active()
    else:
        instruments = await instrument_repo.get_all()
    
    return ResponseModel(
        success=True,
        data=[i.to_dict() for i in instruments]
    )


@router.post("/instruments", response_model=ResponseModel[InstrumentResponse])
async def create_instrument(
    instrument_data: InstrumentCreate,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new trading instrument (admin only).
    """
    instrument_repo = InstrumentRepository(db)
    
    # Check if symbol exists
    if await instrument_repo.symbol_exists(instrument_data.symbol):
        raise ValidationException(f"Instrument '{instrument_data.symbol}' already exists")
    
    instrument = await instrument_repo.create(**instrument_data.model_dump())
    await db.commit()
    
    logger.info(f"Instrument '{instrument_data.symbol}' created by {current_user.email}")
    
    return ResponseModel(
        success=True,
        message="Instrument created successfully",
        data=InstrumentResponse.model_validate(instrument.to_dict())
    )


@router.put("/instruments/{instrument_id}", response_model=ResponseModel[InstrumentResponse])
async def update_instrument(
    instrument_id: UUID,
    update_data: InstrumentUpdate,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Update a trading instrument (admin only).
    """
    instrument_repo = InstrumentRepository(db)
    instrument = await instrument_repo.get_by_id(instrument_id)
    
    if not instrument:
        raise NotFoundException("Instrument", instrument_id)
    
    updated = await instrument_repo.update(
        instrument_id,
        update_data.model_dump(exclude_unset=True)
    )
    await db.commit()
    
    logger.info(f"Instrument '{instrument.symbol}' updated by {current_user.email}")
    
    return ResponseModel(
        success=True,
        message="Instrument updated successfully",
        data=InstrumentResponse.model_validate(updated.to_dict())
    )


@router.delete("/instruments/{instrument_id}", response_model=ResponseModel)
async def delete_instrument(
    instrument_id: UUID,
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a trading instrument (admin only).
    """
    instrument_repo = InstrumentRepository(db)
    instrument = await instrument_repo.get_by_id(instrument_id)
    
    if not instrument:
        raise NotFoundException("Instrument", instrument_id)
    
    symbol = instrument.symbol
    await instrument_repo.delete(instrument_id)
    await db.commit()
    
    logger.info(f"Instrument '{symbol}' deleted by {current_user.email}")
    
    return ResponseModel(
        success=True,
        message=f"Instrument '{symbol}' deleted successfully"
    )


# ═══════════════════════════════════════════════════════════════════
# Cache Management Endpoints
# ═══════════════════════════════════════════════════════════════════

@router.post("/cache/clear", response_model=CacheClearResponse)
async def clear_cache(
    request: CacheClearRequest,
    current_user: CurrentAdmin,
    cache: RedisCache = Depends(get_redis),
):
    """
    Clear cache entries (admin only).
    """
    keys_cleared = 0
    
    if request.clear_all:
        await cache.clear_all()
        keys_cleared = -1  # Indicates all cleared
        message = "All cache cleared"
    elif request.pattern:
        keys_cleared = await cache.delete_pattern(request.pattern)
        message = f"Cleared {keys_cleared} keys matching pattern '{request.pattern}'"
    else:
        message = "No pattern specified"
    
    logger.info(f"Cache cleared by {current_user.email}: {message}")
    
    return CacheClearResponse(
        success=True,
        keys_cleared=keys_cleared,
        message=message
    )


# ═══════════════════════════════════════════════════════════════════
# Runtime Settings Endpoints (Read-only .env values)
# ═══════════════════════════════════════════════════════════════════

@router.get("/settings/runtime", response_model=ResponseModel)
async def get_runtime_settings(
    current_user: CurrentAdmin,
):
    """
    Get current runtime settings from environment (read-only).
    These are loaded from .env and cannot be changed via UI.
    """
    from app.config.settings import settings
    
    runtime_settings = {
        "application": {
            "APP_NAME": settings.APP_NAME,
            "APP_VERSION": settings.APP_VERSION,
            "APP_ENV": settings.APP_ENV,
            "DEBUG": settings.DEBUG,
        },
        "server": {
            "HOST": settings.HOST,
            "PORT": settings.PORT,
            "WORKERS": settings.WORKERS,
        },
        "database": {
            "DATABASE_URL": settings.DATABASE_URL[:30] + "..." if settings.DATABASE_URL else "Not configured",
            "DATABASE_POOL_SIZE": settings.DATABASE_POOL_SIZE,
            "DATABASE_MAX_OVERFLOW": settings.DATABASE_MAX_OVERFLOW,
        },
        "redis": {
            "REDIS_URL": settings.REDIS_URL[:30] + "..." if settings.REDIS_URL else "Not configured",
            "REDIS_CACHE_TTL": settings.REDIS_CACHE_TTL,
            "REDIS_OPTIONS_CACHE_TTL": settings.REDIS_OPTIONS_CACHE_TTL,
        },
        "api": {
            "DHAN_API_BASE_URL": settings.DHAN_API_BASE_URL,
            "DHAN_API_TIMEOUT": settings.DHAN_API_TIMEOUT,
            "DHAN_API_RETRY_COUNT": settings.DHAN_API_RETRY_COUNT,
            "DHAN_AUTH_TOKEN": "***configured***" if settings.DHAN_AUTH_TOKEN else "Not configured",
        },
        "websocket": {
            "WS_HEARTBEAT_INTERVAL": settings.WS_HEARTBEAT_INTERVAL,
            "WS_MAX_CONNECTIONS": settings.WS_MAX_CONNECTIONS,
            "WS_BROADCAST_INTERVAL": settings.WS_BROADCAST_INTERVAL,
        },
        "security": {
            "RATE_LIMIT_PER_MINUTE": settings.RATE_LIMIT_PER_MINUTE,
            "RATE_LIMIT_BURST": settings.RATE_LIMIT_BURST,
            "ACCESS_TOKEN_EXPIRE_MINUTES": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        },
        "trading": {
            "DEFAULT_RISK_FREE_RATE": settings.DEFAULT_RISK_FREE_RATE,
            "DEFAULT_SYMBOL": settings.DEFAULT_SYMBOL,
        },
        "logging": {
            "LOG_LEVEL": settings.LOG_LEVEL,
        },
    }
    
    return ResponseModel(
        success=True,
        data=runtime_settings
    )


@router.post("/seed", response_model=ResponseModel)
async def reseed_database(
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Re-seed missing configurations and instruments.
    Will not overwrite existing entries.
    """
    from app.utils.seeder import seed_configs, seed_instruments
    
    config_count = await seed_configs(db)
    instrument_count = await seed_instruments(db)
    
    logger.info(f"Re-seed by {current_user.email}: {config_count} configs, {instrument_count} instruments")
    
    return ResponseModel(
        success=True,
        message=f"Seeded {config_count} configs and {instrument_count} instruments",
        data={
            "configs_seeded": config_count,
            "instruments_seeded": instrument_count,
        }
    )


# ═══════════════════════════════════════════════════════════════════
# Feature Flags Endpoints
# ═══════════════════════════════════════════════════════════════════

@router.get("/features", response_model=ResponseModel)
async def list_feature_flags(
    current_user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    List all feature flags with their current status.
    """
    config_repo = ConfigRepository(db)
    
    try:
        features_category = ConfigCategory.FEATURES
    except AttributeError:
        # FEATURES category might not exist, return empty
        return ResponseModel(success=True, data=[])
    
    features = await config_repo.get_by_category(features_category)
    
    result = []
    for f in features:
        result.append({
            "key": f.key,
            "display_name": f.display_name or f.key,
            "description": f.description,
            "enabled": f.value.lower() in ("true", "1", "yes", "on"),
            "value": f.value,
        })
    
    return ResponseModel(success=True, data=result)


@router.put("/features/{key}", response_model=ResponseModel)
async def toggle_feature(
    key: str,
    current_user: CurrentAdmin,
    enabled: bool = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_redis),
):
    """
    Toggle a feature flag on or off.
    """
    config_repo = ConfigRepository(db)
    
    config = await config_repo.get_by_key(key)
    if not config:
        raise NotFoundException("Feature flag", key)
    
    new_value = "true" if enabled else "false"
    await config_repo.update_value(key, new_value, updated_by=current_user.id)
    await db.commit()
    
    # Invalidate cache
    if cache:
        from app.cache.redis import CacheKeys
        await cache.delete(CacheKeys.config(key))
    
    logger.info(f"Feature '{key}' set to {enabled} by {current_user.email}")
    
    return ResponseModel(
        success=True,
        message=f"Feature '{key}' {'enabled' if enabled else 'disabled'}",
        data={"key": key, "enabled": enabled}
    )

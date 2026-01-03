"""
Configuration Seeding Service

Seeds default configurations into the database on application startup.
Only creates missing configs, does not overwrite existing values.
"""
import logging
from sqlalchemy import select
from core.database.pool import write_session
from core.database.models import SystemConfigDB
from services.admin.routers.config import SYSTEM_CONFIGS

logger = logging.getLogger("stockify.admin.seed")


async def seed_default_configs():
    """
    Seed all default configurations into the database.
    Called during application startup via lifespan event.
    
    Only creates configs that don't already exist in the database,
    preserving any user-modified values.
    """
    async with write_session() as session:
        created_count = 0
        skipped_count = 0
        
        for key, meta in SYSTEM_CONFIGS.items():
            # Check if config already exists
            result = await session.execute(
                select(SystemConfigDB).where(SystemConfigDB.key == key)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                skipped_count += 1
                continue
            
            # Create new config entry
            config = SystemConfigDB(
                key=key,
                value=meta["value"],
                description=meta.get("description", ""),
                category=meta.get("category", "general"),
                data_type=meta.get("data_type", "string"),
                requires_restart=meta.get("requires_restart", False),
                is_encrypted=meta.get("is_sensitive", False),
                updated_by="system"
            )
            session.add(config)
            created_count += 1
        
        await session.commit()
        
        if created_count > 0:
            logger.info(f"Seeded {created_count} default configurations ({skipped_count} already existed)")
        else:
            logger.debug(f"All {skipped_count} configurations already exist, nothing to seed")
        
        return {"created": created_count, "skipped": skipped_count}


async def reset_to_defaults(category: str = None):
    """
    Reset configurations to their default values.
    
    Args:
        category: Optional category to reset. If None, resets all configs.
    """
    async with write_session() as session:
        reset_count = 0
        
        for key, meta in SYSTEM_CONFIGS.items():
            if category and meta.get("category") != category:
                continue
            
            result = await session.execute(
                select(SystemConfigDB).where(SystemConfigDB.key == key)
            )
            config = result.scalar_one_or_none()
            
            if config:
                config.value = meta["value"]
                config.updated_by = "system"
                reset_count += 1
        
        await session.commit()
        logger.info(f"Reset {reset_count} configurations to defaults")
        
        return {"reset": reset_count}

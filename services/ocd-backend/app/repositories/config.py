"""
Configuration Repository - Admin config data access operations
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.config import SystemConfig, TradingInstrument, ConfigCategory
from app.repositories.base import BaseRepository


class ConfigRepository(BaseRepository[SystemConfig]):
    """Repository for SystemConfig model operations"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, SystemConfig)
    
    async def get_by_key(self, key: str) -> Optional[SystemConfig]:
        """Get config by key"""
        result = await self.db.execute(
            select(SystemConfig).where(
                SystemConfig.key == key,
                SystemConfig.is_active == True
            )
        )
        return result.scalar_one_or_none()
    
    async def get_value(self, key: str, fallback: Optional[str] = None) -> Optional[str]:
        """Get config value by key with fallback"""
        config = await self.get_by_key(key)
        if config:
            return config.value
        return fallback
    
    async def get_by_category(self, category: ConfigCategory) -> List[SystemConfig]:
        """Get all configs in a category"""
        result = await self.db.execute(
            select(SystemConfig)
            .where(
                SystemConfig.category == category,
                SystemConfig.is_active == True
            )
            .order_by(SystemConfig.key)
        )
        return list(result.scalars().all())
    
    async def get_all_active(self) -> List[SystemConfig]:
        """Get all active configs"""
        result = await self.db.execute(
            select(SystemConfig)
            .where(SystemConfig.is_active == True)
            .order_by(SystemConfig.category, SystemConfig.key)
        )
        return list(result.scalars().all())
    
    async def create(
        self,
        key: str,
        value: str,
        category: ConfigCategory = ConfigCategory.SYSTEM,
        description: Optional[str] = None,
        display_name: Optional[str] = None,
        is_sensitive: bool = False,
        value_type: str = "string",
        fallback_value: Optional[str] = None,
        updated_by: Optional[UUID] = None,
    ) -> SystemConfig:
        """Create a new config"""
        config = SystemConfig(
            key=key,
            value=value,
            category=category,
            description=description,
            display_name=display_name or key,
            is_sensitive=is_sensitive,
            value_type=value_type,
            fallback_value=fallback_value,
            updated_by=updated_by,
        )
        self.db.add(config)
        await self.db.flush()
        await self.db.refresh(config)
        return config
    
    async def update_value(
        self,
        key: str,
        value: str,
        updated_by: Optional[UUID] = None
    ) -> Optional[SystemConfig]:
        """Update config value by key"""
        config = await self.get_by_key(key)
        if config:
            config.value = value
            config.updated_by = updated_by
            await self.db.flush()
            await self.db.refresh(config)
        return config
    
    async def set_config(
        self,
        key: str,
        value: str,
        category: ConfigCategory = ConfigCategory.SYSTEM,
        updated_by: Optional[UUID] = None,
        **kwargs
    ) -> SystemConfig:
        """Set config - create if not exists, update if exists"""
        config = await self.get_by_key(key)
        if config:
            config.value = value
            config.updated_by = updated_by
            for k, v in kwargs.items():
                if hasattr(config, k) and v is not None:
                    setattr(config, k, v)
            await self.db.flush()
            await self.db.refresh(config)
            return config
        else:
            return await self.create(
                key=key,
                value=value,
                category=category,
                updated_by=updated_by,
                **kwargs
            )
    
    async def key_exists(self, key: str) -> bool:
        """Check if config key exists"""
        config = await self.get_by_key(key)
        return config is not None


class InstrumentRepository(BaseRepository[TradingInstrument]):
    """Repository for TradingInstrument model operations"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, TradingInstrument)
    
    async def get_by_symbol(self, symbol: str) -> Optional[TradingInstrument]:
        """Get instrument by symbol"""
        result = await self.db.execute(
            select(TradingInstrument).where(
                TradingInstrument.symbol == symbol.upper()
            )
        )
        return result.scalar_one_or_none()
    
    async def get_active(self) -> List[TradingInstrument]:
        """Get all active instruments"""
        result = await self.db.execute(
            select(TradingInstrument)
            .where(TradingInstrument.is_active == True)
            .order_by(TradingInstrument.priority.desc(), TradingInstrument.symbol)
        )
        return list(result.scalars().all())
    
    async def create(
        self,
        symbol: str,
        display_name: Optional[str] = None,
        segment: str = "IDX",
        lot_size: int = 1,
        tick_size: float = 0.05,
        strike_interval: float = 50.0,
        strikes_count: int = 20,
        priority: int = 0,
        is_active: bool = True,
    ) -> TradingInstrument:
        """Create a new instrument"""
        instrument = TradingInstrument(
            symbol=symbol.upper(),
            display_name=display_name or symbol.upper(),
            segment=segment,
            lot_size=lot_size,
            tick_size=tick_size,
            strike_interval=strike_interval,
            strikes_count=strikes_count,
            priority=priority,
            is_active=is_active,
        )
        self.db.add(instrument)
        await self.db.flush()
        await self.db.refresh(instrument)
        return instrument
    
    async def symbol_exists(self, symbol: str) -> bool:
        """Check if symbol exists"""
        instrument = await self.get_by_symbol(symbol)
        return instrument is not None

"""
Options Data Repository

NOTE: Data persistence is handled by the dedicated Storage service.
See: services/storage/main.py

This repository now only handles read operations and instrument lookups.
"""
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.database.models import InstrumentDB

logger = logging.getLogger(__name__)


class OptionsRepository:
    """
    Repository for options data operations.
    
    NOTE: DB writes are handled by services/storage/main.py
    This repository provides read operations only.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_instrument_id(self, symbol: str) -> Optional[int]:
        """Get instrument ID for a symbol"""
        query = select(InstrumentDB).where(InstrumentDB.symbol == symbol)
        result = await self.db.execute(query)
        instrument = result.scalars().first()
        return instrument.symbol_id if instrument else None

    # NOTE: save_snapshot() was removed - data persists via Storage service pipeline only
    # The Storage service at services/storage/main.py handles all DB writes:
    # - Consumes from Kafka enriched_data topic
    # - Stores market_snapshots and option_contracts tables
    # - Includes oi_pct, volume_pct, oichng_pct calculated by Processor


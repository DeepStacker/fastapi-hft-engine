"""
Historical Data Repository

Provides efficient queries for historical market data from TimescaleDB.
Designed for high-performance timeseries queries supporting millions of users.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass

from sqlalchemy import select, func, text, and_, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.models import (
    MarketSnapshotDB,
    OptionContractDB,
    InstrumentDB,
    PCRHistoryDB,
)

logger = logging.getLogger(__name__)


@dataclass
class TimeSeriesPoint:
    """Single point in time-series data"""
    timestamp: datetime
    value: float
    change: Optional[float] = None
    change_percent: Optional[float] = None


@dataclass
class OHLCVPoint:
    """OHLCV candlestick data point"""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


class HistoricalDataRepository:
    """
    Repository for querying historical market data from TimescaleDB.
    
    Optimized for:
    - Time-range queries with aggregation
    - Strike-level option data
    - Spot price history
    - PCR history
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_option_timeseries(
        self,
        symbol_id: int,
        strike: float,
        option_type: str,
        expiry: str,
        field: str,
        start_time: datetime,
        end_time: datetime,
        interval_minutes: int = 5,
    ) -> List[TimeSeriesPoint]:
        """
        Get time-series data for a specific option contract.
        
        Args:
            symbol_id: Instrument symbol ID
            strike: Strike price
            option_type: CE or PE
            expiry: Expiry date string
            field: Field to query (oi, ltp, iv, volume, delta, theta)
            start_time: Start of time range
            end_time: End of time range  
            interval_minutes: Aggregation interval
            
        Returns:
            List of TimeSeriesPoint objects
        """
        # Map field name to database column
        field_mapping = {
            "oi": OptionContractDB.oi,
            "oi_change": OptionContractDB.oi_change,
            "ltp": OptionContractDB.ltp,
            "iv": OptionContractDB.iv,
            "volume": OptionContractDB.volume,
            "delta": OptionContractDB.delta,
            "theta": OptionContractDB.theta,
            "gamma": OptionContractDB.gamma,
            "vega": OptionContractDB.vega,
        }
        
        column = field_mapping.get(field, OptionContractDB.oi)
        
        # TimescaleDB time_bucket for efficient aggregation
        query = (
            select(
                func.time_bucket(
                    text(f"'{interval_minutes} minutes'"),
                    OptionContractDB.timestamp
                ).label("bucket"),
                func.last(column, OptionContractDB.timestamp).label("value"),
            )
            .where(
                and_(
                    OptionContractDB.symbol_id == symbol_id,
                    OptionContractDB.strike_price == strike,
                    OptionContractDB.option_type == option_type,
                    OptionContractDB.expiry == expiry,
                    OptionContractDB.timestamp >= start_time,
                    OptionContractDB.timestamp <= end_time,
                )
            )
            .group_by(text("bucket"))
            .order_by(asc(text("bucket")))
        )
        
        try:
            result = await self.db.execute(query)
            rows = result.fetchall()
            
            points = []
            prev_value = None
            
            for row in rows:
                value = float(row.value) if row.value else 0.0
                change = value - prev_value if prev_value is not None else None
                change_pct = (change / prev_value * 100) if prev_value and prev_value != 0 else None
                
                points.append(TimeSeriesPoint(
                    timestamp=row.bucket,
                    value=value,
                    change=round(change, 2) if change else None,
                    change_percent=round(change_pct, 2) if change_pct else None,
                ))
                prev_value = value
            
            return points
            
        except Exception as e:
            logger.error(f"Error querying option timeseries: {e}")
            return []
    
    async def get_spot_timeseries(
        self,
        symbol_id: int,
        start_time: datetime,
        end_time: datetime,
        interval_minutes: int = 5,
    ) -> List[TimeSeriesPoint]:
        """
        Get spot price time-series from market snapshots.
        
        Uses TimescaleDB time_bucket for efficient aggregation.
        """
        query = (
            select(
                func.time_bucket(
                    text(f"'{interval_minutes} minutes'"),
                    MarketSnapshotDB.timestamp
                ).label("bucket"),
                func.first(MarketSnapshotDB.ltp, MarketSnapshotDB.timestamp).label("open"),
                func.max(MarketSnapshotDB.ltp).label("high"),
                func.min(MarketSnapshotDB.ltp).label("low"),
                func.last(MarketSnapshotDB.ltp, MarketSnapshotDB.timestamp).label("close"),
                func.sum(MarketSnapshotDB.volume).label("volume"),
            )
            .where(
                and_(
                    MarketSnapshotDB.symbol_id == symbol_id,
                    MarketSnapshotDB.timestamp >= start_time,
                    MarketSnapshotDB.timestamp <= end_time,
                )
            )
            .group_by(text("bucket"))
            .order_by(asc(text("bucket")))
        )
        
        try:
            result = await self.db.execute(query)
            rows = result.fetchall()
            
            points = []
            prev_value = None
            
            for row in rows:
                value = float(row.close) if row.close else 0.0
                change = value - prev_value if prev_value is not None else None
                change_pct = (change / prev_value * 100) if prev_value and prev_value != 0 else None
                
                points.append(TimeSeriesPoint(
                    timestamp=row.bucket,
                    value=value,
                    change=round(change, 2) if change else None,
                    change_percent=round(change_pct, 2) if change_pct else None,
                ))
                prev_value = value
            
            return points
            
        except Exception as e:
            logger.error(f"Error querying spot timeseries: {e}")
            return []
    
    async def get_spot_ohlcv(
        self,
        symbol_id: int,
        start_time: datetime,
        end_time: datetime,
        interval_minutes: int = 5,
    ) -> List[OHLCVPoint]:
        """
        Get OHLCV candlestick data for spot price.
        """
        query = (
            select(
                func.time_bucket(
                    text(f"'{interval_minutes} minutes'"),
                    MarketSnapshotDB.timestamp
                ).label("bucket"),
                func.first(MarketSnapshotDB.ltp, MarketSnapshotDB.timestamp).label("open"),
                func.max(MarketSnapshotDB.ltp).label("high"),
                func.min(MarketSnapshotDB.ltp).label("low"),
                func.last(MarketSnapshotDB.ltp, MarketSnapshotDB.timestamp).label("close"),
                func.sum(MarketSnapshotDB.volume).label("volume"),
            )
            .where(
                and_(
                    MarketSnapshotDB.symbol_id == symbol_id,
                    MarketSnapshotDB.timestamp >= start_time,
                    MarketSnapshotDB.timestamp <= end_time,
                )
            )
            .group_by(text("bucket"))
            .order_by(asc(text("bucket")))
        )
        
        try:
            result = await self.db.execute(query)
            rows = result.fetchall()
            
            return [
                OHLCVPoint(
                    timestamp=row.bucket,
                    open=float(row.open or 0),
                    high=float(row.high or 0),
                    low=float(row.low or 0),
                    close=float(row.close or 0),
                    volume=int(row.volume or 0),
                )
                for row in rows
            ]
            
        except Exception as e:
            logger.error(f"Error querying OHLCV: {e}")
            return []
    
    async def get_pcr_history(
        self,
        symbol_id: int,
        expiry: str,
        start_time: datetime,
        end_time: datetime,
        interval_minutes: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Get PCR history from PCRHistoryDB or calculate from option contracts.
        """
        # First try PCRHistoryDB
        query = (
            select(
                func.time_bucket(
                    text(f"'{interval_minutes} minutes'"),
                    PCRHistoryDB.timestamp
                ).label("bucket"),
                func.last(PCRHistoryDB.pcr_oi, PCRHistoryDB.timestamp).label("pcr_oi"),
                func.last(PCRHistoryDB.pcr_volume, PCRHistoryDB.timestamp).label("pcr_volume"),
                func.last(PCRHistoryDB.total_call_oi, PCRHistoryDB.timestamp).label("call_oi"),
                func.last(PCRHistoryDB.total_put_oi, PCRHistoryDB.timestamp).label("put_oi"),
            )
            .where(
                and_(
                    PCRHistoryDB.symbol_id == symbol_id,
                    PCRHistoryDB.expiry == expiry,
                    PCRHistoryDB.timestamp >= start_time,
                    PCRHistoryDB.timestamp <= end_time,
                )
            )
            .group_by(text("bucket"))
            .order_by(asc(text("bucket")))
        )
        
        try:
            result = await self.db.execute(query)
            rows = result.fetchall()
            
            return [
                {
                    "timestamp": row.bucket.isoformat(),
                    "pcr_oi": float(row.pcr_oi or 0),
                    "pcr_volume": float(row.pcr_volume or 0),
                    "call_oi": int(row.call_oi or 0),
                    "put_oi": int(row.put_oi or 0),
                }
                for row in rows
            ]
            
        except Exception as e:
            logger.error(f"Error querying PCR history: {e}")
            return []
    
    async def get_latest_snapshot(
        self,
        symbol_id: int,
    ) -> Optional[MarketSnapshotDB]:
        """Get the most recent market snapshot for a symbol."""
        query = (
            select(MarketSnapshotDB)
            .where(MarketSnapshotDB.symbol_id == symbol_id)
            .order_by(desc(MarketSnapshotDB.timestamp))
            .limit(1)
        )
        
        try:
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting latest snapshot: {e}")
            return None
    
    async def get_symbol_id(self, symbol: str) -> Optional[int]:
        """Get symbol_id from symbol name."""
        query = (
            select(InstrumentDB.symbol_id)
            .where(InstrumentDB.symbol == symbol.upper())
            .limit(1)
        )
        
        try:
            result = await self.db.execute(query)
            row = result.scalar_one_or_none()
            return row
        except Exception as e:
            logger.error(f"Error getting symbol_id: {e}")
            return None
    
    async def has_historical_data(
        self,
        symbol_id: int,
        start_time: datetime,
        end_time: datetime,
    ) -> bool:
        """Check if historical data exists for the given time range."""
        query = (
            select(func.count())
            .select_from(MarketSnapshotDB)
            .where(
                and_(
                    MarketSnapshotDB.symbol_id == symbol_id,
                    MarketSnapshotDB.timestamp >= start_time,
                    MarketSnapshotDB.timestamp <= end_time,
                )
            )
        )
        
        try:
            result = await self.db.execute(query)
            count = result.scalar()
            return count > 0
        except Exception as e:
            logger.error(f"Error checking historical data: {e}")
            return False


# Factory function for dependency injection
def get_historical_repository(db: AsyncSession) -> HistoricalDataRepository:
    """Get historical data repository instance."""
    return HistoricalDataRepository(db)

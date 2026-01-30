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
        interval: str = "5 minutes",
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
            interval: Aggregation interval (e.g. '5 minutes', '30 seconds')
            
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
            # Percentage fields for COA
            "oi_pct": OptionContractDB.oi_pct,
            "volume_pct": OptionContractDB.volume_pct,
            "oichng_pct": OptionContractDB.oichng_pct,
        }
        
        column = field_mapping.get(field, OptionContractDB.oi)
        
        # TimescaleDB time_bucket for efficient aggregation
        query = (
            select(
                func.time_bucket(
                    text(f"'{interval}'"),
                    OptionContractDB.timestamp
                ).label("bucket"),
                func.last(column, OptionContractDB.timestamp).label("value"),
            )
            .where(
                and_(
                    OptionContractDB.symbol_id == symbol_id,
                    OptionContractDB.strike_price == strike,
                    OptionContractDB.option_type == option_type,
                    # Cast expiry to integer since DB has bigint column
                    OptionContractDB.expiry == int(expiry) if expiry and expiry.isdigit() else OptionContractDB.expiry == expiry,
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
                change = value - prev_value if prev_value is not None else 0.0
                change_pct = (change / prev_value * 100) if prev_value and prev_value != 0 else 0.0
                
                points.append(TimeSeriesPoint(
                    timestamp=row.bucket,
                    value=value,
                    change=round(change, 2) if change is not None else 0.0,
                    change_percent=round(change_pct, 2) if change_pct is not None else 0.0,
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
        interval: str = "5 minutes",
    ) -> List[TimeSeriesPoint]:
        """
        Get spot price time-series from market snapshots.
        
        Uses TimescaleDB time_bucket for efficient aggregation.
        """
        query = (
            select(
                func.time_bucket(
                    text(f"'{interval}'"),
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
        interval: str = "5 minutes",
    ) -> List[OHLCVPoint]:
        """
        Get OHLCV candlestick data for spot price.
        """
        query = (
            select(
                func.time_bucket(
                    text(f"'{interval}'"),
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
        interval: str = "5 minutes",
    ) -> List[Dict[str, Any]]:
        """
        Get PCR history from PCRHistoryDB or calculate from option contracts.
        """
        # First try PCRHistoryDB
        query = (
            select(
                func.time_bucket(
                    text(f"'{interval}'"),
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

    async def get_available_dates(
        self,
        symbol_id: int,
        limit: int = 60,
    ) -> List[str]:
        """
        Get list of dates that have historical data for a symbol.
        Returns dates in YYYY-MM-DD format, most recent first.
        """
        query = (
            select(func.date_trunc('day', MarketSnapshotDB.timestamp).label('date'))
            .where(MarketSnapshotDB.symbol_id == symbol_id)
            .group_by(text('date'))
            .order_by(desc(text('date')))
            .limit(limit)
        )
        
        try:
            result = await self.db.execute(query)
            rows = result.fetchall()
            return [row.date.strftime('%Y-%m-%d') for row in rows if row.date]
        except Exception as e:
            logger.error(f"Error getting available dates: {e}")
            return []

    async def get_available_times(
        self,
        symbol_id: int,
        date_str: str,
        interval: str = "5 minutes",
    ) -> List[str]:
        """
        Get available snapshot times for a specific date.
        Returns times in HH:MM format.
        """
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            start_time = datetime.combine(target_date, datetime.min.time())
            end_time = datetime.combine(target_date, datetime.max.time())
            
            query = (
                select(
                    func.time_bucket(
                        text(f"'{interval}'"),
                        MarketSnapshotDB.timestamp
                    ).label("bucket")
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
            
            result = await self.db.execute(query)
            rows = result.fetchall()
            return [row.bucket.strftime('%H:%M') for row in rows if row.bucket]
        except Exception as e:
            logger.error(f"Error getting available times: {e}")
            return []

    async def get_snapshot_at_time(
        self,
        symbol_id: int,
        target_time: datetime,
        expiry: str,
        tolerance_minutes: int = 5,
    ) -> Optional[Dict[str, Any]]:
        """
        Get complete option chain snapshot at a specific time.
        
        Args:
            symbol_id: Instrument symbol ID
            target_time: Target timestamp to query
            expiry: Expiry string
            tolerance_minutes: Time tolerance for finding nearest snapshot
            
        Returns:
            Complete snapshot dict with spot, pcr, atm, and option chain data
        """
        start_time = target_time - timedelta(minutes=tolerance_minutes)
        end_time = target_time + timedelta(minutes=tolerance_minutes)
        
        try:
            # 1. Get market snapshot (closest to target time)
            snapshot_query = (
                select(MarketSnapshotDB)
                .where(
                    and_(
                        MarketSnapshotDB.symbol_id == symbol_id,
                        MarketSnapshotDB.timestamp >= start_time,
                        MarketSnapshotDB.timestamp <= end_time,
                    )
                )
                .order_by(
                    func.abs(
                        func.extract('epoch', MarketSnapshotDB.timestamp) - 
                        func.extract('epoch', text(f"'{target_time}'::timestamp"))
                    )
                )
                .limit(1)
            )
            
            snapshot_result = await self.db.execute(snapshot_query)
            snapshot = snapshot_result.scalar_one_or_none()
            
            if not snapshot:
                return None
            
            # 2. Get option contracts for this time window
            contracts_query = (
                select(OptionContractDB)
                .where(
                    and_(
                        OptionContractDB.symbol_id == symbol_id,
                        OptionContractDB.expiry == expiry,
                        OptionContractDB.timestamp >= start_time,
                        OptionContractDB.timestamp <= end_time,
                    )
                )
                .order_by(OptionContractDB.strike_price, OptionContractDB.option_type)
            )
            
            contracts_result = await self.db.execute(contracts_query)
            contracts = contracts_result.scalars().all()
            
            # 3. Build option chain dict
            option_chain = {}
            for contract in contracts:
                strike_key = str(int(contract.strike_price))
                if strike_key not in option_chain:
                    option_chain[strike_key] = {"strike": contract.strike_price}
                
                leg_key = "ce" if contract.option_type == "CE" else "pe"
                option_chain[strike_key][leg_key] = {
                    "ltp": contract.ltp,
                    "volume": contract.volume,
                    "oi": contract.oi,
                    "oi_change": contract.oi_change or 0,
                    "iv": contract.iv or 0,
                    "optgeeks": {
                        "delta": contract.delta,
                        "gamma": contract.gamma,
                        "theta": contract.theta,
                        "vega": contract.vega,
                    },
                    "BuiltupName": contract.buildup_name or "NEUTRAL",
                    "btyp": contract.buildup_type or "NT",
                }
            
            # 4. Calculate ATM strike
            spot = snapshot.ltp
            strikes = sorted([float(k) for k in option_chain.keys()])
            atm_strike = min(strikes, key=lambda x: abs(x - spot)) if strikes else spot
            
            return {
                "symbol_id": symbol_id,
                "timestamp": snapshot.timestamp.isoformat(),
                "spot": spot,
                "spot_change": snapshot.spot_change or 0,
                "atm_strike": atm_strike,
                "pcr": snapshot.pcr_ratio or 0,
                "max_pain": snapshot.max_pain_strike or 0,
                "atmiv": snapshot.atm_iv or 0,
                "total_ce_oi": snapshot.total_call_oi or 0,
                "total_pe_oi": snapshot.total_put_oi or 0,
                "oc": option_chain,
            }
            
        except Exception as e:
            logger.error(f"Error getting snapshot at time: {e}")
            return None


# Factory function for dependency injection
def get_historical_repository(db: AsyncSession) -> HistoricalDataRepository:
    """Get historical data repository instance."""
    return HistoricalDataRepository(db)


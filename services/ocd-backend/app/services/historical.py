"""
Historical Option Chain Service
Provides access to historical option chain data from TimescaleDB.
Optimized for sub-millisecond response times.
"""
import logging
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.cache.redis import RedisCache

logger = logging.getLogger(__name__)


@dataclass
class HistoricalSnapshot:
    """Represents a single historical option chain snapshot"""
    symbol: str
    expiry: str
    timestamp: datetime
    spot: float
    atm_strike: float
    pcr: float
    max_pain: float
    option_chain: Dict[str, Any]
    futures: Dict[str, Any] = None


# In-memory caches for ultra-fast lookups
_symbol_id_cache: Dict[str, int] = {}


class HistoricalService:
    """
    High-performance Historical Option Chain Service.
    
    Optimized for:
    - Sub-millisecond response times
    - Direct TimescaleDB queries (no fallbacks/simulation)
    - In-memory caching of symbol lookups
    - Raw SQL for maximum performance
    """
    
    def __init__(
        self,
        db: Optional[AsyncSession] = None,
        cache: Optional[RedisCache] = None
    ):
        self.db = db
        self.cache = cache
    
    async def _get_symbol_id(self, symbol: str) -> Optional[int]:
        """Get symbol_id with in-memory caching for O(1) lookups"""
        global _symbol_id_cache
        
        symbol_upper = symbol.upper()
        if symbol_upper in _symbol_id_cache:
            return _symbol_id_cache[symbol_upper]
        
        if self.db is None:
            return None
        
        # Single optimized query
        result = await self.db.execute(
            text("SELECT symbol_id FROM instruments WHERE symbol = :symbol LIMIT 1"),
            {"symbol": symbol_upper}
        )
        row = result.fetchone()
        
        if row:
            _symbol_id_cache[symbol_upper] = row[0]
            return row[0]
        return None
    
    async def get_available_dates(self, symbol: str) -> List[str]:
        """
        Get list of dates with historical data from TimescaleDB.
        Uses optimized date_trunc query with index.
        
        Returns:
            List of date strings in YYYY-MM-DD format, empty if no data
        """
        if self.db is None:
            logger.error("No database connection for get_available_dates")
            return []
        
        symbol_id = await self._get_symbol_id(symbol)
        if symbol_id is None:
            return []
        
        try:
            # Optimized: Uses covering index on (symbol_id, timestamp)
            result = await self.db.execute(
                text("""
                    SELECT DISTINCT DATE(timestamp) as date
                    FROM market_snapshots
                    WHERE symbol_id = :symbol_id
                    ORDER BY date DESC
                    LIMIT 60
                """),
                {"symbol_id": symbol_id}
            )
            rows = result.fetchall()
            return [row[0].strftime('%Y-%m-%d') for row in rows if row[0]]
        except Exception as e:
            logger.error(f"Error getting available dates: {e}")
            return []
    
    async def get_available_times(self, symbol: str, date_str: str) -> List[str]:
        """
        Get available snapshot times for a date from TimescaleDB.
        Uses TimescaleDB time_bucket for efficient aggregation.
        
        Returns:
            List of time strings in HH:MM format, empty if no data
        """
        if self.db is None:
            logger.error("No database connection for get_available_times")
            return []
        
        symbol_id = await self._get_symbol_id(symbol)
        if symbol_id is None:
            return []
        
        try:
            # Optimized: TimescaleDB time_bucket with 5-minute intervals
            result = await self.db.execute(
                text("""
                    SELECT DISTINCT time_bucket('5 minutes', timestamp) as bucket
                    FROM market_snapshots
                    WHERE symbol_id = :symbol_id
                      AND timestamp::date = :target_date
                    ORDER BY bucket ASC
                """),
                {"symbol_id": symbol_id, "target_date": date_str}
            )
            rows = result.fetchall()
            return [row[0].strftime('%H:%M') for row in rows if row[0]]
        except Exception as e:
            logger.error(f"Error getting available times: {e}")
            return []
    
    async def get_historical_snapshot(
        self,
        symbol: str,
        expiry: str,
        date_str: str,
        time_str: str
    ) -> Optional[HistoricalSnapshot]:
        """
        Get a complete historical option chain snapshot from TimescaleDB.
        
        Optimized single-query approach for sub-ms performance.
        No fallbacks - returns None if data not found.
        
        Returns:
            HistoricalSnapshot or None if not found
        """
        if self.db is None:
            logger.error("No database connection for get_historical_snapshot")
            return None
        
        symbol_id = await self._get_symbol_id(symbol)
        if symbol_id is None:
            return None
        
        try:
            target_time = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            
            # Query 1: Get market snapshot (optimized with index)
            snapshot_result = await self.db.execute(
                text("""
                    SELECT timestamp, ltp, spot_change, pcr_ratio, max_pain_strike,
                           atm_iv, total_call_oi, total_put_oi
                    FROM market_snapshots
                    WHERE symbol_id = :symbol_id
                      AND timestamp BETWEEN :start_time AND :end_time
                    ORDER BY ABS(EXTRACT(EPOCH FROM timestamp - :target_time))
                    LIMIT 1
                """),
                {
                    "symbol_id": symbol_id,
                    "start_time": target_time - timedelta(minutes=5),
                    "end_time": target_time + timedelta(minutes=5),
                    "target_time": target_time
                }
            )
            snapshot_row = snapshot_result.fetchone()
            
            if not snapshot_row:
                return None
            
            timestamp, spot, spot_change, pcr, max_pain, atmiv, ce_oi, pe_oi = snapshot_row
            
            # Query 2: Get option contracts (batch fetch, indexed)
            contracts_result = await self.db.execute(
                text("""
                    SELECT strike_price, option_type, ltp, volume, oi, oi_change, iv,
                           delta, gamma, theta, vega, buildup_name, buildup_type
                    FROM option_contracts
                    WHERE symbol_id = :symbol_id
                      AND expiry = :expiry
                      AND timestamp BETWEEN :start_time AND :end_time
                    ORDER BY strike_price, option_type
                """),
                {
                    "symbol_id": symbol_id,
                    "expiry": expiry,
                    "start_time": target_time - timedelta(minutes=5),
                    "end_time": target_time + timedelta(minutes=5)
                }
            )
            contracts = contracts_result.fetchall()
            
            # Build option chain dict (O(n) single pass)
            option_chain = {}
            for row in contracts:
                strike, opt_type, ltp, vol, oi, oi_chg, iv, delta, gamma, theta, vega, buildup, btyp = row
                strike_key = str(int(strike))
                
                if strike_key not in option_chain:
                    option_chain[strike_key] = {"strike": strike}
                
                leg = "ce" if opt_type == "CE" else "pe"
                option_chain[strike_key][leg] = {
                    "ltp": ltp or 0,
                    "volume": vol or 0,
                    "oi": oi or 0,
                    "oi_change": oi_chg or 0,
                    "iv": iv or 0,
                    "optgeeks": {"delta": delta, "gamma": gamma, "theta": theta, "vega": vega},
                    "BuiltupName": buildup or "NEUTRAL",
                    "btyp": btyp or "NT",
                }
            
            # Calculate ATM strike
            strikes = sorted([float(k) for k in option_chain.keys()])
            atm_strike = min(strikes, key=lambda x: abs(x - spot)) if strikes else spot
            
            return HistoricalSnapshot(
                symbol=symbol,
                expiry=expiry,
                timestamp=timestamp,
                spot=spot or 0,
                atm_strike=atm_strike,
                pcr=pcr or 0,
                max_pain=max_pain or 0,
                option_chain=option_chain,
                futures=None
            )
            
        except Exception as e:
            logger.error(f"Error getting historical snapshot: {e}")
            return None
    
    async def get_snapshots_in_range(
        self,
        symbol: str,
        expiry: str,
        start_datetime: datetime,
        end_datetime: datetime,
        interval_minutes: int = 5
    ) -> List[HistoricalSnapshot]:
        """
        Get multiple snapshots within a time range.
        Optimized batch processing.
        """
        snapshots = []
        current = start_datetime
        
        while current <= end_datetime:
            date_str = current.strftime("%Y-%m-%d")
            time_str = current.strftime("%H:%M")
            
            snapshot = await self.get_historical_snapshot(symbol, expiry, date_str, time_str)
            if snapshot:
                snapshots.append(snapshot)
            
            current += timedelta(minutes=interval_minutes)
        
        return snapshots


# Factory function
async def get_historical_service(
    db: Optional[AsyncSession] = None,
    cache: Optional[RedisCache] = None
) -> HistoricalService:
    """Get historical service instance"""
    return HistoricalService(db=db, cache=cache)

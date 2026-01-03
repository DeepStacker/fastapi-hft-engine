"""
Historical Option Chain Service
Provides access to historical option chain data from TimescaleDB.
Optimized for sub-millisecond response times.
"""
import logging
from datetime import datetime, date, timedelta, timezone
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
    spot_change: float
    atm_strike: float
    atm_iv: float
    pcr: float
    max_pain: float
    total_call_oi: float
    total_put_oi: float
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
    
    async def get_available_expiries(self, symbol: str) -> List[str]:
        """
        Get list of unique expiries with historical data from TimescaleDB.
        Cached for 5 minutes.
        
        Returns:
            List of expiry strings in YYYY-MM-DD format, sorted most recent first
        """
        # Check Redis cache first
        cache_key = f"hist:exp:{symbol.upper()}"
        if self.cache:
            try:
                cached = await self.cache.get_json(cache_key)
                if cached is not None:
                    return cached
            except Exception:
                pass
        
        if self.db is None:
            logger.error("No database connection for get_available_expiries")
            return []
        
        symbol_id = await self._get_symbol_id(symbol)
        if symbol_id is None:
            return []
        
        try:
            # Get current timestamp to filter out future expiries
            import time
            current_ts = int(time.time())
            
            # Query distinct expiries from option_contracts
            # REMOVED: AND expiry <= :current_ts (This was hiding active contracts which have future expiry)
            # We trust the DB to contain only relevant expiries now that ingestion is fixed.
            result = await self.db.execute(
                text("""
                    SELECT DISTINCT expiry
                    FROM option_contracts
                    WHERE symbol_id = :symbol_id
                      AND expiry IS NOT NULL
                      AND expiry != 0
                      AND expiry > 1000000
                    ORDER BY expiry DESC
                    LIMIT 20
                """),
                {"symbol_id": symbol_id}
            )
            rows = result.fetchall()
            
            # Convert BigInt Timestamps to Date Strings (YYYY-MM-DD)
            # Timestamps are stored at 10:00 UTC (15:30 IST), use IST for display
            import pytz
            ist = pytz.timezone("Asia/Kolkata")
            
            expiries = []
            seen = set()
            for row in rows:
                if row[0]:
                    try:
                        # Ensure it's treated as integer for timestamp conversion
                        ts = int(row[0])
                        if ts < 1000000: # Ignore logical 0/small ints
                            continue
                        dt = datetime.fromtimestamp(ts, tz=ist)
                        date_str = dt.strftime('%Y-%m-%d')
                        if date_str not in seen:
                            expiries.append(date_str)
                            seen.add(date_str)
                    except (ValueError, TypeError, Exception):
                        pass
            
            # Cache the result for 5 minutes
            if self.cache and expiries:
                try:
                    await self.cache.set_json(cache_key, expiries, ttl=300)
                except Exception:
                    pass
            
            return expiries
        except Exception as e:
            logger.error(f"Error getting available expiries: {e}")
            return []
    
    async def get_available_dates(self, symbol: str, expiry: Optional[str] = None) -> List[str]:
        """
        Get list of dates with historical data from TimescaleDB.
        If expiry is provided, returns dates where that expiry was active.
        Cached for 5 minutes.
        
        Returns:
            List of date strings in YYYY-MM-DD format, empty if no data
        """
        # Check Redis cache first
        cache_key = f"hist:dates:{symbol.upper()}:{expiry or 'all'}"
        if self.cache:
            try:
                cached = await self.cache.get_json(cache_key)
                if cached is not None:
                    return cached
            except Exception:
                pass
        
        if self.db is None:
            logger.error("No database connection for get_available_dates")
            return []
        
        symbol_id = await self._get_symbol_id(symbol)
        if symbol_id is None:
            return []
        
        try:
            if expiry:
                # 1. Convert Expiry Date String to Timestamp
                expiry_ts = expiry
                if isinstance(expiry, str):
                    try:
                        dt = datetime.strptime(expiry, "%Y-%m-%d")
                        # Set to 10:00 UTC (15:30 IST) to preserve correct date when displayed
                        dt_utc = dt.replace(hour=10, minute=0, tzinfo=timezone.utc)
                        expiry_ts = int(dt_utc.timestamp())
                    except ValueError:
                         pass

                # 2. Find Previous Expiry to define Start Date
                # Get max expiry < current expiry
                prev_exp_res = await self.db.execute(
                     text("SELECT MAX(expiry) FROM option_contracts WHERE symbol_id = :sid AND expiry < :curr"),
                     {"sid": symbol_id, "curr": expiry_ts}
                )
                prev_exp_row = prev_exp_res.fetchone()
                start_ts_filter = 0
                if prev_exp_row and prev_exp_row[0]:
                    start_ts_filter = prev_exp_row[0]

                # 3. Query Dates within Cycle (Prev Expiry < Date <= Curr Expiry)
                result = await self.db.execute(
                    text("""
                        SELECT DISTINCT DATE(timestamp) as date
                        FROM option_contracts
                        WHERE symbol_id = :symbol_id
                          AND expiry = :expiry
                          AND timestamp > to_timestamp(:start_ts)
                          AND timestamp <= to_timestamp(:end_ts)
                        ORDER BY date DESC
                        LIMIT 60
                    """),
                    {
                        "symbol_id": symbol_id, 
                        "expiry": expiry_ts,
                        "start_ts": start_ts_filter,
                        "end_ts": expiry_ts
                    }
                )
            else:
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
            dates = [row[0].strftime('%Y-%m-%d') for row in rows if row[0]]
            
            # Cache the result for 5 minutes
            if self.cache and dates:
                try:
                    await self.cache.set_json(cache_key, dates, ttl=300)
                except Exception:
                    pass
            
            return dates
        except Exception as e:
            logger.error(f"Error getting available dates: {e}")
            return []
    
    async def get_available_times(self, symbol: str, date_str: str) -> List[str]:
        """
        Get available snapshot times for a date from TimescaleDB.
        Uses TimescaleDB time_bucket for efficient aggregation.
        Cached for 5 minutes.
        
        Returns:
            List of time strings in HH:MM format, empty if no data
        """
        # Check Redis cache first
        cache_key = f"hist:times:{symbol.upper()}:{date_str}"
        if self.cache:
            try:
                cached = await self.cache.get_json(cache_key)
                if cached is not None:
                    return cached
            except Exception:
                pass
        
        if self.db is None:
            logger.error("No database connection for get_available_times")
            return []
        
        symbol_id = await self._get_symbol_id(symbol)
        if symbol_id is None:
            return []
        
        try:
            # Parse date string to object for asyncpg
            target_date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            # Optimized: TimescaleDB time_bucket with 5-minute intervals
            result = await self.db.execute(
                text("""
                    SELECT DISTINCT time_bucket('5 minutes', timestamp) as bucket
                    FROM market_snapshots
                    WHERE symbol_id = :symbol_id
                      AND timestamp::date = :target_date
                    ORDER BY bucket ASC
                """),
                {"symbol_id": symbol_id, "target_date": target_date_obj}
            )
            rows = result.fetchall()
            times = [row[0].strftime('%H:%M') for row in rows if row[0]]
            
            # Cache the result for 5 minutes
            if self.cache and times:
                try:
                    await self.cache.set_json(cache_key, times, ttl=300)
                except Exception:
                    pass
            
            return times
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
        Cached for 24 hours (historical data is immutable).
        No fallbacks - returns None if data not found.
        
        Returns:
            HistoricalSnapshot or None if not found
        """
        # Check Redis cache first (historical data is immutable - long TTL)
        cache_key = f"hist:snap:{symbol.upper()}:{expiry}:{date_str}:{time_str}"
        if self.cache:
            try:
                cached = await self.cache.get_json(cache_key)
                if cached is not None:
                    # Reconstruct HistoricalSnapshot from cached dict
                    return HistoricalSnapshot(
                        symbol=cached['symbol'],
                        expiry=cached['expiry'],
                        timestamp=datetime.fromisoformat(cached['timestamp']),
                        spot=cached['spot'],
                        spot_change=cached['spot_change'],
                        atm_strike=cached['atm_strike'],
                        atm_iv=cached['atm_iv'],
                        pcr=cached['pcr'],
                        max_pain=cached['max_pain'],
                        total_call_oi=cached['total_call_oi'],
                        total_put_oi=cached['total_put_oi'],
                        option_chain=cached['option_chain'],
                        futures=cached.get('futures')
                    )
            except Exception:
                pass
        
        if self.db is None:
            logger.error("No database connection for get_historical_snapshot")
            return None
        
        symbol_id = await self._get_symbol_id(symbol)
        if symbol_id is None:
            return None
        
        try:
            try:
                # Try parsing with seconds first
                target_time = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M:%S")
            except ValueError:
                # Fallback to HH:MM
                target_time = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            
            # Convert expiry date string (YYYY-MM-DD) to Timestamp (12:00 IST / 06:30 UTC)
            # Database stores expiry as Unix Timestamp at generic noon time
            expiry_val = expiry
            if isinstance(expiry, str) and len(expiry) == 10 and '-' in expiry:
                try:
                    dt = datetime.strptime(expiry, "%Y-%m-%d")
                    # Set to 10:00 UTC (15:30 IST) to preserve correct date when displayed
                    dt_utc = dt.replace(hour=10, minute=0, tzinfo=timezone.utc)
                    expiry_val = int(dt_utc.timestamp())
                    logger.debug(f"Converted expiry date {expiry} to timestamp {expiry_val}")
                except ValueError:
                    pass
            elif isinstance(expiry, str) and expiry.isdigit():
                 expiry_val = int(expiry)
            elif isinstance(expiry, int):
                expiry_val = expiry
            
            # Efficient Whole Day Search (9:00 AM to 4:00 PM usually, but covering 24h just in case)
            day_start = target_time.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(hours=23, minutes=59, seconds=59)
            
            logger.debug(f"Historical: Searching snapshot for {symbol} on {date_str} around {time_str}")

            # Query 1: Get market snapshot (Nearest in the whole day)
            snapshot_result = await self.db.execute(
                text("""
                    SELECT timestamp, ltp, spot_change, pcr_ratio, max_pain_strike,
                           atm_iv, total_call_oi, total_put_oi
                    FROM market_snapshots
                    WHERE symbol_id = :symbol_id
                      AND timestamp >= :day_start AND timestamp <= :day_end
                    ORDER BY ABS(EXTRACT(EPOCH FROM timestamp - :target_time))
                    LIMIT 1
                """),
                {
                    "symbol_id": symbol_id,
                    "day_start": day_start,
                    "day_end": day_end,
                    "target_time": target_time
                }
            )
            snapshot_row = snapshot_result.fetchone()
            
            if not snapshot_row:
                logger.debug(f"Historical: No snapshot for {symbol} on {date_str}")
                return None
            
            timestamp, spot, spot_change, pcr, max_pain, atmiv, ce_oi, pe_oi = snapshot_row

            # Query 2: Get option contracts (batch fetch, indexed)
            # Use a narrow window around the snapshot timestamp for efficiency
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
                    "expiry": expiry_val,
                    "start_time": timestamp - timedelta(minutes=5),
                    "end_time": timestamp + timedelta(minutes=5)
                }
            )
            contracts = contracts_result.fetchall()
            
            # Build option chain dict (O(n) single pass)
            option_chain = {}
            for row in contracts:
                strike, opt_type, ltp, vol, oi, oi_chg, iv, delta, gamma, theta, vega, buildup, btyp = row
                strike_key = str(int(strike))
                
                if strike_key not in option_chain:
                    option_chain[strike_key] = {
                        "strike": strike,
                        "strike_price": strike,
                        "reversal": strike,
                        "wkly_reversal": strike,
                        "trading_signals": {},
                        "market_regimes": {}
                    }
                
                leg = "ce" if opt_type == "CE" else "pe"
                option_chain[strike_key][leg] = {
                    "ltp": ltp or 0,
                    "volume": vol or 0,
                    "oi": oi or 0,
                    "OI": oi or 0,  # Frontend uppercase compatibility
                    "oi_change": oi_chg or 0,
                    "oichng": oi_chg or 0, # Frontend abbreviated compatibility
                    "iv": iv or 0,
                    "optgeeks": {"delta": delta, "gamma": gamma, "theta": theta, "vega": vega},
                    "BuiltupName": buildup or "NEUTRAL",
                    "btyp": btyp or "NT",
                }
            
            # Calculate ATM strike
            strikes = sorted([float(k) for k in option_chain.keys()])
            atm_strike = min(strikes, key=lambda x: abs(x - spot)) if strikes else spot
            
            snapshot = HistoricalSnapshot(
                symbol=symbol,
                expiry=expiry,
                timestamp=timestamp,
                spot=spot or 0,
                spot_change=spot_change or 0,
                atm_strike=atm_strike,
                atm_iv=atmiv or 0,
                pcr=pcr or 0,
                max_pain=max_pain or 0,
                total_call_oi=ce_oi or 0,
                total_put_oi=pe_oi or 0,
                option_chain=option_chain,
                futures=None
            )
            
            # Cache the snapshot for 24 hours (historical data is immutable)
            if self.cache and snapshot:
                try:
                    cache_data = {
                        'symbol': snapshot.symbol,
                        'expiry': snapshot.expiry,
                        'timestamp': snapshot.timestamp.isoformat(),
                        'spot': snapshot.spot,
                        'spot_change': snapshot.spot_change,
                        'atm_strike': snapshot.atm_strike,
                        'atm_iv': snapshot.atm_iv,
                        'pcr': snapshot.pcr,
                        'max_pain': snapshot.max_pain,
                        'total_call_oi': snapshot.total_call_oi,
                        'total_put_oi': snapshot.total_put_oi,
                        'option_chain': snapshot.option_chain,
                        'futures': snapshot.futures
                    }
                    await self.cache.set_json(cache_key, cache_data, ttl=86400)  # 24 hours
                except Exception:
                    pass
            
            return snapshot
            
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

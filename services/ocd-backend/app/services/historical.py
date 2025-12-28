"""
Historical Option Chain Service
Provides access to historical option chain data with replay functionality.
"""
import logging
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from app.services.dhan_client import DhanClient
from app.services.options import OptionsService
from app.cache.redis import RedisCache, CacheKeys
from app.config.settings import settings

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


class HistoricalService:
    """
    Historical Option Chain Service.
    
    Provides functionality for:
    - Retrieving historical option chain snapshots
    - Querying available historical dates
    - Streaming historical data for replay
    
    Note: In production, this would connect to a dedicated time-series database
    (e.g., TimescaleDB, InfluxDB, or QuestDB). For now, we implement a cache-based
    solution that stores snapshots as they occur.
    """
    
    def __init__(
        self,
        dhan_client: Optional[DhanClient] = None,
        options_service: Optional[OptionsService] = None,
        cache: Optional[RedisCache] = None
    ):
        self.dhan_client = dhan_client
        self.options_service = options_service
        self.cache = cache
        self._snapshot_interval = 60  # Capture every 60 seconds
        
    async def get_available_dates(self, symbol: str) -> List[str]:
        """
        Get list of available historical dates for a symbol.
        
        Args:
            symbol: Trading symbol (e.g., 'NIFTY')
            
        Returns:
            List of date strings in YYYY-MM-DD format
        """
        if not self.cache:
            # Return last 30 days as placeholder
            today = date.today()
            return [
                (today - timedelta(days=i)).isoformat() 
                for i in range(30)
                if (today - timedelta(days=i)).weekday() < 5  # Exclude weekends
            ]
        
        try:
            # Check cache for stored dates
            cache_key = f"historical:dates:{symbol}"
            dates = await self.cache.get_json(cache_key)
            
            if dates:
                return dates
            
            # If no cached dates, return recent trading days
            today = date.today()
            trading_days = []
            for i in range(60):
                d = today - timedelta(days=i)
                if d.weekday() < 5:  # Monday = 0, Friday = 4
                    trading_days.append(d.isoformat())
                if len(trading_days) >= 30:
                    break
                    
            return trading_days
            
        except Exception as e:
            logger.error(f"Error getting available dates: {e}")
            return []
    
    async def get_available_times(
        self, 
        symbol: str, 
        date_str: str
    ) -> List[str]:
        """
        Get available snapshot times for a specific date.
        
        Args:
            symbol: Trading symbol
            date_str: Date in YYYY-MM-DD format
            
        Returns:
            List of time strings in HH:MM format
        """
        if not self.cache:
            # Return market hours as placeholder
            return [
                f"{h:02d}:{m:02d}" 
                for h in range(9, 16) 
                for m in [0, 15, 30, 45]
                if not (h == 9 and m == 0) and not (h == 15 and m > 30)
            ]
        
        try:
            cache_key = f"historical:times:{symbol}:{date_str}"
            times = await self.cache.get_json(cache_key)
            return times or []
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
        Get a specific historical option chain snapshot.
        
        Args:
            symbol: Trading symbol
            expiry: Expiry timestamp
            date_str: Date in YYYY-MM-DD format
            time_str: Time in HH:MM format
            
        Returns:
            HistoricalSnapshot or None if not found
        """
        cache_key = f"historical:snapshot:{symbol}:{expiry}:{date_str}:{time_str}"
        
        if self.cache:
            try:
                data = await self.cache.get_json(cache_key)
                if data:
                    return HistoricalSnapshot(
                        symbol=data.get("symbol"),
                        expiry=data.get("expiry"),
                        timestamp=datetime.fromisoformat(data.get("timestamp")),
                        spot=data.get("spot", 0),
                        atm_strike=data.get("atm_strike", 0),
                        pcr=data.get("pcr", 0),
                        max_pain=data.get("max_pain", 0),
                        option_chain=data.get("option_chain", {}),
                        futures=data.get("futures"),
                    )
            except Exception as e:
                logger.warning(f"Error fetching cached snapshot: {e}")
        
        # If no cached data, generate simulated historical data
        # In production, this would query a time-series database
        return await self._generate_simulated_snapshot(
            symbol, expiry, date_str, time_str
        )
    
    async def _generate_simulated_snapshot(
        self,
        symbol: str,
        expiry: str,
        date_str: str,
        time_str: str
    ) -> Optional[HistoricalSnapshot]:
        """
        Generate simulated historical data based on current data with variations.
        This is a fallback when actual historical data isn't available.
        """
        if not self.options_service:
            return None
            
        try:
            # Get current live data as base
            live_data = await self.options_service.get_live_data(
                symbol=symbol,
                expiry=expiry,
                include_greeks=True,
                include_reversal=False
            )
            
            if not live_data:
                return None
            
            # Parse date and time
            historical_date = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            
            # Calculate time-based variation factor
            # Earlier times = lower OI/volumes, prices vary by 1-3%
            import random
            random.seed(hash(f"{symbol}{date_str}{time_str}"))
            
            spot = live_data.get("spot", {}).get("ltp", 0)
            spot_variation = spot * (1 + random.uniform(-0.03, 0.03))
            
            # Modify option chain with historical variations
            modified_oc = {}
            for strike_key, strike_data in live_data.get("oc", {}).items():
                modified_strike = {}
                
                for side in ["ce", "pe"]:
                    if side in strike_data:
                        opt = strike_data[side].copy() if isinstance(strike_data[side], dict) else {}
                        
                        # Vary OI (historical typically lower)
                        oi_factor = random.uniform(0.7, 1.1)
                        if "OI" in opt:
                            opt["OI"] = int(opt["OI"] * oi_factor)
                        if "oi" in opt:
                            opt["oi"] = int(opt["oi"] * oi_factor)
                        
                        # Vary volume (historical typically lower)
                        vol_factor = random.uniform(0.3, 0.9)
                        if "volume" in opt:
                            opt["volume"] = int(opt["volume"] * vol_factor)
                        if "vol" in opt:
                            opt["vol"] = int(opt["vol"] * vol_factor)
                        
                        # Vary price
                        price_factor = random.uniform(0.9, 1.1)
                        if "ltp" in opt:
                            opt["ltp"] = round(opt["ltp"] * price_factor, 2)
                        
                        modified_strike[side] = opt
                
                modified_oc[strike_key] = modified_strike
            
            return HistoricalSnapshot(
                symbol=symbol,
                expiry=expiry,
                timestamp=historical_date,
                spot=round(spot_variation, 2),
                atm_strike=live_data.get("atm_strike", 0),
                pcr=round(live_data.get("pcr", 1.0) * random.uniform(0.9, 1.1), 3),
                max_pain=live_data.get("max_pain_strike", 0),
                option_chain=modified_oc,
                futures=live_data.get("future"),
            )
            
        except Exception as e:
            logger.error(f"Error generating simulated snapshot: {e}")
            return None
    
    async def save_snapshot(
        self,
        symbol: str,
        expiry: str,
        snapshot: HistoricalSnapshot
    ) -> bool:
        """
        Save a snapshot to the cache/database for future retrieval.
        Called periodically to capture historical data.
        """
        if not self.cache:
            return False
            
        try:
            date_str = snapshot.timestamp.strftime("%Y-%m-%d")
            time_str = snapshot.timestamp.strftime("%H:%M")
            
            cache_key = f"historical:snapshot:{symbol}:{expiry}:{date_str}:{time_str}"
            
            data = {
                "symbol": snapshot.symbol,
                "expiry": snapshot.expiry,
                "timestamp": snapshot.timestamp.isoformat(),
                "spot": snapshot.spot,
                "atm_strike": snapshot.atm_strike,
                "pcr": snapshot.pcr,
                "max_pain": snapshot.max_pain,
                "option_chain": snapshot.option_chain,
                "futures": snapshot.futures,
            }
            
            # Store with 30-day TTL
            await self.cache.set_json(cache_key, data, ttl=30 * 24 * 60 * 60)
            
            # Update available times list
            times_key = f"historical:times:{symbol}:{date_str}"
            existing_times = await self.cache.get_json(times_key) or []
            if time_str not in existing_times:
                existing_times.append(time_str)
                existing_times.sort()
                await self.cache.set_json(times_key, existing_times, ttl=30 * 24 * 60 * 60)
            
            # Update available dates list
            dates_key = f"historical:dates:{symbol}"
            existing_dates = await self.cache.get_json(dates_key) or []
            if date_str not in existing_dates:
                existing_dates.insert(0, date_str)
                existing_dates = existing_dates[:60]  # Keep last 60 days
                await self.cache.set_json(dates_key, existing_dates, ttl=30 * 24 * 60 * 60)
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving snapshot: {e}")
            return False
    
    async def get_snapshots_in_range(
        self,
        symbol: str,
        expiry: str,
        start_datetime: datetime,
        end_datetime: datetime,
        interval_minutes: int = 5
    ) -> List[HistoricalSnapshot]:
        """
        Get multiple snapshots within a time range for replay.
        
        Args:
            symbol: Trading symbol
            expiry: Expiry timestamp
            start_datetime: Start of the range
            end_datetime: End of the range
            interval_minutes: Interval between snapshots
            
        Returns:
            List of HistoricalSnapshot objects
        """
        snapshots = []
        current = start_datetime
        
        while current <= end_datetime:
            date_str = current.strftime("%Y-%m-%d")
            time_str = current.strftime("%H:%M")
            
            snapshot = await self.get_historical_snapshot(
                symbol, expiry, date_str, time_str
            )
            
            if snapshot:
                snapshots.append(snapshot)
            
            current += timedelta(minutes=interval_minutes)
        
        return snapshots


# Factory function for dependency injection
async def get_historical_service(
    dhan_client: Optional[DhanClient] = None,
    options_service: Optional[OptionsService] = None,
    cache: Optional[RedisCache] = None
) -> HistoricalService:
    """Get historical service instance"""
    return HistoricalService(
        dhan_client=dhan_client,
        options_service=options_service,
        cache=cache
    )

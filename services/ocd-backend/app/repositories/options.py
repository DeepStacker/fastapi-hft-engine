"""
Options Data Repository
Handles persistence of market snapshots and option contracts to TimescaleDB.
"""
import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.database.models import MarketSnapshotDB, OptionContractDB, InstrumentDB
from app.utils.timezone import get_ist_now

logger = logging.getLogger(__name__)


class OptionsRepository:
    """
    Repository for persisting options data.
    Separates database logic from business logic.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_instrument_id(self, symbol: str) -> Optional[int]:
        """Get instrument ID for a symbol"""
        query = select(InstrumentDB).where(InstrumentDB.symbol == symbol)
        result = await self.db.execute(query)
        instrument = result.scalars().first()
        return instrument.symbol_id if instrument else None

    async def save_snapshot(self, data: Dict[str, Any]):
        """
        Persist complete market snapshot to database.
        
        OPTIMIZED: Uses bulk insert for Option Contracts to avoid ORM overhead (10x faster).
        """
        if not self.db:
            return

        try:
            symbol = data.get("symbol")
            # DB expects naive timestamp (wall time)
            timestamp = get_ist_now().replace(tzinfo=None)
            trade_date = timestamp.date()  # Derive trade_date for hypertable
            
            # 1. Get Instrument ID
            symbol_id = await self.get_instrument_id(symbol)
            
            if not symbol_id:
                logger.warning(f"Instrument {symbol} not found in DB, skipping snapshot")
                return

            # 2. Create Snapshot Header (Single Insert)
            snapshot = MarketSnapshotDB(
                timestamp=timestamp,
                trade_date=trade_date,  # Add trade_date for hypertable
                symbol_id=symbol_id,
                exchange="NSE", # Default
                segment=data.get("instrument_type", "DERIVATIVE"),
                ltp=data.get("spot", {}).get("ltp", 0),
                volume=data.get("spot", {}).get("vol", 0),
                oi=0, # Aggregate if needed
                total_call_oi=data.get("total_ce_oi", 0),
                total_put_oi=data.get("total_pe_oi", 0),
                pcr_ratio=data.get("pcr", 0),
                atm_iv=data.get("atmiv", 0),
                atm_iv_change=data.get("atmiv_change", 0),
                max_pain_strike=data.get("max_pain_strike", 0),
                days_to_expiry=int(data.get("days_to_expiry", 0)),
                spot_change=data.get("spot", {}).get("change", 0),
                spot_change_pct=data.get("spot", {}).get("pchng", 0),
                raw_data=json.dumps(data) # Store full JSON for backup
            )
            self.db.add(snapshot)
            
            # 3. Create Option Contracts (Bulk Insert)
            oc_data = data.get("oc", {})
            # Convert expiry to integer since DB column is bigint
            expiry_raw = data.get("expiry", "")
            try:
                expiry = int(expiry_raw) if expiry_raw else 0
            except (ValueError, TypeError):
                expiry = 0
                logger.warning(f"Could not convert expiry '{expiry_raw}' to integer")
            
            bulk_contracts = []
            
            for strike_str, strike_data in oc_data.items():
                strike_price = float(strike_data.get("strike", 0))
                
                # CE Leg
                ce = strike_data.get("ce", {})
                if ce:
                    bulk_contracts.append({
                        "timestamp": timestamp,
                        "trade_date": trade_date,  # Required for hypertable
                        "symbol_id": symbol_id,
                        "expiry": expiry,
                        "strike_price": strike_price,
                        "option_type": "CE",
                        "ltp": ce.get("ltp", 0),
                        "volume": ce.get("volume", 0),
                        "oi": ce.get("oi", 0),
                        "oi_change": ce.get("oi_change", 0),
                        "iv": ce.get("iv", 0),
                        "delta": ce.get("optgeeks", {}).get("delta"),
                        "gamma": ce.get("optgeeks", {}).get("gamma"),
                        "theta": ce.get("optgeeks", {}).get("theta"),
                        "vega": ce.get("optgeeks", {}).get("vega"),
                        "buildup_name": ce.get("BuiltupName"),
                        "buildup_type": ce.get("btyp")
                    })
                    
                # PE Leg
                pe = strike_data.get("pe", {})
                if pe:
                    bulk_contracts.append({
                        "timestamp": timestamp,
                        "trade_date": trade_date,  # Required for hypertable
                        "symbol_id": symbol_id,
                        "expiry": expiry,
                        "strike_price": strike_price,
                        "option_type": "PE",
                        "ltp": pe.get("ltp", 0),
                        "volume": pe.get("volume", 0),
                        "oi": pe.get("oi", 0),
                        "oi_change": pe.get("oi_change", 0),
                        "iv": pe.get("iv", 0),
                        "delta": pe.get("optgeeks", {}).get("delta"),
                        "gamma": pe.get("optgeeks", {}).get("gamma"),
                        "theta": pe.get("optgeeks", {}).get("theta"),
                        "vega": pe.get("optgeeks", {}).get("vega"),
                        "buildup_name": pe.get("BuiltupName"),
                        "buildup_type": pe.get("btyp")
                    })
            
            # Execute Bulk Insert
            if bulk_contracts:
                from sqlalchemy import insert
                await self.db.execute(insert(OptionContractDB), bulk_contracts)
            
            await self.db.commit()
            logger.info(f"Persisted snapshot for {symbol} at {timestamp} ({len(bulk_contracts)} contracts)")
            
        except Exception as e:
            logger.error(f"Failed to persist snapshot: {e}")
            await self.db.rollback()

"""
COA History Storage

Stores COA snapshots to database for historical analysis.
"""
import logging
from datetime import datetime
from typing import Dict, Any

from sqlalchemy import text
from core.database.session import write_session

logger = logging.getLogger(__name__)


async def store_coa_snapshot(
    symbol_id: int,
    expiry: str,
    spot_price: float,
    atm_strike: float,
    coa_result: Dict[str, Any],
    timestamp: datetime = None
) -> bool:
    """
    Store a COA analysis snapshot to the database.
    
    Args:
        symbol_id: Instrument symbol ID
        expiry: Expiry date string
        spot_price: Current spot price
        atm_strike: ATM strike
        coa_result: Result from COAService.analyze()
        timestamp: Snapshot timestamp (defaults to now)
    """
    if timestamp is None:
        timestamp = datetime.utcnow()
    
    trade_date = timestamp.date()
    
    try:
        async with write_session() as session:
            stmt = text("""
                INSERT INTO coa_history (
                    timestamp, trade_date, symbol_id, expiry,
                    scenario_id, scenario_name, scenario_bias,
                    support_strength, support_strike, support_strike2nd,
                    support_oi, support_oi_change, support_oi_pct,
                    resistance_strength, resistance_strike, resistance_strike2nd,
                    resistance_oi, resistance_oi_change, resistance_oi_pct,
                    eos, eor, spot_price, atm_strike,
                    trade_at_eos, trade_at_eor
                ) VALUES (
                    :timestamp, :trade_date, :symbol_id, :expiry,
                    :scenario_id, :scenario_name, :scenario_bias,
                    :support_strength, :support_strike, :support_strike2nd,
                    :support_oi, :support_oi_change, :support_oi_pct,
                    :resistance_strength, :resistance_strike, :resistance_strike2nd,
                    :resistance_oi, :resistance_oi_change, :resistance_oi_pct,
                    :eos, :eor, :spot_price, :atm_strike,
                    :trade_at_eos, :trade_at_eor
                )
            """)
            
            scenario = coa_result.get('scenario', {})
            support = coa_result.get('support', {})
            resistance = coa_result.get('resistance', {})
            levels = coa_result.get('levels', {})
            
            await session.execute(stmt, {
                'timestamp': timestamp,
                'trade_date': trade_date,
                'symbol_id': symbol_id,
                'expiry': expiry,
                'scenario_id': scenario.get('id', '?'),
                'scenario_name': scenario.get('name', 'Unknown'),
                'scenario_bias': scenario.get('bias', 'unknown'),
                'support_strength': support.get('strength', 'Unknown'),
                'support_strike': support.get('strike100'),
                'support_strike2nd': support.get('strike2nd'),
                'support_oi': support.get('oi100'),
                'support_oi_change': support.get('oichng100'),
                'support_oi_pct': support.get('oi_pct100'),
                'resistance_strength': resistance.get('strength', 'Unknown'),
                'resistance_strike': resistance.get('strike100'),
                'resistance_strike2nd': resistance.get('strike2nd'),
                'resistance_oi': resistance.get('oi100'),
                'resistance_oi_change': resistance.get('oichng100'),
                'resistance_oi_pct': resistance.get('oi_pct100'),
                'eos': levels.get('eos'),
                'eor': levels.get('eor'),
                'spot_price': spot_price,
                'atm_strike': atm_strike,
                'trade_at_eos': levels.get('trade_at_eos', False),
                'trade_at_eor': levels.get('trade_at_eor', False),
            })
            
            logger.debug(f"Stored COA snapshot: {scenario.get('id')} for symbol {symbol_id}")
            return True
            
    except Exception as e:
        logger.error(f"Failed to store COA snapshot: {e}")
        return False

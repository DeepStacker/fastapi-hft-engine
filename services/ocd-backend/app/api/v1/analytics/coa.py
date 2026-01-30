"""
Chart of Accuracy API Endpoints

Provides COA scenario analysis and trading recommendations
based on OI percentage data.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.config.database import get_db
from app.cache.redis import get_redis, RedisCache
from app.services.options import get_options_service, OptionsService
from app.services.coa_service import get_coa_service, ChartOfAccuracyService

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Response Models ==============

class ScenarioResponse(BaseModel):
    """COA scenario details"""
    id: str
    name: str
    bias: str
    tradable: str


class StrengthResponse(BaseModel):
    """Support/Resistance strength details"""
    strength: str
    strike100: float
    strike2nd: Optional[float]
    oi100: int
    oi2nd: Optional[int]
    oichng100: int
    oichng2nd: Optional[int]
    oi_pct100: float
    oi_pct2nd: Optional[float]


class LevelsResponse(BaseModel):
    """Trading levels"""
    eos: float
    eor: float
    eos_plus1: float
    eos_minus1: float
    eor_plus1: float
    eor_minus1: float
    top: Optional[float]
    bottom: Optional[float]
    trade_at_eos: bool
    trade_at_eor: bool


class TradingResponse(BaseModel):
    """Trading recommendation"""
    recommendation: str


class COAResponse(BaseModel):
    """Complete Chart of Accuracy response"""
    success: bool = True
    symbol: str
    expiry: str
    scenario: ScenarioResponse
    support: StrengthResponse
    resistance: StrengthResponse
    levels: LevelsResponse
    trading: TradingResponse
    spot_price: float
    atm_strike: float


# ============== Endpoints ==============

@router.get("/{symbol}/coa", response_model=COAResponse)
async def get_chart_of_accuracy(
    symbol: str,
    expiry: Optional[str] = Query(None, description="Expiry date (uses current if not provided)"),
    service: OptionsService = Depends(get_options_service),
    coa_service: ChartOfAccuracyService = Depends(get_coa_service),
    cache: RedisCache = Depends(get_redis),
):
    """
    Get Chart of Accuracy scenario analysis.
    
    Returns:
    - Current scenario (1.0-1.8)
    - Support/Resistance strength (Strong, WTT, WTB)
    - EOS/EOR trading levels
    - Trading recommendation
    """
    try:
        # Get live option chain data
        live_data = await service.get_live_data(
            symbol=symbol,
            expiry=expiry or "",
            include_greeks=False,
            include_reversal=False,
            include_profiles=False
        )
        
        if not live_data:
            raise HTTPException(status_code=404, detail=f"No data available for {symbol}")
        
        # Extract data for COA analysis
        spot_price = live_data.get("spot", {}).get("ltp", 0)
        atm_strike = live_data.get("atm", 0)
        oc_data = live_data.get("oc", {})
        used_expiry = live_data.get("expiry", expiry or "")
        
        # Validate data
        if spot_price <= 0 or not oc_data:
            raise HTTPException(status_code=404, detail=f"Invalid or missing market data for {symbol}")

        
        # Build options list from oc_data
        options = []
        for strike_key, strike_data in oc_data.items():
            strike_price = strike_data.get("strike", 0)
            
            # CE leg
            ce = strike_data.get("ce", {})
            if ce:
                options.append({
                    "strike": strike_price,
                    "option_type": "CE",
                    "ltp": ce.get("ltp", 0),
                    "oi": ce.get("oi", 0),
                    "oi_change": ce.get("oi_change", 0) or ce.get("change_oi", 0),
                    "volume": ce.get("volume", 0) or ce.get("vol", 0),
                    "oi_pct": ce.get("oi_pct", 0),
                    "volume_pct": ce.get("volume_pct", 0),
                    "oichng_pct": ce.get("oichng_pct", 0),
                })
            
            # PE leg
            pe = strike_data.get("pe", {})
            if pe:
                options.append({
                    "strike": strike_price,
                    "option_type": "PE",
                    "ltp": pe.get("ltp", 0),
                    "oi": pe.get("oi", 0),
                    "oi_change": pe.get("oi_change", 0) or pe.get("change_oi", 0),
                    "volume": pe.get("volume", 0) or pe.get("vol", 0),
                    "oi_pct": pe.get("oi_pct", 0),
                    "volume_pct": pe.get("volume_pct", 0),
                    "oichng_pct": pe.get("oichng_pct", 0),
                })
        
        
        # Calculate OI percentages using VISIBLE RANGE only (matching frontend logic)
        # Visible range = ATM ± 10 strikes = 21 strikes total
        # This ensures intraday relevance and prevents far OTM legacy OI from skewing analysis
        
        step_size = 50  # Default for NIFTY/BANKNIFTY
        if symbol.upper() == "BANKNIFTY":
            step_size = 100
        elif symbol.upper() == "FINNIFTY":
            step_size = 50
        
        visible_range = 10  # 10 strikes ITM and 10 OTM from ATM
        lower_bound = atm_strike - (step_size * visible_range)
        upper_bound = atm_strike + (step_size * visible_range)
        
        # Filter to visible range for percentage calculation
        visible_options = [
            o for o in options 
            if lower_bound <= o.get('strike', 0) <= upper_bound
        ]
        
        # Also filter to OTM within visible range for COA analysis
        # Resistance (CE): strike > spot_price AND within visible range
        # Support (PE): strike < spot_price AND within visible range
        visible_ce_options = [
            o for o in visible_options 
            if o['option_type'] == 'CE' and o['strike'] > spot_price
        ]
        visible_pe_options = [
            o for o in visible_options 
            if o['option_type'] == 'PE' and o['strike'] < spot_price
        ]
        
        # Calculate max OI among VISIBLE OTM options only (matching frontend logic)
        max_ce_oi = max((o.get('oi', 0) for o in visible_ce_options), default=0)
        max_pe_oi = max((o.get('oi', 0) for o in visible_pe_options), default=0)
        
        # Calculate OI percentage relative to visible range max
        for ce in visible_options:
            if ce['option_type'] == 'CE':
                if max_ce_oi > 0:
                    ce['oi_pct'] = (ce.get('oi', 0) / max_ce_oi) * 100
                else:
                    ce['oi_pct'] = 0
                    
        for pe in visible_options:
            if pe['option_type'] == 'PE':
                if max_pe_oi > 0:
                    pe['oi_pct'] = (pe.get('oi', 0) / max_pe_oi) * 100
                else:
                    pe['oi_pct'] = 0
        
        # Pass only visible OTM options to COA service for analysis
        otm_options = visible_ce_options + visible_pe_options

        # Run COA analysis (step_size already calculated above for visible range)

        coa_result = coa_service.analyze(
            options=otm_options,  # Use only OTM options for proper COA analysis
            spot_price=spot_price,
            atm_strike=atm_strike,
            step_size=step_size
        )
        
        # Store snapshot to database (fire and forget - don't block API)
        try:
            from datetime import datetime
            from sqlalchemy import text, select
            from core.database.models import InstrumentDB
            
            # Get symbol_id - first try live_data, then query instruments table
            symbol_id = live_data.get("symbol_id") or live_data.get("spot", {}).get("symbol_id")
            
            if not symbol_id:
                # Query from instruments table
                from app.config.database import AsyncSessionLocal
                async with AsyncSessionLocal() as temp_session:
                    result = await temp_session.execute(
                        select(InstrumentDB.symbol_id).where(InstrumentDB.symbol == symbol.upper()).limit(1)
                    )
                    symbol_id = result.scalar_one_or_none()
            
            if symbol_id:
                scenario = coa_result.get('scenario', {})
                support = coa_result.get('support', {})
                resistance = coa_result.get('resistance', {})
                levels = coa_result.get('levels', {})
                
                stmt = text("""
                    INSERT INTO coa_history (
                        timestamp, symbol_id, expiry,
                        scenario_id, scenario_name, scenario_bias,
                        support_strength, support_strike, support_oi, support_oi_change,
                        resistance_strength, resistance_strike, resistance_oi, resistance_oi_change,
                        eos, eor, spot_price, atm_strike, trade_at_eos, trade_at_eor
                    ) VALUES (
                        NOW(), :symbol_id, :expiry,
                        :scenario_id, :scenario_name, :scenario_bias,
                        :support_strength, :support_strike, :support_oi, :support_oi_change,
                        :resistance_strength, :resistance_strike, :resistance_oi, :resistance_oi_change,
                        :eos, :eor, :spot_price, :atm_strike, :trade_at_eos, :trade_at_eor
                    )
                """)
                
                # Use db session from dependency
                from app.config.database import AsyncSessionLocal
                async with AsyncSessionLocal() as session:
                    # Check last entry to prevent duplicate saving
                    last_entry_result = await session.execute(
                        text("""
                            SELECT 
                                scenario_id, scenario_bias, 
                                support_strength, support_strike,
                                resistance_strength, resistance_strike
                            FROM coa_history 
                            WHERE symbol_id = :symbol_id 
                            ORDER BY timestamp DESC 
                            LIMIT 1
                        """),
                        {'symbol_id': symbol_id}
                    )
                    last_entry = last_entry_result.fetchone()
                    
                    should_save = True
                    if last_entry:
                        # Compare critical fields
                        # Note: Check for exact matches. strikes are compared as floats/numbers
                        if (
                            last_entry.scenario_id == str(scenario.get('id', '?')) and
                            last_entry.scenario_bias == str(scenario.get('bias', 'unknown')) and
                            last_entry.support_strength == str(support.get('strength', 'Unknown')) and
                            last_entry.support_strike == float(support.get('strike100', 0)) and
                            last_entry.resistance_strength == str(resistance.get('strength', 'Unknown')) and
                            last_entry.resistance_strike == float(resistance.get('strike100', 0))
                        ):
                            should_save = False

                    if should_save:
                        await session.execute(stmt, {
                            'symbol_id': symbol_id,
                            'expiry': used_expiry,
                            'scenario_id': scenario.get('id', '?'),
                            'scenario_name': scenario.get('name', 'Unknown'),
                            'scenario_bias': scenario.get('bias', 'unknown'),
                            'support_strength': support.get('strength', 'Unknown'),
                            'support_strike': support.get('strike100'),
                            'support_oi': support.get('oi100'),
                            'support_oi_change': support.get('oichng100'),
                            'resistance_strength': resistance.get('strength', 'Unknown'),
                            'resistance_strike': resistance.get('strike100'),
                            'resistance_oi': resistance.get('oi100'),
                            'resistance_oi_change': resistance.get('oichng100'),
                            'eos': levels.get('eos'),
                            'eor': levels.get('eor'),
                            'spot_price': spot_price,
                            'atm_strike': atm_strike,
                            'trade_at_eos': levels.get('trade_at_eos', False),
                            'trade_at_eor': levels.get('trade_at_eor', False),
                        })
                        await session.commit()
                        logger.debug(f"Stored COA snapshot: {scenario.get('id')} for {symbol}")
                    else:
                        logger.debug(f"Skipping duplicate COA snapshot for {symbol}")
        except Exception as store_err:
            logger.warning(f"Failed to store COA snapshot: {store_err}")
            # Don't fail the API call if storage fails
        
        return {
            "success": True,
            "symbol": symbol.upper(),
            "expiry": used_expiry,
            "scenario": coa_result["scenario"],
            "support": coa_result["support"],
            "resistance": coa_result["resistance"],
            "levels": coa_result["levels"],
            "trading": coa_result["trading"],
            "spot_price": coa_result["spot_price"],
            "atm_strike": coa_result["atm_strike"],
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"COA analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"COA analysis failed: {str(e)}")


@router.get("/{symbol}/coa/scenarios")
async def get_all_scenarios():
    """
    Get reference for all 9 COA scenarios.
    """
    return {
        "success": True,
        "scenarios": [
            {"id": "1.0", "support": "Strong", "resistance": "Strong", "bias": "Neutral", "top": "EOR", "bottom": "EOS"},
            {"id": "1.1", "support": "Strong", "resistance": "WTB", "bias": "Bearish", "top": "R-1", "bottom": "EOS"},
            {"id": "1.2", "support": "Strong", "resistance": "WTT", "bias": "Bullish", "top": "EOR+1", "bottom": "EOS"},
            {"id": "1.3", "support": "WTB", "resistance": "Strong", "bias": "Bearish", "top": "EOR", "bottom": "S-1"},
            {"id": "1.4", "support": "WTT", "resistance": "Strong", "bias": "Bullish", "top": "EOR", "bottom": "S+1"},
            {"id": "1.5", "support": "WTB", "resistance": "WTB", "bias": "Blood Bath", "top": "None", "bottom": "None"},
            {"id": "1.6", "support": "WTT", "resistance": "WTT", "bias": "Bull Run", "top": "None", "bottom": "None"},
            {"id": "1.7", "support": "WTB", "resistance": "WTT", "bias": "Wait", "top": "None", "bottom": "None"},
            {"id": "1.8", "support": "WTT", "resistance": "WTB", "bias": "Wait", "top": "None", "bottom": "None"},
        ],
        "legend": {
            "S": "Support strike",
            "R": "Resistance strike",
            "EOS": "Extension of Support (S - PE LTP)",
            "EOR": "Extension of Resistance (R + CE LTP)",
            "+1/-1": "One strike step above/below",
            "WTT": "Weak Towards Top (gaining higher strike)",
            "WTB": "Weak Towards Bottom (losing to lower strike)",
        }
    }


@router.get("/{symbol}/coa/history")
async def get_coa_history(
    symbol: str,
    start_time: Optional[str] = Query(None, description="Start time (ISO format)"),
    end_time: Optional[str] = Query(None, description="End time (ISO format)"),
    interval: str = Query("5 minutes", description="Aggregation interval"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get COA history timeseries.
    
    Returns historical support/resistance strength changes for visualization.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import select, func, text, and_, desc
    from core.database.models import COAHistoryDB, InstrumentDB
    
    try:
        # Get symbol ID
        symbol_query = select(InstrumentDB.symbol_id).where(InstrumentDB.symbol == symbol.upper()).limit(1)
        result = await db.execute(symbol_query)
        symbol_id = result.scalar_one_or_none()
        
        if not symbol_id:
            raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
        
        # Parse time range (default: last 6 hours)
        if end_time:
            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
        else:
            end_dt = datetime.utcnow()
            
        if start_time:
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        else:
            start_dt = end_dt - timedelta(hours=6)
        
        # Query with time bucket aggregation
        query = text(f"""
            SELECT 
                time_bucket('{interval}', timestamp) AS bucket,
                LAST(scenario_id, timestamp) AS scenario_id,
                LAST(scenario_name, timestamp) AS scenario_name,
                LAST(scenario_bias, timestamp) AS scenario_bias,
                LAST(support_strength, timestamp) AS support_strength,
                LAST(support_strike, timestamp) AS support_strike,
                LAST(support_oi, timestamp) AS support_oi,
                LAST(resistance_strength, timestamp) AS resistance_strength,
                LAST(resistance_strike, timestamp) AS resistance_strike,
                LAST(resistance_oi, timestamp) AS resistance_oi,
                LAST(eos, timestamp) AS eos,
                LAST(eor, timestamp) AS eor,
                LAST(spot_price, timestamp) AS spot_price
            FROM coa_history
            WHERE symbol_id = :symbol_id
                AND timestamp >= :start_time
                AND timestamp <= :end_time
            GROUP BY bucket
            ORDER BY bucket ASC
        """)
        
        result = await db.execute(query, {
            'symbol_id': symbol_id,
            'start_time': start_dt,
            'end_time': end_dt,
        })
        rows = result.fetchall()
        
        history = []
        for row in rows:
            history.append({
                'timestamp': row.bucket.isoformat() if row.bucket else None,
                'scenario': {
                    'id': row.scenario_id,
                    'name': row.scenario_name,
                    'bias': row.scenario_bias,
                },
                'support': {
                    'strength': row.support_strength,
                    'strike': row.support_strike,
                    'oi': row.support_oi,
                },
                'resistance': {
                    'strength': row.resistance_strength,
                    'strike': row.resistance_strike,
                    'oi': row.resistance_oi,
                },
                'levels': {
                    'eos': row.eos,
                    'eor': row.eor,
                },
                'spot_price': row.spot_price,
            })
        
        return {
            'success': True,
            'symbol': symbol.upper(),
            'start_time': start_dt.isoformat(),
            'end_time': end_dt.isoformat(),
            'interval': interval,
            'count': len(history),
            'history': history,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"COA history failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"COA history failed: {str(e)}")


@router.get("/{symbol}/coa/history/export")
async def export_coa_history(
    symbol: str,
    format: str = Query("json", description="Export format: json or csv"),
    start_time: Optional[str] = Query(None, description="Start time (ISO format)"),
    end_time: Optional[str] = Query(None, description="End time (ISO format)"),
    interval: str = Query("5 minutes", description="Aggregation interval"),
    db: AsyncSession = Depends(get_db),
):
    """
    Export COA history data in CSV or JSON format.
    
    Returns downloadable file with historical COA data.
    """
    from datetime import datetime, timedelta
    from fastapi.responses import StreamingResponse, JSONResponse
    from sqlalchemy import text
    from core.database.models import InstrumentDB
    import io
    import csv
    import json
    
    try:
        # Get symbol ID
        symbol_query = select(InstrumentDB.symbol_id).where(InstrumentDB.symbol == symbol.upper()).limit(1)
        result = await db.execute(symbol_query)
        symbol_id = result.scalar_one_or_none()
        
        if not symbol_id:
            raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
        
        # Parse time range (default: last 24 hours for export)
        if end_time:
            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
        else:
            end_dt = datetime.utcnow()
            
        if start_time:
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        else:
            start_dt = end_dt - timedelta(hours=24)
        
        # Query with time bucket aggregation
        query = text(f"""
            SELECT 
                time_bucket('{interval}', timestamp) AS bucket,
                LAST(scenario_id, timestamp) AS scenario_id,
                LAST(scenario_name, timestamp) AS scenario_name,
                LAST(scenario_bias, timestamp) AS scenario_bias,
                LAST(support_strength, timestamp) AS support_strength,
                LAST(support_strike, timestamp) AS support_strike,
                LAST(support_oi, timestamp) AS support_oi,
                LAST(resistance_strength, timestamp) AS resistance_strength,
                LAST(resistance_strike, timestamp) AS resistance_strike,
                LAST(resistance_oi, timestamp) AS resistance_oi,
                LAST(eos, timestamp) AS eos,
                LAST(eor, timestamp) AS eor,
                LAST(spot_price, timestamp) AS spot_price,
                LAST(trade_at_eos, timestamp) AS trade_at_eos,
                LAST(trade_at_eor, timestamp) AS trade_at_eor
            FROM coa_history
            WHERE symbol_id = :symbol_id
                AND timestamp >= :start_time
                AND timestamp <= :end_time
            GROUP BY bucket
            ORDER BY bucket ASC
        """)
        
        result = await db.execute(query, {
            'symbol_id': symbol_id,
            'start_time': start_dt,
            'end_time': end_dt,
        })
        rows = result.fetchall()
        
        if format.lower() == "csv":
            # Generate CSV
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow([
                'timestamp', 'scenario_id', 'scenario_name', 'scenario_bias',
                'support_strength', 'support_strike', 'support_oi',
                'resistance_strength', 'resistance_strike', 'resistance_oi',
                'eos', 'eor', 'spot_price', 'trade_at_eos', 'trade_at_eor'
            ])
            
            # Write data
            for row in rows:
                writer.writerow([
                    row.bucket.isoformat() if row.bucket else '',
                    row.scenario_id or '',
                    row.scenario_name or '',
                    row.scenario_bias or '',
                    row.support_strength or '',
                    row.support_strike or '',
                    row.support_oi or '',
                    row.resistance_strength or '',
                    row.resistance_strike or '',
                    row.resistance_oi or '',
                    row.eos or '',
                    row.eor or '',
                    row.spot_price or '',
                    row.trade_at_eos or False,
                    row.trade_at_eor or False,
                ])
            
            output.seek(0)
            filename = f"coa_history_{symbol.upper()}_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}.csv"
            
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                }
            )
        
        else:  # JSON format
            history = []
            for row in rows:
                history.append({
                    'timestamp': row.bucket.isoformat() if row.bucket else None,
                    'scenario': {
                        'id': row.scenario_id,
                        'name': row.scenario_name,
                        'bias': row.scenario_bias,
                    },
                    'support': {
                        'strength': row.support_strength,
                        'strike': row.support_strike,
                        'oi': row.support_oi,
                    },
                    'resistance': {
                        'strength': row.resistance_strength,
                        'strike': row.resistance_strike,
                        'oi': row.resistance_oi,
                    },
                    'levels': {
                        'eos': row.eos,
                        'eor': row.eor,
                        'trade_at_eos': row.trade_at_eos,
                        'trade_at_eor': row.trade_at_eor,
                    },
                    'spot_price': row.spot_price,
                })
            
            export_data = {
                'symbol': symbol.upper(),
                'start_time': start_dt.isoformat(),
                'end_time': end_dt.isoformat(),
                'interval': interval,
                'count': len(history),
                'history': history,
            }
            
            filename = f"coa_history_{symbol.upper()}_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}.json"
            
            return StreamingResponse(
                iter([json.dumps(export_data, indent=2)]),
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"COA export failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"COA export failed: {str(e)}")



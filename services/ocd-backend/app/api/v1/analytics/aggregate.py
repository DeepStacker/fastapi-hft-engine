"""
Aggregate Analytics Endpoints

LOC Calculator-style aggregate views:
- COI (Change in OI) across strikes
- Total OI distribution
- PCR (Put-Call Ratio) analysis
- Percentage change views
"""
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.dependencies import OptionalUser
from app.services.dhan_client import get_dhan_client
from app.services.options import OptionsService
from app.cache.redis import get_redis, RedisCache
from app.repositories.historical import get_historical_repository

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Models ==============

class AggregateDataPoint(BaseModel):
    """Single point in aggregate data"""
    strike: float
    ce_value: float = 0
    pe_value: float = 0
    net_value: float = 0
    percentage: Optional[float] = None


class AggregateResponse(BaseModel):
    """Response for aggregate data views"""
    success: bool = True
    symbol: str
    expiry: str
    view_type: str
    data: List[dict]
    summary: dict = {}


# ============== Helper ==============

async def get_analytics_service(cache: RedisCache = Depends(get_redis)) -> OptionsService:
    dhan = await get_dhan_client(cache=cache)
    return OptionsService(dhan_client=dhan, cache=cache)


# Removed generate_mock_aggregate_data - using DB fallback instead


# ============== COI Endpoint ==============

from sqlalchemy.ext.asyncio import AsyncSession
from app.config.database import get_db


# ... (keep existing imports)

@router.get("/aggregate/coi/{symbol}/{expiry}")
async def get_aggregate_coi(
    symbol: str,
    expiry: str,
    top_n: int = Query(30, ge=10, le=50),
    current_user: OptionalUser = None,
    db: AsyncSession = Depends(get_db),
    service: OptionsService = Depends(get_analytics_service),
):
    """
    Get Change in OI (COI) aggregated across all strikes.
    Similar to LOC Calculator's "COi" and "Overall COi" views.
    """
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(
            symbol=symbol, expiry=expiry, include_greeks=False, include_reversal=False
        )
        
        oc_data = live_data.get("oc", {})
        atm_strike = live_data.get("atm_strike", 0)
        
        # Fallback to DB if live data missing
        if not oc_data:
            repo = get_historical_repository(db)
            symbol_id = await repo.get_symbol_id(symbol)
            if symbol_id:
                snapshot = await repo.get_latest_snapshot(symbol_id)
                if snapshot and snapshot.option_chain:
                    oc_data = snapshot.option_chain
                    atm_strike = snapshot.atm_strike or 0

        if not oc_data:
            # Final fallback to empty response instead of mock data
            return {
                "success": False,
                "error": "No data available",
                "symbol": symbol,
                "expiry": expiry,
                "data": []
            }
        
        data = []
        total_ce_coi = 0
        total_pe_coi = 0
        
        for strike_key, strike_data in oc_data.items():
            try:
                strike = float(strike_key)
            except:
                continue
            
            ce = strike_data.get("ce", {})
            pe = strike_data.get("pe", {})
            
            ce_coi = ce.get("oichng", ce.get("oi_change", 0)) or 0
            pe_coi = pe.get("oichng", pe.get("oi_change", 0)) or 0
            
            total_ce_coi += ce_coi
            total_pe_coi += pe_coi
            
            data.append({
                "strike": strike,
                "ce_coi": ce_coi,
                "pe_coi": pe_coi,
                "net_coi": pe_coi - ce_coi,
                "ce_oi": ce.get("OI", ce.get("oi", 0)) or 0,
                "pe_oi": pe.get("OI", pe.get("oi", 0)) or 0,
                "is_atm": abs(strike - atm_strike) < 100,
            })
        
        data.sort(key=lambda x: abs(x["ce_coi"]) + abs(x["pe_coi"]), reverse=True)
        data = data[:top_n]
        data.sort(key=lambda x: x["strike"])
        
        cumulative_ce = 0
        cumulative_pe = 0
        for item in data:
            cumulative_ce += item["ce_coi"]
            cumulative_pe += item["pe_coi"]
            item["cumulative_ce_coi"] = cumulative_ce
            item["cumulative_pe_coi"] = cumulative_pe
            item["cumulative_net"] = cumulative_pe - cumulative_ce
        
        net_coi = total_pe_coi - total_ce_coi
        
        return {
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "view_type": "coi",
            "data": data,
            "summary": {
                "total_ce_coi": total_ce_coi,
                "total_pe_coi": total_pe_coi,
                "net_coi": net_coi,
                "atm_strike": atm_strike,
                "signal": "BULLISH" if net_coi > 0 else "BEARISH",
            }
        }
    except Exception as e:
        logger.error(f"Error getting aggregate COI: {e}")
        return {"success": False, "error": str(e), "symbol": symbol, "expiry": expiry, "data": []}


# ============== Total OI Endpoint ==============

@router.get("/aggregate/oi/{symbol}/{expiry}")
async def get_aggregate_oi(
    symbol: str,
    expiry: str,
    top_n: int = Query(30, ge=10, le=50),
    current_user: OptionalUser = None,
    db: AsyncSession = Depends(get_db),
    service: OptionsService = Depends(get_analytics_service),
):
    """Get total OI aggregated across all strikes."""
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(
            symbol=symbol, expiry=expiry, include_greeks=False, include_reversal=False
        )
        
        oc_data = live_data.get("oc", {})
        atm_strike = live_data.get("atm_strike", 0)
        
        # Fallback to DB if live data missing
        if not oc_data:
            repo = get_historical_repository(db)
            symbol_id = await repo.get_symbol_id(symbol)
            if symbol_id:
                snapshot = await repo.get_latest_snapshot(symbol_id)
                if snapshot and snapshot.option_chain:
                    oc_data = snapshot.option_chain
                    atm_strike = snapshot.atm_strike or 0

        if not oc_data:
            return {
                "success": False,
                "error": "No data available",
                "symbol": symbol,
                "expiry": expiry,
                "data": []
            }
        
        data = []
        total_ce_oi = 0
        total_pe_oi = 0
        
        for strike_key, strike_data in oc_data.items():
            try:
                strike = float(strike_key)
            except:
                continue
            
            ce = strike_data.get("ce", {})
            pe = strike_data.get("pe", {})
            
            ce_oi = ce.get("OI", ce.get("oi", 0)) or 0
            pe_oi = pe.get("OI", pe.get("oi", 0)) or 0
            
            total_ce_oi += ce_oi
            total_pe_oi += pe_oi
            
            data.append({
                "strike": strike,
                "ce_oi": ce_oi,
                "pe_oi": pe_oi,
                "total_oi": ce_oi + pe_oi,
                "pcr": round(pe_oi / ce_oi, 2) if ce_oi > 0 else 0,
                "is_atm": abs(strike - atm_strike) < 100,
            })
        
        data.sort(key=lambda x: x["total_oi"], reverse=True)
        data = data[:top_n]
        data.sort(key=lambda x: x["strike"])
        
        pcr = round(total_pe_oi / total_ce_oi, 2) if total_ce_oi > 0 else 0
        
        return {
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "view_type": "oi",
            "data": data,
            "summary": {
                "total_ce_oi": total_ce_oi,
                "total_pe_oi": total_pe_oi,
                "total_oi": total_ce_oi + total_pe_oi,
                "pcr": pcr,
                "atm_strike": atm_strike,
            }
        }
    except Exception as e:
        logger.error(f"Error getting aggregate OI: {e}")

        return {"success": False, "error": str(e)}


# ============== PCR Endpoint ==============

@router.get("/aggregate/pcr/{symbol}/{expiry}")
async def get_aggregate_pcr(
    symbol: str,
    expiry: str,
    current_user: OptionalUser = None,
    db: AsyncSession = Depends(get_db),
    service: OptionsService = Depends(get_analytics_service),
):
    """Get PCR (Put-Call Ratio) data across all strikes."""
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(
            symbol=symbol, expiry=expiry, include_greeks=False, include_reversal=False
        )
        
        oc_data = live_data.get("oc", {})
        atm_strike = live_data.get("atm_strike", 0)
        
        # Fallback to DB if live data missing
        if not oc_data:
            repo = get_historical_repository(db)
            symbol_id = await repo.get_symbol_id(symbol)
            if symbol_id:
                snapshot = await repo.get_latest_snapshot(symbol_id)
                if snapshot and snapshot.option_chain:
                    oc_data = snapshot.option_chain
                    atm_strike = snapshot.atm_strike or 0
        
        if not oc_data:
            return {"success": False, "error": "No data available"}
        
        data = []
        total_ce_oi = 0
        total_pe_oi = 0
        total_ce_vol = 0
        total_pe_vol = 0
        
        for strike_key, strike_data in oc_data.items():
            try:
                strike = float(strike_key)
            except:
                continue
            
            ce = strike_data.get("ce", {})
            pe = strike_data.get("pe", {})
            
            ce_oi = ce.get("OI", ce.get("oi", 0)) or 0
            pe_oi = pe.get("OI", pe.get("oi", 0)) or 0
            ce_vol = ce.get("volume", ce.get("vol", 0)) or 0
            pe_vol = pe.get("volume", pe.get("vol", 0)) or 0
            
            total_ce_oi += ce_oi
            total_pe_oi += pe_oi
            total_ce_vol += ce_vol
            total_pe_vol += pe_vol
            
            data.append({
                "strike": strike,
                "oi_pcr": round(pe_oi / ce_oi, 2) if ce_oi > 0 else 0,
                "vol_pcr": round(pe_vol / ce_vol, 2) if ce_vol > 0 else 0,
                "is_atm": abs(strike - atm_strike) < 100,
            })
        
        data.sort(key=lambda x: x["strike"])
        
        overall_oi_pcr = round(total_pe_oi / total_ce_oi, 2) if total_ce_oi > 0 else 0
        overall_vol_pcr = round(total_pe_vol / total_ce_vol, 2) if total_ce_vol > 0 else 0
        
        return {
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "view_type": "pcr",
            "data": data,
            "summary": {
                "oi_pcr": overall_oi_pcr,
                "vol_pcr": overall_vol_pcr,
                "atm_strike": atm_strike,
                "signal": "BULLISH" if overall_oi_pcr > 1 else "BEARISH",
            }
        }
    except Exception as e:
        logger.error(f"Error getting PCR: {e}")
        return {"success": False, "error": str(e)}


# ============== Percentage Change ==============

@router.get("/aggregate/percentage/{symbol}/{expiry}")
async def get_aggregate_percentage(
    symbol: str,
    expiry: str,
    current_user: OptionalUser = None,
    db: AsyncSession = Depends(get_db),
    service: OptionsService = Depends(get_analytics_service),
):
    """Get percentage change view for OI and Volume."""
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(
            symbol=symbol, expiry=expiry, include_greeks=False, include_reversal=False
        )
        
        oc_data = live_data.get("oc", {})
        atm_strike = live_data.get("atm_strike", 0)
        
        # Fallback to DB if live data missing
        if not oc_data:
            repo = get_historical_repository(db)
            symbol_id = await repo.get_symbol_id(symbol)
            if symbol_id:
                snapshot = await repo.get_latest_snapshot(symbol_id)
                if snapshot and snapshot.option_chain:
                    oc_data = snapshot.option_chain
                    atm_strike = snapshot.atm_strike or 0
        
        if not oc_data:
            return {"success": False, "error": "No data available"}
        
        data = []
        
        for strike_key, strike_data in oc_data.items():
            try:
                strike = float(strike_key)
            except:
                continue
            
            ce = strike_data.get("ce", {})
            pe = strike_data.get("pe", {})
            
            ce_oi = ce.get("OI", ce.get("oi", 0)) or 0
            pe_oi = pe.get("OI", pe.get("oi", 0)) or 0
            ce_coi = ce.get("oichng", 0) or 0
            pe_coi = pe.get("oichng", 0) or 0
            
            ce_pct = round((ce_coi / ce_oi) * 100, 2) if ce_oi > 0 else 0
            pe_pct = round((pe_coi / pe_oi) * 100, 2) if pe_oi > 0 else 0
            
            data.append({
                "strike": strike,
                "ce_oi_pct": ce_pct,
                "pe_oi_pct": pe_pct,
                "is_atm": abs(strike - atm_strike) < 100,
            })
        
        data.sort(key=lambda x: x["strike"])
        
        return {
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "view_type": "percentage",
            "data": data,
            "summary": {"atm_strike": atm_strike}
        }
    except Exception as e:
        logger.error(f"Error getting percentage: {e}")
        return {"success": False, "error": str(e)}

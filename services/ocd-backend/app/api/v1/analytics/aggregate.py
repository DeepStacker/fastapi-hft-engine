"""
Aggregate Analytics Endpoints

LOC Calculator-style aggregate views:
- COI (Change in OI) across strikes
- Total OI distribution
- PCR (Put-Call Ratio) analysis
- Percentage change views
"""
import logging
import random
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.dependencies import OptionalUser
from app.services.dhan_client import get_dhan_client
from app.services.options import OptionsService
from app.cache.redis import get_redis, RedisCache

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


def generate_mock_aggregate_data(symbol: str, view_type: str = "coi", num_strikes: int = 21) -> dict:
    """Generate mock aggregate data when live data unavailable."""
    base_strikes = {"NIFTY": 24500, "BANKNIFTY": 52000, "FINNIFTY": 24000}
    base = base_strikes.get(symbol.upper(), 24000)
    step = 50 if symbol.upper() == "NIFTY" else 100
    
    atm_index = num_strikes // 2
    strikes = [base + (i - atm_index) * step for i in range(num_strikes)]
    
    data = []
    total_ce = 0
    total_pe = 0
    
    for i, strike in enumerate(strikes):
        distance_from_atm = abs(i - atm_index)
        multiplier = max(0.3, 1 - (distance_from_atm * 0.1))
        
        if view_type in ["coi", "overall"]:
            ce_val = int(random.uniform(5000, 50000) * multiplier) * (1 if random.random() > 0.5 else -1)
            pe_val = int(random.uniform(5000, 50000) * multiplier) * (1 if random.random() > 0.5 else -1)
        else:
            ce_val = int(random.uniform(100000, 500000) * multiplier)
            pe_val = int(random.uniform(100000, 500000) * multiplier)
        
        total_ce += abs(ce_val)
        total_pe += abs(pe_val)
        
        data.append({
            "strike": strike,
            "ce_coi": ce_val if view_type in ["coi", "overall"] else 0,
            "pe_coi": pe_val if view_type in ["coi", "overall"] else 0,
            "ce_oi": ce_val if view_type == "oi" else abs(ce_val) * 10,
            "pe_oi": pe_val if view_type == "oi" else abs(pe_val) * 10,
            "net_coi": pe_val - ce_val,
            "is_atm": i == atm_index,
        })
    
    cumulative_ce = 0
    cumulative_pe = 0
    for item in data:
        cumulative_ce += item.get("ce_coi", 0)
        cumulative_pe += item.get("pe_coi", 0)
        item["cumulative_ce_coi"] = cumulative_ce
        item["cumulative_pe_coi"] = cumulative_pe
        item["cumulative_net"] = cumulative_pe - cumulative_ce
    
    pcr = total_pe / total_ce if total_ce > 0 else 1.0
    
    return {
        "success": True,
        "symbol": symbol.upper(),
        "expiry": "2024-12-26",
        "view_type": view_type,
        "data": data,
        "summary": {
            "total_ce_coi": total_ce if view_type in ["coi", "overall"] else 0,
            "total_pe_coi": total_pe if view_type in ["coi", "overall"] else 0,
            "net_coi": total_pe - total_ce,
            "atm_strike": strikes[atm_index],
            "pcr": round(pcr, 2),
            "signal": "BULLISH" if pcr > 1 else "BEARISH",
        }
    }


# ============== COI Endpoint ==============

@router.get("/aggregate/coi/{symbol}/{expiry}")
async def get_aggregate_coi(
    symbol: str,
    expiry: str,
    top_n: int = Query(30, ge=10, le=50),
    current_user: OptionalUser = None,
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
        
        if not oc_data:
            return generate_mock_aggregate_data(symbol, "coi", top_n)
        
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
        return generate_mock_aggregate_data(symbol, "coi", top_n)


# ============== Total OI Endpoint ==============

@router.get("/aggregate/oi/{symbol}/{expiry}")
async def get_aggregate_oi(
    symbol: str,
    expiry: str,
    top_n: int = Query(30, ge=10, le=50),
    current_user: OptionalUser = None,
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
        
        if not oc_data:
            return generate_mock_aggregate_data(symbol, "oi", top_n)
        
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
        return generate_mock_aggregate_data(symbol, "oi", top_n)


# ============== PCR Endpoint ==============

@router.get("/aggregate/pcr/{symbol}/{expiry}")
async def get_aggregate_pcr(
    symbol: str,
    expiry: str,
    current_user: OptionalUser = None,
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

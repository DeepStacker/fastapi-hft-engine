"""
Strike Analysis and Reversal Level Endpoints

Provides:
- Comprehensive strike analysis with Greeks and signals
- LOC Calculator-style precise reversal levels
- Futures summary
- OI distribution 
- Max pain calculation
- IV skew analysis
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from app.core.dependencies import OptionalUser
from app.services.dhan_client import get_dhan_client
from app.services.options import OptionsService
from app.cache.redis import get_redis, RedisCache

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Models ==============

class StrikeAnalysisResponse(BaseModel):
    """Comprehensive strike analysis"""
    success: bool = True
    strike: float
    symbol: str
    expiry: str
    call: dict
    put: dict
    reversal_levels: dict
    trading_signals: dict
    market_regime: dict
    support_resistance: dict


class ReversalLevelsResponse(BaseModel):
    """LOC Calculator-style precise reversal levels"""
    success: bool = True
    strike: float
    symbol: str
    expiry: str
    spot_price: float
    futures_price: float
    atm_strike: float
    spot_levels: dict
    future_levels: dict
    ltp_levels: dict
    straddle: float
    expected_range: float
    calculation_details: dict


class FuturesSummaryResponse(BaseModel):
    """Futures contracts summary"""
    success: bool = True
    symbol: str
    contracts: list
    total_oi: int
    total_volume: int


class OIDistributionResponse(BaseModel):
    """OI distribution across strikes"""
    success: bool = True
    symbol: str
    expiry: str
    distribution: list
    max_oi_ce: dict
    max_oi_pe: dict
    pcr: float


# ============== Helper ==============

async def get_analytics_service(cache: RedisCache = Depends(get_redis)) -> OptionsService:
    dhan = await get_dhan_client(cache=cache)
    return OptionsService(dhan_client=dhan, cache=cache)


# ============== Strike Analysis ==============

@router.get("/strike/{symbol}/{strike}")
async def get_strike_analysis(
    symbol: str,
    strike: float,
    expiry: str = Query(..., description="Expiry timestamp"),
    current_user: OptionalUser = None,
    service: OptionsService = Depends(get_analytics_service),
) -> StrikeAnalysisResponse:
    """Get comprehensive analysis for a single strike."""
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(
            symbol=symbol, expiry=expiry, include_greeks=True, include_reversal=True
        )
        
        strike_key = f"{strike:.6f}"
        strike_data = live_data.get("oc", {}).get(strike_key, {})
        
        if not strike_data:
            strike_data = live_data.get("oc", {}).get(str(int(strike)), {})
        
        if not strike_data:
            raise HTTPException(status_code=404, detail=f"Strike {strike} not found")
        
        return StrikeAnalysisResponse(
            strike=strike,
            symbol=symbol,
            expiry=expiry,
            call=strike_data.get("ce", {}),
            put=strike_data.get("pe", {}),
            reversal_levels={
                "daily": strike_data.get("reversal"),
                "weekly": strike_data.get("wkly_reversal"),
                "futures": strike_data.get("fut_reversal"),
            },
            trading_signals=strike_data.get("trading_signals", {}),
            market_regime=strike_data.get("market_regimes", {}),
            support_resistance={
                "resistance": strike_data.get("rs"),
                "support": strike_data.get("ss"),
                "range_resistance": strike_data.get("rr"),
                "sr_diff": strike_data.get("sr_diff"),
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting strike analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Reversal Levels (LOC Style) ==============

@router.get("/reversal/{symbol}/{strike}")
async def get_precise_reversal(
    symbol: str,
    strike: float,
    expiry: str = Query(..., description="Expiry timestamp"),
    current_user: OptionalUser = None,
    service: OptionsService = Depends(get_analytics_service),
) -> ReversalLevelsResponse:
    """Get precise Support/Resistance levels - LOC Calculator Style."""
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(
            symbol=symbol, expiry=expiry, include_greeks=True, include_reversal=True
        )
        
        oc_data = live_data.get("oc", {})
        spot = live_data.get("spot", {}).get("ltp", 0)
        atm_strike = live_data.get("atm_strike", 0)
        
        futures_data = live_data.get("future", {})
        futures_ltp = 0
        days_to_expiry = 0
        for exp_ts, fut in futures_data.items():
            if fut.get("ltp"):
                futures_ltp = fut.get("ltp", 0)
                days_to_expiry = fut.get("daystoexp", 0)
                break
        
        strike_key = f"{strike:.6f}"
        strike_data = oc_data.get(strike_key, oc_data.get(str(int(strike)), {}))
        
        if not strike_data:
            raise HTTPException(status_code=404, detail=f"Strike {strike} not found")
        
        ce = strike_data.get("ce", {})
        pe = strike_data.get("pe", {})
        ce_ltp = ce.get("ltp", 0) or 0
        pe_ltp = pe.get("ltp", 0) or 0
        
        atm_key = f"{atm_strike:.6f}"
        atm_data = oc_data.get(atm_key, oc_data.get(str(int(atm_strike)), {}))
        atm_ce_ltp = atm_data.get("ce", {}).get("ltp", 0) or 0
        atm_pe_ltp = atm_data.get("pe", {}).get("ltp", 0) or 0
        atm_straddle = atm_ce_ltp + atm_pe_ltp
        
        # SPOT-based levels
        spot_resistance = spot + atm_ce_ltp if spot > 0 else 0
        spot_support = spot - atm_pe_ltp if spot > 0 else 0
        
        # FUTURE-based levels
        cost_of_carry = (futures_ltp - spot) / spot if spot > 0 else 0
        future_resistance = futures_ltp + (atm_ce_ltp * (1 + cost_of_carry)) if futures_ltp > 0 else 0
        future_support = futures_ltp - (atm_pe_ltp * (1 + cost_of_carry)) if futures_ltp > 0 else 0
        
        # LTP-based levels
        ltp_resistance = strike + ce_ltp
        ltp_support = strike - pe_ltp
        
        # Time decay adjustment
        decay_factor = 1.0
        if days_to_expiry == 0:
            now = datetime.now()
            market_close = now.replace(hour=15, minute=30, second=0)
            market_open = now.replace(hour=9, minute=15, second=0)
            if market_open <= now <= market_close:
                time_remaining = (market_close - now).seconds / 3600
                total_session = 6.25
                decay_factor = 0.3 + (time_remaining / total_session) * 0.7
        elif days_to_expiry == 1:
            decay_factor = 0.8
        
        expected_range = atm_straddle * decay_factor
        
        return ReversalLevelsResponse(
            strike=strike,
            symbol=symbol,
            expiry=expiry,
            spot_price=round(spot, 2),
            futures_price=round(futures_ltp, 2),
            atm_strike=atm_strike,
            spot_levels={
                "resistance": round(spot_resistance, 2),
                "support": round(spot_support, 2),
            },
            future_levels={
                "resistance": round(future_resistance, 2),
                "support": round(future_support, 2),
            },
            ltp_levels={
                "resistance": round(ltp_resistance, 2),
                "support": round(ltp_support, 2),
                "breakeven_up": round(strike + ce_ltp + pe_ltp, 2),
                "breakeven_down": round(strike - ce_ltp - pe_ltp, 2),
            },
            straddle=round(atm_straddle, 2),
            expected_range=round(expected_range, 2),
            calculation_details={
                "atm_ce_ltp": round(atm_ce_ltp, 2),
                "atm_pe_ltp": round(atm_pe_ltp, 2),
                "ce_ltp": round(ce_ltp, 2),
                "pe_ltp": round(pe_ltp, 2),
                "days_to_expiry": days_to_expiry,
                "decay_factor": round(decay_factor, 2),
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating reversal levels: {e}")
        return ReversalLevelsResponse(
            strike=strike, symbol=symbol, expiry=expiry,
            spot_price=0, futures_price=0, atm_strike=0,
            spot_levels={"resistance": 0, "support": 0},
            future_levels={"resistance": 0, "support": 0},
            ltp_levels={"resistance": 0, "support": 0},
            straddle=0, expected_range=0,
            calculation_details={"error": str(e)}
        )


# ============== Futures Summary ==============

@router.get("/futures/{symbol}")
async def get_futures_summary(
    symbol: str,
    current_user: OptionalUser = None,
    service: OptionsService = Depends(get_analytics_service),
) -> FuturesSummaryResponse:
    """Get summary of all futures contracts for a symbol."""
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(symbol=symbol, expiry="")
        futures = live_data.get("future", {})
        
        contracts = []
        total_oi = 0
        total_volume = 0
        
        for exp_ts, fut_data in futures.items():
            total_oi += fut_data.get("oi", 0)
            total_volume += fut_data.get("vol", 0)
            
            contracts.append({
                "expiry": exp_ts,
                "symbol": fut_data.get("sym", ""),
                "ltp": fut_data.get("ltp", 0),
                "change": fut_data.get("pch", 0),
                "change_percent": fut_data.get("prch", 0),
                "oi": fut_data.get("oi", 0),
                "oi_change": fut_data.get("oichng", 0),
                "volume": fut_data.get("vol", 0),
                "lot_size": fut_data.get("lot", 0),
                "days_to_expiry": fut_data.get("daystoexp", 0),
            })
        
        contracts.sort(key=lambda x: x.get("days_to_expiry", 999))
        
        return FuturesSummaryResponse(
            symbol=symbol,
            contracts=contracts,
            total_oi=total_oi,
            total_volume=total_volume
        )
    except Exception as e:
        logger.error(f"Error getting futures summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== OI Distribution ==============

@router.get("/oi-distribution/{symbol}/{expiry}")
async def get_oi_distribution(
    symbol: str,
    expiry: str,
    top_n: int = Query(20, ge=5, le=50),
    current_user: OptionalUser = None,
    service: OptionsService = Depends(get_analytics_service),
) -> OIDistributionResponse:
    """Get OI distribution across strikes for visualization."""
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(
            symbol=symbol, expiry=expiry, include_greeks=False, include_reversal=False
        )
        
        oc_data = live_data.get("oc", {})
        distribution = []
        max_ce_oi = {"strike": 0, "oi": 0}
        max_pe_oi = {"strike": 0, "oi": 0}
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
            
            if ce_oi > max_ce_oi["oi"]:
                max_ce_oi = {"strike": strike, "oi": ce_oi}
            if pe_oi > max_pe_oi["oi"]:
                max_pe_oi = {"strike": strike, "oi": pe_oi}
            
            distribution.append({
                "strike": strike,
                "ce_oi": ce_oi,
                "pe_oi": pe_oi,
                "ce_oi_change": ce.get("oichng", 0) or 0,
                "pe_oi_change": pe.get("oichng", 0) or 0,
                "pcr": round(pe_oi / ce_oi, 3) if ce_oi > 0 else 0,
            })
        
        distribution.sort(key=lambda x: x["ce_oi"] + x["pe_oi"], reverse=True)
        distribution = distribution[:top_n]
        distribution.sort(key=lambda x: x["strike"])
        
        pcr = round(total_pe_oi / total_ce_oi, 3) if total_ce_oi > 0 else 0
        
        return OIDistributionResponse(
            symbol=symbol, expiry=expiry, distribution=distribution,
            max_oi_ce=max_ce_oi, max_oi_pe=max_pe_oi, pcr=pcr
        )
    except Exception as e:
        logger.error(f"Error getting OI distribution: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Max Pain ==============

@router.get("/maxpain/{symbol}/{expiry}")
async def get_max_pain_analysis(
    symbol: str,
    expiry: str,
    current_user: OptionalUser = None,
    service: OptionsService = Depends(get_analytics_service),
):
    """Get max pain calculation with detailed breakdown."""
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(
            symbol=symbol, expiry=expiry, include_greeks=False, include_reversal=False
        )
        
        max_pain = live_data.get("max_pain_strike", 0)
        spot = live_data.get("spot", {}).get("ltp", 0)
        
        return {
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "max_pain_strike": max_pain,
            "current_spot": spot,
            "distance_to_max_pain": round(spot - max_pain, 2) if spot and max_pain else None,
        }
    except Exception as e:
        logger.error(f"Error calculating max pain: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== IV Skew ==============

@router.get("/iv-skew/{symbol}/{expiry}")
async def get_iv_skew(
    symbol: str,
    expiry: str,
    current_user: OptionalUser = None,
    service: OptionsService = Depends(get_analytics_service),
):
    """Get IV skew across strikes for visualization."""
    symbol = symbol.upper()
    
    try:
        live_data = await service.get_live_data(
            symbol=symbol, expiry=expiry, include_greeks=True, include_reversal=False
        )
        
        oc_data = live_data.get("oc", {})
        atm_strike = live_data.get("atm_strike", 0)
        skew_data = []
        
        for strike_key, strike_data in oc_data.items():
            try:
                strike = float(strike_key)
            except:
                continue
            
            ce_iv = strike_data.get("ce", {}).get("iv", 0) or 0
            pe_iv = strike_data.get("pe", {}).get("iv", 0) or 0
            
            skew_data.append({
                "strike": strike,
                "ce_iv": round(ce_iv, 2),
                "pe_iv": round(pe_iv, 2),
                "avg_iv": round((ce_iv + pe_iv) / 2, 2) if ce_iv and pe_iv else 0,
                "skew": round(pe_iv - ce_iv, 2),
                "is_atm": abs(strike - atm_strike) < 100,
            })
        
        skew_data.sort(key=lambda x: x["strike"])
        
        return {
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "atm_strike": atm_strike,
            "iv_data": skew_data,
        }
    except Exception as e:
        logger.error(f"Error getting IV skew: {e}")
        raise HTTPException(status_code=500, detail=str(e))

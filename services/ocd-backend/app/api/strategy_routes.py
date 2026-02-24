"""
Strategy Optimization API Routes

Endpoints:
- POST /strategies/optimize - Get optimized leg structures
- POST /strategies/recommend - Get strategy type recommendations
"""
import logging
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.leg_optimizer import (
    LegOptimizer, get_leg_optimizer,
    RiskProfile, StrategyType, OptimizedStructure
)
from app.services.options import OptionsService, get_options_service
from app.services.coa_service import get_coa_service
from app.config.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strategies", tags=["Strategy Optimization"])


# ========================================
# REQUEST/RESPONSE SCHEMAS
# ========================================

class OptimizeRequest(BaseModel):
    """Request for strategy optimization."""
    strategy_type: str = Field(..., description="Strategy type (e.g., iron_condor)")
    symbol: str = Field(default="NIFTY", description="Underlying symbol")
    expiry: Union[str, int] = Field(..., description="Expiry date string or timestamp")
    risk_profile: str = Field(default="moderate", description="Risk profile: conservative, moderate, aggressive")
    max_capital: float = Field(default=100000, ge=10000, description="Maximum capital to allocate (₹)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "strategy_type": "iron_condor",
                "symbol": "NIFTY",
                "expiry": "27-02-2025",
                "risk_profile": "moderate",
                "max_capital": 100000
            }
        }


class RecommendRequest(BaseModel):
    """Request for strategy recommendations."""
    symbol: str = Field(default="NIFTY")
    expiry: Union[str, int] = Field(...)
    risk_profile: str = Field(default="moderate")
    iv_percentile: Optional[float] = Field(default=None, description="Current IV percentile (0-100)")
    pcr: Optional[float] = Field(default=None, description="Put-Call Ratio")


class LegResponse(BaseModel):
    """Single leg in response."""
    strike: float
    option_type: str
    action: str
    qty: int
    lot_size: int
    ltp: float
    iv: float
    delta: float
    gamma: float
    theta: float
    vega: float
    total_qty: int
    premium_value: float


class MetricsResponse(BaseModel):
    """Strategy metrics in response."""
    max_profit: float
    max_loss: float
    net_credit: float
    probability_of_profit: float
    breakevens: List[float]
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float
    risk_reward_ratio: float
    margin_required: float
    capital_at_risk: float


class StructureResponse(BaseModel):
    """Complete optimized structure response."""
    strategy_type: str
    legs: List[LegResponse]
    metrics: MetricsResponse
    rationale: str
    confidence: float
    market_context: dict
    generated_at: str


class OptimizeResponse(BaseModel):
    """Response for optimization endpoint."""
    success: bool
    structures: List[StructureResponse]
    message: str = ""


class RecommendResponse(BaseModel):
    """Response for recommendation endpoint."""
    success: bool
    recommended_strategies: List[str]
    market_analysis: dict
    message: str = ""


class AutoGenerateRequest(BaseModel):
    """Request for intelligent auto-strategy generation."""
    symbol: str = Field(default="NIFTY", description="Underlying symbol")
    risk_profile: str = Field(default="moderate", description="Risk profile: conservative, moderate, aggressive")
    max_capital: float = Field(default=100000, ge=10000, description="Maximum capital to allocate (₹)")
    # Optional overrides - if not provided, system chooses automatically
    strategy_type: Optional[str] = Field(default=None, description="Optional strategy type override")
    expiry: Optional[str] = Field(default=None, description="Optional expiry override (auto-selects if not provided)")
    include_calendar_spread: bool = Field(default=True, description="Include calendar spreads when IV is high")
    
    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "NIFTY",
                "risk_profile": "moderate",
                "max_capital": 100000,
                "include_calendar_spread": True
            }
        }


class CalendarSpreadLeg(BaseModel):
    """Calendar spread leg with expiry info."""
    strike: float
    option_type: str
    action: str
    expiry: str
    expiry_label: str  # "Near Term" or "Far Term"
    ltp: float
    iv: float
    dte: int


class AutoGenerateResponse(BaseModel):
    """Response for auto-generate endpoint."""
    success: bool
    strategy_name: str
    strategy_type: str
    iv_regime: str  # "Low", "Normal", "High"
    sentiment: str  # "Bullish", "Bearish", "Neutral"
    is_calendar_spread: bool
    legs: List[dict]  # Flexible to support both regular and calendar spread legs
    metrics: Optional[MetricsResponse] = None
    market_context: dict
    rationale: str
    confidence: float
    message: str = ""


# ========================================
# ENDPOINTS
# ========================================

@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_strategy(
    request: OptimizeRequest,
    options_service: OptionsService = Depends(get_options_service),
    optimizer: LegOptimizer = Depends(get_leg_optimizer)
):
    """
    Optimize strategy legs based on market data and user preferences.
    
    Returns one or more optimized structures with specific strikes,
    quantities, and comprehensive metrics.
    """
    try:
        # Validate strategy type
        try:
            strategy_type = StrategyType(request.strategy_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid strategy type: {request.strategy_type}. "
                       f"Valid types: {[s.value for s in StrategyType]}"
            )
        
        # Validate risk profile
        try:
            risk_profile = RiskProfile(request.risk_profile.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid risk profile: {request.risk_profile}. "
                       f"Valid: conservative, moderate, aggressive"
            )
        
        # Fetch live options data
        live_data = await options_service.get_live_data(
            symbol=request.symbol,
            expiry=request.expiry,
            include_greeks=True,
            include_reversal=False,
            include_profiles=False
        )
        
        if not live_data or "oc" not in live_data:
            raise HTTPException(
                status_code=404,
                detail=f"No option chain data for {request.symbol} expiry {request.expiry}"
            )
        
        # Convert option chain format
        option_chain = []
        for strike_str, data in live_data["oc"].items():
            strike = float(strike_str)
            # Add CE
            if "ce" in data:
                ce = data["ce"]
                option_chain.append({
                    "strike": strike,
                    "option_type": "CE",
                    "ltp": ce.get("ltp", 0),
                    "oi": ce.get("oi", 0),
                    "oi_chng": ce.get("oi_chng", 0),
                    "volume": ce.get("vol", 0),
                    "iv": ce.get("iv", 15),
                    "delta": ce.get("delta", 0),
                    "gamma": ce.get("gamma", 0),
                    "theta": ce.get("theta", 0),
                    "vega": ce.get("vega", 0),
                    "oi_pct": ce.get("oi_pct", 0)
                })
            # Add PE
            if "pe" in data:
                pe = data["pe"]
                option_chain.append({
                    "strike": strike,
                    "option_type": "PE",
                    "ltp": pe.get("ltp", 0),
                    "oi": pe.get("oi", 0),
                    "oi_chng": pe.get("oi_chng", 0),
                    "volume": pe.get("vol", 0),
                    "iv": pe.get("iv", 15),
                    "delta": pe.get("delta", 0),
                    "gamma": pe.get("gamma", 0),
                    "theta": pe.get("theta", 0),
                    "vega": pe.get("vega", 0),
                    "oi_pct": pe.get("oi_pct", 0)
                })
        
        spot_price = live_data.get("sltp", 0)
        atm_strike = live_data.get("atm_strike", 0)
        lot_size = live_data.get("lot_size", 75)
        
        # Determine step size
        step_size = 50 if request.symbol.upper() == "NIFTY" else 100
        
        # Run optimization
        structures = optimizer.optimize(
            strategy_type=strategy_type,
            option_chain=option_chain,
            spot_price=spot_price,
            atm_strike=atm_strike,
            expiry=request.expiry,
            lot_size=lot_size,
            risk_profile=risk_profile,
            max_capital=request.max_capital,
            step_size=step_size
        )
        
        if not structures:
            return OptimizeResponse(
                success=False,
                structures=[],
                message="No valid structures found for current market conditions"
            )
        
        # Convert to response format
        response_structures = []
        for s in structures:
            legs = [
                LegResponse(
                    strike=leg.strike,
                    option_type=leg.option_type,
                    action=leg.action,
                    qty=leg.qty,
                    lot_size=leg.lot_size,
                    ltp=leg.ltp,
                    iv=leg.iv,
                    delta=leg.delta,
                    gamma=leg.gamma,
                    theta=leg.theta,
                    vega=leg.vega,
                    total_qty=leg.total_qty,
                    premium_value=leg.premium_value
                )
                for leg in s.legs
            ]
            
            metrics = MetricsResponse(
                max_profit=s.metrics.max_profit,
                max_loss=s.metrics.max_loss,
                net_credit=s.metrics.net_credit,
                probability_of_profit=s.metrics.probability_of_profit,
                breakevens=s.metrics.breakevens,
                net_delta=s.metrics.net_delta,
                net_gamma=s.metrics.net_gamma,
                net_theta=s.metrics.net_theta,
                net_vega=s.metrics.net_vega,
                risk_reward_ratio=s.metrics.risk_reward_ratio,
                margin_required=s.metrics.margin_required,
                capital_at_risk=s.metrics.capital_at_risk
            )
            
            response_structures.append(StructureResponse(
                strategy_type=s.strategy_type,
                legs=legs,
                metrics=metrics,
                rationale=s.rationale,
                confidence=s.confidence,
                market_context=s.market_context,
                generated_at=s.generated_at
            ))
        
        return OptimizeResponse(
            success=True,
            structures=response_structures,
            message=f"Found {len(response_structures)} optimized structure(s)"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Strategy optimization failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommend", response_model=RecommendResponse)
async def recommend_strategies(
    request: RecommendRequest,
    options_service: OptionsService = Depends(get_options_service),
    optimizer: LegOptimizer = Depends(get_leg_optimizer),
    db: AsyncSession = Depends(get_db)
):
    """
    Recommend suitable strategy types based on current market conditions.
    
    Analyzes IV percentile, PCR, and OI patterns to suggest strategies.
    """
    try:
        # Fetch live data if IV/PCR not provided
        iv_percentile = request.iv_percentile
        pcr = request.pcr
        
        if iv_percentile is None or pcr is None:
            live_data = await options_service.get_live_data(
                symbol=request.symbol,
                expiry=request.expiry,
                include_greeks=True,
                include_reversal=False,
                include_profiles=False
            )
            if live_data:
                if iv_percentile is None:
                    atmiv = live_data.get("atmiv", 15)
                    # Simplified percentile (NIFTY historical: 10-35)
                    iv_percentile = min(100, max(0, (atmiv - 10) / 25 * 100))
                if pcr is None:
                    pcr = live_data.get("pcr", 1.0)
        
        # Get option chain for analysis
        option_chain = []
        
        try:
            risk_profile = RiskProfile(request.risk_profile.lower())
        except ValueError:
            risk_profile = RiskProfile.MODERATE
        
        # Prepare market context
        iv_regime = "High" if (iv_percentile or 50) > 60 else "Low" if (iv_percentile or 50) < 40 else "Normal"
        sentiment = "Bullish" if (pcr or 1) > 1.2 else "Bearish" if (pcr or 1) < 0.8 else "Neutral"
        
        context = {
            "iv_regime": iv_regime,
            "bias": sentiment.lower(), # COA uses lowercase for some reason, aligning
            "iv_percentile": iv_percentile,
            "pcr": pcr
        }
        
        # Get recommendations (Async + Intelligent)
        recommendations = await optimizer.recommend_strategies(
            option_chain=option_chain,
            spot_price=0,
            atm_strike=0,
            iv_percentile=iv_percentile or 50,
            pcr=pcr or 1.0,
            risk_profile=risk_profile,
            db_session=db,
            market_context=context
        )
        
        return RecommendResponse(
            success=True,
            recommended_strategies=[r.value for r in recommendations],
            market_analysis={
                "iv_percentile": iv_percentile,
                "pcr": pcr,
                "iv_regime": iv_regime,
                "sentiment": sentiment
            },
            message="Strategies ranked by suitability for current conditions"
        )
        
    except Exception as e:
        logger.exception("Strategy recommendation failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/types")
async def list_strategy_types():
    """List all supported strategy types."""
    return {
        "strategy_types": [
            {
                "id": s.value,
                "name": s.value.replace("_", " ").title(),
                "description": _get_strategy_description(s)
            }
            for s in StrategyType
        ]
    }


def _get_strategy_description(s: StrategyType) -> str:
    """Get human-readable description for strategy type."""
    descriptions = {
        StrategyType.IRON_CONDOR: "Neutral strategy that profits from range-bound movement. Sells OTM call and put spreads.",
        StrategyType.BULL_PUT_SPREAD: "Bullish credit spread. Sells OTM put, buys lower put for protection.",
        StrategyType.BEAR_CALL_SPREAD: "Bearish credit spread. Sells OTM call, buys higher call for protection.",
        StrategyType.LONG_STRADDLE: "Volatility play. Buys ATM call and put for large moves in either direction.",
        StrategyType.SHORT_STRADDLE: "Premium collection. Sells ATM call and put. High risk, unlimited loss.",
        StrategyType.STRANGLE: "Similar to straddle but with OTM strikes. Lower premium, wider breakevens.",
        StrategyType.BULL_CALL_SPREAD: "Bullish debit spread. Buys call, sells higher call to reduce cost.",
        StrategyType.BEAR_PUT_SPREAD: "Bearish debit spread. Buys put, sells lower put to reduce cost.",
        StrategyType.JADE_LIZARD: "Naked put with bear call spread above. Collects premium with upside protection.",
        StrategyType.CUSTOM: "Custom multi-leg structure."
    }
    return descriptions.get(s, "")


@router.post("/auto-generate", response_model=AutoGenerateResponse)
async def auto_generate_strategy(
    request: AutoGenerateRequest,
    options_service: OptionsService = Depends(get_options_service),
    optimizer: LegOptimizer = Depends(get_leg_optimizer),
    db: AsyncSession = Depends(get_db)
):
    """
    Intelligent auto-strategy generation.
    
    Automatically detects market conditions and generates optimal strategy:
    - Analyzes IV regime (High/Normal/Low)
    - Detects market sentiment (Bullish/Neutral/Bearish)
    - Suggests calendar spreads when IV is rising
    - Auto-selects strikes based on OI walls
    - Returns fully populated legs with no manual configuration needed
    """
    logger.info(f"[AUTO-GEN] Starting auto-generate for {request.symbol}")
    try:
        # 1. Get expiry list if not provided
        logger.info("[AUTO-GEN] Step 1: Fetching expiry dates")
        expiry_response = await options_service.get_expiry_dates(request.symbol)
        expiry_list = expiry_response.get("expiry_dates", []) if expiry_response else []
        logger.info(f"[AUTO-GEN] Got {len(expiry_list)} expiries")
        
        if not expiry_list:
            return AutoGenerateResponse(
                success=False,
                strategy_name="No Data",
                strategy_type="none",
                iv_regime="Unknown",
                sentiment="Unknown",
                is_calendar_spread=False,
                legs=[],
                market_context={},
                rationale="No expiry dates available for the symbol",
                confidence=0,
                message="Failed to fetch expiry dates"
            )
        
        # Use first (nearest) expiry if not specified
        near_expiry = request.expiry if request.expiry else str(expiry_list[0])
        far_expiry = str(expiry_list[1]) if len(expiry_list) > 1 else near_expiry
        
        # 2. Fetch live data for near-term expiry
        # Performance optimization: Fetch WITHOUT Greeks (0.01s vs 2.1s)
        # We will calculate Greeks only for the selected legs later
        live_data = await options_service.get_live_data(
            symbol=request.symbol,
            expiry=near_expiry,
            include_greeks=False,
            include_reversal=False,
            include_profiles=False
        )
        
        if not live_data or "oc" not in live_data:
            return AutoGenerateResponse(
                success=False,
                strategy_name="No Data",
                strategy_type="none",
                iv_regime="Unknown",
                sentiment="Unknown",
                is_calendar_spread=False,
                legs=[],
                market_context={},
                rationale="No option chain data available",
                confidence=0,
                message="Failed to fetch option chain data"
            )
        
        # 3. Extract market context
        spot_price = live_data.get("spot", {}).get("ltp") or live_data.get("sltp", 0)
        atm_strike = live_data.get("atm_strike", 0)
        atmiv = live_data.get("atmiv", 15)
        pcr = live_data.get("pcr", 1.0)
        dte = live_data.get("dte", 7)
        lot_size = live_data.get("lot_size", 75)
        
        # Calculate IV percentile (NIFTY historical: 10-35)
        IV_LOW = 10
        IV_HIGH = 35
        iv_percentile = min(100, max(0, (atmiv - IV_LOW) / (IV_HIGH - IV_LOW) * 100))
        
        # Determine IV regime
        if iv_percentile > 60:
            iv_regime = "High"
        elif iv_percentile < 40:
            iv_regime = "Low"
        else:
            iv_regime = "Normal"
        
        # Determine sentiment
        if pcr > 1.2:
            sentiment = "Bullish"
        elif pcr < 0.8:
            sentiment = "Bearish"
        else:
            sentiment = "Neutral"
        if spot_price <= 0:
            logger.warning(f"Invalid Spot Price ({spot_price}) from source={live_data.get('_source')}. Skipping optimization.")
            return AutoGenerateResponse(
                success=False,
                strategy_name="Error",
                strategy_type="none",
                iv_regime="Unknown",
                sentiment="Unknown",
                is_calendar_spread=False,
                legs=[],
                market_context={},
                rationale=f"Invalid Market Data (Spot={spot_price})",
                confidence=0,
                message="Failed to get valid spot price"
            )


        # 4. Determine strategy based on market conditions
        use_calendar_spread = (
            request.include_calendar_spread and 
            iv_regime == "High" and 
            len(expiry_list) > 1 and
            near_expiry != far_expiry
        )
        
        # Strategy selection logic
        if request.strategy_type:
            selected_strategy = request.strategy_type
            strategy_name = request.strategy_type.replace("_", " ").title()
        elif use_calendar_spread:
            selected_strategy = "calendar_spread"
            strategy_name = "Calendar Spread (IV Play)"
        else:
            # INTELLIGENT SELECTION
            # Ask the optimizer what's best (checking feedback loop first)
            try:
                risk_profile_enum = RiskProfile(request.risk_profile.lower())
            except:
                risk_profile_enum = RiskProfile.MODERATE
                
            market_context_rec = {
                "iv_regime": iv_regime,
                "bias": sentiment.lower(),
                "iv_percentile": iv_percentile,
                "pcr": pcr
            }
            
            recs = await optimizer.recommend_strategies(
                option_chain=[],
                spot_price=0,
                atm_strike=0,
                iv_percentile=iv_percentile,
                pcr=pcr,
                risk_profile=risk_profile_enum,
                db_session=db,
                market_context=market_context_rec
            )
            
            # Pick the top recommendation
            if recs:
                selected_strategy = recs[0].value
                strategy_name = selected_strategy.replace("_", " ").title()
                # If feedback loop promoted it, add to rationale later
            else:
                # Fallback
                selected_strategy = "iron_condor"
                strategy_name = "Iron Condor"
        
        # 5. Generate legs based on strategy
        legs = []
        rationale = ""
        confidence = 0.7
        
        if use_calendar_spread:
            # Calendar Spread: Sell near-term, Buy far-term at same strike (ATM)
            oc = live_data.get("oc", {})
            atm_key = str(int(atm_strike))
            atm_data = oc.get(atm_key, {})
            
            # Get ATM CE data for near-term
            ce_data = atm_data.get("ce", {})
            near_ce_ltp = ce_data.get("ltp", 0)
            near_ce_iv = ce_data.get("iv", atmiv)
            
            # For calendar spread, we need far-term data too
            # Currently simplify: assume far-term IV is similar but premium is higher
            far_ce_ltp_estimate = near_ce_ltp * 1.5  # Rough estimate for demo
            
            legs = [
                {
                    "strike": atm_strike,
                    "option_type": "CE",
                    "action": "SELL",
                    "expiry": near_expiry,
                    "expiry_label": "Near Term",
                    "ltp": near_ce_ltp,
                    "iv": near_ce_iv,
                    "dte": dte,
                    "qty": 1,
                    "lot_size": lot_size
                },
                {
                    "strike": atm_strike,
                    "option_type": "CE",
                    "action": "BUY",
                    "expiry": far_expiry,
                    "expiry_label": "Far Term",
                    "ltp": far_ce_ltp_estimate,
                    "iv": near_ce_iv * 0.95,  # Far-term usually lower IV
                    "dte": dte + 7,  # Approx
                    "qty": 1,
                    "lot_size": lot_size
                }
            ]
            
            rationale = (
                f"High IV environment ({iv_percentile:.0f}th percentile). "
                f"Calendar spread captures IV crush on near-term option while maintaining long vega exposure. "
                f"Sell {atm_strike} CE expiring {near_expiry}, Buy {atm_strike} CE expiring {far_expiry}."
            )
            confidence = 0.75
        else:
            # Regular strategy - use optimizer
            try:
                # Convert option chain format
                option_chain = []
                for strike_str, data in live_data.get("oc", {}).items():
                    strike = float(strike_str)
                    if "ce" in data:
                        ce = data["ce"]
                        option_chain.append({
                            "strike": strike,
                            "option_type": "CE",
                            "ltp": ce.get("ltp", 0),
                            "oi": ce.get("oi", 0),
                            "iv": ce.get("iv", 15),
                            "delta": ce.get("delta", 0),
                            "gamma": ce.get("gamma", 0),
                            "theta": ce.get("theta", 0),
                            "vega": ce.get("vega", 0),
                        })
                    if "pe" in data:
                        pe = data["pe"]
                        option_chain.append({
                            "strike": strike,
                            "option_type": "PE",
                            "ltp": pe.get("ltp", 0),
                            "oi": pe.get("oi", 0),
                            "iv": pe.get("iv", 15),
                            "delta": pe.get("delta", 0),
                            "gamma": pe.get("gamma", 0),
                            "theta": pe.get("theta", 0),
                            "vega": pe.get("vega", 0),
                        })
                
                # Validate risk profile
                try:
                    risk_profile = RiskProfile(request.risk_profile.lower())
                except ValueError:
                    risk_profile = RiskProfile.MODERATE
                
                # Validate strategy type
                try:
                    strategy_type_enum = StrategyType(selected_strategy.lower())
                except ValueError:
                    strategy_type_enum = StrategyType.IRON_CONDOR
                
                step_size = 50 if request.symbol.upper() == "NIFTY" else 100
                
                # Run optimization
                structures = optimizer.optimize(
                    strategy_type=strategy_type_enum,
                    option_chain=option_chain,
                    spot_price=spot_price,
                    atm_strike=atm_strike,
                    expiry=near_expiry,
                    lot_size=lot_size,
                    risk_profile=risk_profile,
                    max_capital=request.max_capital,
                    step_size=step_size
                )
                
                if structures:
                    best = structures[0]
                    legs = []
                    for leg in best.legs:
                        leg_dict = {
                            "strike": leg.strike,
                            "option_type": leg.option_type,
                            "action": leg.action,
                            "qty": leg.qty,
                            "lot_size": leg.lot_size,
                            "ltp": leg.ltp,
                            "iv": leg.iv,
                            "total_qty": leg.total_qty,
                            "premium_value": leg.premium_value,
                            "dte": dte, # Inherit from context
                            "expiry": near_expiry
                        }
                        legs.append(leg_dict)
                        
                    rationale = best.rationale
                    confidence = best.confidence
                else:
                    rationale = "No optimal structure found for current market conditions"
                    confidence = 0.3
                    
            except Exception as e:
                logger.warning(f"Optimization failed: {e}, using simplified legs")
                rationale = f"Auto-selected {strategy_name} based on IV={iv_regime}, Sentiment={sentiment}"
                confidence = 0.5
        
        # 6. Post-Calculation: Calculate Greeks for the selected legs
        # This is efficient because we only calculate for 2-4 legs instead of whole chain
        if legs and options_service.greeks and spot_price > 0:
            for leg in legs:
                try:
                    # Calculate T (years)
                    leg_dte = leg.get("dte", dte)
                    T_years = max(leg_dte, 0.001) / 365.0
                    
                    # Normalize IV (handle % vs decimal)
                    iv_val = leg.get("iv", 0)
                    sigma = iv_val / 100.0 if iv_val > 1 else iv_val
                    
                    if sigma > 0:
                        greeks = options_service.greeks.calculate_all_greeks(
                            S=spot_price,
                            K=leg["strike"],
                            T=T_years,
                            sigma=sigma,
                            option_type=leg["option_type"].lower()
                        )
                        
                        leg.update({
                            "delta": greeks.delta,
                            "gamma": greeks.gamma,
                            "theta": greeks.theta,
                            "vega": greeks.vega,
                            "rho": greeks.rho
                        })
                except Exception as ex:
                    logger.warning(f"Failed to calculate greeks for leg: {ex}")
        
        # Build market context
        market_context = {
            "spot_price": spot_price,
            "atm_strike": atm_strike,
            "atm_iv": atmiv,
            "iv_percentile": iv_percentile,
            "pcr": pcr,
            "dte": dte,
            "lot_size": lot_size,
            "near_expiry": near_expiry,
            "far_expiry": far_expiry if use_calendar_spread else None
        }
        
        logger.info(f"[AUTO-GEN] Completed strategy generation: {strategy_name}, {len(legs)} legs")
        
        return AutoGenerateResponse(
            success=True,
            strategy_name=strategy_name,
            strategy_type=selected_strategy,
            iv_regime=iv_regime,
            sentiment=sentiment,
            is_calendar_spread=use_calendar_spread,
            legs=legs,
            market_context=market_context,
            rationale=rationale,
            confidence=confidence,
            message=f"Generated {strategy_name} strategy"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Auto-generate strategy failed")
        raise HTTPException(status_code=500, detail=str(e))


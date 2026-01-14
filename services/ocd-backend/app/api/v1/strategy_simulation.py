"""
Strategy Simulation API Endpoints
Provides endpoints for strategy simulation, payoff surfaces, and scenario analysis.
"""
import logging
from typing import List, Optional, Tuple
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.dependencies import OptionalUser
from app.services.strategy_simulation_service import (
    StrategySimulationService,
    StrategyLeg,
    get_strategy_simulation_service
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Request/Response Models ==============

class LegRequest(BaseModel):
    """Single strategy leg"""
    strike: float = Field(..., gt=0, description="Strike price")
    option_type: str = Field(..., pattern="^(CE|PE)$", description="Option type")
    action: str = Field(..., pattern="^(BUY|SELL)$", description="Buy or Sell")
    qty: int = Field(1, gt=0, description="Quantity (lots)")
    entry_price: float = Field(..., ge=0, description="Entry price (LTP)")
    iv: float = Field(..., gt=0, description="Implied volatility as decimal (e.g., 0.15)")
    expiry: str = Field(..., description="Expiry as ISO timestamp or Unix ms")
    lot_size: int = Field(1, gt=0, description="Lot size")


class SimulateRequest(BaseModel):
    """Request for single point simulation"""
    legs: List[LegRequest] = Field(..., min_length=1, description="Strategy legs")
    spot_price: float = Field(..., gt=0, description="Simulated spot price")
    simulation_date: Optional[str] = Field(None, description="Simulation date (ISO format), defaults to now")
    iv_change: float = Field(0.0, description="IV change as decimal (e.g., 0.05 for +5%)")
    risk_free_rate: float = Field(0.07, ge=0, le=0.5, description="Risk-free rate")


class PayoffSurfaceRequest(BaseModel):
    """Request for payoff surface generation"""
    legs: List[LegRequest] = Field(..., min_length=1)
    current_spot: float = Field(..., gt=0)
    current_date: Optional[str] = Field(None, description="Current date (ISO format)")
    price_range_pct: Tuple[float, float] = Field((-0.15, 0.15), description="Price range as (min%, max%)")
    time_steps: int = Field(10, ge=2, le=50)
    price_steps: int = Field(50, ge=10, le=200)
    iv_change: float = Field(0.0)


class GreeksSurfaceRequest(BaseModel):
    """Request for Greeks sensitivity surface"""
    legs: List[LegRequest] = Field(..., min_length=1)
    current_spot: float = Field(..., gt=0)
    current_date: Optional[str] = Field(None)
    price_range_pct: Tuple[float, float] = Field((-0.10, 0.10))
    iv_range_pct: Tuple[float, float] = Field((-0.10, 0.10))
    price_steps: int = Field(25, ge=5, le=100)
    iv_steps: int = Field(25, ge=5, le=100)


class ScenarioRequest(BaseModel):
    """Single scenario definition"""
    name: str = Field(..., description="Scenario name")
    spot_change: float = Field(0.0, description="Spot change as decimal (e.g., 0.05 for +5%)")
    days_forward: int = Field(0, ge=0, description="Days to simulate forward")
    iv_change: float = Field(0.0, description="IV change as decimal")


class ScenarioAnalysisRequest(BaseModel):
    """Request for scenario analysis"""
    legs: List[LegRequest] = Field(..., min_length=1)
    current_spot: float = Field(..., gt=0)
    current_date: Optional[str] = Field(None)
    scenarios: List[ScenarioRequest] = Field(..., min_length=1)


# ============== Helper Functions ==============

def _convert_legs(leg_requests: List[LegRequest]) -> List[StrategyLeg]:
    """Convert request legs to service model"""
    return [
        StrategyLeg(
            strike=leg.strike,
            option_type=leg.option_type,
            action=leg.action,
            qty=leg.qty,
            entry_price=leg.entry_price,
            iv=leg.iv,
            expiry=leg.expiry,
            lot_size=leg.lot_size
        )
        for leg in leg_requests
    ]


def _parse_date(date_str: Optional[str]) -> datetime:
    """Parse date string or return current datetime"""
    if not date_str:
        return datetime.now()
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        return datetime.now()


# ============== Endpoints ==============

@router.post("/simulate")
async def simulate_strategy(
    request: SimulateRequest,
    current_user: OptionalUser = None,
):
    """
    Simulate strategy P&L and Greeks at a specific point.
    
    Calculate the theoretical P&L and net Greeks for a strategy
    at a given spot price, date, and IV change.
    """
    try:
        service = get_strategy_simulation_service()
        legs = _convert_legs(request.legs)
        sim_date = _parse_date(request.simulation_date)
        
        result = service.simulate_strategy_at_point(
            legs=legs,
            spot_price=request.spot_price,
            simulation_date=sim_date,
            iv_change=request.iv_change,
            risk_free_rate=request.risk_free_rate
        )
        
        return {
            "success": True,
            "spot_price": result.spot_price,
            "days_to_expiry": result.days_to_expiry,
            "iv_change_pct": round(result.iv_change * 100, 2),
            "pnl": result.pnl,
            "greeks": {
                "net_delta": result.net_delta,
                "net_gamma": result.net_gamma,
                "net_theta": result.net_theta,
                "net_vega": result.net_vega,
                "net_rho": result.net_rho
            }
        }
    except Exception as e:
        logger.error(f"Error simulating strategy: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payoff-surface")
async def generate_payoff_surface(
    request: PayoffSurfaceRequest,
    current_user: OptionalUser = None,
):
    """
    Generate 2D payoff surface for time × price.
    
    Returns a matrix of P&L values across different combinations
    of time (days to expiry) and spot price.
    """
    try:
        service = get_strategy_simulation_service()
        legs = _convert_legs(request.legs)
        current_date = _parse_date(request.current_date)
        
        result = service.generate_payoff_surface(
            legs=legs,
            current_spot=request.current_spot,
            current_date=current_date,
            price_range=request.price_range_pct,
            time_steps=request.time_steps,
            price_steps=request.price_steps,
            iv_change=request.iv_change
        )
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"Error generating payoff surface: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/greeks-surface")
async def generate_greeks_surface(
    request: GreeksSurfaceRequest,
    current_user: OptionalUser = None,
):
    """
    Generate Greeks sensitivity surface for price × IV.
    
    Returns matrices of Delta, Gamma, Theta, and Vega values
    across different combinations of spot price and IV changes.
    """
    try:
        service = get_strategy_simulation_service()
        legs = _convert_legs(request.legs)
        current_date = _parse_date(request.current_date)
        
        result = service.generate_greeks_surface(
            legs=legs,
            current_spot=request.current_spot,
            current_date=current_date,
            price_range=request.price_range_pct,
            iv_range=request.iv_range_pct,
            price_steps=request.price_steps,
            iv_steps=request.iv_steps
        )
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"Error generating Greeks surface: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scenario-analysis")
async def run_scenario_analysis(
    request: ScenarioAnalysisRequest,
    current_user: OptionalUser = None,
):
    """
    Run what-if scenario analysis.
    
    Calculate P&L and Greeks for multiple predefined scenarios
    with different spot price, time, and IV assumptions.
    """
    try:
        service = get_strategy_simulation_service()
        legs = _convert_legs(request.legs)
        current_date = _parse_date(request.current_date)
        
        scenarios = [
            {
                "name": s.name,
                "spot_change": s.spot_change,
                "days_forward": s.days_forward,
                "iv_change": s.iv_change
            }
            for s in request.scenarios
        ]
        
        results = service.scenario_analysis(
            legs=legs,
            current_spot=request.current_spot,
            current_date=current_date,
            scenarios=scenarios
        )
        
        return {
            "success": True,
            "current_spot": request.current_spot,
            "scenarios": results
        }
    except Exception as e:
        logger.error(f"Error running scenario analysis: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/presets")
async def get_strategy_presets():
    """
    Get available strategy presets for quick strategy building.
    """
    return {
        "success": True,
        "presets": [
            {
                "id": "long_straddle",
                "name": "Long Straddle",
                "description": "Buy ATM Call + Buy ATM Put",
                "category": "volatility",
                "legs": [
                    {"strike_offset": 0, "option_type": "CE", "action": "BUY", "qty": 1},
                    {"strike_offset": 0, "option_type": "PE", "action": "BUY", "qty": 1}
                ]
            },
            {
                "id": "short_straddle",
                "name": "Short Straddle",
                "description": "Sell ATM Call + Sell ATM Put",
                "category": "volatility",
                "legs": [
                    {"strike_offset": 0, "option_type": "CE", "action": "SELL", "qty": 1},
                    {"strike_offset": 0, "option_type": "PE", "action": "SELL", "qty": 1}
                ]
            },
            {
                "id": "iron_condor",
                "name": "Iron Condor",
                "description": "Sell OTM Call Spread + Sell OTM Put Spread",
                "category": "neutral",
                "legs": [
                    {"strike_offset": -200, "option_type": "PE", "action": "BUY", "qty": 1},
                    {"strike_offset": -100, "option_type": "PE", "action": "SELL", "qty": 1},
                    {"strike_offset": 100, "option_type": "CE", "action": "SELL", "qty": 1},
                    {"strike_offset": 200, "option_type": "CE", "action": "BUY", "qty": 1}
                ]
            },
            {
                "id": "iron_butterfly",
                "name": "Iron Butterfly",
                "description": "Sell ATM Straddle + Buy OTM Strangle",
                "category": "neutral",
                "legs": [
                    {"strike_offset": 0, "option_type": "CE", "action": "SELL", "qty": 1},
                    {"strike_offset": 0, "option_type": "PE", "action": "SELL", "qty": 1},
                    {"strike_offset": 100, "option_type": "CE", "action": "BUY", "qty": 1},
                    {"strike_offset": -100, "option_type": "PE", "action": "BUY", "qty": 1}
                ]
            },
            {
                "id": "bull_call_spread",
                "name": "Bull Call Spread",
                "description": "Buy ATM Call + Sell OTM Call",
                "category": "directional",
                "legs": [
                    {"strike_offset": 0, "option_type": "CE", "action": "BUY", "qty": 1},
                    {"strike_offset": 100, "option_type": "CE", "action": "SELL", "qty": 1}
                ]
            },
            {
                "id": "bear_put_spread",
                "name": "Bear Put Spread",
                "description": "Buy ATM Put + Sell OTM Put",
                "category": "directional",
                "legs": [
                    {"strike_offset": 0, "option_type": "PE", "action": "BUY", "qty": 1},
                    {"strike_offset": -100, "option_type": "PE", "action": "SELL", "qty": 1}
                ]
            },
            {
                "id": "long_strangle",
                "name": "Long Strangle",
                "description": "Buy OTM Call + Buy OTM Put",
                "category": "volatility",
                "legs": [
                    {"strike_offset": 100, "option_type": "CE", "action": "BUY", "qty": 1},
                    {"strike_offset": -100, "option_type": "PE", "action": "BUY", "qty": 1}
                ]
            },
            {
                "id": "calendar_spread_call",
                "name": "Calendar Spread (Call)",
                "description": "Sell near-expiry Call + Buy far-expiry Call",
                "category": "calendar",
                "multi_expiry": True,
                "legs": [
                    {"strike_offset": 0, "option_type": "CE", "action": "SELL", "qty": 1, "expiry_index": 0},
                    {"strike_offset": 0, "option_type": "CE", "action": "BUY", "qty": 1, "expiry_index": 1}
                ]
            },
            {
                "id": "calendar_spread_put",
                "name": "Calendar Spread (Put)",
                "description": "Sell near-expiry Put + Buy far-expiry Put",
                "category": "calendar",
                "multi_expiry": True,
                "legs": [
                    {"strike_offset": 0, "option_type": "PE", "action": "SELL", "qty": 1, "expiry_index": 0},
                    {"strike_offset": 0, "option_type": "PE", "action": "BUY", "qty": 1, "expiry_index": 1}
                ]
            },
            {
                "id": "diagonal_spread_call",
                "name": "Diagonal Spread (Call)",
                "description": "Sell near OTM Call + Buy far ITM Call",
                "category": "calendar",
                "multi_expiry": True,
                "legs": [
                    {"strike_offset": 100, "option_type": "CE", "action": "SELL", "qty": 1, "expiry_index": 0},
                    {"strike_offset": 0, "option_type": "CE", "action": "BUY", "qty": 1, "expiry_index": 1}
                ]
            },
            {
                "id": "jade_lizard",
                "name": "Jade Lizard",
                "description": "Sell OTM Put + Sell OTM Call Spread",
                "category": "neutral",
                "legs": [
                    {"strike_offset": -100, "option_type": "PE", "action": "SELL", "qty": 1},
                    {"strike_offset": 100, "option_type": "CE", "action": "SELL", "qty": 1},
                    {"strike_offset": 200, "option_type": "CE", "action": "BUY", "qty": 1}
                ]
            },
            {
                "id": "broken_wing_butterfly",
                "name": "Broken Wing Butterfly",
                "description": "Asymmetric butterfly with reduced risk on one side",
                "category": "neutral",
                "legs": [
                    {"strike_offset": -100, "option_type": "PE", "action": "BUY", "qty": 1},
                    {"strike_offset": 0, "option_type": "PE", "action": "SELL", "qty": 2},
                    {"strike_offset": 200, "option_type": "PE", "action": "BUY", "qty": 1}
                ]
            }
        ]
    }


# ============== PROFESSIONAL ENDPOINTS ==============

class POPRequest(BaseModel):
    """Request for Probability of Profit calculation"""
    legs: List[LegRequest] = Field(..., min_length=1)
    current_spot: float = Field(..., gt=0)
    current_date: Optional[str] = Field(None)
    average_iv: Optional[float] = Field(None, description="Override average IV")


class PriceSlicesRequest(BaseModel):
    """Request for price slices table"""
    legs: List[LegRequest] = Field(..., min_length=1)
    current_spot: float = Field(..., gt=0)
    current_date: Optional[str] = Field(None)
    price_changes: List[float] = Field([-0.05, -0.02, 0, 0.02, 0.05], description="Price changes as decimals")
    time_offsets: List[Optional[int]] = Field([0, 3, 7, None], description="Days forward, None for expiry")


class MarginRequest(BaseModel):
    """Request for margin calculation"""
    legs: List[LegRequest] = Field(..., min_length=1)
    current_spot: float = Field(..., gt=0)


class ScenarioMatrixRequest(BaseModel):
    """Request for scenario matrix"""
    legs: List[LegRequest] = Field(..., min_length=1)
    current_spot: float = Field(..., gt=0)
    current_date: Optional[str] = Field(None)
    spot_changes: List[float] = Field([-0.05, -0.025, 0, 0.025, 0.05])
    iv_changes: List[float] = Field([-0.10, -0.05, 0, 0.05, 0.10])


class StrategyMetricsRequest(BaseModel):
    """Request for full strategy metrics"""
    legs: List[LegRequest] = Field(..., min_length=1)
    current_spot: float = Field(..., gt=0)
    current_date: Optional[str] = Field(None)


@router.post("/probability-of-profit")
async def calculate_pop(
    request: POPRequest,
    current_user: OptionalUser = None,
):
    """
    Calculate Probability of Profit (POP) for the strategy.
    
    Uses lognormal distribution based on average IV to estimate
    the probability that the strategy will be profitable at expiry.
    """
    try:
        service = get_strategy_simulation_service()
        legs = _convert_legs(request.legs)
        current_date = _parse_date(request.current_date)
        
        result = service.calculate_probability_of_profit(
            legs=legs,
            current_spot=request.current_spot,
            current_date=current_date,
            average_iv=request.average_iv
        )
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"Error calculating POP: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/price-slices")
async def calculate_price_slices(
    request: PriceSlicesRequest,
    current_user: OptionalUser = None,
):
    """
    Calculate P&L at specific price slices and time offsets.
    
    Returns a table showing P&L for each combination of:
    - Price changes (-5%, -2%, 0%, +2%, +5%)
    - Time offsets (Today, +3d, +7d, Expiry)
    """
    try:
        service = get_strategy_simulation_service()
        legs = _convert_legs(request.legs)
        current_date = _parse_date(request.current_date)
        
        result = service.calculate_price_slices(
            legs=legs,
            current_spot=request.current_spot,
            current_date=current_date,
            price_changes=request.price_changes,
            time_offsets=request.time_offsets
        )
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"Error calculating price slices: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/margin-requirement")
async def calculate_margin(
    request: MarginRequest,
    current_user: OptionalUser = None,
):
    """
    Estimate margin requirement for the strategy.
    
    Uses simplified SPAN-like calculation based on:
    - For naked shorts: 15% of spot + premium - OTM amount
    - For defined risk: Max loss of the strategy
    """
    try:
        service = get_strategy_simulation_service()
        legs = _convert_legs(request.legs)
        
        result = service.calculate_margin_requirement(
            legs=legs,
            current_spot=request.current_spot
        )
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"Error calculating margin: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/max-profit-loss")
async def calculate_max_profit_loss(
    request: MarginRequest,
    current_user: OptionalUser = None,
):
    """
    Calculate maximum profit and maximum loss for the strategy.
    
    Determines if profit/loss is unlimited or capped.
    """
    try:
        service = get_strategy_simulation_service()
        legs = _convert_legs(request.legs)
        
        result = service.calculate_max_profit_loss(
            legs=legs,
            current_spot=request.current_spot
        )
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"Error calculating max profit/loss: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scenario-matrix")
async def generate_scenario_matrix(
    request: ScenarioMatrixRequest,
    current_user: OptionalUser = None,
):
    """
    Generate 2D scenario matrix for spot × IV changes.
    
    Returns a grid of P&L values for each combination of:
    - Spot price changes
    - IV changes
    """
    try:
        service = get_strategy_simulation_service()
        legs = _convert_legs(request.legs)
        current_date = _parse_date(request.current_date)
        
        result = service.scenario_matrix(
            legs=legs,
            current_spot=request.current_spot,
            current_date=current_date,
            spot_changes=request.spot_changes,
            iv_changes=request.iv_changes
        )
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"Error generating scenario matrix: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/full-metrics")
async def get_full_strategy_metrics(
    request: StrategyMetricsRequest,
    current_user: OptionalUser = None,
):
    """
    Get complete strategy metrics in a single call.
    
    Returns POP, max profit/loss, breakevens, margin, and Greeks
    all in one response for efficient UI updates.
    """
    try:
        service = get_strategy_simulation_service()
        legs = _convert_legs(request.legs)
        current_date = _parse_date(request.current_date)
        
        # Get all metrics
        pop_result = service.calculate_probability_of_profit(
            legs=legs,
            current_spot=request.current_spot,
            current_date=current_date
        )
        
        max_pl = service.calculate_max_profit_loss(
            legs=legs,
            current_spot=request.current_spot
        )
        
        margin = service.calculate_margin_requirement(
            legs=legs,
            current_spot=request.current_spot
        )
        
        current_sim = service.simulate_strategy_at_point(
            legs=legs,
            spot_price=request.current_spot,
            simulation_date=current_date
        )
        
        return {
            "success": True,
            "probability_of_profit": pop_result["pop"],
            "breakevens": pop_result["breakevens"],
            "one_std_range": pop_result.get("one_std_range"),
            "max_profit": max_pl["max_profit"],
            "max_loss": max_pl["max_loss"],
            "profit_unlimited": max_pl["profit_unlimited"],
            "loss_unlimited": max_pl["loss_unlimited"],
            "risk_reward_ratio": max_pl["risk_reward_ratio"],
            "estimated_margin": margin["estimated_margin"],
            "net_premium": margin["net_premium"],
            "current_pnl": current_sim.pnl,
            "greeks": {
                "net_delta": current_sim.net_delta,
                "net_gamma": current_sim.net_gamma,
                "net_theta": current_sim.net_theta,
                "net_vega": current_sim.net_vega,
                "net_rho": current_sim.net_rho
            },
            "days_to_expiry": current_sim.days_to_expiry
        }
    except Exception as e:
        logger.error(f"Error getting full metrics: {e}")
        raise HTTPException(status_code=400, detail=str(e))

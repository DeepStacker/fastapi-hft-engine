"""
Financial Calculators API Endpoints
Provides endpoints for Option Pricing, Greeks, and Investment calculators.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field

from app.core.dependencies import OptionalUser
from app.services.calculators import CalculatorService, get_calculator_service

logger = logging.getLogger(__name__)
router = APIRouter()



# ============== Request/Response Models ==============

class OptionPriceRequest(BaseModel):
    """Request for option price calculation"""
    spot: float = Field(..., gt=0, description="Current spot price")
    strike: float = Field(..., gt=0, description="Strike price")
    time_to_expiry: float = Field(..., gt=0, description="Time to expiry in years")
    risk_free_rate: float = Field(0.07, ge=0, description="Annual risk-free rate (e.g., 0.07 for 7%)")
    volatility: float = Field(..., gt=0, description="Annual volatility (e.g., 0.20 for 20%)")
    dividend_yield: float = Field(0.0, ge=0, description="Annual dividend yield")


class OptionPriceResponse(BaseModel):
    """Response for option price calculation"""
    success: bool = True
    call_price: float
    put_price: float
    greeks: dict


class IVRequest(BaseModel):
    """Request for IV calculation"""
    option_price: float = Field(..., gt=0, description="Market price of the option")
    spot: float = Field(..., gt=0, description="Current spot price")
    strike: float = Field(..., gt=0, description="Strike price")
    time_to_expiry: float = Field(..., gt=0, description="Time to expiry in years")
    risk_free_rate: float = Field(0.07, ge=0, description="Annual risk-free rate")
    option_type: str = Field("CE", pattern="^(CE|PE)$", description="Option type")
    dividend_yield: float = Field(0.0, ge=0, description="Annual dividend yield")


class SIPRequest(BaseModel):
    """Request for SIP calculation"""
    monthly_investment: float = Field(..., gt=0, description="Monthly investment amount")
    annual_return: float = Field(..., gt=0, description="Expected annual return percentage")
    years: int = Field(..., gt=0, le=50, description="Investment duration in years")


class LumpsumRequest(BaseModel):
    """Request for Lumpsum calculation"""
    principal: float = Field(..., gt=0, description="Initial investment amount")
    annual_return: float = Field(..., gt=0, description="Expected annual return percentage")
    years: int = Field(..., gt=0, le=50, description="Investment duration in years")


class SWPRequest(BaseModel):
    """Request for SWP calculation"""
    initial_investment: float = Field(..., gt=0, description="Initial corpus")
    monthly_withdrawal: float = Field(..., gt=0, description="Monthly withdrawal amount")
    annual_return: float = Field(..., gt=0, description="Expected annual return percentage")
    years: int = Field(..., gt=0, le=50, description="Duration in years")


class MarginRequest(BaseModel):
    """Request for margin calculation"""
    spot: float = Field(..., gt=0, description="Spot price")
    strike: float = Field(..., gt=0, description="Strike price")
    option_type: str = Field("CE", pattern="^(CE|PE)$", description="Option type")
    premium: float = Field(..., gt=0, description="Option premium")
    lot_size: int = Field(..., gt=0, description="Lot size")
    is_buy: bool = Field(True, description="True for buy, False for sell")


# ============== Endpoints ==============

@router.post("/option-price")
async def calculate_option_price(
    request: OptionPriceRequest,
    current_user: OptionalUser = None,
):
    """
    Calculate option price and Greeks using Black-Scholes model.
    """
    service = get_calculator_service()
    
    try:
        result = service.calculate_option_price(
            spot=request.spot,
            strike=request.strike,
            time_to_expiry=request.time_to_expiry,
            risk_free_rate=request.risk_free_rate,
            volatility=request.volatility,
            dividend_yield=request.dividend_yield
        )
        
        return {
            "success": True,
            "call_price": result.call_price,
            "put_price": result.put_price,
            "greeks": {
                "call_delta": result.call_delta,
                "put_delta": result.put_delta,
                "gamma": result.gamma,
                "vega": result.vega,
                "call_theta": result.call_theta,
                "put_theta": result.put_theta,
                "call_rho": result.call_rho,
                "put_rho": result.put_rho,
            }
        }
    except Exception as e:
        logger.error(f"Error calculating option price: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/implied-volatility")
async def calculate_iv(
    request: IVRequest,
    current_user: OptionalUser = None,
):
    """
    Calculate implied volatility from option price.
    """
    service = get_calculator_service()
    
    try:
        iv = service.calculate_iv(
            option_price=request.option_price,
            spot=request.spot,
            strike=request.strike,
            time_to_expiry=request.time_to_expiry,
            risk_free_rate=request.risk_free_rate,
            option_type=request.option_type,
            dividend_yield=request.dividend_yield
        )
        
        return {
            "success": True,
            "implied_volatility": iv,
            "implied_volatility_pct": round(iv * 100, 2)
        }
    except Exception as e:
        logger.error(f"Error calculating IV: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sip")
async def calculate_sip(
    request: SIPRequest,
    current_user: OptionalUser = None,
):
    """
    Calculate SIP (Systematic Investment Plan) returns.
    """
    service = get_calculator_service()
    
    try:
        result = service.calculate_sip(
            monthly_investment=request.monthly_investment,
            annual_return=request.annual_return,
            years=request.years
        )
        
        return {
            "success": True,
            "monthly_investment": request.monthly_investment,
            "annual_return_pct": request.annual_return,
            "years": request.years,
            "total_investment": result.total_investment,
            "future_value": result.future_value,
            "wealth_gained": result.wealth_gained,
            "returns_percentage": result.returns_percentage
        }
    except Exception as e:
        logger.error(f"Error calculating SIP: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/lumpsum")
async def calculate_lumpsum(
    request: LumpsumRequest,
    current_user: OptionalUser = None,
):
    """
    Calculate Lumpsum investment returns.
    """
    service = get_calculator_service()
    
    try:
        result = service.calculate_lumpsum(
            principal=request.principal,
            annual_return=request.annual_return,
            years=request.years
        )
        
        return {
            "success": True,
            "principal": result.principal,
            "annual_return_pct": request.annual_return,
            "years": request.years,
            "future_value": result.future_value,
            "wealth_gained": result.wealth_gained,
            "returns_percentage": result.returns_percentage
        }
    except Exception as e:
        logger.error(f"Error calculating lumpsum: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/swp")
async def calculate_swp(
    request: SWPRequest,
    current_user: OptionalUser = None,
):
    """
    Calculate SWP (Systematic Withdrawal Plan) results.
    """
    service = get_calculator_service()
    
    try:
        result = service.calculate_swp(
            initial_investment=request.initial_investment,
            monthly_withdrawal=request.monthly_withdrawal,
            annual_return=request.annual_return,
            years=request.years
        )
        
        return {
            "success": True,
            "initial_investment": result.initial_investment,
            "monthly_withdrawal": request.monthly_withdrawal,
            "annual_return_pct": request.annual_return,
            "years": request.years,
            "total_withdrawn": result.total_withdrawn,
            "final_balance": result.final_balance,
            "monthly_withdrawals": result.monthly_withdrawals
        }
    except Exception as e:
        logger.error(f"Error calculating SWP: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/margin")
async def calculate_margin(
    request: MarginRequest,
    current_user: OptionalUser = None,
):
    """
    Calculate approximate margin required for option trading.
    """
    service = get_calculator_service()
    
    try:
        result = service.calculate_option_margin(
            spot=request.spot,
            strike=request.strike,
            option_type=request.option_type,
            premium=request.premium,
            lot_size=request.lot_size,
            is_buy=request.is_buy
        )
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"Error calculating margin: {e}")
        raise HTTPException(status_code=400, detail=str(e))

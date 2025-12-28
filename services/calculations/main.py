"""
Calculations API Main Service

Provides REST API for all calculators:
- Option Pricing
- Implied Volatility
- Greeks
- Financial Calculators
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import date
from typing import Literal, List, Optional
import structlog

from services.calculations.option_pricing import OptionPricer
from services.calculations.iv_solver import IVSolver
from services.calculations.greeks import GreeksCalculator
from services.calculations.financial import FinancialCalculators

# Configure logging
from core.logging.logger import configure_logger, get_logger
configure_logger()
logger = get_logger("calculations-service")

app = FastAPI(
    title="Calculations Service",
    description="Option Pricing, IV, Greeks, and Financial Calculators API",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize calculators
option_pricer = OptionPricer()
iv_solver = IVSolver()
greeks_calc = GreeksCalculator()
financial_calc = FinancialCalculators()


# Pydantic models
class OptionPriceRequest(BaseModel):
    spot: float = Field(..., gt=0, description="Current underlying price")
    strike: float = Field(..., gt=0, description="Strike price")
    expiry_date: date = Field(..., description="Expiry date (YYYY-MM-DD)")
    risk_free_rate: float = Field(0.05, description="Risk-free rate (decimal, e.g., 0.05 = 5%)")
    volatility: float = Field(..., gt=0, description="Volatility (decimal, e.g., 0.20 = 20%)")
    option_type: Literal["CE", "PE"] = Field(..., description="Option type: CE or PE")
    model: Literal["black_scholes", "binomial"] = Field("black_scholes", description="Pricing model")


class IVRequest(BaseModel):
    spot: float = Field(..., gt=0)
    strike: float = Field(..., gt=0)
    expiry_date: date
    risk_free_rate: float = Field(0.05)
    market_price: float = Field(..., gt=0, description="Observed market price")
    option_type: Literal["CE", "PE"]


class GreeksRequest(BaseModel):
    spot: float = Field(..., gt=0)
    strike: float = Field(..., gt=0)
    expiry_date: date
    risk_free_rate: float = Field(0.05)
    volatility: float = Field(..., gt=0)
    option_type: Literal["CE", "PE"]


class PortfolioPosition(BaseModel):
    strike: float
    expiry_date: date
    volatility: float
    option_type: Literal["CE", "PE"]
    quantity: int = Field(..., description="Positive for long, negative for short")


class PortfolioGreeksRequest(BaseModel):
    positions: List[PortfolioPosition]
    spot: float = Field(..., gt=0)
    risk_free_rate: float = Field(0.05)


# Option Pricing Endpoints
@app.post("/option-price")
async def calculate_option_price(request: OptionPriceRequest):
    """
    Calculate option theoretical price using Black-Scholes or Binomial Tree.
    
    Returns theoretical price, intrinsic value, and time value.
    """
    try:
        result = option_pricer.calculate_option_price(
            spot=request.spot,
            strike=request.strike,
            expiry_date=request.expiry_date,
            risk_free_rate=request.risk_free_rate,
            volatility=request.volatility,
            option_type=request.option_type,
            model=request.model
        )
        return result
    except Exception as e:
        logger.error(f"Error calculating option price: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/implied-volatility")
async def calculate_iv(request: IVRequest):
    """
    Calculate implied volatility from market price using Newton-Raphson method.
    
    Returns implied volatility, iterations, and convergence status.
    """
    try:
        result = iv_solver.newton_raphson(
            spot=request.spot,
            strike=request.strike,
            expiry_date=request.expiry_date,
            risk_free_rate=request.risk_free_rate,
            market_price=request.market_price,
            option_type=request.option_type
        )
        return result
    except Exception as e:
        logger.error(f"Error calculating IV: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/greeks")
async def calculate_greeks(request: GreeksRequest):
    """
    Calculate option Greeks: Delta, Gamma, Theta, Vega, Rho.
    
    Returns all Greeks for the specified option.
   """
    try:
        result = greeks_calc.calculate_greeks(
            spot=request.spot,
            strike=request.strike,
            expiry_date=request.expiry_date,
            risk_free_rate=request.risk_free_rate,
            volatility=request.volatility,
            option_type=request.option_type
        )
        return result
    except Exception as e:
        logger.error(f"Error calculating Greeks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/greeks/portfolio")
async def calculate_portfolio_greeks(request: PortfolioGreeksRequest):
    """
    Calculate portfolio-level Greeks for multiple positions.
    
    Aggregates Greeks across all positions.
    """
    try:
        positions_list = [pos.dict() for pos in request.positions]
        result = greeks_calc.calculate_portfolio_greeks(
            positions=positions_list,
            spot=request.spot,
            risk_free_rate=request.risk_free_rate
        )
        return result
    except Exception as e:
        logger.error(f"Error calculating portfolio Greeks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Financial Calculators
@app.get("/lumpsum")
async def calculate_lumpsum(
    principal: float,
    annual_rate: float,
    time_years: float
):
    """Lumpsum investment calculator"""
    try:
        return financial_calc.lumpsum(principal, annual_rate, time_years)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sip")
async def calculate_sip(
    monthly_investment: float,
    annual_rate: float,
    time_years: float
):
    """SIP (Systematic Investment Plan) calculator"""
    try:
        return financial_calc.sip(monthly_investment, annual_rate, time_years)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/swp")
async def calculate_swp(
    corpus: float,
    withdrawal_per_month: float,
    annual_rate: float,
    time_years: float
):
    """SWP (Systematic Withdrawal Plan) calculator"""
    try:
        return financial_calc.swp(corpus, withdrawal_per_month, annual_rate, time_years)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/emi")
async def calculate_emi(
    loan_amount: float,
    annual_rate: float,
    tenure_months: int
):
    """EMI (Equated Monthly Installment) calculator"""
    try:
        return financial_calc.emi(loan_amount, annual_rate, tenure_months)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "calculations"}


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Calculations Service",
        "version": "1.0.0",
        "endpoints": {
            "option_pricing": "/option-price (POST)",
            "implied_volatility": "/implied-volatility (POST)",
            "greeks": "/greeks (POST)",
            "portfolio_greeks": "/greeks/portfolio (POST)",
            "lumpsum": "/lumpsum (GET)",
            "sip": "/sip (GET)",
            "swp": "/swp (GET)",
            "emi": "/emi (GET)",
            "docs": "/docs"
        },
        "features": [
            "Black-Scholes & Binomial Tree option pricing",
            "Newton-Raphson IV solver",
            "Greeks calculation (Delta, Gamma, Theta, Vega, Rho)",
            "Portfolio Greeks aggregation",
            "Financial calculators (Lumpsum, SIP, SWP, EMI)"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "services.calculations.main:app",
        host="0.0.0.0",
        port=8004,
        reload=False
    )

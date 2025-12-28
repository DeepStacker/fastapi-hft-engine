"""
Financial Calculators Service
Provides Option Pricing, Greeks, and Investment calculators.
"""
import math
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
from scipy.stats import norm

logger = logging.getLogger(__name__)


@dataclass
class OptionPriceResult:
    """Result of option price calculation"""
    call_price: float
    put_price: float
    call_delta: float
    put_delta: float
    gamma: float
    vega: float
    call_theta: float
    put_theta: float
    call_rho: float
    put_rho: float


@dataclass
class SIPResult:
    """Result of SIP calculation"""
    total_investment: float
    future_value: float
    wealth_gained: float
    returns_percentage: float


@dataclass
class LumpsumResult:
    """Result of Lumpsum calculation"""
    principal: float
    future_value: float
    wealth_gained: float
    returns_percentage: float


@dataclass
class SWPResult:
    """Result of SWP calculation"""
    initial_investment: float
    total_withdrawn: float
    final_balance: float
    monthly_withdrawals: int


class CalculatorService:
    """
    Financial Calculator Service.
    
    Provides:
    - Black-Scholes Option Pricing
    - Option Greeks (Delta, Gamma, Theta, Vega, Rho)
    - SIP Calculator
    - Lumpsum Calculator
    - SWP Calculator
    """
    
    def __init__(self):
        pass
    
    # ============== Black-Scholes Option Pricing ==============
    
    def calculate_option_price(
        self,
        spot: float,
        strike: float,
        time_to_expiry: float,  # In years
        risk_free_rate: float,  # Annual rate (e.g., 0.07 for 7%)
        volatility: float,  # Annual volatility (e.g., 0.20 for 20%)
        dividend_yield: float = 0.0  # Annual dividend yield
    ) -> OptionPriceResult:
        """
        Calculate option prices and Greeks using Black-Scholes model.
        
        Args:
            spot: Current spot price
            strike: Strike price
            time_to_expiry: Time to expiry in years
            risk_free_rate: Risk-free interest rate (annual)
            volatility: Implied volatility (annual)
            dividend_yield: Continuous dividend yield
            
        Returns:
            OptionPriceResult with call/put prices and all Greeks
        """
        try:
            # Safety checks
            if time_to_expiry <= 0:
                time_to_expiry = 1/365  # 1 day minimum
            if volatility <= 0:
                volatility = 0.001
            
            # Calculate d1 and d2
            d1 = (math.log(spot / strike) + (risk_free_rate - dividend_yield + 0.5 * volatility ** 2) * time_to_expiry) / (volatility * math.sqrt(time_to_expiry))
            d2 = d1 - volatility * math.sqrt(time_to_expiry)
            
            # Call and Put prices
            call_price = spot * math.exp(-dividend_yield * time_to_expiry) * norm.cdf(d1) - strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2)
            put_price = strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2) - spot * math.exp(-dividend_yield * time_to_expiry) * norm.cdf(-d1)
            
            # Greeks
            # Delta
            call_delta = math.exp(-dividend_yield * time_to_expiry) * norm.cdf(d1)
            put_delta = -math.exp(-dividend_yield * time_to_expiry) * norm.cdf(-d1)
            
            # Gamma (same for call and put)
            gamma = math.exp(-dividend_yield * time_to_expiry) * norm.pdf(d1) / (spot * volatility * math.sqrt(time_to_expiry))
            
            # Vega (same for call and put, per 1% change)
            vega = spot * math.exp(-dividend_yield * time_to_expiry) * norm.pdf(d1) * math.sqrt(time_to_expiry) / 100
            
            # Theta (per day)
            call_theta = (-spot * math.exp(-dividend_yield * time_to_expiry) * norm.pdf(d1) * volatility / (2 * math.sqrt(time_to_expiry))
                         - risk_free_rate * strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2)
                         + dividend_yield * spot * math.exp(-dividend_yield * time_to_expiry) * norm.cdf(d1)) / 365
            
            put_theta = (-spot * math.exp(-dividend_yield * time_to_expiry) * norm.pdf(d1) * volatility / (2 * math.sqrt(time_to_expiry))
                        + risk_free_rate * strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2)
                        - dividend_yield * spot * math.exp(-dividend_yield * time_to_expiry) * norm.cdf(-d1)) / 365
            
            # Rho (per 1% change)
            call_rho = strike * time_to_expiry * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2) / 100
            put_rho = -strike * time_to_expiry * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2) / 100
            
            return OptionPriceResult(
                call_price=round(call_price, 2),
                put_price=round(put_price, 2),
                call_delta=round(call_delta, 4),
                put_delta=round(put_delta, 4),
                gamma=round(gamma, 6),
                vega=round(vega, 4),
                call_theta=round(call_theta, 4),
                put_theta=round(put_theta, 4),
                call_rho=round(call_rho, 4),
                put_rho=round(put_rho, 4),
            )
            
        except Exception as e:
            logger.error(f"Error calculating option price: {e}")
            raise ValueError(f"Calculation error: {e}")
    
    def calculate_iv(
        self,
        option_price: float,
        spot: float,
        strike: float,
        time_to_expiry: float,
        risk_free_rate: float,
        option_type: str = "CE",
        dividend_yield: float = 0.0
    ) -> float:
        """
        Calculate implied volatility using Newton-Raphson method.
        
        Args:
            option_price: Market price of the option
            spot: Current spot price
            strike: Strike price
            time_to_expiry: Time to expiry in years
            risk_free_rate: Risk-free rate
            option_type: "CE" for call, "PE" for put
            dividend_yield: Dividend yield
            
        Returns:
            Implied volatility as decimal (e.g., 0.20 for 20%)
        """
        MAX_ITERATIONS = 100
        PRECISION = 1e-5
        
        # Initial guess
        sigma = 0.3
        
        for _ in range(MAX_ITERATIONS):
            result = self.calculate_option_price(
                spot, strike, time_to_expiry, 
                risk_free_rate, sigma, dividend_yield
            )
            
            price = result.call_price if option_type == "CE" else result.put_price
            vega = result.vega * 100  # Convert back from per 1%
            
            diff = price - option_price
            
            if abs(diff) < PRECISION:
                return round(sigma, 4)
            
            if vega < 1e-10:
                break
                
            sigma = sigma - diff / vega
            
            # Keep sigma in reasonable bounds
            sigma = max(0.01, min(5.0, sigma))
        
        return round(sigma, 4)
    
    # ============== SIP Calculator ==============
    
    def calculate_sip(
        self,
        monthly_investment: float,
        annual_return: float,  # As percentage (e.g., 12 for 12%)
        years: int
    ) -> SIPResult:
        """
        Calculate SIP (Systematic Investment Plan) returns.
        
        Args:
            monthly_investment: Amount invested each month
            annual_return: Expected annual return percentage
            years: Investment duration in years
            
        Returns:
            SIPResult with investment details
        """
        monthly_rate = annual_return / 12 / 100
        months = years * 12
        
        # FV = P × ((1 + r)^n - 1) / r × (1 + r)
        if monthly_rate == 0:
            future_value = monthly_investment * months
        else:
            future_value = monthly_investment * (((1 + monthly_rate) ** months - 1) / monthly_rate) * (1 + monthly_rate)
        
        total_investment = monthly_investment * months
        wealth_gained = future_value - total_investment
        returns_percentage = (wealth_gained / total_investment) * 100
        
        return SIPResult(
            total_investment=round(total_investment, 2),
            future_value=round(future_value, 2),
            wealth_gained=round(wealth_gained, 2),
            returns_percentage=round(returns_percentage, 2)
        )
    
    # ============== Lumpsum Calculator ==============
    
    def calculate_lumpsum(
        self,
        principal: float,
        annual_return: float,  # As percentage
        years: int
    ) -> LumpsumResult:
        """
        Calculate Lumpsum investment returns.
        
        Args:
            principal: Initial investment amount
            annual_return: Expected annual return percentage
            years: Investment duration in years
            
        Returns:
            LumpsumResult with investment details
        """
        rate = annual_return / 100
        
        # FV = P × (1 + r)^n
        future_value = principal * ((1 + rate) ** years)
        wealth_gained = future_value - principal
        returns_percentage = (wealth_gained / principal) * 100
        
        return LumpsumResult(
            principal=round(principal, 2),
            future_value=round(future_value, 2),
            wealth_gained=round(wealth_gained, 2),
            returns_percentage=round(returns_percentage, 2)
        )
    
    # ============== SWP Calculator ==============
    
    def calculate_swp(
        self,
        initial_investment: float,
        monthly_withdrawal: float,
        annual_return: float,  # As percentage
        years: int
    ) -> SWPResult:
        """
        Calculate SWP (Systematic Withdrawal Plan) results.
        
        Args:
            initial_investment: Initial corpus
            monthly_withdrawal: Amount withdrawn each month
            annual_return: Expected annual return percentage
            years: Duration in years
            
        Returns:
            SWPResult with withdrawal details
        """
        monthly_rate = annual_return / 12 / 100
        months = years * 12
        
        balance = initial_investment
        total_withdrawn = 0
        withdrawals_count = 0
        
        for _ in range(months):
            if balance <= 0:
                break
            
            # Add monthly returns
            balance *= (1 + monthly_rate)
            
            # Withdraw
            withdrawal = min(monthly_withdrawal, balance)
            balance -= withdrawal
            total_withdrawn += withdrawal
            withdrawals_count += 1
        
        return SWPResult(
            initial_investment=round(initial_investment, 2),
            total_withdrawn=round(total_withdrawn, 2),
            final_balance=round(max(0, balance), 2),
            monthly_withdrawals=withdrawals_count
        )
    
    # ============== Margin Calculator ==============
    
    def calculate_option_margin(
        self,
        spot: float,
        strike: float,
        option_type: str,
        premium: float,
        lot_size: int,
        is_buy: bool = True
    ) -> Dict[str, Any]:
        """
        Calculate approximate margin required for option trading.
        
        Note: This is an approximation. Actual margin varies by exchange.
        """
        if is_buy:
            # For buying options, margin = premium paid
            margin = premium * lot_size
            return {
                "margin_required": round(margin, 2),
                "margin_type": "Premium",
                "premium_paid": round(margin, 2),
                "max_loss": round(margin, 2),
                "max_profit": "Unlimited" if option_type == "CE" else round(strike * lot_size - margin, 2)
            }
        else:
            # For selling options, margin is higher
            # Simplified formula: SPAN margin + Exposure margin
            span_margin = spot * lot_size * 0.15  # ~15% of notional
            exposure_margin = spot * lot_size * 0.03  # ~3% of notional
            total_margin = span_margin + exposure_margin - (premium * lot_size)
            
            return {
                "margin_required": round(total_margin, 2),
                "margin_type": "SPAN + Exposure",
                "span_margin": round(span_margin, 2),
                "exposure_margin": round(exposure_margin, 2),
                "premium_received": round(premium * lot_size, 2),
                "max_profit": round(premium * lot_size, 2),
                "max_loss": "Unlimited"
            }


def get_calculator_service() -> CalculatorService:
    """Get calculator service instance"""
    return CalculatorService()

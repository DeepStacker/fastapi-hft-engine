"""
Black-Scholes-Merton Model for European Options

Calculates theoretical option prices and Greeks.
"""
import math
import numpy as np
from typing import Literal, Dict, List
from scipy.stats import norm
from core.logging.logger import get_logger
from services.processor.models.raw_data import OptionGreeks

logger = get_logger("bsm")


class BlackScholesModel:
    """
    Black-Scholes-Merton model for option pricing
    
    Assumes:
    - European-style options (can only be exercised at expiry)
    - No dividends (or adjustable for dividend yield)
    - Constant volatility and risk-free rate
    """
    
    def __init__(self, risk_free_rate: float = 0.095, dividend_yield: float = 0.0):
        """
        Initialize BSM model
        
        Args:
            risk_free_rate: Annual risk-free rate (default 6.5% for India)
            dividend_yield: Annual dividend yield (default 0%)
        """
        self.risk_free_rate = risk_free_rate
        self.dividend_yield = dividend_yield
    
    def calculate(
        self,
        spot_price: float,
        strike_price: float,
        time_to_expiry: float,  # In years
        volatility: float,  # IV as decimal (e.g., 0.12 for 12%)
        option_type: Literal['CE', 'PE']
    ) -> Dict[str, float]:
        """
        Calculate theoretical option price using BSM formula
        
        Args:
            spot_price: Current spot price
            strike_price: Option strike price
            time_to_expiry: Time to expiry in years
            volatility: Implied volatility (as decimal)
            option_type: 'CE' for call, 'PE' for put
            
        Returns:
            Dict with:
            - theoretical_price: BSM fair value
            - d1, d2: Intermediate values (useful for Greeks)
        """
        # Handle edge cases
        if spot_price <= 0 or strike_price <= 0:
            logger.warning(f"Invalid prices: spot={spot_price}, strike={strike_price}")
            return {
                'theoretical_price': 0.0,
                'd1': 0.0,
                'd2': 0.0
            }
        
        if time_to_expiry <= 0:
            # At or past expiry, return intrinsic value
            if option_type == 'CE':
                intrinsic = max(spot_price - strike_price, 0)
            else:
                intrinsic = max(strike_price - spot_price, 0)
            
            return {
                'theoretical_price': intrinsic,
                'd1': 0.0,
                'd2': 0.0
            }
        
        if volatility <= 0:
            logger.warning(f"Invalid volatility: {volatility}")
            # Return intrinsic value
            if option_type == 'CE':
                intrinsic = max(spot_price - strike_price, 0)
            else:
                intrinsic = max(strike_price - spot_price, 0)
            
            return {
                'theoretical_price': intrinsic,
                'd1': 0.0,
                'd2': 0.0
            }
        
        # Calculate d1 and d2
        try:
            d1 = (
                math.log(spot_price / strike_price) + 
                (self.risk_free_rate - self.dividend_yield + 0.5 * volatility ** 2) * time_to_expiry
            ) / (volatility * math.sqrt(time_to_expiry))
            
            d2 = d1 - volatility * math.sqrt(time_to_expiry)
            
            # Calculate option price
            if option_type == 'CE':
                # Call option
                price = (
                    spot_price * math.exp(-self.dividend_yield * time_to_expiry) * norm.cdf(d1) -
                    strike_price * math.exp(-self.risk_free_rate * time_to_expiry) * norm.cdf(d2)
                )
            else:
                # Put option
                price = (
                    strike_price * math.exp(-self.risk_free_rate * time_to_expiry) * norm.cdf(-d2) -
                    spot_price * math.exp(-self.dividend_yield * time_to_expiry) * norm.cdf(-d1)
                )
            
            return {
                'theoretical_price': round(max(price, 0), 2),  # Never negative
                'd1': round(d1, 6),
                'd2': round(d2, 6)
            }
            
        except Exception as e:
            logger.error(f"BSM calculation error: {e}")
            return {
                'theoretical_price': 0.0,
                'd1': 0.0,
                'd2': 0.0
            }
    
    def calculate_greeks(
        self,
        spot_price: float,
        strike_price: float,
        time_to_expiry: float,
        volatility: float,
        option_type: Literal['CE', 'PE']
    ) -> OptionGreeks:
        """
        Calculate option Greeks
        """
        if time_to_expiry <= 0 or volatility <= 0 or spot_price <= 0:
            return OptionGreeks()

        try:
            d1 = (math.log(spot_price / strike_price) + 
                  (self.risk_free_rate - self.dividend_yield + 0.5 * volatility ** 2) * time_to_expiry) / \
                 (volatility * math.sqrt(time_to_expiry))
            
            d2 = d1 - volatility * math.sqrt(time_to_expiry)
            
            # Common terms
            pdf_d1 = norm.pdf(d1)
            cdf_d1 = norm.cdf(d1)
            cdf_d2 = norm.cdf(d2)
            cdf_neg_d1 = norm.cdf(-d1)
            cdf_neg_d2 = norm.cdf(-d2)
            exp_qt = math.exp(-self.dividend_yield * time_to_expiry)
            exp_rt = math.exp(-self.risk_free_rate * time_to_expiry)
            
            # Delta
            if option_type == 'CE':
                delta = exp_qt * cdf_d1
            else:
                delta = -exp_qt * cdf_neg_d1
                
            # Gamma (same for Call and Put)
            gamma = (exp_qt * pdf_d1) / (spot_price * volatility * math.sqrt(time_to_expiry))
            
            # Vega (same for Call and Put) - usually expressed for 1% change in vol
            vega = (spot_price * exp_qt * pdf_d1 * math.sqrt(time_to_expiry)) / 100.0
            
            # Theta
            term1 = -(spot_price * exp_qt * pdf_d1 * volatility) / (2 * math.sqrt(time_to_expiry))
            if option_type == 'CE':
                term2 = -self.risk_free_rate * strike_price * exp_rt * cdf_d2
                term3 = self.dividend_yield * spot_price * exp_qt * cdf_d1
                theta = (term1 + term2 + term3) / 365.0 # Daily theta
            else:
                term2 = self.risk_free_rate * strike_price * exp_rt * cdf_neg_d2
                term3 = -self.dividend_yield * spot_price * exp_qt * cdf_neg_d1
                theta = (term1 + term2 + term3) / 365.0 # Daily theta
                
            # Rho
            if option_type == 'CE':
                rho = (strike_price * time_to_expiry * exp_rt * cdf_d2) / 100.0
            else:
                rho = (-strike_price * time_to_expiry * exp_rt * cdf_neg_d2) / 100.0
                
            return OptionGreeks(
                delta=round(delta, 5),
                gamma=round(gamma, 6),
                theta=round(theta, 5),
                vega=round(vega, 5),
                rho=round(rho, 5)
            )
            
        except Exception as e:
            logger.error(f"Greeks calculation error: {e}")
            return OptionGreeks()

    def calculate_iv(
        self,
        market_price: float,
        spot_price: float,
        strike_price: float,
        time_to_expiry: float,
        option_type: Literal['CE', 'PE'],
        initial_guess: float = 0.5,
        max_iter: int = 100,
        precision: float = 1e-5
    ) -> float:
        """
        Calculate Implied Volatility using Newton-Raphson method
        """
        if market_price <= 0 or time_to_expiry <= 0:
            return 0.0
            
        # Check intrinsic value lower bound
        intrinsic = 0.0
        if option_type == 'CE':
            intrinsic = max(spot_price - strike_price, 0)
        else:
            intrinsic = max(strike_price - spot_price, 0)
            
        if market_price < intrinsic:
            # Price is below intrinsic, arbitrage exists, IV undefined (or 0)
            return 0.0

        sigma = initial_guess
        
        for i in range(max_iter):
            # Calculate price with current sigma
            res = self.calculate(spot_price, strike_price, time_to_expiry, sigma, option_type)
            price = res['theoretical_price']
            
            diff = market_price - price
            
            if abs(diff) < precision:
                return round(sigma * 100, 2) # Return as percentage
                
            # Calculate vega (derivative of price w.r.t volatility)
            # We need raw vega (not divided by 100)
            d1 = (math.log(spot_price / strike_price) + 
                  (self.risk_free_rate - self.dividend_yield + 0.5 * sigma ** 2) * time_to_expiry) / \
                 (sigma * math.sqrt(time_to_expiry))
            
            vega = spot_price * math.exp(-self.dividend_yield * time_to_expiry) * norm.pdf(d1) * math.sqrt(time_to_expiry)
            
            if vega == 0:
                break
                
            sigma = sigma + diff / vega
            
            if sigma <= 0:
                sigma = 0.001 # Reset to small positive if it goes negative
                
        return 0.0 # Failed to converge

    def calculate_batch(
        self,
        options: list,
        spot_price: float,
        days_to_expiry: int
    ) -> list:
        """
        Calculate BSM for multiple options in batch
        
        Args:
            options: List of CleanedOptionData objects
            spot_price: Current spot price
            days_to_expiry: Days to expiry
            
        Returns:
            Same list with theoretical_price and Greeks populated
        """
        time_to_expiry = days_to_expiry / 365.0
        
        for option in options:
            # 1. Calculate IV if missing
            if option.iv is None or option.iv <= 0:
                # Use Mid price if available, else LTP
                price = option.mid_price if option.mid_price and option.mid_price > 0 else option.ltp
                
                if price and price > 0:
                    calculated_iv = self.calculate_iv(
                        market_price=price,
                        spot_price=spot_price,
                        strike_price=option.strike,
                        time_to_expiry=time_to_expiry,
                        option_type=option.option_type
                    )
                    if calculated_iv > 0:
                        option.iv = calculated_iv
            
            # 2. Calculate Theoretical Price
            if option.iv and option.iv > 0:
                result = self.calculate(
                    spot_price=spot_price,
                    strike_price=option.strike,
                    time_to_expiry=time_to_expiry,
                    volatility=option.iv / 100.0,
                    option_type=option.option_type
                )
                option.theoretical_price = result['theoretical_price']
                
                # 3. Calculate Greeks (Always recalculate to ensure consistency)
                greeks = self.calculate_greeks(
                    spot_price=spot_price,
                    strike_price=option.strike,
                    time_to_expiry=time_to_expiry,
                    volatility=option.iv / 100.0,
                    option_type=option.option_type
                )
                
                # Update option object
                option.delta = greeks.delta
                option.gamma = greeks.gamma
                option.theta = greeks.theta
                option.vega = greeks.vega
                option.rho = greeks.rho
        
        return options
    
    def calculate_batch_vectorized(
        self,
        options: list,
        spot_price: float,
        days_to_expiry: int
    ) -> list:
        """
        OPTIMIZED: Calculate BSM for multiple options using NumPy vectorization.
        
        10-100x faster than scalar loop for large option chains!
        
        Args:
            options: List of CleanedOptionData objects
            spot_price: Current spot price
            days_to_expiry: Days to expiry
            
        Returns:
            Same list with theoretical_price and Greeks populated
        """
        if not options:
            return options
        
        time_to_expiry = days_to_expiry / 365.0
        n = len(options)
        
        # Extract option data into NumPy arrays (vectorization prep)
        # Handle both 'strike' and 'strike_price' attributes
        strikes = np.array([
            getattr(opt, 'strike', getattr(opt, 'strike_price', 0)) 
            for opt in options
        ], dtype=np.float64)
        
        ivs = np.array([
            opt.iv / 100.0 if (hasattr(opt, 'iv') and opt.iv and opt.iv > 0) else 0.0 
            for opt in options
        ], dtype=np.float64)
        
        is_call = np.array([
            opt.option_type == 'CE' if hasattr(opt, 'option_type') else False
            for opt in options
        ], dtype=bool)
        
        # Handle zero IVs or invalid strikes (skip calculations for these)
        valid_mask = (ivs > 0) & (strikes > 0)
        
        if not np.any(valid_mask):
            return options  # No valid options, nothing to calculate
        
        # Initialize result arrays
        theoretical_prices = np.zeros(n)
        deltas = np.zeros(n)
        gammas = np.zeros(n)
        thetas = np.zeros(n)
        vegas = np.zeros(n)
        rhos = np.zeros(n)
        
        # Vectorized calculations (only for valid IVs)
        S = spot_price
        K = strikes[valid_mask]
        T = time_to_expiry
        sigma = ivs[valid_mask]
        r = self.risk_free_rate
        q = self.dividend_yield
        
        # Calculate d1 and d2 (vectorized)
        sqrt_T = np.sqrt(T)
        d1 = (
            np.log(S / K) + (r - q + 0.5 * sigma**2) * T
        ) / (sigma * sqrt_T)
        d2 = d1 - sigma * sqrt_T
        
        # Precompute common terms
        exp_qt = np.exp(-q * T)
        exp_rt = np.exp(-r * T)
        pdf_d1 = norm.pdf(d1)
        cdf_d1 = norm.cdf(d1)
        cdf_d2 = norm.cdf(d2)
        cdf_neg_d1 = norm.cdf(-d1)
        cdf_neg_d2 = norm.cdf(-d2)
        
        # Calculate option prices (vectorized)
        calls_mask = is_call[valid_mask]
        puts_mask = ~calls_mask
        
        prices = np.zeros(valid_mask.sum())
        prices[calls_mask] = S * exp_qt * cdf_d1[calls_mask] - K[calls_mask] * exp_rt * cdf_d2[calls_mask]
        prices[puts_mask] = K[puts_mask] * exp_rt * cdf_neg_d2[puts_mask] - S * exp_qt * cdf_neg_d1[puts_mask]
        theoretical_prices[valid_mask] = np.maximum(prices, 0)  # Never negative
        
        # Calculate Greeks (vectorized)
        # Delta
        deltas_temp = np.zeros(valid_mask.sum())
        deltas_temp[calls_mask] = exp_qt * cdf_d1[calls_mask]
        deltas_temp[puts_mask] = -exp_qt * cdf_neg_d1[puts_mask]
        deltas[valid_mask] = deltas_temp
        
        # Gamma (same for calls and puts)
        gammas[valid_mask] = (exp_qt * pdf_d1) / (S * sigma * sqrt_T)
        
        # Vega (same for calls and puts)
        vegas[valid_mask] = (S * exp_qt * pdf_d1 * sqrt_T) / 100.0
        
        # Theta
        term1 = -(S * exp_qt * pdf_d1 * sigma) / (2 * sqrt_T)
        thetas_temp = np.zeros(valid_mask.sum())
        
        # Calls
        if np.any(calls_mask):
            term2 = -r * K[calls_mask] * exp_rt * cdf_d2[calls_mask]
            term3 = q * S * exp_qt * cdf_d1[calls_mask]
            thetas_temp[calls_mask] = (term1[calls_mask] + term2 + term3) / 365.0
        
        # Puts
        if np.any(puts_mask):
            term2 = r * K[puts_mask] * exp_rt * cdf_neg_d2[puts_mask]
            term3 = -q * S * exp_qt * cdf_neg_d1[puts_mask]
            thetas_temp[puts_mask] = (term1[puts_mask] + term2 + term3) / 365.0
        
        thetas[valid_mask] = thetas_temp
        
        # Rho
        rhos_temp = np.zeros(valid_mask.sum())
        rhos_temp[calls_mask] = (K[calls_mask] * T * exp_rt * cdf_d2[calls_mask]) / 100.0
        rhos_temp[puts_mask] = (-K[puts_mask] * T * exp_rt * cdf_neg_d2[puts_mask]) / 100.0
        rhos[valid_mask] = rhos_temp
        
        # Update option objects with vectorized results
        for i, option in enumerate(options):
            if valid_mask[i]:
                option.theoretical_price = round(theoretical_prices[i], 2)
                option.delta = round(deltas[i], 5)
                option.gamma = round(gammas[i], 6)
                option.theta = round(thetas[i], 5)
                option.vega = round(vegas[i], 5)
                option.rho = round(rhos[i], 5)
        
        return options
    
    def update_risk_free_rate(self, rate: float):
        """Update risk-free rate (e.g., from config)"""
        self.risk_free_rate = rate
        logger.info(f"Updated risk-free rate to {rate:.4f}")
    
    def update_dividend_yield(self, yield_rate: float):
        """Update dividend yield"""
        self.dividend_yield = yield_rate
        logger.info(f"Updated dividend yield to {yield_rate:.4f}")

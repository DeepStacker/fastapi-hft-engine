"""
Strategy Simulation Service
Provides batch strategy payoff calculation and simulation capabilities.
"""
import math
import logging
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
from scipy.stats import norm

logger = logging.getLogger(__name__)


@dataclass
class StrategyLeg:
    """Single leg of an options strategy"""
    strike: float
    option_type: str  # CE or PE
    action: str  # BUY or SELL
    qty: int
    entry_price: float
    iv: float
    expiry: str  # ISO timestamp
    lot_size: int = 1


@dataclass
class SimulationPoint:
    """Result at a single simulation point"""
    spot_price: float
    days_to_expiry: float
    iv_change: float
    pnl: float
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float
    net_rho: float


class StrategySimulationService:
    """
    Strategy Simulation Service.
    
    Provides:
    - Batch strategy payoff calculation at simulated conditions
    - Payoff surface generation (time × price × IV)
    - Greeks sensitivity analysis
    - What-if scenario analysis
    """
    
    def __init__(self, risk_free_rate: float = 0.07):
        self.risk_free_rate = risk_free_rate
    
    def _calculate_d1_d2(
        self,
        spot: float,
        strike: float,
        time_to_expiry: float,
        volatility: float,
        risk_free_rate: float
    ) -> Tuple[float, float]:
        """Calculate d1 and d2 for Black-Scholes"""
        if time_to_expiry <= 0:
            time_to_expiry = 1/365/24  # 1 hour minimum
        if volatility <= 0:
            volatility = 0.001
            
        d1 = (math.log(spot / strike) + (risk_free_rate + 0.5 * volatility ** 2) * time_to_expiry) / (volatility * math.sqrt(time_to_expiry))
        d2 = d1 - volatility * math.sqrt(time_to_expiry)
        return d1, d2
    
    def _black_scholes_price(
        self,
        spot: float,
        strike: float,
        time_to_expiry: float,
        volatility: float,
        risk_free_rate: float,
        option_type: str
    ) -> float:
        """Calculate option price using Black-Scholes"""
        if time_to_expiry <= 0:
            # At expiry, use intrinsic value
            if option_type == "CE":
                return max(0, spot - strike)
            else:
                return max(0, strike - spot)
        
        d1, d2 = self._calculate_d1_d2(spot, strike, time_to_expiry, volatility, risk_free_rate)
        
        if option_type == "CE":
            price = spot * norm.cdf(d1) - strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2)
        else:
            price = strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2) - spot * norm.cdf(-d1)
        
        return max(0, price)
    
    def _calculate_greeks(
        self,
        spot: float,
        strike: float,
        time_to_expiry: float,
        volatility: float,
        risk_free_rate: float,
        option_type: str
    ) -> Dict[str, float]:
        """Calculate all Greeks for a single option"""
        if time_to_expiry <= 0:
            # At expiry
            if option_type == "CE":
                delta = 1.0 if spot > strike else 0.0
            else:
                delta = -1.0 if spot < strike else 0.0
            return {
                "delta": delta,
                "gamma": 0.0,
                "theta": 0.0,
                "vega": 0.0,
                "rho": 0.0
            }
        
        d1, d2 = self._calculate_d1_d2(spot, strike, time_to_expiry, volatility, risk_free_rate)
        sqrt_t = math.sqrt(time_to_expiry)
        
        # Delta
        if option_type == "CE":
            delta = norm.cdf(d1)
        else:
            delta = -norm.cdf(-d1)
        
        # Gamma (same for call and put)
        gamma = norm.pdf(d1) / (spot * volatility * sqrt_t)
        
        # Vega (per 1% change)
        vega = spot * norm.pdf(d1) * sqrt_t / 100
        
        # Theta (per day)
        first_term = -spot * norm.pdf(d1) * volatility / (2 * sqrt_t)
        if option_type == "CE":
            theta = (first_term - risk_free_rate * strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2)) / 365
        else:
            theta = (first_term + risk_free_rate * strike * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2)) / 365
        
        # Rho (per 1% change)
        if option_type == "CE":
            rho = strike * time_to_expiry * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2) / 100
        else:
            rho = -strike * time_to_expiry * math.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2) / 100
        
        return {
            "delta": round(delta, 4),
            "gamma": round(gamma, 6),
            "theta": round(theta, 4),
            "vega": round(vega, 4),
            "rho": round(rho, 4)
        }
    
    def simulate_strategy_at_point(
        self,
        legs: List[StrategyLeg],
        spot_price: float,
        simulation_date: datetime,
        iv_change: float = 0.0,
        risk_free_rate: Optional[float] = None
    ) -> SimulationPoint:
        """
        Calculate strategy P&L and Greeks at a specific point in time/price/IV.
        
        Args:
            legs: List of strategy legs
            spot_price: Simulated spot price
            simulation_date: Date to simulate (for time decay)
            iv_change: IV change as decimal (e.g., 0.05 for +5%)
            risk_free_rate: Override risk-free rate
            
        Returns:
            SimulationPoint with P&L and net Greeks
        """
        rfr = risk_free_rate if risk_free_rate is not None else self.risk_free_rate
        
        total_pnl = 0.0
        net_delta = 0.0
        net_gamma = 0.0
        net_theta = 0.0
        net_vega = 0.0
        net_rho = 0.0
        
        min_dte = float('inf')
        
        for leg in legs:
            # Parse expiry
            try:
                expiry_dt = datetime.fromisoformat(leg.expiry.replace('Z', '+00:00'))
            except:
                # Try parsing as timestamp
                expiry_dt = datetime.fromtimestamp(int(leg.expiry) / 1000)
            
            # Calculate time to expiry in years
            time_diff = expiry_dt - simulation_date
            days_to_expiry = max(0, time_diff.total_seconds() / (24 * 3600))
            time_to_expiry = days_to_expiry / 365
            
            min_dte = min(min_dte, days_to_expiry)
            
            # Adjust IV
            adjusted_iv = max(0.01, leg.iv + iv_change)
            
            # Calculate current theoretical price
            current_price = self._black_scholes_price(
                spot_price, leg.strike, time_to_expiry,
                adjusted_iv, rfr, leg.option_type
            )
            
            # Calculate P&L per unit
            if leg.action == "BUY":
                leg_pnl = (current_price - leg.entry_price) * leg.qty * leg.lot_size
            else:
                leg_pnl = (leg.entry_price - current_price) * leg.qty * leg.lot_size
            
            total_pnl += leg_pnl
            
            # Calculate Greeks
            greeks = self._calculate_greeks(
                spot_price, leg.strike, time_to_expiry,
                adjusted_iv, rfr, leg.option_type
            )
            
            # Aggregate Greeks (direction based on action)
            direction = 1 if leg.action == "BUY" else -1
            multiplier = leg.qty * leg.lot_size * direction
            
            net_delta += greeks["delta"] * multiplier
            net_gamma += greeks["gamma"] * multiplier
            net_theta += greeks["theta"] * multiplier
            net_vega += greeks["vega"] * multiplier
            net_rho += greeks["rho"] * multiplier
        
        return SimulationPoint(
            spot_price=spot_price,
            days_to_expiry=min_dte if min_dte != float('inf') else 0,
            iv_change=iv_change,
            pnl=round(total_pnl, 2),
            net_delta=round(net_delta, 4),
            net_gamma=round(net_gamma, 6),
            net_theta=round(net_theta, 4),
            net_vega=round(net_vega, 4),
            net_rho=round(net_rho, 4)
        )
    
    def generate_payoff_surface(
        self,
        legs: List[StrategyLeg],
        current_spot: float,
        current_date: datetime,
        price_range: Tuple[float, float] = (-0.15, 0.15),  # ±15% of spot
        time_steps: int = 10,
        price_steps: int = 50,
        iv_change: float = 0.0
    ) -> Dict[str, Any]:
        """
        Generate a 2D payoff surface for time × price.
        
        Args:
            legs: Strategy legs
            current_spot: Current spot price
            current_date: Current date
            price_range: (min%, max%) range around spot
            time_steps: Number of time points
            price_steps: Number of price points
            iv_change: Fixed IV change for the surface
            
        Returns:
            Dict with prices, days, and payoff matrix
        """
        # Find maximum DTE across all legs
        max_dte = 0
        for leg in legs:
            try:
                expiry_dt = datetime.fromisoformat(leg.expiry.replace('Z', '+00:00'))
            except:
                expiry_dt = datetime.fromtimestamp(int(leg.expiry) / 1000)
            
            time_diff = expiry_dt - current_date
            leg_dte = max(0, time_diff.total_seconds() / (24 * 3600))
            max_dte = max(max_dte, leg_dte)
        
        if max_dte == 0:
            max_dte = 1  # Minimum 1 day
        
        # Generate price points
        min_price = current_spot * (1 + price_range[0])
        max_price = current_spot * (1 + price_range[1])
        prices = [min_price + (max_price - min_price) * i / (price_steps - 1) for i in range(price_steps)]
        
        # Generate time points (days from now)
        days = [max_dte * i / (time_steps - 1) for i in range(time_steps)]
        
        # Calculate payoff matrix
        payoff_matrix = []
        for day in days:
            row = []
            sim_date = current_date + timedelta(days=day)
            for price in prices:
                point = self.simulate_strategy_at_point(legs, price, sim_date, iv_change)
                row.append(point.pnl)
            payoff_matrix.append(row)
        
        return {
            "prices": [round(p, 2) for p in prices],
            "days": [round(d, 1) for d in days],
            "payoff_matrix": payoff_matrix,
            "current_spot": current_spot,
            "max_dte": round(max_dte, 1)
        }
    
    def generate_greeks_surface(
        self,
        legs: List[StrategyLeg],
        current_spot: float,
        current_date: datetime,
        price_range: Tuple[float, float] = (-0.10, 0.10),
        iv_range: Tuple[float, float] = (-0.10, 0.10),
        price_steps: int = 25,
        iv_steps: int = 25
    ) -> Dict[str, Any]:
        """
        Generate Greeks sensitivity surface for price × IV.
        
        Returns delta, gamma, theta, vega surfaces.
        """
        min_price = current_spot * (1 + price_range[0])
        max_price = current_spot * (1 + price_range[1])
        prices = [min_price + (max_price - min_price) * i / (price_steps - 1) for i in range(price_steps)]
        
        iv_changes = [iv_range[0] + (iv_range[1] - iv_range[0]) * i / (iv_steps - 1) for i in range(iv_steps)]
        
        delta_matrix = []
        gamma_matrix = []
        theta_matrix = []
        vega_matrix = []
        
        for iv_change in iv_changes:
            delta_row, gamma_row, theta_row, vega_row = [], [], [], []
            for price in prices:
                point = self.simulate_strategy_at_point(legs, price, current_date, iv_change)
                delta_row.append(point.net_delta)
                gamma_row.append(point.net_gamma)
                theta_row.append(point.net_theta)
                vega_row.append(point.net_vega)
            
            delta_matrix.append(delta_row)
            gamma_matrix.append(gamma_row)
            theta_matrix.append(theta_row)
            vega_matrix.append(vega_row)
        
        return {
            "prices": [round(p, 2) for p in prices],
            "iv_changes": [round(iv * 100, 1) for iv in iv_changes],  # As percentage
            "delta_matrix": delta_matrix,
            "gamma_matrix": gamma_matrix,
            "theta_matrix": theta_matrix,
            "vega_matrix": vega_matrix,
            "current_spot": current_spot
        }
    
    def scenario_analysis(
        self,
        legs: List[StrategyLeg],
        current_spot: float,
        current_date: datetime,
        scenarios: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Run what-if scenario analysis.
        
        Args:
            legs: Strategy legs
            current_spot: Current spot price
            current_date: Current date
            scenarios: List of scenario definitions, each with:
                - name: Scenario name
                - spot_change: % change in spot (e.g., 0.05 for +5%)
                - days_forward: Days to simulate forward
                - iv_change: IV change as decimal
                
        Returns:
            List of scenario results with P&L and Greeks
        """
        results = []
        
        for scenario in scenarios:
            name = scenario.get("name", "Unnamed")
            spot_change = scenario.get("spot_change", 0)
            days_forward = scenario.get("days_forward", 0)
            iv_change = scenario.get("iv_change", 0)
            
            sim_spot = current_spot * (1 + spot_change)
            sim_date = current_date + timedelta(days=days_forward)
            
            point = self.simulate_strategy_at_point(legs, sim_spot, sim_date, iv_change)
            
            results.append({
                "name": name,
                "spot_price": round(sim_spot, 2),
                "spot_change_pct": round(spot_change * 100, 2),
                "days_forward": days_forward,
                "iv_change_pct": round(iv_change * 100, 2),
                "pnl": point.pnl,
                "net_delta": point.net_delta,
                "net_gamma": point.net_gamma,
                "net_theta": point.net_theta,
                "net_vega": point.net_vega
            })
        
        return results

    # ============== PROFESSIONAL FEATURES ==============

    def calculate_probability_of_profit(
        self,
        legs: List[StrategyLeg],
        current_spot: float,
        current_date: datetime,
        average_iv: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculate Probability of Profit (POP) using lognormal distribution.
        
        Uses the Black-Scholes assumption that prices are lognormally distributed.
        """
        # Find breakevens first
        breakevens = self.find_breakevens(legs, current_spot, current_date)
        
        if not breakevens:
            # No breakevens found, check if always profit or always loss
            test_point = self.simulate_strategy_at_point(legs, current_spot, current_date)
            if test_point.pnl > 0:
                return {"pop": 100.0, "breakevens": [], "analysis": "Always profitable at current conditions"}
            else:
                return {"pop": 0.0, "breakevens": [], "analysis": "Always loss at current conditions"}
        
        # Calculate days to expiry (use minimum across legs)
        min_dte = float('inf')
        total_iv = 0
        for leg in legs:
            try:
                expiry_dt = datetime.fromisoformat(leg.expiry.replace('Z', '+00:00'))
            except:
                expiry_dt = datetime.fromtimestamp(int(leg.expiry) / 1000)
            
            time_diff = expiry_dt - current_date
            dte = max(0.001, time_diff.total_seconds() / (24 * 3600))
            min_dte = min(min_dte, dte)
            total_iv += leg.iv
        
        avg_iv = average_iv if average_iv else (total_iv / len(legs))
        time_to_expiry = min_dte / 365
        
        # Calculate probability using lognormal distribution
        # Standard deviation for lognormal = IV * sqrt(T)
        std_dev = avg_iv * math.sqrt(time_to_expiry)
        
        # Calculate profit zones
        # We need to determine which side of each breakeven is profitable
        profit_prob = 0.0
        
        # Sort breakevens
        sorted_be = sorted(breakevens)
        
        # Check P&L at spot to determine profit direction
        center_pnl = self._calculate_expiry_payoff(legs, current_spot)
        
        if len(sorted_be) == 1:
            be = sorted_be[0]
            # Single breakeven - profit on one side
            d = (math.log(be / current_spot)) / std_dev if std_dev > 0 else 0
            prob_below = norm.cdf(d)
            prob_above = 1 - prob_below
            
            # Check which side is profitable
            if center_pnl > 0:
                # Profitable at center, need price to stay near center
                profit_prob = prob_above if current_spot < be else prob_below
            else:
                profit_prob = prob_above if current_spot > be else prob_below
                
        elif len(sorted_be) == 2:
            # Two breakevens - typical for straddles/strangles
            be_low, be_high = sorted_be[0], sorted_be[1]
            
            d_low = (math.log(be_low / current_spot)) / std_dev if std_dev > 0 else 0
            d_high = (math.log(be_high / current_spot)) / std_dev if std_dev > 0 else 0
            
            prob_below_low = norm.cdf(d_low)
            prob_above_high = 1 - norm.cdf(d_high)
            prob_between = norm.cdf(d_high) - norm.cdf(d_low)
            
            # Check if profitable between or outside breakevens
            mid_price = (be_low + be_high) / 2
            mid_pnl = self._calculate_expiry_payoff(legs, mid_price)
            
            if mid_pnl > 0:
                # Profitable between breakevens (e.g., short straddle)
                profit_prob = prob_between
            else:
                # Profitable outside breakevens (e.g., long straddle)
                profit_prob = prob_below_low + prob_above_high
        else:
            # Multiple breakevens - complex strategy
            # Use Monte Carlo approximation
            profit_prob = self._monte_carlo_pop(legs, current_spot, std_dev, 5000)
        
        return {
            "pop": round(profit_prob * 100, 2),
            "breakevens": [round(be, 2) for be in sorted_be],
            "average_iv": round(avg_iv * 100, 2),
            "days_to_expiry": round(min_dte, 1),
            "std_move": round(std_dev * current_spot, 2),
            "one_std_range": [
                round(current_spot * math.exp(-std_dev), 2),
                round(current_spot * math.exp(std_dev), 2)
            ]
        }

    def _calculate_expiry_payoff(self, legs: List[StrategyLeg], spot_price: float) -> float:
        """Calculate total payoff at expiry for given spot price"""
        total = 0.0
        for leg in legs:
            if leg.option_type == "CE":
                intrinsic = max(0, spot_price - leg.strike)
            else:
                intrinsic = max(0, leg.strike - spot_price)
            
            if leg.action == "BUY":
                total += (intrinsic - leg.entry_price) * leg.qty * leg.lot_size
            else:
                total += (leg.entry_price - intrinsic) * leg.qty * leg.lot_size
        
        return total

    def _monte_carlo_pop(self, legs: List[StrategyLeg], current_spot: float, std_dev: float, n_sims: int) -> float:
        """Monte Carlo estimation of POP for complex strategies"""
        import random
        
        profitable_count = 0
        for _ in range(n_sims):
            # Generate random spot price using lognormal
            random_return = random.gauss(0, std_dev)
            sim_spot = current_spot * math.exp(random_return)
            
            # Calculate payoff
            payoff = self._calculate_expiry_payoff(legs, sim_spot)
            if payoff > 0:
                profitable_count += 1
        
        return profitable_count / n_sims

    def find_breakevens(
        self,
        legs: List[StrategyLeg],
        current_spot: float,
        current_date: datetime,
        at_expiry: bool = True
    ) -> List[float]:
        """
        Find breakeven points for the strategy.
        
        Uses bisection method to find where P&L crosses zero.
        """
        # Search range: ±50% from spot
        min_price = current_spot * 0.5
        max_price = current_spot * 1.5
        step = (max_price - min_price) / 200
        
        if step <= 0.0001:
            logger.warning("Step size too small for breakeven search (Spot=0?), returning empty")
            return []
        
        breakevens = []
        prev_pnl = None
        
        price = min_price
        while price <= max_price:
            if at_expiry:
                pnl = self._calculate_expiry_payoff(legs, price)
            else:
                point = self.simulate_strategy_at_point(legs, price, current_date)
                pnl = point.pnl
            
            if prev_pnl is not None:
                # Check for sign change
                if (prev_pnl < 0 and pnl >= 0) or (prev_pnl >= 0 and pnl < 0):
                    # Bisection to find exact breakeven
                    be = self._bisect_breakeven(legs, price - step, price, at_expiry, current_date)
                    breakevens.append(be)
            
            prev_pnl = pnl
            price += step
        
        return breakevens

    def _bisect_breakeven(
        self,
        legs: List[StrategyLeg],
        low: float,
        high: float,
        at_expiry: bool,
        current_date: datetime,
        tolerance: float = 0.5
    ) -> float:
        """Bisection method to find exact breakeven"""
        for _ in range(20):  # Max iterations
            mid = (low + high) / 2
            
            if at_expiry:
                pnl = self._calculate_expiry_payoff(legs, mid)
            else:
                point = self.simulate_strategy_at_point(legs, mid, current_date)
                pnl = point.pnl
            
            if abs(pnl) < tolerance:
                return mid
            
            if at_expiry:
                low_pnl = self._calculate_expiry_payoff(legs, low)
            else:
                low_pnl = self.simulate_strategy_at_point(legs, low, current_date).pnl
            
            if (low_pnl < 0 and pnl < 0) or (low_pnl >= 0 and pnl >= 0):
                low = mid
            else:
                high = mid
        
        return (low + high) / 2

    def calculate_max_profit_loss(
        self,
        legs: List[StrategyLeg],
        current_spot: float
    ) -> Dict[str, Any]:
        """
        Calculate maximum profit and maximum loss for the strategy.
        
        Returns theoretical max profit/loss based on expiry payoffs.
        """
        # Check a wide range of prices
        min_price = current_spot * 0.3
        max_price = current_spot * 1.7
        
        payoffs = []
        prices = []
        
        for i in range(100):
            price = min_price + (max_price - min_price) * i / 99
            payoff = self._calculate_expiry_payoff(legs, price)
            payoffs.append(payoff)
            prices.append(price)
        
        max_profit = max(payoffs)
        max_loss = min(payoffs)
        max_profit_price = prices[payoffs.index(max_profit)]
        max_loss_price = prices[payoffs.index(max_loss)]
        
        # Check extremes (0 and infinity approximation)
        payoff_at_zero = self._calculate_expiry_payoff(legs, 0.01)
        payoff_at_high = self._calculate_expiry_payoff(legs, current_spot * 5)
        
        # Determine if unlimited
        profit_unlimited = payoff_at_high > max_profit * 1.5 or payoff_at_zero > max_profit * 1.5
        loss_unlimited = payoff_at_high < max_loss * 1.5 or payoff_at_zero < max_loss * 1.5
        
        return {
            "max_profit": round(max_profit, 2) if not profit_unlimited else "Unlimited",
            "max_profit_price": round(max_profit_price, 2) if not profit_unlimited else None,
            "max_loss": round(max_loss, 2) if not loss_unlimited else "Unlimited",
            "max_loss_price": round(max_loss_price, 2) if not loss_unlimited else None,
            "profit_unlimited": profit_unlimited,
            "loss_unlimited": loss_unlimited,
            "risk_reward_ratio": round(abs(max_profit / max_loss), 2) if max_loss != 0 and not profit_unlimited and not loss_unlimited else None
        }

    def calculate_price_slices(
        self,
        legs: List[StrategyLeg],
        current_spot: float,
        current_date: datetime,
        price_changes: List[float] = [-0.05, -0.02, 0, 0.02, 0.05],
        time_offsets: List[int] = [0, 3, 7, None]  # None = expiry
    ) -> Dict[str, Any]:
        """
        Calculate P&L at specific price slices and time offsets.
        
        Returns a table of P&L values for each combination.
        """
        # Find expiry
        min_dte = float('inf')
        for leg in legs:
            try:
                expiry_dt = datetime.fromisoformat(leg.expiry.replace('Z', '+00:00'))
            except:
                expiry_dt = datetime.fromtimestamp(int(leg.expiry) / 1000)
            
            time_diff = expiry_dt - current_date
            dte = max(0, time_diff.total_seconds() / (24 * 3600))
            min_dte = min(min_dte, dte)
        
        # Build result table
        slices = []
        
        for pct_change in price_changes:
            sim_price = current_spot * (1 + pct_change)
            row = {
                "price_change_pct": round(pct_change * 100, 1),
                "spot_price": round(sim_price, 2),
                "pnl_by_time": {}
            }
            
            for days in time_offsets:
                if days is None:
                    # At expiry
                    pnl = self._calculate_expiry_payoff(legs, sim_price)
                    key = "expiry"
                else:
                    if days >= min_dte:
                        pnl = self._calculate_expiry_payoff(legs, sim_price)
                    else:
                        sim_date = current_date + timedelta(days=days)
                        point = self.simulate_strategy_at_point(legs, sim_price, sim_date)
                        pnl = point.pnl
                    key = f"+{days}d" if days > 0 else "today"
                
                row["pnl_by_time"][key] = round(pnl, 2)
            
            slices.append(row)
        
        return {
            "current_spot": current_spot,
            "days_to_expiry": round(min_dte, 1),
            "time_columns": ["today"] + [f"+{d}d" for d in time_offsets if d and d > 0] + ["expiry"],
            "slices": slices
        }

    def calculate_margin_requirement(
        self,
        legs: List[StrategyLeg],
        current_spot: float
    ) -> Dict[str, Any]:
        """
        Estimate margin requirement for the strategy.
        
        Uses simplified SPAN-like calculation:
        - For naked short options: 15% of spot + premium - OTM amount
        - For spreads: Max risk of the spread
        - For fully hedged: Just the debit
        """
        total_margin = 0.0
        premium_received = 0.0
        premium_paid = 0.0
        
        # Separate calls and puts
        call_legs = [l for l in legs if l.option_type == "CE"]
        put_legs = [l for l in legs if l.option_type == "PE"]
        
        # Calculate net premium
        for leg in legs:
            if leg.action == "SELL":
                premium_received += leg.entry_price * leg.qty * leg.lot_size
            else:
                premium_paid += leg.entry_price * leg.qty * leg.lot_size
        
        net_premium = premium_received - premium_paid
        
        # Calculate max loss (simplified)
        max_profit_loss = self.calculate_max_profit_loss(legs, current_spot)
        
        if max_profit_loss["loss_unlimited"]:
            # Naked short position - use standard margin
            for leg in legs:
                if leg.action == "SELL":
                    # 15% of spot + premium - OTM amount
                    otm_amount = abs(current_spot - leg.strike) if (
                        (leg.option_type == "CE" and leg.strike > current_spot) or
                        (leg.option_type == "PE" and leg.strike < current_spot)
                    ) else 0
                    
                    margin = max(
                        0.15 * current_spot * leg.lot_size * leg.qty + leg.entry_price * leg.lot_size * leg.qty - otm_amount * leg.lot_size * leg.qty,
                        0.10 * current_spot * leg.lot_size * leg.qty
                    )
                    total_margin += margin
        else:
            # Defined risk - margin = max loss
            total_margin = abs(max_profit_loss["max_loss"]) if isinstance(max_profit_loss["max_loss"], (int, float)) else 0
        
        return {
            "estimated_margin": round(total_margin, 2),
            "premium_received": round(premium_received, 2),
            "premium_paid": round(premium_paid, 2),
            "net_premium": round(net_premium, 2),
            "max_loss": max_profit_loss["max_loss"],
            "margin_type": "span_estimated",
            "note": "Actual margin may vary based on broker and exchange rules"
        }

    def scenario_matrix(
        self,
        legs: List[StrategyLeg],
        current_spot: float,
        current_date: datetime,
        spot_changes: List[float] = [-0.05, -0.025, 0, 0.025, 0.05],
        iv_changes: List[float] = [-0.10, -0.05, 0, 0.05, 0.10]
    ) -> Dict[str, Any]:
        """
        Generate 2D scenario matrix for spot × IV changes.
        
        Returns a grid of P&L values.
        """
        matrix = []
        
        for iv_change in iv_changes:
            row = []
            for spot_change in spot_changes:
                sim_spot = current_spot * (1 + spot_change)
                point = self.simulate_strategy_at_point(legs, sim_spot, current_date, iv_change)
                row.append({
                    "pnl": point.pnl,
                    "delta": point.net_delta,
                    "theta": point.net_theta
                })
            matrix.append(row)
        
        return {
            "spot_changes_pct": [round(s * 100, 1) for s in spot_changes],
            "iv_changes_pct": [round(iv * 100, 1) for iv in iv_changes],
            "matrix": matrix,
            "current_spot": current_spot
        }


# Singleton instance
_simulation_service: Optional[StrategySimulationService] = None


def get_strategy_simulation_service() -> StrategySimulationService:
    """Get strategy simulation service instance"""
    global _simulation_service
    if _simulation_service is None:
        _simulation_service = StrategySimulationService()
    return _simulation_service

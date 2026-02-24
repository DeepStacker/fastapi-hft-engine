"""
Leg Optimizer Service

Data-driven strategy leg optimization using:
- OI wall detection (from COA service)
- IV skew analysis
- Greeks targeting
- Risk/Capital-aware position sizing

This service suggests specific strikes and quantities, not just strategy names.
"""
import logging
import math
from typing import Dict, List, Any, Optional, Literal, Tuple
from datetime import datetime, date
from dataclasses import dataclass, field, asdict
from enum import Enum

from app.services.strategy_simulation_service import (
    StrategySimulationService, StrategyLeg
)
from app.services.coa_service import ChartOfAccuracyService, get_coa_service
from app.services.bsm import BSMService
from app.services.performance_analytics import get_performance_analytics
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ============================================================
# ENUMS & DATACLASSES
# ============================================================

class RiskProfile(str, Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


class StrategyType(str, Enum):
    IRON_CONDOR = "iron_condor"
    BULL_PUT_SPREAD = "bull_put_spread"
    BEAR_CALL_SPREAD = "bear_call_spread"
    LONG_STRADDLE = "long_straddle"
    SHORT_STRADDLE = "short_straddle"
    STRANGLE = "strangle"
    BULL_CALL_SPREAD = "bull_call_spread"
    BEAR_PUT_SPREAD = "bear_put_spread"
    JADE_LIZARD = "jade_lizard"
    CUSTOM = "custom"


@dataclass
class OptimizedLeg:
    """Single leg of an optimized structure."""
    strike: float
    option_type: str  # "CE" or "PE"
    action: str  # "BUY" or "SELL"
    qty: int
    lot_size: int
    ltp: float  # Current premium
    iv: float
    delta: float
    gamma: float
    theta: float
    vega: float
    
    @property
    def total_qty(self) -> int:
        return self.qty * self.lot_size
    
    @property
    def premium_value(self) -> float:
        """Total premium for this leg."""
        return self.ltp * self.total_qty
    
    def to_simulation_leg(self, expiry: str) -> StrategyLeg:
        """Convert to StrategyLeg for simulation service."""
        return StrategyLeg(
            strike=self.strike,
            option_type=self.option_type,
            action=self.action,
            qty=self.qty,
            entry_price=self.ltp,
            iv=self.iv / 100 if self.iv > 1 else self.iv,  # Normalize
            expiry=expiry,
            lot_size=self.lot_size
        )


@dataclass
class StructureMetrics:
    """Calculated metrics for a structure."""
    max_profit: float
    max_loss: float
    net_credit: float  # Positive = credit received
    probability_of_profit: float  # 0-100
    breakevens: List[float]
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float
    risk_reward_ratio: float  # max_profit / max_loss
    margin_required: float  # Estimated
    capital_at_risk: float


@dataclass
class OptimizedStructure:
    """Complete optimized strategy structure."""
    strategy_type: str
    legs: List[OptimizedLeg]
    metrics: StructureMetrics
    rationale: str
    confidence: float  # 0-1
    market_context: Dict[str, Any]
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "strategy_type": self.strategy_type,
            "legs": [asdict(leg) for leg in self.legs],
            "metrics": asdict(self.metrics),
            "rationale": self.rationale,
            "confidence": self.confidence,
            "market_context": self.market_context,
            "generated_at": self.generated_at
        }


# ============================================================
# LEG OPTIMIZER SERVICE
# ============================================================

class LegOptimizer:
    """
    Data-driven leg optimization for option strategies.
    
    Uses:
    - OI walls from COA service for strike selection
    - IV surface for mispricing detection
    - Greeks for risk management
    - Capital constraints for position sizing
    """
    
    # Strategy width mappings by risk profile (in strike steps)
    SPREAD_WIDTHS = {
        RiskProfile.CONSERVATIVE: 2,  # 100 pts for NIFTY
        RiskProfile.MODERATE: 3,      # 150 pts
        RiskProfile.AGGRESSIVE: 4,    # 200 pts
    }
    
    # OTM buffer for short strikes (in strike steps from ATM)
    OTM_BUFFER = {
        RiskProfile.CONSERVATIVE: 4,  # Far OTM
        RiskProfile.MODERATE: 3,
        RiskProfile.AGGRESSIVE: 2,    # Closer to ATM
    }
    
    def __init__(
        self,
        simulation_service: Optional[StrategySimulationService] = None,
        coa_service: Optional[ChartOfAccuracyService] = None,
        risk_free_rate: float = 0.07
    ):
        self.sim = simulation_service or StrategySimulationService(risk_free_rate)
        self.coa = coa_service or get_coa_service()
        self.bsm = BSMService(risk_free_rate)
        self.rfr = risk_free_rate
    
    # --------------------------------------------------------
    # PUBLIC API
    # --------------------------------------------------------
    
    def optimize(
        self,
        strategy_type: StrategyType,
        option_chain: List[Dict[str, Any]],
        spot_price: float,
        atm_strike: float,
        expiry: str,
        lot_size: int,
        risk_profile: RiskProfile = RiskProfile.MODERATE,
        max_capital: float = 100000,
        step_size: float = 50
    ) -> List[OptimizedStructure]:
        """
        Main optimization entry point.
        
        Args:
            strategy_type: Type of strategy to optimize
            option_chain: Live option chain data (list of strike dicts)
            spot_price: Current spot price
            atm_strike: ATM strike
            expiry: Expiry date string
            lot_size: Lot size for the instrument
            risk_profile: User's risk tolerance
            max_capital: Maximum capital to allocate
            step_size: Strike step size (50 for NIFTY, 100 for BANKNIFTY)
        
        Returns:
            List of optimized structures ranked by confidence
        """
        # 1. Analyze OI walls using COA
        coa_result = self.coa.analyze(
            options=option_chain,
            spot_price=spot_price,
            atm_strike=atm_strike,
            step_size=step_size
        )
        
        # 2. Build market context
        context = self._build_market_context(
            coa_result=coa_result,
            spot_price=spot_price,
            atm_strike=atm_strike,
            option_chain=option_chain
        )
        
        # 3. Route to strategy-specific optimizer
        structures = []
        
        if strategy_type == StrategyType.IRON_CONDOR:
            structures = self._optimize_iron_condor(
                context, option_chain, expiry, lot_size, risk_profile, max_capital, step_size
            )
        elif strategy_type == StrategyType.BULL_PUT_SPREAD:
            structures = self._optimize_bull_put_spread(
                context, option_chain, expiry, lot_size, risk_profile, max_capital, step_size
            )
        elif strategy_type == StrategyType.BEAR_CALL_SPREAD:
            structures = self._optimize_bear_call_spread(
                context, option_chain, expiry, lot_size, risk_profile, max_capital, step_size
            )
        elif strategy_type == StrategyType.LONG_STRADDLE:
            structures = self._optimize_long_straddle(
                context, option_chain, expiry, lot_size, risk_profile, max_capital
            )
        elif strategy_type == StrategyType.SHORT_STRADDLE:
            structures = self._optimize_short_straddle(
                context, option_chain, expiry, lot_size, risk_profile, max_capital
            )
        else:
            logger.warning(f"Strategy {strategy_type} not yet implemented")
            return []
        
        # 4. Sort by confidence
        structures.sort(key=lambda s: s.confidence, reverse=True)
        
        return structures
    
    async def recommend_strategies(
        self,
        option_chain: List[Dict[str, Any]],
        spot_price: float,
        atm_strike: float,
        iv_percentile: float,
        pcr: float,
        risk_profile: RiskProfile = RiskProfile.MODERATE,
        db_session: Optional[AsyncSession] = None,
        market_context: Optional[Dict[str, Any]] = None
    ) -> List[StrategyType]:
        """
        Recommend which strategies are suitable for current market conditions.
        
        INTELLIGENT V2:
        1. Checks Feedback Loop (historical performance in this context)
        2. Applies Rules Engine (IV/PCR logic)
        3. Prioritizes data-driven suggestions
        
        Returns list of strategy types ranked by suitability.
        """
        recommendations = []
        
        # 1. FEEDBACK LOOP (Data-Driven)
        if db_session and market_context:
            try:
                analytics = get_performance_analytics()
                bias = market_context.get("bias", "neutral")
                iv_regime = market_context.get("iv_regime", "Normal")
                
                best_historical = await analytics.get_best_strategy_for_context(
                    db_session, bias=bias, iv_regime=iv_regime
                )
                
                if best_historical:
                    try:
                        strategy_enum = StrategyType(best_historical)
                        recommendations.append(strategy_enum)
                        logger.info(f"Feedback Loop promoted strategy: {best_historical}")
                    except ValueError:
                        pass
            except Exception as e:
                logger.warning(f"Feedback loop failed: {e}")
        
        # 2. RULES ENGINE (Market Logic)
        rule_recs = []
        
        # High IV -> Sell premium
        if iv_percentile > 60:
            if pcr > 1.2:  # Bullish sentiment
                rule_recs.append(StrategyType.BULL_PUT_SPREAD)
            elif pcr < 0.8:  # Bearish sentiment
                rule_recs.append(StrategyType.BEAR_CALL_SPREAD)
            else:  # Neutral
                rule_recs.append(StrategyType.IRON_CONDOR)
                rule_recs.append(StrategyType.SHORT_STRADDLE)
        
        # Low IV -> Buy premium
        elif iv_percentile < 40:
            rule_recs.append(StrategyType.LONG_STRADDLE)
            if pcr > 1.2:
                rule_recs.append(StrategyType.BULL_CALL_SPREAD)
            elif pcr < 0.8:
                rule_recs.append(StrategyType.BEAR_PUT_SPREAD)
        
        # Normal IV
        else:
            rule_recs.append(StrategyType.IRON_CONDOR)
            if pcr > 1.2:
                rule_recs.append(StrategyType.BULL_PUT_SPREAD)
            elif pcr < 0.8:
                rule_recs.append(StrategyType.BEAR_CALL_SPREAD)
        
        # 3. MERGE (Prioritize Feedback Loop)
        for r in rule_recs:
            if r not in recommendations:
                recommendations.append(r)
        
        return recommendations
    
    # --------------------------------------------------------
    # STRATEGY OPTIMIZERS
    # --------------------------------------------------------
    
    def _optimize_iron_condor(
        self,
        context: Dict[str, Any],
        oc: List[Dict[str, Any]],
        expiry: str,
        lot_size: int,
        risk_profile: RiskProfile,
        max_capital: float,
        step_size: float
    ) -> List[OptimizedStructure]:
        """
        Optimize Iron Condor legs.
        
        Logic:
        1. Use OI resistance wall for short CE
        2. Use OI support wall for short PE
        3. Width based on risk profile
        4. Quantity based on capital / max_loss
        """
        structures = []
        spot = context["spot_price"]
        atm = context["atm_strike"]
        
        # Get OI walls
        resistance = context.get("resistance_strike", atm + step_size * 3)
        support = context.get("support_strike", atm - step_size * 3)
        
        # Determine short strikes (at or beyond OI walls)
        buffer = self.OTM_BUFFER[risk_profile]
        short_ce = max(resistance, atm + step_size * buffer)
        short_pe = min(support, atm - step_size * buffer)
        
        # Width for long protection
        width = self.SPREAD_WIDTHS[risk_profile]
        long_ce = short_ce + step_size * width
        long_pe = short_pe - step_size * width
        
        # Snap to valid strikes
        short_ce = self._snap_to_strike(short_ce, oc)
        short_pe = self._snap_to_strike(short_pe, oc)
        long_ce = self._snap_to_strike(long_ce, oc)
        long_pe = self._snap_to_strike(long_pe, oc)
        
        # Get option data
        short_ce_data = self._get_option_data(oc, short_ce, "CE")
        short_pe_data = self._get_option_data(oc, short_pe, "PE")
        long_ce_data = self._get_option_data(oc, long_ce, "CE")
        long_pe_data = self._get_option_data(oc, long_pe, "PE")
        
        if not all([short_ce_data, short_pe_data, long_ce_data, long_pe_data]):
            logger.warning("Missing option data for Iron Condor")
            return []
        
        # Calculate premiums
        net_credit = (
            short_ce_data.get("ltp", 0) + short_pe_data.get("ltp", 0)
            - long_ce_data.get("ltp", 0) - long_pe_data.get("ltp", 0)
        )
        
        # Max loss = width - credit
        width_value = abs(short_ce - long_ce)  # Same as PE side
        max_loss_per_lot = (width_value - net_credit) * lot_size
        max_profit_per_lot = net_credit * lot_size
        
        if max_loss_per_lot <= 0:
            logger.warning("Invalid Iron Condor: max_loss <= 0")
            return []
        
        # Position sizing
        qty = max(1, int(max_capital / max_loss_per_lot))
        
        # Build legs
        legs = [
            self._create_leg(short_ce_data, "CE", "SELL", qty, lot_size, short_ce),
            self._create_leg(long_ce_data, "CE", "BUY", qty, lot_size, long_ce),
            self._create_leg(short_pe_data, "PE", "SELL", qty, lot_size, short_pe),
            self._create_leg(long_pe_data, "PE", "BUY", qty, lot_size, long_pe),
        ]
        
        # Calculate full metrics via simulation
        metrics = self._calculate_metrics(legs, expiry, spot, max_capital)
        
        # Confidence based on OI alignment
        confidence = self._calculate_confidence(
            short_ce, short_pe, resistance, support, context
        )
        
        # Rationale
        rationale = (
            f"Short CE at {short_ce} near resistance OI wall ({resistance}). "
            f"Short PE at {short_pe} near support OI wall ({support}). "
            f"Width {width} strikes ({width_value} pts) per risk profile."
        )
        
        structures.append(OptimizedStructure(
            strategy_type=StrategyType.IRON_CONDOR.value,
            legs=legs,
            metrics=metrics,
            rationale=rationale,
            confidence=confidence,
            market_context=context
        ))
        
        return structures
    
    def _optimize_bull_put_spread(
        self,
        context: Dict[str, Any],
        oc: List[Dict[str, Any]],
        expiry: str,
        lot_size: int,
        risk_profile: RiskProfile,
        max_capital: float,
        step_size: float
    ) -> List[OptimizedStructure]:
        """Optimize Bull Put Spread (credit spread)."""
        structures = []
        spot = context["spot_price"]
        atm = context["atm_strike"]
        support = context.get("support_strike", atm - step_size * 3)
        
        buffer = self.OTM_BUFFER[risk_profile]
        width = self.SPREAD_WIDTHS[risk_profile]
        
        short_pe = min(support, atm - step_size * buffer)
        long_pe = short_pe - step_size * width
        
        short_pe = self._snap_to_strike(short_pe, oc)
        long_pe = self._snap_to_strike(long_pe, oc)
        
        short_pe_data = self._get_option_data(oc, short_pe, "PE")
        long_pe_data = self._get_option_data(oc, long_pe, "PE")
        
        if not short_pe_data or not long_pe_data:
            return []
        
        net_credit = short_pe_data.get("ltp", 0) - long_pe_data.get("ltp", 0)
        width_value = abs(short_pe - long_pe)
        max_loss_per_lot = (width_value - net_credit) * lot_size
        
        if max_loss_per_lot <= 0:
            return []
        
        qty = max(1, int(max_capital / max_loss_per_lot))
        
        legs = [
            self._create_leg(short_pe_data, "PE", "SELL", qty, lot_size, short_pe),
            self._create_leg(long_pe_data, "PE", "BUY", qty, lot_size, long_pe),
        ]
        
        metrics = self._calculate_metrics(legs, expiry, spot, max_capital)
        confidence = 0.7 if short_pe <= support else 0.5
        
        rationale = f"Sell PE at {short_pe} (support at {support}), buy protection at {long_pe}."
        
        structures.append(OptimizedStructure(
            strategy_type=StrategyType.BULL_PUT_SPREAD.value,
            legs=legs,
            metrics=metrics,
            rationale=rationale,
            confidence=confidence,
            market_context=context
        ))
        
        return structures
    
    def _optimize_bear_call_spread(
        self,
        context: Dict[str, Any],
        oc: List[Dict[str, Any]],
        expiry: str,
        lot_size: int,
        risk_profile: RiskProfile,
        max_capital: float,
        step_size: float
    ) -> List[OptimizedStructure]:
        """Optimize Bear Call Spread (credit spread)."""
        structures = []
        spot = context["spot_price"]
        atm = context["atm_strike"]
        resistance = context.get("resistance_strike", atm + step_size * 3)
        
        buffer = self.OTM_BUFFER[risk_profile]
        width = self.SPREAD_WIDTHS[risk_profile]
        
        short_ce = max(resistance, atm + step_size * buffer)
        long_ce = short_ce + step_size * width
        
        short_ce = self._snap_to_strike(short_ce, oc)
        long_ce = self._snap_to_strike(long_ce, oc)
        
        short_ce_data = self._get_option_data(oc, short_ce, "CE")
        long_ce_data = self._get_option_data(oc, long_ce, "CE")
        
        if not short_ce_data or not long_ce_data:
            return []
        
        net_credit = short_ce_data.get("ltp", 0) - long_ce_data.get("ltp", 0)
        width_value = abs(short_ce - long_ce)
        max_loss_per_lot = (width_value - net_credit) * lot_size
        
        if max_loss_per_lot <= 0:
            return []
        
        qty = max(1, int(max_capital / max_loss_per_lot))
        
        legs = [
            self._create_leg(short_ce_data, "CE", "SELL", qty, lot_size, short_ce),
            self._create_leg(long_ce_data, "CE", "BUY", qty, lot_size, long_ce),
        ]
        
        metrics = self._calculate_metrics(legs, expiry, spot, max_capital)
        confidence = 0.7 if short_ce >= resistance else 0.5
        
        rationale = f"Sell CE at {short_ce} (resistance at {resistance}), buy protection at {long_ce}."
        
        structures.append(OptimizedStructure(
            strategy_type=StrategyType.BEAR_CALL_SPREAD.value,
            legs=legs,
            metrics=metrics,
            rationale=rationale,
            confidence=confidence,
            market_context=context
        ))
        
        return structures
    
    def _optimize_long_straddle(
        self,
        context: Dict[str, Any],
        oc: List[Dict[str, Any]],
        expiry: str,
        lot_size: int,
        risk_profile: RiskProfile,
        max_capital: float
    ) -> List[OptimizedStructure]:
        """Optimize Long Straddle (ATM buy)."""
        structures = []
        spot = context["spot_price"]
        atm = context["atm_strike"]
        
        ce_data = self._get_option_data(oc, atm, "CE")
        pe_data = self._get_option_data(oc, atm, "PE")
        
        if not ce_data or not pe_data:
            return []
        
        total_premium = ce_data.get("ltp", 0) + pe_data.get("ltp", 0)
        max_loss_per_lot = total_premium * lot_size
        
        if max_loss_per_lot <= 0:
            return []
        
        qty = max(1, int(max_capital / max_loss_per_lot))
        
        legs = [
            self._create_leg(ce_data, "CE", "BUY", qty, lot_size, atm),
            self._create_leg(pe_data, "PE", "BUY", qty, lot_size, atm),
        ]
        
        metrics = self._calculate_metrics(legs, expiry, spot, max_capital)
        confidence = 0.6  # Straddles have lower base confidence
        
        rationale = f"Buy ATM straddle at {atm}. Premium paid: {total_premium:.2f}. Breakevens at {atm - total_premium:.0f} and {atm + total_premium:.0f}."
        
        structures.append(OptimizedStructure(
            strategy_type=StrategyType.LONG_STRADDLE.value,
            legs=legs,
            metrics=metrics,
            rationale=rationale,
            confidence=confidence,
            market_context=context
        ))
        
        return structures
    
    def _optimize_short_straddle(
        self,
        context: Dict[str, Any],
        oc: List[Dict[str, Any]],
        expiry: str,
        lot_size: int,
        risk_profile: RiskProfile,
        max_capital: float
    ) -> List[OptimizedStructure]:
        """Optimize Short Straddle (ATM sell)."""
        structures = []
        spot = context["spot_price"]
        atm = context["atm_strike"]
        
        ce_data = self._get_option_data(oc, atm, "CE")
        pe_data = self._get_option_data(oc, atm, "PE")
        
        if not ce_data or not pe_data:
            return []
        
        total_credit = ce_data.get("ltp", 0) + pe_data.get("ltp", 0)
        
        # For naked straddle, risk is unlimited - use margin estimate
        estimated_margin = spot * lot_size * 0.15  # ~15% of notional
        
        qty = max(1, int(max_capital / estimated_margin))
        
        legs = [
            self._create_leg(ce_data, "CE", "SELL", qty, lot_size, atm),
            self._create_leg(pe_data, "PE", "SELL", qty, lot_size, atm),
        ]
        
        metrics = self._calculate_metrics(legs, expiry, spot, max_capital)
        confidence = 0.5 if risk_profile == RiskProfile.AGGRESSIVE else 0.3
        
        rationale = f"Sell ATM straddle at {atm}. Credit received: {total_credit:.2f}. High risk - unlimited loss potential."
        
        structures.append(OptimizedStructure(
            strategy_type=StrategyType.SHORT_STRADDLE.value,
            legs=legs,
            metrics=metrics,
            rationale=rationale,
            confidence=confidence,
            market_context=context
        ))
        
        return structures
    
    # --------------------------------------------------------
    # HELPERS
    # --------------------------------------------------------
    
    def _build_market_context(
        self,
        coa_result: Dict[str, Any],
        spot_price: float,
        atm_strike: float,
        option_chain: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Build market context from COA and option chain."""
        context = {
            "spot_price": spot_price,
            "atm_strike": atm_strike,
            "timestamp": datetime.now().isoformat()
        }
        
        # Extract COA levels
        if coa_result:
            support = coa_result.get("support", {})
            resistance = coa_result.get("resistance", {})
            levels = coa_result.get("levels", {})
            
            context["support_strike"] = support.get("strike100", atm_strike - 150)
            context["resistance_strike"] = resistance.get("strike100", atm_strike + 150)
            context["support_strength"] = support.get("strength", "Unknown")
            context["resistance_strength"] = resistance.get("strength", "Unknown")
            context["eos"] = levels.get("eos", atm_strike - 100)
            context["eor"] = levels.get("eor", atm_strike + 100)
            context["scenario"] = coa_result.get("scenario", {}).get("id", "Unknown")
        
        # Calculate ATM IV
        atm_ce = self._get_option_data(option_chain, atm_strike, "CE")
        atm_pe = self._get_option_data(option_chain, atm_strike, "PE")
        if atm_ce and atm_pe:
            context["atm_iv"] = (atm_ce.get("iv", 15) + atm_pe.get("iv", 15)) / 2
        
        return context
    
    def _get_option_data(
        self,
        oc: List[Dict[str, Any]],
        strike: float,
        option_type: str
    ) -> Optional[Dict[str, Any]]:
        """Get option data for a specific strike and type."""
        for opt in oc:
            if abs(opt.get("strike", 0) - strike) < 1 and opt.get("option_type") == option_type:
                return opt
        return None
    
    def _snap_to_strike(
        self,
        target: float,
        oc: List[Dict[str, Any]]
    ) -> float:
        """Snap to nearest valid strike in option chain."""
        strikes = sorted(set(opt.get("strike", 0) for opt in oc))
        if not strikes:
            return target
        
        closest = min(strikes, key=lambda s: abs(s - target))
        return closest
    
    def _create_leg(
        self,
        opt_data: Dict[str, Any],
        option_type: str,
        action: str,
        qty: int,
        lot_size: int,
        strike: float
    ) -> OptimizedLeg:
        """Create an OptimizedLeg from option data."""
        return OptimizedLeg(
            strike=strike,
            option_type=option_type,
            action=action,
            qty=qty,
            lot_size=lot_size,
            ltp=opt_data.get("ltp", 0),
            iv=opt_data.get("iv", 15),
            delta=opt_data.get("delta", 0),
            gamma=opt_data.get("gamma", 0),
            theta=opt_data.get("theta", 0),
            vega=opt_data.get("vega", 0)
        )
    
    def _calculate_metrics(
        self,
        legs: List[OptimizedLeg],
        expiry: str,
        spot: float,
        max_capital: float
    ) -> StructureMetrics:
        """Calculate comprehensive metrics for a structure."""
        # Convert to simulation legs
        sim_legs = [leg.to_simulation_leg(expiry) for leg in legs]
        
        # Use simulation service for POP and breakevens
        try:
            pop_result = self.sim.calculate_probability_of_profit(
                legs=sim_legs,
                current_spot=spot,
                current_date=datetime.now()
            )
            pop = pop_result.get("probability_of_profit", 50)
            breakevens = pop_result.get("breakevens", [])
        except Exception as e:
            logger.warning(f"POP calculation failed: {e}")
            pop = 50
            breakevens = []
        
        # Calculate net premium
        net_credit = sum(
            leg.ltp * leg.total_qty * (1 if leg.action == "SELL" else -1)
            for leg in legs
        )
        
        # Net Greeks
        net_delta = sum(
            leg.delta * leg.total_qty * (1 if leg.action == "BUY" else -1)
            for leg in legs
        )
        net_gamma = sum(
            leg.gamma * leg.total_qty * (1 if leg.action == "BUY" else -1)
            for leg in legs
        )
        net_theta = sum(
            leg.theta * leg.total_qty * (-1 if leg.action == "BUY" else 1)
            for leg in legs
        )
        net_vega = sum(
            leg.vega * leg.total_qty * (1 if leg.action == "BUY" else -1)
            for leg in legs
        )
        
        # Estimate max profit/loss (simplified for spreads)
        # For proper calculation, use payoff surface
        if net_credit > 0:  # Credit strategy
            max_profit = net_credit
            # Max loss depends on strategy type
            buy_legs = [l for l in legs if l.action == "BUY"]
            sell_legs = [l for l in legs if l.action == "SELL"]
            if buy_legs and sell_legs:
                # Spread width
                width = abs(buy_legs[0].strike - sell_legs[0].strike) * buy_legs[0].total_qty
                max_loss = width - net_credit
            else:
                max_loss = max_capital  # Naked - unlimited
        else:  # Debit strategy
            max_loss = abs(net_credit)
            max_profit = float('inf')  # Unlimited for long straddle etc.
        
        risk_reward = max_profit / max_loss if max_loss > 0 else 0
        
        # Margin estimate (simplified)
        margin = max_loss * 1.2 if max_loss < max_capital else max_capital
        
        return StructureMetrics(
            max_profit=max_profit,
            max_loss=max_loss,
            net_credit=net_credit,
            probability_of_profit=pop,
            breakevens=breakevens,
            net_delta=net_delta,
            net_gamma=net_gamma,
            net_theta=net_theta,
            net_vega=net_vega,
            risk_reward_ratio=risk_reward,
            margin_required=margin,
            capital_at_risk=min(max_loss, max_capital)
        )
    
    def _calculate_confidence(
        self,
        short_ce: float,
        short_pe: float,
        resistance: float,
        support: float,
        context: Dict[str, Any]
    ) -> float:
        """
        Calculate confidence score (0-1) based on:
        - How well strikes align with OI walls
        - COA scenario quality
        - Greeks balance
        """
        score = 0.5  # Base
        
        # OI alignment bonus
        if short_ce >= resistance:
            score += 0.15
        if short_pe <= support:
            score += 0.15
        
        # COA scenario bonus
        scenario = context.get("scenario", "")
        if scenario in ["1.0", "2.0", "3.0"]:  # Tradeable scenarios
            score += 0.1
        
        # Strength bonus
        if context.get("resistance_strength") == "Strong":
            score += 0.05
        if context.get("support_strength") == "Strong":
            score += 0.05
        
        return min(1.0, score)


# ============================================================
# FACTORY
# ============================================================

_leg_optimizer_instance = None

def get_leg_optimizer() -> LegOptimizer:
    """Get singleton instance of LegOptimizer."""
    global _leg_optimizer_instance
    if _leg_optimizer_instance is None:
        _leg_optimizer_instance = LegOptimizer()
    return _leg_optimizer_instance

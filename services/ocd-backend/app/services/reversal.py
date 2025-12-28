"""
Reversal Detection Service
Advanced reversal point prediction with trading signals
Ported from BSM.py and reversal.py
"""
import math
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

import numpy as np
from scipy.stats import norm

from app.services.bsm import BSMService
from app.services.greeks import GreeksService, AdvancedGreeks


@dataclass
class TradingSignals:
    """Trading signal results"""
    entry: float
    stop_loss: float
    take_profit: float
    risk_reward: float


@dataclass
class ReversalResult:
    """Complete reversal calculation result"""
    strike_price: float
    reversal: float
    wkly_reversal: float
    rs: float  # Reversal Support
    rr: float  # Reversal Resistance
    ss: float  # Support/Resistance
    sr_diff: float
    fut_reversal: float
    ce_tv: float  # Call theoretical value
    pe_tv: float  # Put theoretical value
    confidence: int  # 0-100
    direction: str  # bullish, bearish, neutral
    price_range: Dict[str, float]
    trading_signals: TradingSignals
    market_regimes: Dict[str, str]
    recommended_strategy: str
    alert: Dict[str, str]
    call_greeks: Dict[str, float]
    put_greeks: Dict[str, float]
    debug_data: Dict = field(default_factory=dict)


class ReversalService:
    """
    Comprehensive reversal point detection service.
    Uses BSM, Greeks, and advanced analysis to predict reversal points.
    """
    
    def __init__(self, risk_free_rate: float = 0.10):
        self.r = risk_free_rate
        self.bsm = BSMService(risk_free_rate)
        self.greeks_service = GreeksService(risk_free_rate)
    
    def detect_volatility_regime(
        self,
        iv_series: List[float],
        low_threshold: float = 0.15,
        medium_threshold: float = 0.30
    ) -> str:
        """Detect market volatility regime based on IV levels."""
        if not iv_series:
            return "medium"
        
        avg_iv = sum(iv_series) / len(iv_series)
        
        if avg_iv < low_threshold:
            return "low"
        elif avg_iv < medium_threshold:
            return "medium"
        return "high"
    
    def detect_trend_regime(
        self,
        price_series: List[float],
        window: int = 5,
        threshold_ratio: float = 0.0005
    ) -> str:
        """Detect market trend regime based on recent price action."""
        if len(price_series) < window:
            return "sideways"
        
        recent = price_series[-window:]
        first_price = recent[0]
        last_price = recent[-1]
        
        if first_price == 0:
            return "sideways"
        
        change_ratio = (last_price - first_price) / first_price
        
        if change_ratio > threshold_ratio:
            return "uptrend"
        elif change_ratio < -threshold_ratio:
            return "downtrend"
        return "sideways"
    
    def _calculate_liquidity_gravity(
        self, 
        ce_oi: float, 
        pe_oi: float, 
        avg_ce_oi: float, 
        avg_pe_oi: float
    ) -> tuple:
        """
        Calculate liquidity ratio and gravity factor.
        Returns: (liquidity_ratio, gravity)
        """
        avg_oi_safe = max(avg_ce_oi + avg_pe_oi, 1) / 2
        strike_oi = ce_oi + pe_oi
        ratio = strike_oi / avg_oi_safe
        
        # Gravity logic: If OI is huge (>2x average), it anchors the price closer to Strike
        # If OI is low, price is free to drift with Greeks
        # Gravity range: 0.0 to 0.4 (max 40% dampening)
        gravity = min(0.4, max(0, (ratio - 1) * 0.1))
        return ratio, gravity

    def expected_price_range(
        self, 
        S: float, 
        iv: float, 
        T_days: float, 
        confidence: float = 0.68
    ) -> tuple:
        """Calculate expected price range - delegates to BSMService."""
        # Note: BSMService.expected_price_range takes T_days as int, we have float
        return self.bsm.expected_price_range(S, iv, int(T_days), confidence)
    
    def weekly_theta_decay(self, T_days: float) -> float:
        """Calculate weekly theta decay factor - delegates to BSMService."""
        return self.bsm.weekly_theta_decay(int(T_days))
    
    def round_to_tick(self, price: float, tick_size: float = 0.05) -> float:
        """Round price to the nearest tick size."""
        return round(round(price / tick_size) * tick_size, 2)

    def adjusted_reversal_price(
        self,
        curr_call_price: float,
        curr_put_price: float,
        strike: float,
        call_theoretical: float,
        put_theoretical: float,
        call_iv: float,
        put_iv: float,
        alpha: float,
        pe_delta: float,
        ce_delta: float,
        ce_gamma: float = 0.0,
        pe_gamma: float = 0.0,
        gravity: float = 0.0
    ) -> tuple:
        """
        Calculate adjusted reversal prices with Liquidity Gravity.
        Returns: (wkly_rev, rs, rr, ss)
        """
        dampener = 1.0 - gravity
        
        # Gamma-weighted weekly reversal (trust the leg with higher sensitivity)
        put_diff = curr_put_price - put_theoretical
        call_diff = curr_call_price - call_theoretical
        
        total_gamma = abs(ce_gamma) + abs(pe_gamma)
        if total_gamma > 0.0001:
            weighted_diff = (put_diff * abs(pe_gamma) + call_diff * abs(ce_gamma)) / total_gamma
        else:
            weighted_diff = put_diff + call_diff  # Fallback to simple sum
            
        # Apply gravity dampener
        wkly_rev = strike + (weighted_diff * dampener)
        
        # RR (Resistance Reversal)
        rr_raw_adj = (
            (abs(curr_put_price - put_theoretical) - 
             abs(curr_call_price - call_theoretical)) -
            alpha * (put_iv - call_iv)
        )
        rr = strike + (rr_raw_adj * dampener)
        
        # RS (Reversal Support)
        rs_raw_adj = (
            ((curr_put_price - put_theoretical) * pe_delta) -
            ((curr_call_price - call_theoretical) * ce_delta) +
            alpha * (put_iv - call_iv)
        )
        rs = strike + (rs_raw_adj * dampener)
        
        # SS (Support Support)
        ss_raw_adj = (
            ((curr_call_price - call_theoretical) - 
             (curr_put_price - put_theoretical)) -
            alpha * (call_iv - put_iv)
        )
        ss = strike - (ss_raw_adj * dampener)
        
        return (
            self.round_to_tick(wkly_rev),
            self.round_to_tick(rs),
            self.round_to_tick(rr),
            self.round_to_tick(ss)
        )
    
    def compute_reversal_features(
        self,
        K: float,
        ce_greeks: AdvancedGreeks,
        pe_greeks: AdvancedGreeks
    ) -> Dict[str, Any]:
        """
        Compute reversal features per strike using advanced Greeks.
        Ported from avp.py compute_reversal_features_per_strike()
        """
        net_delta = ce_greeks.delta + pe_greeks.delta
        net_gamma = ce_greeks.gamma + pe_greeks.gamma
        net_vega = ce_greeks.vega + pe_greeks.vega
        net_vanna = ce_greeks.vanna + pe_greeks.vanna
        net_vomma = ce_greeks.vomma + pe_greeks.vomma
        net_charm = ce_greeks.charm + pe_greeks.charm
        net_color = ce_greeks.color + pe_greeks.color
        net_speed = ce_greeks.speed + pe_greeks.speed
        
        # Advanced Greek features
        vanna_gamma = net_vanna * net_gamma
        vomma_vanna_ratio = net_vomma / max(abs(net_vanna), 1e-5)
        charm_color_sum = abs(net_charm) + abs(net_color)
        speed_gamma_ratio = net_speed / max(abs(net_gamma), 1e-5)
        
        # Composite Weighted Score (lower = better reversal candidate)
        composite_score = (
            0.25 * abs(net_delta) +
            0.30 * abs(net_gamma) +
            0.20 * abs(net_vanna) +
            0.15 * abs(net_charm) +
            0.10 * abs(net_vomma)
        )
        
        return {
            "strike": K,
            "net_delta": net_delta,
            "net_gamma": net_gamma,
            "net_vega": net_vega,
            "net_vanna": net_vanna,
            "net_vomma": net_vomma,
            "net_charm": net_charm,
            "net_color": net_color,
            "vanna_gamma": vanna_gamma,
            "vomma_vanna_ratio": vomma_vanna_ratio,
            "charm_color_sum": charm_color_sum,
            "speed_gamma_ratio": speed_gamma_ratio,
            "composite_score": composite_score,
        }

    def advanced_reversal_point(
        self,
        K: float,
        spot_price: float,
        T_days: float,
        current_iv: float,
        iv_chng: float,
        ce_greeks: AdvancedGreeks,
        pe_greeks: AdvancedGreeks,
        curr_call_price: float,
        curr_put_price: float,
        call_theoretical: float,
        put_theoretical: float,
        ce_oi: float = 0,
        pe_oi: float = 0,
        avg_ce_oi: float = 1,
        avg_pe_oi: float = 1,
        S_chng: float = 1.0,
        instrument_type: str = "IDX",
        vol_chng: float = 0.01,
        time_chng: float = 1/365,
        gravity: float = 0.0,
        liquidity_ratio: float = 1.0
    ) -> tuple:
        """
        Calculate advanced reversal point using 11 Greek orders AND Liquidity Gravity.
        Full implementation ported from avp.py advanced_reversal_point()
        """
        if T_days <= 0:
            return (K, 0, {})
        
        # ===== NET GREEKS CALCULATION =====
        # First-order nets
        net_delta = ce_greeks.delta + pe_greeks.delta
        net_gamma = ce_greeks.gamma + pe_greeks.gamma
        net_vega = ce_greeks.vega + pe_greeks.vega
        net_theta = ce_greeks.theta + pe_greeks.theta
        net_rho = ce_greeks.rho + pe_greeks.rho
        
        # Second-order nets
        net_vomma = ce_greeks.vomma + pe_greeks.vomma
        net_vanna = ce_greeks.vanna + pe_greeks.vanna
        net_charm = ce_greeks.charm + pe_greeks.charm
        
        # Third-order nets
        net_speed = ce_greeks.speed + pe_greeks.speed
        net_zomma = ce_greeks.zomma + pe_greeks.zomma
        net_color = ce_greeks.color + pe_greeks.color
        net_ultima = ce_greeks.ultima + pe_greeks.ultima
        
        # ===== CONTRIBUTION CALCULATIONS =====
        # First-order contributions
        delta_effect = net_delta * S_chng
        gamma_effect = 0.5 * net_gamma * (S_chng ** 2)
        vega_effect = net_vega * iv_chng
        theta_effect = net_theta * time_chng
        rho_effect = net_rho * 0.001  # 1bp rate change
        
        # Second-order contributions (critical for accuracy)
        vomma_effect = 0.5 * net_vomma * (iv_chng ** 2)  # Vega convexity
        vanna_effect = net_vanna * S_chng * iv_chng  # Cross delta-vol
        charm_effect = net_charm * time_chng  # Delta time decay
        
        # Third-order contributions (fine-tuning)
        speed_effect = (1/6) * net_speed * (S_chng ** 3)  # Gamma acceleration
        zomma_effect = net_zomma * S_chng * iv_chng  # Gamma-vol cross
        color_effect = net_color * time_chng  # Gamma time decay
        ultima_effect = (1/6) * net_ultima * (iv_chng ** 3)  # Vomma acceleration
        
        # ===== INTELLIGENT WEIGHTING SYSTEM =====
        # Time-based weighting (near expiry emphasizes higher-order Greeks)
        if T_days <= 5:  # Weekly expiry - higher-order Greeks dominate
            w1, w2, w3 = 0.4, 0.4, 0.2
            volatility_multiplier = 1.5
        elif T_days <= 15:  # Bi-weekly
            w1, w2, w3 = 0.5, 0.35, 0.15
            volatility_multiplier = 1.3
        elif T_days <= 30:  # Monthly
            w1, w2, w3 = 0.6, 0.3, 0.1
            volatility_multiplier = 1.1
        else:  # Longer dated
            w1, w2, w3 = 0.7, 0.25, 0.05
            volatility_multiplier = 1.0
        
        # Volatility regime adjustment
        if current_iv > 30:  # High vol - emphasize vega-related Greeks
            vega_boost = 1.4
            vomma_boost = 1.6
            ultima_boost = 1.3
        elif current_iv < 12:  # Low vol - emphasize delta/gamma
            vega_boost = 0.8
            vomma_boost = 0.7
            ultima_boost = 0.6
        else:  # Normal vol
            vega_boost = vomma_boost = ultima_boost = 1.0
        
        # ===== WEIGHTED CONTRIBUTIONS =====
        first_order_total = (
            delta_effect +
            gamma_effect +
            (vega_effect * vega_boost) +
            theta_effect +
            rho_effect
        )
        
        second_order_total = (
            (vomma_effect * vomma_boost) + vanna_effect + charm_effect
        ) * volatility_multiplier
        
        third_order_total = (
            speed_effect + zomma_effect + color_effect + (ultima_effect * ultima_boost)
        ) * (volatility_multiplier ** 1.5)
        
        # ===== FINAL ADJUSTMENT CALCULATION =====
        total_greek_adjustment = (
            first_order_total * w1 + second_order_total * w2 + third_order_total * w3
        )
        
        # Apply gravity to the adjustment (dampening the theoretical drift)
        total_greek_adjustment = total_greek_adjustment * (1 - gravity)
        
        # Price discrepancy factor
        price_discrepancy = (curr_call_price - call_theoretical) + (curr_put_price - put_theoretical)
        
        # ===== DYNAMIC BOUNDS (NEW) =====
        # Replace hardcoded logic with Volatility-based Stdv
        # 1 Stdv move roughly = Spot * IV * sqrt(T)
        implied_move_today = spot_price * (current_iv / 100) * math.sqrt(1/365)
        # Allow up to 3 standard deviations of "adjustment"
        dynamic_max_adj = max(10.0, implied_move_today * 3.0)
        
        max_adjustment = min(dynamic_max_adj, K * 0.02) # Cap at 2% of strike to check infinity
        
        # Apply hyperbolic tangent for smooth bounds
        bounded_adjustment = math.tanh(total_greek_adjustment / max(max_adjustment, 1)) * max_adjustment
        
        # Final reversal point
        reversal_point = self.round_to_tick(K + bounded_adjustment)
        
        # ===== ADVANCED CONFIDENCE SCORING =====
        greek_magnitudes = [
            abs(net_delta), abs(net_gamma), abs(net_vega), abs(net_theta),
            abs(net_vomma), abs(net_vanna), abs(net_charm),
            abs(net_speed), abs(net_zomma), abs(net_color), abs(net_ultima)
        ]
        
        # Higher-order Greek significance
        higher_order_significance = sum(greek_magnitudes[4:]) / max(sum(greek_magnitudes[:4]), 0.001)
        
        # Time-volatility confidence
        time_vol_confidence = min(100, (T_days * current_iv) / 10)
        
        # Overall confidence
        base_confidence = 60 + min(30, higher_order_significance * 20)
        final_confidence = round(min(95, base_confidence + time_vol_confidence * 0.1))
        
        # ===== COMPREHENSIVE DEBUG OUTPUT =====
        debug_data = {
            "reversal_point": reversal_point,
            "confidence_score": final_confidence,
            "liquidity_adjustment": {
                "ratio": liquidity_ratio,
                "gravity": gravity
            },
            "greek_breakdown": {
                "first_order": {
                    "delta": delta_effect,
                    "gamma": gamma_effect,
                    "vega": vega_effect,
                    "theta": theta_effect,
                    "rho": rho_effect,
                    "total": first_order_total,
                },
                "second_order": {
                    "vomma": vomma_effect,
                    "vanna": vanna_effect,
                    "charm": charm_effect,
                    "total": second_order_total,
                },
                "third_order": {
                    "speed": speed_effect,
                    "zomma": zomma_effect,
                    "color": color_effect,
                    "ultima": ultima_effect,
                    "total": third_order_total,
                },
            },
            "market_factors": {
                "price_discrepancy": price_discrepancy,
                "volatility_regime": "high" if current_iv > 30 else ("low" if current_iv < 12 else "normal"),
                "time_regime": "near_expiry" if T_days <= 5 else "normal",
                "max_adjustment_bound": max_adjustment,
            },
            "weights_applied": {"w1": w1, "w2": w2, "w3": w3},
            "higher_order_significance": higher_order_significance,
            "reversal_features": self.compute_reversal_features(K, ce_greeks, pe_greeks),
        }
        
        return (reversal_point, final_confidence, debug_data)
    
    def calculate_reversal(
        self,
        spot: float,
        spot_change: float,
        iv_change: float,
        strike: float,
        T_days: float,
        sigma_call: float,
        sigma_put: float,
        curr_call_price: float,
        curr_put_price: float,
        fut_price: float = 0,
        atmiv: float = 0,
        instrument_type: str = "IDX",
        ce_oi: float = 0,
        pe_oi: float = 0,
        avg_ce_oi: float = 1,
        avg_pe_oi: float = 1
    ) -> ReversalResult:
        """
        Complete reversal calculation matching original get_reversal function.
        """
        try:
            # Normalize inputs
            S = round(float(spot), 4)
            K = float(strike)
            T = T_days / 365
            sigma_call = float(sigma_call) / 100
            sigma_put = float(sigma_put) / 100
            
            # Handle zero IVs
            if sigma_call <= 0:
                sigma_call = sigma_put if sigma_put > 0 else 0.15
            if sigma_put <= 0:
                sigma_put = sigma_call if sigma_call > 0 else 0.15
            
            # Calculate theoretical prices
            call_theoretical = self.bsm.price(S, K, T, sigma_call, "call")
            put_theoretical = self.bsm.price(S, K, T, sigma_put, "put")
            
            # Calculate Greeks
            ce_greeks = self.greeks_service.calculate_all_greeks(
                S, K, T, sigma_call, "call"
            )
            pe_greeks = self.greeks_service.calculate_all_greeks(
                S, K, T, sigma_put, "put"
            )
            
            # Standard Greeks dictionaries
            call_greeks_dict = {
                "delta": ce_greeks.delta,
                "gamma": ce_greeks.gamma,
                "theta": ce_greeks.theta,
                "vega": ce_greeks.vega,
                "rho": ce_greeks.rho,
            }
            put_greeks_dict = {
                "delta": pe_greeks.delta,
                "gamma": pe_greeks.gamma,
                "theta": pe_greeks.theta,
                "vega": pe_greeks.vega,
                "rho": pe_greeks.rho,
            }
            
            # Alpha for reversal calculations
            alpha = put_theoretical - call_theoretical
            
            # Calculate liquidity adjustments (Gravity)
            liq_ratio, gravity = self._calculate_liquidity_gravity(
                ce_oi, pe_oi, avg_ce_oi, avg_pe_oi
            )
            
            # Adjusted reversal prices (All types now respect gravity)
            wkly_rev, rs, rr, ss = self.adjusted_reversal_price(
                curr_call_price, curr_put_price, K,
                call_theoretical, put_theoretical,
                sigma_call, sigma_put, alpha,
                pe_greeks.delta, ce_greeks.delta,
                ce_greeks.gamma, pe_greeks.gamma,
                gravity=gravity
            )
            
            # Advanced reversal point (Main Reversal)
            rev, confidence, debug_data = self.advanced_reversal_point(
                K=K,
                spot_price=S,
                T_days=T_days,
                current_iv=atmiv if atmiv > 0 else (sigma_call + sigma_put) / 2 * 100,
                iv_chng=iv_change,
                ce_greeks=ce_greeks,
                pe_greeks=pe_greeks,
                curr_call_price=curr_call_price,
                curr_put_price=curr_put_price,
                call_theoretical=call_theoretical,
                put_theoretical=put_theoretical,
                ce_oi=ce_oi,
                pe_oi=pe_oi,
                avg_ce_oi=avg_ce_oi,
                avg_pe_oi=avg_pe_oi,
                S_chng=spot_change,
                instrument_type=instrument_type,
                gravity=gravity,
                liquidity_ratio=liq_ratio
            )
            
            # IV skew analysis
            iv_skew = sigma_call - sigma_put
            if abs(iv_skew) > 0.01:
                weight = 0.5 + (iv_skew / max(sigma_call, sigma_put)) * 0.5
                volatility_weight = max(0, min(1, weight))
            else:
                volatility_weight = 0.5
            
            effective_iv = volatility_weight * sigma_call + (1 - volatility_weight) * sigma_put
            
            # Expected price range
            price_low, price_high = self.expected_price_range(S, effective_iv, T_days)
            range_pct = (price_high - price_low) / S if S > 0 else 0
            rr_base = 2.5 if range_pct < 0.01 else (1.5 if range_pct < 0.02 else 1.0)
            
            # Trading signals
            entry_price = round(rev, 2)
            stop_loss = round(rev - (rev * 0.005 * rr_base), 2)
            take_profit = round(entry_price + (entry_price - stop_loss) * rr_base, 2)
            
            risk = entry_price - stop_loss
            reward = take_profit - entry_price
            risk_reward = round(reward / risk, 2) if risk > 0 else 0
            
            # Direction
            direction = "neutral"
            if rev > S + 10:
                direction = "bullish"
            elif rev < S - 10:
                direction = "bearish"
            
            # Market regimes
            iv_series = [sigma_call * 100, sigma_put * 100]
            vol_regime = self.detect_volatility_regime([s / 100 for s in iv_series])
            trend_regime = self.detect_trend_regime([S])
            
            liquidity_regime = "high" if liq_ratio > 1.1 else ("medium" if liq_ratio > 0.9 else "low")
            
            # Recommended strategy
            if vol_regime == "high" and trend_regime == "sideways":
                strategy = "Iron Condor"
            elif vol_regime == "high" and trend_regime in ["uptrend", "downtrend"]:
                strategy = "Calendar Spread"
            elif vol_regime == "low" and trend_regime != "sideways":
                strategy = "Vertical Spread"
            else:
                strategy = "Reversal"
            
            # Alert level based on distance from reversal
            current_distance = abs(S - rev)
            strike_distance = 100  # Default
            
            if current_distance < 0.3 * strike_distance:
                alert_level = "high"
                alert_message = f"Price near reversal point ({rev})"
            elif current_distance < 0.7 * strike_distance:
                alert_level = "medium"
                alert_message = f"Price approaching reversal ({rev})"
            else:
                alert_level = "low"
                alert_message = "Monitoring"
            
            # Future reversal
            fut_rev = self.round_to_tick(rev + (fut_price - S)) if fut_price > 0 else rev
            sr_diff = self.round_to_tick(wkly_rev - rr)
            
            return ReversalResult(
                strike_price=K,
                reversal=rev,
                wkly_reversal=wkly_rev,
                rs=rs,
                rr=rr,
                ss=ss,
                sr_diff=sr_diff,
                fut_reversal=fut_rev,
                ce_tv=call_theoretical,
                pe_tv=put_theoretical,
                confidence=confidence,
                direction=direction,
                price_range={
                    "low": price_low,
                    "high": price_high,
                    "confidence": 0.68
                },
                trading_signals=TradingSignals(
                    entry=entry_price,
                    stop_loss=stop_loss,
                    take_profit=take_profit,
                    risk_reward=risk_reward
                ),
                market_regimes={
                    "volatility": vol_regime,
                    "trend": trend_regime,
                    "liquidity": liquidity_regime
                },
                recommended_strategy=strategy,
                alert={"level": alert_level, "message": alert_message},
                call_greeks=call_greeks_dict,
                put_greeks=put_greeks_dict,
                debug_data=debug_data
            )
            
        except Exception as e:
            # Return minimal result on error
            return ReversalResult(
                strike_price=strike,
                reversal=strike,
                wkly_reversal=strike,
                rs=strike, rr=strike, ss=strike,
                sr_diff=0, fut_reversal=strike,
                ce_tv=0, pe_tv=0,
                confidence=0,
                direction="neutral",
                price_range={"low": 0, "high": 0, "confidence": 0},
                trading_signals=TradingSignals(strike, strike, strike, 0),
                market_regimes={"volatility": "unknown", "trend": "unknown", "liquidity": "unknown"},
                recommended_strategy="None",
                alert={"level": "error", "message": str(e)},
                call_greeks={}, put_greeks={},
                debug_data={"error": str(e)}
            )


# Singleton instance
reversal_service = ReversalService()

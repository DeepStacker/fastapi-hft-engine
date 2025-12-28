"""
Consolidated Analytics Engine

Unified analytics module that replaces scattered analyzer implementations.
All analytics logic consolidated into single, reusable modules.

For millions of transactions/sec, this reduces code duplication and improves maintainability.
"""

from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from datetime import datetime
import numpy as np

# Import consolidated stateless analytics
from core.analytics.stateless import (
    calculate_pcr_detailed,
    calculate_max_pain,
    calculate_rankings
)

# Processor analyzers (stateless - no DB dependency)
from services.processor.analyzers.bsm import BSMPricer
from services.processor.analyzers.futures_basis import FuturesBasisAnalyzer
from services.processor.analyzers.vix_divergence import VixDivergenceAnalyzer
from services.processor.analyzers.gamma_exposure import GammaExposureAnalyzer
from services.processor.analyzers.iv_skew_analyzer import IVSkewAnalyzer
from services.processor.analyzers.reversal import ReversalAnalyzer

# Analytics analyzers (stateful - require historical data)
from services.analytics.analyzers.cumulative_oi import CumulativeOIAnalyzer
from services.analytics.analyzers.velocity import VelocityAnalyzer
from services.analytics.analyzers.patterns import PatternDetector
from services.analytics.analyzers.zones import SupportResistanceAnalyzer
from services.analytics.analyzers.liquidity import LiquidityStressAnalyzer
from services.analytics.analyzers.order_flow import OrderFlowToxicityAnalyzer
from services.analytics.analyzers.smart_money import SmartMoneyDetector


@dataclass
class AnalyticsRequest:
    """Unified request for all analytics"""
    symbol_id: int
    expiry: str
    timestamp: datetime
    options: List[Any]  # List of option data
    historical_data: Optional[List[Any]] = None  # For stateful analytics
    spot_price: Optional[float] = None
    futures_price: Optional[float] = None
    vix_value: Optional[float] = None


@dataclass
class AnalyticsResult:
    """Unified result for all analytics"""
    # Stateless analytics (Processor)
    pcr: Optional[Dict] = None
    max_pain: Optional[Dict] = None
    futures_basis: Optional[Dict] = None
    vix_divergence: Optional[Dict] = None
    gamma_exposure: Optional[Dict] = None
    iv_skew: Optional[Dict] = None
    
    # Stateful analytics (Analytics Service)
    cumulative_oi: Optional[Dict] = None
    velocity: Optional[Dict] = None
    patterns: Optional[List[Dict]] = None
    zones: Optional[Dict] = None
    liquidity_stress: Optional[Dict] = None
    order_flow_toxicity: Optional[Dict] = None
    smart_money: Optional[Dict] = None


class ConsolidatedAnalyticsEngine:
    """
    Single analytics engine that replaces duplicate implementations.
    
    Benefits:
    - No code duplication
    - Consistent calculations across services
    - Easy to maintain and test
    - Better performance (shared caching)
    """
    
    def __init__(self):
        # Initialize stateless analyzers (Processor)
        self.bsm_pricer = BSMPricer()
        self.futures_analyzer = FuturesBasisAnalyzer()
        self.vix_analyzer = VixDivergenceAnalyzer()
        self.gamma_analyzer = GammaExposureAnalyzer()
        self.iv_skew_analyzer = IVSkewAnalyzer()
        self.reversal_analyzer = ReversalAnalyzer()
        
        # Initialize stateful analyzers (Analytics)
        self.cumulative_oi_analyzer = CumulativeOIAnalyzer()
        self.velocity_analyzer = VelocityAnalyzer()
        self.pattern_detector = PatternDetector()
        self.zones_analyzer = SupportResistanceAnalyzer()
        self.liquidity_analyzer = LiquidityStressAnalyzer()
        self.order_flow_analyzer = OrderFlowToxicityAnalyzer()
        self.smart_money_detector = SmartMoneyDetector()
    
    def run_stateless_analytics(self, request: AnalyticsRequest) -> Dict:
        """
        Run all stateless analytics (for Processor Service).
        
        These don't require historical data:
        - PCR (Put-Call Ratio)
        - Max Pain
        - Futures Basis
        - VIX Divergence
        - Gamma Exposure
        - IV Skew
        """
        result = {}
        
        # PCR Analysis (using consolidated function)
        if request.options:
            put_oi = sum(opt.open_interest for opt in request.options if opt.option_type == 'PE')
            call_oi = sum(opt.open_interest for opt in request.options if opt.option_type == 'CE')
            result['pcr'] = calculate_pcr_detailed(
                put_oi=put_oi,
                call_oi=call_oi,
                put_value=put_oi,  # OI-based
                call_value=call_oi
            )
        
        # Max Pain
        if request.options:
            result['max_pain'] = calculate_max_pain(request.options)
        
        # Futures Basis (if futures price available)
        if request.spot_price and request.futures_price:
            result['futures_basis'] = self.futures_analyzer.analyze(
                spot_price=request.spot_price,
                futures_price=request.futures_price,
                days_to_expiry=self._days_to_expiry(request.expiry, request.timestamp)
            )
        
        # VIX Divergence (if VIX available)
        if request.vix_value and request.spot_price:
            result['vix_divergence'] = self.vix_analyzer.analyze(
                vix=request.vix_value,
                spot_price=request.spot_price,
                pcr=result.get('pcr', {}).get('pcr_oi', 0)
            )
        
        # Gamma Exposure
        if request.options and request.spot_price:
            result['gamma_exposure'] = self.gamma_analyzer.analyze(
                options=request.options,
                spot_price=request.spot_price
            )
        
        # IV Skew
        if request.options and request.spot_price:
            atm_iv = self._get_atm_iv(request.options, request.spot_price)
            result['iv_skew'] = self.iv_skew_analyzer.analyze(
                options=request.options,
                spot_price=request.spot_price,
                atm_iv=atm_iv
            )
        
        return result
    
    def run_stateful_analytics(self, request: AnalyticsRequest) -> Dict:
        """
        Run all stateful analytics (for Analytics Service).
        
        These require historical data:
        - Cumulative OI changes
        - Velocity metrics
        - Pattern detection
        - Support/Resistance zones
        - Liquidity stress
        - Order flow toxicity
        - Smart money detection
        """
        result = {}
        
        if not request.historical_data:
            return result
        
        # Cumulative OI
        result['cumulative_oi'] = self.cumulative_oi_analyzer.analyze(
            current=request.options,
            historical=request.historical_data
        )
        
        # Velocity
        result['velocity'] = self.velocity_analyzer.analyze(
            current=request.options,
            historical=request.historical_data
        )
        
        # Patterns
        result['patterns'] = self.pattern_detector.detect(
            current=request.options,
            historical=request.historical_data
        )
        
        # Zones (Support/Resistance)
        result['zones'] = self.zones_analyzer.analyze(
            options=request.options,
            historical=request.historical_data
        )
        
        # Liquidity Stress
        result['liquidity_stress'] = self.liquidity_analyzer.analyze(
            options=request.options
        )
        
        # Order Flow Toxicity
        result['order_flow_toxicity'] = self.order_flow_analyzer.analyze(
            current=request.options,
            historical=request.historical_data
        )
        
        # Smart Money Detection
        result['smart_money'] = self.smart_money_detector.detect(
            current=request.options,
            historical=request.historical_data
        )
        
        return result
    
    def run_all_analytics(self, request: AnalyticsRequest) -> AnalyticsResult:
        """
        Run both stateless and stateful analytics.
        
        Use this when you have historical data available.
        """
        stateless = self.run_stateless_analytics(request)
        stateful = self.run_stateful_analytics(request)
        
        return AnalyticsResult(
            pcr=stateless.get('pcr'),
            max_pain=stateless.get('max_pain'),
            futures_basis=stateless.get('futures_basis'),
            vix_divergence=stateless.get('vix_divergence'),
            gamma_exposure=stateless.get('gamma_exposure'),
            iv_skew=stateless.get('iv_skew'),
            cumulative_oi=stateful.get('cumulative_oi'),
            velocity=stateful.get('velocity'),
            patterns=stateful.get('patterns'),
            zones=stateful.get('zones'),
            liquidity_stress=stateful.get('liquidity_stress'),
            order_flow_toxicity=stateful.get('order_flow_toxicity'),
            smart_money=stateful.get('smart_money')
        )
    
    def _days_to_expiry(self, expiry: str, current: datetime) -> int:
        """Calculate days to expiry"""
        from datetime import date
        expiry_date = date.fromisoformat(expiry)
        return (expiry_date - current.date()).days
    
    def _get_atm_iv(self, options: List, spot_price: float) -> float:
        """Get ATM implied volatility"""
        # Find ATM strike
        atm_strike = min(options, key=lambda opt: abs(opt.strike - spot_price)).strike
        atm_options = [opt for opt in options if opt.strike == atm_strike]
        
        if not atm_options:
            return 0.0
        
        # Average IV of ATM calls and puts
        ivs = [opt.implied_volatility for opt in atm_options if opt.implied_volatility]
        return np.mean(ivs) if ivs else 0.0


# Singleton instance
analytics_engine = ConsolidatedAnalyticsEngine()

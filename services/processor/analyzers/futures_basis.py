"""
Futures-Spot Basis Analyzer

Detects:
- Hedging demand
- Rollover pressure
- Arbitrage opportunities
"""
from typing import Dict, List
from core.logging.logger import get_logger

logger = get_logger("futures-basis")


class FuturesBasisAnalyzer:
    """
    Analyze futures-spot basis to detect market sentiment and opportunities
    
    Basis = Futures Price - Spot Price
    
    Positive Basis (Contango): Normal market condition
    Negative Basis (Backwardation): Bearish sentiment or high hedging demand
    """
    
    def __init__(self, risk_free_rate: float = 0.065):
        """
        Initialize analyzer
        
        Args:
            risk_free_rate: Annual risk-free rate for fair value calculation
        """
        self.risk_free_rate = risk_free_rate
    
    def analyze(
        self,
        futures_data,  # CleanedFuturesData
        spot_price: float,
        days_to_expiry: int
    ) -> Dict:
        """
        Analyze futures-spot basis
        
        Args:
            futures_data: CleanedFuturesData object
            spot_price: Current spot price
            days_to_expiry: Days until futures expiry
            
        Returns:
            Analysis result dict
        """
        if not futures_data:
            return {}
            
        futures_price = futures_data.ltp
        futures_oi = futures_data.oi
        # Calculate basis
        basis = futures_price - spot_price
        basis_pct = (basis / spot_price) * 100 if spot_price > 0 else 0
        
        # Fair value basis (cost of carry)
        time_fraction = days_to_expiry / 365.0
        fair_value_basis_pct = self.risk_free_rate * time_fraction * 100
        
        # Mispricing
        mispricing_pct = basis_pct - fair_value_basis_pct
        
        # Convert OI to millions for readability
        oi_millions = futures_oi / 1_000_000
        
        # Generate signals
        signals = []
        
        # Mispricing signals
        if mispricing_pct > 0.5:
            signals.append('STRONG_ROLLOVER_PRESSURE')
        elif mispricing_pct > 0.2:
            signals.append('ROLLOVER_PRESSURE')
        elif mispricing_pct < -0.5:
            signals.append('STRONG_HEDGING_DEMAND')
        elif mispricing_pct < -0.2:
            signals.append('HEDGING_DEMAND')
        
        # Arbitrage opportunity
        if abs(mispricing_pct) > 0.5:
            signals.append('ARBITRAGE_OPPORTUNITY')
        
        # OI-based signals
        if oi_millions > 20:
            signals.append('HIGH_FUTURES_ACTIVITY')
        
        # Determine sentiment
        if mispricing_pct > 0.3:
            sentiment = 'BULLISH'
        elif mispricing_pct < -0.3:
            sentiment = 'BEARISH'
        else:
            sentiment = 'NEUTRAL'
        
        result = {
            'basis': round(basis, 2),
            'basis_pct': round(basis_pct, 4),
            'fair_value_basis_pct': round(fair_value_basis_pct, 4),
            'mispricing_pct': round(mispricing_pct, 4),
            'futures_oi_millions': round(oi_millions, 2),
            'signals': signals,
            'sentiment': sentiment
        }
        
        logger.debug(
            f"Futures Basis: {basis:.2f} ({basis_pct:.2f}%), "
            f"Mispricing: {mispricing_pct:.2f}%, "
            f"Sentiment: {sentiment}"
        )
        
        return result
    
    def update_risk_free_rate(self, rate: float):
        """Update risk-free rate"""
        self.risk_free_rate = rate
        logger.info(f"Updated risk-free rate to {rate:.4f}")

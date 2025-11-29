"""
VIX-IV Divergence Analyzer

Detects:
- Overpriced options (IV > VIX expectation) = Sell premium
- Underpriced options (IV < VIX expectation) = Buy protection
"""
from typing import Dict, Literal
from core.logging.logger import get_logger
from core.config.dynamic_config import ConfigManager

logger = get_logger("vix-divergence")


class VIXDivergenceAnalyzer:
    """
    Analyze divergence between ATM IV and India VIX
    
    Normal Relationship:
    - NIFTY ATM IV ≈ VIX × 1.0
    - Bank Nifty ATM IV ≈ VIX × 1.15 (typically 15% higher)
    
    Divergence Signals:
    - ATM IV >> VIX = Options overpriced (sell premium)
    - ATM IV << VIX = Options cheap (buy protection)
    """
    
    def __init__(self, config_manager: ConfigManager):
        """
        Initialize analyzer
        
        Args:
            config_manager: For fetching current VIX value
        """
        self.config_manager = config_manager
        self._cached_vix = None
        self._cache_timestamp = None
    
    async def analyze(
        self,
        context  # CleanedGlobalContext
    ) -> Dict:
        """
        Analyze VIX-IV divergence
        
        Args:
            context: Global market context
            
        Returns:
            Analysis result dict
        """
        atm_iv = context.atm_iv
        symbol = context.symbol
        # Get India VIX
        india_vix = await self._get_india_vix()
        
        # Determine expected IV based on symbol
        symbol_type = 'BANK' if 'BANK' in symbol.upper() else 'INDEX'
        
        if symbol_type == 'BANK':
            expected_iv = india_vix * 1.15  # Bank Nifty typically 15% higher
        else:
            expected_iv = india_vix * 1.0  # Regular index
        
        # Calculate divergence
        divergence = atm_iv - expected_iv
        divergence_pct = (divergence / expected_iv) * 100 if expected_iv > 0 else 0
        
        # Generate signals
        if divergence_pct > 20:
            signal = 'STRONG_SELL_PREMIUM'
            strategy = 'IRON_CONDOR'
            reason = f'Options overpriced by {divergence_pct:.1f}% vs VIX'
        elif divergence_pct > 15:
            signal = 'SELL_PREMIUM'
            strategy = 'CREDIT_SPREAD'
            reason = f'Options overpriced by {divergence_pct:.1f}% vs VIX'
        elif divergence_pct < -20:
            signal = 'STRONG_BUY_PROTECTION'
            strategy = 'LONG_STRADDLE'
            reason = f'Options cheap by {abs(divergence_pct):.1f}% vs VIX'
        elif divergence_pct < -15:
            signal = 'BUY_PROTECTION'
            strategy = 'LONG_PUT'
            reason = f'Options cheap by {abs(divergence_pct):.1f}% vs VIX'
        else:
            signal = 'NEUTRAL'
            strategy = 'WAIT'
            reason = 'Fair pricing relative to VIX'
        
        result = {
            'atm_iv': round(atm_iv, 4),
            'india_vix': round(india_vix, 4),
            'expected_iv': round(expected_iv, 4),
            'divergence': round(divergence, 4),
            'divergence_pct': round(divergence_pct, 2),
            'signal': signal,
            'strategy': strategy,
            'reason': reason
        }
        
        logger.debug(
            f"VIX Divergence ({symbol}): "
            f"ATM IV={atm_iv:.2f}, VIX={india_vix:.2f}, "
            f"Divergence={divergence_pct:.2f}%, Signal={signal}"
        )
        
        return result
    
    async def _get_india_vix(self) -> float:
        """
        Get current India VIX value from config
        
        Returns:
            VIX value (as %)
        """
        import time
        
        # Use cache if less than 60 seconds old
        if (self._cached_vix is not None and 
            self._cache_timestamp is not None and
            time.time() - self._cache_timestamp < 60):
            return self._cached_vix
        
        # Fetch from config
        vix_value = self.config_manager.get('india_vix', 12.5)
        
        # Validate
        if vix_value <= 0 or vix_value > 100:
            logger.warning(f"Invalid VIX value {vix_value}, using default 12.5")
            vix_value = 12.5
        
        # Cache
        self._cached_vix = float(vix_value)
        self._cache_timestamp = time.time()
        
        return self._cached_vix
    
    def invalidate_cache(self):
        """Invalidate VIX cache (e.g., after config update)"""
        self._cached_vix = None
        self._cache_timestamp = None

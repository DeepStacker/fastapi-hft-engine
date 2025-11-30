"""
Liquidity Stress Analyzer

Detects:
- Market illiquidity
- Wide spreads
- Order book thinning
"""
from typing import Dict, List
from core.logging.logger import get_logger
from services.processor.models.enriched_data import CleanedOptionData

logger = get_logger("liquidity-stress")


class LiquidityStressAnalyzer:
    """
    Analyze Liquidity Stress
    
    Warning signs:
    - Wide bid-ask spreads
    - Low bid/ask quantities
    - Price vs mid divergence
    """
    
    def analyze(self, options: List[CleanedOptionData]) -> Dict:
        """
        Calculate overall liquidity stress
        
        Args:
            options: List of CleanedOptionData
            
        Returns:
            Dict with stress level and recommendation
        """
        total_stress = 0.0
        count = 0
        
        max_spread_bps = 0.0
        min_depth = float('inf')
        
        for opt in options:
            # Only analyze near-the-money or liquid options to avoid noise from deep OTM
            if not opt.mid_price or opt.mid_price < 1.0:
                continue
                
            # Spread metrics
            spread = opt.ask - opt.bid if (opt.ask and opt.bid) else 0
            spread_bps = (spread / opt.mid_price) * 10000
            
            # Quantity depth
            total_depth = opt.bid_qty + opt.ask_qty
            
            # Price dislocation (LTP vs Mid)
            dislocation = 0.0
            if opt.ltp:
                dislocation = abs(opt.ltp - opt.mid_price) / opt.mid_price * 100
            
            # Scoring (0 to 1)
            spread_score = min(spread_bps / 50, 1)  # 50bps = max stress
            depth_score = min(300 / total_depth, 1) if total_depth > 0 else 1
            dislocation_score = min(dislocation / 2, 1)  # 2% = extreme
            
            stress_score = (spread_score + depth_score + dislocation_score) / 3
            
            total_stress += stress_score
            count += 1
            
            max_spread_bps = max(max_spread_bps, spread_bps)
            if total_depth > 0:
                min_depth = min(min_depth, total_depth)
                
        if count == 0:
            return {
                'stress_level': 'UNKNOWN',
                'avg_stress_score': 0.0
            }
            
        avg_stress = total_stress / count
        
        level = 'NORMAL'
        if avg_stress > 0.7:
            level = 'CRITICAL'
        elif avg_stress > 0.5:
            level = 'HIGH'
            
        recommendation = 'SAFE'
        if level == 'CRITICAL':
            recommendation = 'AVOID_TRADING'
        elif level == 'HIGH':
            recommendation = 'USE_LIMIT_ORDERS'
            
        return {
            'stress_level': level,
            'avg_stress_score': round(avg_stress, 2),
            'max_spread_bps': round(max_spread_bps, 2),
            'min_depth': min_depth if min_depth != float('inf') else 0,
            'recommendation': recommendation
        }

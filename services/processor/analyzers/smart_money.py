"""
Smart Money Analyzer

Detects:
- Institutional positioning (Smart Money)
- Retail speculation (Dumb Money)
- Divergence between the two
"""
from typing import Dict, List
from core.logging.logger import get_logger
from services.processor.models.enriched_data import CleanedOptionData

logger = get_logger("smart-money")


class SmartMoneyAnalyzer:
    """
    Analyze Smart Money vs Dumb Money flow
    
    Smart Money:
    - Sells OTM options (Short Buildup)
    - Buys ATM options when IV is low (Long Buildup)
    - Takes profits (Long Unwinding) when IV is high
    
    Dumb Money:
    - Buys far OTM options (Long Buildup)
    - Panic sells (Short Unwinding)
    """
    
    def analyze(self, options: List[CleanedOptionData]) -> Dict:
        """
        Calculate Smart vs Dumb Money scores
        
        Args:
            options: List of CleanedOptionData
            
        Returns:
            Dict with scores and recommendation
        """
        smart_score_sum = 0.0
        dumb_score_sum = 0.0
        count = 0
        
        for opt in options:
            if not opt.is_valid or not opt.iv:
                continue
                
            # Logic from strategy doc
            buildup = opt.buildup_name
            moneyness = opt.moneyness_type  # ITM/ATM/OTM
            iv = opt.iv
            oi_change_pct = opt.oi_change_pct
            
            # Smart Money Indicators
            smart_val = 0.3  # Default neutral
            
            if buildup == 'SHORT BUILDUP' and moneyness == 'OTM' and abs(oi_change_pct) > 20:
                smart_val = 0.8  # Selling OTM premium
            elif buildup == 'LONG BUILDUP' and moneyness == 'ATM' and iv < 15: # Adjusted threshold
                smart_val = 0.7  # Buying ATM when cheap
            elif buildup == 'LONG UNWINDING' and iv > 20:
                smart_val = 0.6  # Taking profits when expensive
            
            # Dumb Money Indicators
            dumb_val = 0.3 # Default neutral
            
            if buildup == 'LONG BUILDUP' and moneyness == 'OTM' and iv > 20:
                dumb_val = 0.8  # Buying expensive OTM (Lottery tickets)
            elif buildup == 'SHORT UNWINDING' and iv < 12:
                dumb_val = 0.7  # Panic closing when cheap
                
            smart_score_sum += smart_val
            dumb_score_sum += dumb_val
            count += 1
            
        if count == 0:
            return {
                'smart_money_score': 0.0,
                'dumb_money_score': 0.0,
                'recommendation': 'NEUTRAL'
            }
            
        avg_smart = smart_score_sum / count
        avg_dumb = dumb_score_sum / count
        
        recommendation = 'NEUTRAL'
        if avg_smart > 0.5 and avg_smart > avg_dumb:
            recommendation = 'FOLLOW_SMART'
        elif avg_dumb > 0.5 and avg_dumb > avg_smart:
            recommendation = 'FADE_RETAIL'
            
        return {
            'smart_money_score': round(avg_smart, 2),
            'dumb_money_score': round(avg_dumb, 2),
            'recommendation': recommendation,
            'analyzed_strikes': count
        }

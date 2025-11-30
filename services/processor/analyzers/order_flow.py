"""
Order Flow Toxicity Analyzer

Detects:
- Aggressive market orders (toxic flow)
- Bid-Ask Imbalance
- Volume Surges
"""
from typing import Dict, List, Optional
from core.logging.logger import get_logger
from services.processor.models.enriched_data import CleanedOptionData

logger = get_logger("order-flow")


class OrderFlowToxicityAnalyzer:
    """
    Calculate Order Flow Toxicity Score
    
    Toxic flow = aggressive market orders that move price
    Non-toxic flow = passive limit orders
    
    Components:
    1. Bid-Ask Imbalance: (BidQty - AskQty) / TotalQty
    2. Price Aggression: (LTP - Mid) / Mid
    3. Volume Surge: Current Rate / Average Rate
    """
    
    def analyze(
        self,
        options: List[CleanedOptionData],
        minutes_since_open: int = 375  # Default to full day if unknown
    ) -> Dict:
        """
        Analyze order flow toxicity for all options
        
        Args:
            options: List of CleanedOptionData
            minutes_since_open: Minutes since market open (for volume avg)
            
        Returns:
            Dict containing toxicity analysis
        """
        if minutes_since_open <= 0:
            minutes_since_open = 1
            
        results = {}
        
        for opt in options:
            # Skip if critical data missing
            if not opt.is_liquid or not opt.mid_price:
                continue
                
            # 1. Bid-Ask Imbalance
            bid_size = opt.bid_qty
            ask_size = opt.ask_qty
            total_size = bid_size + ask_size
            
            if total_size == 0:
                size_imbalance = 0.0
            else:
                size_imbalance = (bid_size - ask_size) / total_size
            
            # 2. Price Aggression (how far from mid?)
            # Positive = Aggressive Buying (LTP > Mid)
            # Negative = Aggressive Selling (LTP < Mid)
            price_aggression = (opt.ltp - opt.mid_price) / opt.mid_price
            
            # 3. Volume Surge
            # Avg volume per minute (assuming prev_volume is full day? No, prev_volume is yesterday)
            # Strategy doc says: avg_volume = option_data['pVol'] / 375
            avg_vol_rate = opt.prev_volume / 375 if opt.prev_volume > 0 else 1
            current_vol_rate = opt.volume / minutes_since_open
            
            volume_surge = current_vol_rate / avg_vol_rate if avg_vol_rate > 0 else 0
            
            # Combine into Toxicity Score (0 to 1+)
            # Weights from strategy doc: 0.4, 0.3, 0.3
            # Note: price_aggression is usually small (e.g. 0.001), so multiply by 100?
            # Doc says: 0.3 * abs(price_aggression) * 100
            
            toxicity_score = (
                0.4 * abs(size_imbalance) +
                0.3 * abs(price_aggression) * 100 +
                0.3 * min(volume_surge, 5) / 5  # Cap surge at 5x
            )
            
            direction = 'BUY' if price_aggression > 0 else 'SELL'
            intensity = 'HIGH' if toxicity_score > 0.7 else 'MEDIUM' if toxicity_score > 0.4 else 'LOW'
            
            key = f"{opt.strike}_{opt.option_type}"
            results[key] = {
                'toxicity_score': round(toxicity_score, 4),
                'direction': direction,
                'intensity': intensity,
                'imbalance': round(size_imbalance, 4),
                'surge': round(volume_surge, 2)
            }
            
        # Aggregate stats
        high_toxicity_count = sum(1 for r in results.values() if r['intensity'] == 'HIGH')
        
        return {
            'details': results,
            'high_toxicity_count': high_toxicity_count,
            'market_status': 'TOXIC' if high_toxicity_count > 5 else 'NORMAL'
        }

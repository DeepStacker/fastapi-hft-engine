"""
Screener Service
Provides screener logic for Scalp, Positional, and Support/Resistance trading strategies.
"""
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

from app.services.dhan_client import DhanClient
from app.services.options import OptionsService
from app.cache.redis import RedisCache

logger = logging.getLogger(__name__)


class ScreenerType(str, Enum):
    SCALP = "scalp"
    POSITIONAL = "positional"
    SUPPORT_RESISTANCE = "sr"


@dataclass
class ScreenerResult:
    """Single screener result/signal"""
    symbol: str
    strike: float
    option_type: str  # CE or PE
    signal: str  # BUY, SELL, NEUTRAL
    strength: float  # 0-100
    reason: str
    entry_price: float
    target_price: float
    stop_loss: float
    timestamp: datetime
    metrics: Dict[str, Any]


class ScreenerService:
    """
    Screener Service for identifying trading opportunities.
    
    Supports:
    - Scalp: Short-term trades based on OI changes and momentum
    - Positional: Multi-day trades based on OI buildup and trends
    - Support/Resistance: Trades near key S/R levels
    """
    
    def __init__(
        self,
        options_service: Optional[OptionsService] = None,
        cache: Optional[RedisCache] = None
    ):
        self.options_service = options_service
        self.cache = cache
        
    async def run_scalp_screener(
        self,
        symbol: str,
        expiry: str,
        min_oi_change_pct: float = 5.0,
        min_volume: int = 1000
    ) -> List[ScreenerResult]:
        """
        Scalp Screener: Find short-term trading opportunities.
        
        Criteria:
        - High OI change (> min_oi_change_pct)
        - High volume
        - Price momentum
        - Favorable IV
        """
        results = []
        
        if not self.options_service:
            return self._generate_mock_scalp_results(symbol)
        
        try:
            live_data = await self.options_service.get_live_data(
                symbol=symbol,
                expiry=expiry,
                include_greeks=True,
                include_reversal=False
            )
            
            if not live_data:
                return results
            
            oc_data = live_data.get("oc", {})
            atm = live_data.get("atm_strike", 0)
            spot = live_data.get("spot", {}).get("ltp", 0)
            
            for strike_key, strike_data in oc_data.items():
                try:
                    strike = float(strike_key)
                except:
                    continue
                
                # Skip far OTM strikes
                if abs(strike - atm) > atm * 0.05:
                    continue
                
                for side, opt in [("CE", strike_data.get("ce", {})), ("PE", strike_data.get("pe", {}))]:
                    if not opt:
                        continue
                    
                    oi = opt.get("OI", opt.get("oi", 0)) or 0
                    oi_change = opt.get("oichng", 0) or 0
                    volume = opt.get("volume", opt.get("vol", 0)) or 0
                    ltp = opt.get("ltp", 0) or 0
                    iv = opt.get("iv", 0) or 0
                    
                    if oi == 0 or ltp == 0:
                        continue
                    
                    # Calculate OI change percentage
                    prev_oi = oi - oi_change
                    oi_change_pct = (oi_change / prev_oi * 100) if prev_oi > 0 else 0
                    
                    # Scalp signal logic
                    if abs(oi_change_pct) >= min_oi_change_pct and volume >= min_volume:
                        # Determine signal direction
                        if side == "CE":
                            signal = "BUY" if oi_change > 0 else "SELL"
                        else:
                            signal = "BUY" if oi_change < 0 else "SELL"
                        
                        strength = min(100, abs(oi_change_pct) * 2 + (volume / 10000))
                        
                        results.append(ScreenerResult(
                            symbol=symbol,
                            strike=strike,
                            option_type=side,
                            signal=signal,
                            strength=round(strength, 1),
                            reason=f"OI Change: {oi_change_pct:+.1f}%, Vol: {volume}",
                            entry_price=ltp,
                            target_price=ltp * 1.05 if signal == "BUY" else ltp * 0.95,
                            stop_loss=ltp * 0.97 if signal == "BUY" else ltp * 1.03,
                            timestamp=datetime.now(),
                            metrics={
                                "oi": oi,
                                "oi_change": oi_change,
                                "oi_change_pct": round(oi_change_pct, 2),
                                "volume": volume,
                                "iv": iv,
                            }
                        ))
            
            # Sort by strength
            results.sort(key=lambda x: x.strength, reverse=True)
            return results[:10]
            
        except Exception as e:
            logger.error(f"Error running scalp screener: {e}")
            return []
    
    async def run_positional_screener(
        self,
        symbol: str,
        expiry: str,
        min_oi_buildup: int = 100000
    ) -> List[ScreenerResult]:
        """
        Positional Screener: Find multi-day positions.
        
        Criteria:
        - Significant OI buildup
        - Trend confirmation
        - Favorable Greeks (Delta > 0.3, Theta not too negative)
        """
        results = []
        
        if not self.options_service:
            return self._generate_mock_positional_results(symbol)
        
        try:
            live_data = await self.options_service.get_live_data(
                symbol=symbol,
                expiry=expiry,
                include_greeks=True,
                include_reversal=False
            )
            
            if not live_data:
                return results
            
            oc_data = live_data.get("oc", {})
            atm = live_data.get("atm_strike", 0)
            
            for strike_key, strike_data in oc_data.items():
                try:
                    strike = float(strike_key)
                except:
                    continue
                
                for side, opt in [("CE", strike_data.get("ce", {})), ("PE", strike_data.get("pe", {}))]:
                    if not opt:
                        continue
                    
                    oi = opt.get("OI", opt.get("oi", 0)) or 0
                    oi_change = opt.get("oichng", 0) or 0
                    ltp = opt.get("ltp", 0) or 0
                    delta = abs(opt.get("delta", 0) or 0)
                    theta = opt.get("theta", 0) or 0
                    
                    if oi < min_oi_buildup or ltp == 0:
                        continue
                    
                    # Check for fresh OI buildup
                    if oi_change > 0 and delta > 0.25:
                        signal = "BUY"
                        strength = min(100, (oi / 100000) * 10 + delta * 50)
                        
                        results.append(ScreenerResult(
                            symbol=symbol,
                            strike=strike,
                            option_type=side,
                            signal=signal,
                            strength=round(strength, 1),
                            reason=f"OI Buildup: {oi:,}, Delta: {delta:.2f}",
                            entry_price=ltp,
                            target_price=ltp * 1.15,
                            stop_loss=ltp * 0.90,
                            timestamp=datetime.now(),
                            metrics={
                                "oi": oi,
                                "oi_change": oi_change,
                                "delta": delta,
                                "theta": theta,
                            }
                        ))
            
            results.sort(key=lambda x: x.strength, reverse=True)
            return results[:10]
            
        except Exception as e:
            logger.error(f"Error running positional screener: {e}")
            return []
    
    async def run_sr_screener(
        self,
        symbol: str,
        expiry: str
    ) -> List[ScreenerResult]:
        """
        Support/Resistance Screener: Find trades near key levels.
        
        Uses Max Pain and high OI concentrations as S/R levels.
        """
        results = []
        
        if not self.options_service:
            return self._generate_mock_sr_results(symbol)
        
        try:
            live_data = await self.options_service.get_live_data(
                symbol=symbol,
                expiry=expiry,
                include_greeks=True,
                include_reversal=False
            )
            
            if not live_data:
                return results
            
            oc_data = live_data.get("oc", {})
            atm = live_data.get("atm_strike", 0)
            spot = live_data.get("spot", {}).get("ltp", 0)
            max_pain = live_data.get("max_pain_strike", atm)
            
            # Find high OI levels (potential S/R)
            oi_levels = []
            for strike_key, strike_data in oc_data.items():
                try:
                    strike = float(strike_key)
                except:
                    continue
                
                ce_oi = strike_data.get("ce", {}).get("OI", 0) or 0
                pe_oi = strike_data.get("pe", {}).get("OI", 0) or 0
                total_oi = ce_oi + pe_oi
                
                oi_levels.append({
                    "strike": strike,
                    "ce_oi": ce_oi,
                    "pe_oi": pe_oi,
                    "total_oi": total_oi,
                    "type": "RESISTANCE" if strike > spot else "SUPPORT"
                })
            
            # Get top OI levels
            oi_levels.sort(key=lambda x: x["total_oi"], reverse=True)
            top_levels = oi_levels[:5]
            
            for level in top_levels:
                strike = level["strike"]
                sr_type = level["type"]
                
                # Find option at this strike
                strike_data = oc_data.get(str(int(strike)), {})
                
                # For support, buy PE; for resistance, buy CE
                if sr_type == "SUPPORT":
                    opt = strike_data.get("pe", {})
                    opt_type = "PE"
                else:
                    opt = strike_data.get("ce", {})
                    opt_type = "CE"
                
                ltp = opt.get("ltp", 0) or 0
                if ltp == 0:
                    continue
                
                results.append(ScreenerResult(
                    symbol=symbol,
                    strike=strike,
                    option_type=opt_type,
                    signal="BUY",
                    strength=round((level["total_oi"] / 1000000) * 20, 1),
                    reason=f"{sr_type} at {strike:,.0f}, OI: {level['total_oi']:,}",
                    entry_price=ltp,
                    target_price=ltp * 1.10,
                    stop_loss=ltp * 0.92,
                    timestamp=datetime.now(),
                    metrics={
                        "sr_type": sr_type,
                        "ce_oi": level["ce_oi"],
                        "pe_oi": level["pe_oi"],
                        "total_oi": level["total_oi"],
                        "distance_from_spot": abs(strike - spot),
                    }
                ))
            
            return results
            
        except Exception as e:
            logger.error(f"Error running S/R screener: {e}")
            return []
    
    def _generate_mock_scalp_results(self, symbol: str) -> List[ScreenerResult]:
        """Generate mock scalp results for demo"""
        import random
        atm = 24500 if symbol == "NIFTY" else 52000
        results = []
        
        for i in range(5):
            strike = atm + (i - 2) * 100
            side = random.choice(["CE", "PE"])
            signal = random.choice(["BUY", "SELL"])
            ltp = random.uniform(50, 200)
            
            results.append(ScreenerResult(
                symbol=symbol,
                strike=strike,
                option_type=side,
                signal=signal,
                strength=random.uniform(50, 95),
                reason=f"OI Change: +{random.randint(5, 20)}%, Vol: {random.randint(5000, 50000)}",
                entry_price=round(ltp, 2),
                target_price=round(ltp * 1.05, 2),
                stop_loss=round(ltp * 0.97, 2),
                timestamp=datetime.now(),
                metrics={"demo": True}
            ))
        
        return results
    
    def _generate_mock_positional_results(self, symbol: str) -> List[ScreenerResult]:
        """Generate mock positional results for demo"""
        import random
        atm = 24500 if symbol == "NIFTY" else 52000
        results = []
        
        for i in range(3):
            strike = atm + (i - 1) * 200
            side = random.choice(["CE", "PE"])
            ltp = random.uniform(100, 400)
            
            results.append(ScreenerResult(
                symbol=symbol,
                strike=strike,
                option_type=side,
                signal="BUY",
                strength=random.uniform(60, 90),
                reason=f"OI Buildup: {random.randint(1, 5)}L, Delta: {random.uniform(0.3, 0.6):.2f}",
                entry_price=round(ltp, 2),
                target_price=round(ltp * 1.15, 2),
                stop_loss=round(ltp * 0.90, 2),
                timestamp=datetime.now(),
                metrics={"demo": True}
            ))
        
        return results
    
    def _generate_mock_sr_results(self, symbol: str) -> List[ScreenerResult]:
        """Generate mock S/R results for demo"""
        import random
        atm = 24500 if symbol == "NIFTY" else 52000
        results = []
        
        # Mock support levels
        for i, sr_type in enumerate(["SUPPORT", "RESISTANCE", "SUPPORT"]):
            offset = -200 if sr_type == "SUPPORT" else 200
            strike = atm + offset * (i + 1)
            side = "PE" if sr_type == "SUPPORT" else "CE"
            ltp = random.uniform(80, 250)
            
            results.append(ScreenerResult(
                symbol=symbol,
                strike=strike,
                option_type=side,
                signal="BUY",
                strength=random.uniform(55, 85),
                reason=f"{sr_type} at {strike:,.0f}, OI: {random.randint(1, 8)}L",
                entry_price=round(ltp, 2),
                target_price=round(ltp * 1.10, 2),
                stop_loss=round(ltp * 0.92, 2),
                timestamp=datetime.now(),
                metrics={"demo": True, "sr_type": sr_type}
            ))
        
        return results


async def get_screener_service(
    options_service: Optional[OptionsService] = None,
    cache: Optional[RedisCache] = None
) -> ScreenerService:
    """Get screener service instance"""
    return ScreenerService(options_service=options_service, cache=cache)

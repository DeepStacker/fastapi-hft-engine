"""
High-level options data service.
Orchestrates data fetching, Greeks, reversal calculations, and transformations.
Refactored to use modular components (Repository, Transformer).
Unified API for both live and historical data access.
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import numpy as np

from fastapi import Depends
from app.services.dhan_client import DhanClient, get_dhan_client
from app.cache.redis import RedisCache, get_redis
from app.config.database import get_db, AsyncSession

from app.repositories.options import OptionsRepository
from app.services.bsm import BSMService
from app.services.greeks import GreeksService
from app.services.reversal import ReversalService
from app.services.profile_service import profile_service
from app.services.options_transformer import OptionsTransformer
from app.services.historical import HistoricalService, HistoricalSnapshot
from app.config.settings import settings
from app.config.symbols import get_instrument_type
from app.utils.timezone import get_ist_isoformat



logger = logging.getLogger(__name__)


class OptionsService:
    """
    High-level options data service (Orchestrator).
    Delegates persistence to OptionsRepository and transformation to OptionsTransformer.
    """
    
    def __init__(
        self,
        dhan_client: DhanClient,
        cache: Optional[RedisCache] = None,
        db: Optional[AsyncSession] = None
    ):
        self.dhan = dhan_client
        self.cache = cache
        self.db = db
        self.repository = OptionsRepository(db) if db else None
        
        # Domain Services
        self.bsm = BSMService()
        self.greeks = GreeksService()
        self.reversal = ReversalService()
        
        # Historical Service for unified live/historical access
        self.historical = HistoricalService(db=db, cache=cache) if db else None
        
        # Transformer
        self.transformer = OptionsTransformer()
    
    async def get_expiry_dates(self, symbol: str) -> Dict[str, Any]:
        """Get expiry dates for a symbol"""
        expiry_dates = await self.dhan.get_expiry_dates(symbol)
        return {
            "symbol": symbol.upper(),
            "expiry_dates": expiry_dates
        }
    
    async def get_live_data(
        self,
        symbol: str,
        expiry: str,
        include_greeks: bool = True,
        include_reversal: bool = True,
        include_profiles: bool = True
    ) -> Dict[str, Any]:
        """
        Get complete live options data with Greeks, reversal, and profiles.
        """
        # Fetch raw option chain (dhan_client auto-fetches expiry if None)
        chain_data = await self.dhan.get_option_chain(symbol, expiry)
        
        if not chain_data or "oc" not in chain_data:
            return chain_data
        
        spot = chain_data.get("spot", {}).get("ltp", 0)
        spot_change = chain_data.get("spot", {}).get("change", 0)
        
        # Get expiry from chain_data if it was auto-fetched
        actual_expiry = expiry or chain_data.get("expiry") or chain_data.get("exp_sid")
        
        # Calculate time to expiry
        T_days = self.transformer.parse_expiry_to_days(actual_expiry) if actual_expiry else 0
        T_years = max(T_days, 0.001) / 365
        
        # Get instrument type
        instrument_type = get_instrument_type(symbol)
        
        # Process each strike
        oc = chain_data.get("oc", {})
        processed_strikes = {}
        confidence_scores = []
        
        # Calculate OI averages
        all_ce_oi = [s.get("ce", {}).get("oi", s.get("ce", {}).get("OI", 0)) for s in oc.values()]
        all_pe_oi = [s.get("pe", {}).get("oi", s.get("pe", {}).get("OI", 0)) for s in oc.values()]
        total_ce_oi = sum(all_ce_oi)
        total_pe_oi = sum(all_pe_oi)
        avg_ce_oi = total_ce_oi / len(all_ce_oi) if all_ce_oi else 1
        avg_pe_oi = total_pe_oi / len(all_pe_oi) if all_pe_oi else 1
        
        # Get ATM IV
        atmiv = chain_data.get("atmiv", 0)
        iv_change = chain_data.get("atmiv_change", 0) / 100 if chain_data.get("atmiv_change") else 0
        
        # Get future price
        fut_price = 0
        fl = chain_data.get("future", {})
        if fl:
            first_key = list(fl.keys())[0] if fl else None
            if first_key:
                fut_price = fl.get(first_key, {}).get("ltp", 0)
        
        # Process Strikes Loop
        for strike_str, strike_data in oc.items():
            try:
                strike = float(strike_str)
                ce = strike_data.get("ce", {})
                pe = strike_data.get("pe", {})
                
                # Extract IVs
                ce_iv_raw = ce.get("iv", 0)
                pe_iv_raw = pe.get("iv", 0)
                ce_iv = ce_iv_raw / 100 if ce_iv_raw > 0 else 0.2
                pe_iv = pe_iv_raw / 100 if pe_iv_raw > 0 else 0.2
                
                processed = {
                    "strike": strike,
                    "ce": self.transformer.transform_leg(ce),
                    "pe": self.transformer.transform_leg(pe),
                }
                
                # Calculate Greeks
                if include_greeks and spot > 0:
                    ce_has_greeks = ce.get("optgeeks", {}).get("delta") is not None
                    pe_has_greeks = pe.get("optgeeks", {}).get("delta") is not None
                    use_hft_greeks = getattr(settings, 'HFT_USE_GREEKS', True)
                    
                    if not (ce_has_greeks and use_hft_greeks):
                        ce_greeks = self.greeks.calculate_all_greeks(spot, strike, T_years, ce_iv, "call")
                        processed["ce"]["optgeeks"] = self.transformer.greeks_to_dict(ce_greeks)
                    
                    if not (pe_has_greeks and use_hft_greeks):
                        pe_greeks = self.greeks.calculate_all_greeks(spot, strike, T_years, pe_iv, "put")
                        processed["pe"]["optgeeks"] = self.transformer.greeks_to_dict(pe_greeks)
                    
                    # Calculate Reversal
                    if include_reversal:
                        reversal_result = self.reversal.calculate_reversal(
                            spot=spot, spot_change=spot_change, iv_change=iv_change,
                            strike=strike, T_days=T_days,
                            sigma_call=ce_iv_raw if ce_iv_raw > 0 else ce_iv * 100,
                            sigma_put=pe_iv_raw if pe_iv_raw > 0 else pe_iv * 100,
                            curr_call_price=ce.get("ltp", 0),
                            curr_put_price=pe.get("ltp", 0),
                            fut_price=fut_price, atmiv=atmiv,
                            instrument_type=instrument_type,
                            ce_oi=ce.get("oi", ce.get("OI", 0)),
                            pe_oi=pe.get("oi", pe.get("OI", 0)),
                            avg_ce_oi=avg_ce_oi, avg_pe_oi=avg_pe_oi
                        )
                        
                        # Populate Reversal Data
                        processed.update({
                            "strike_price": reversal_result.strike_price,
                            "reversal": reversal_result.reversal,
                            "wkly_reversal": reversal_result.wkly_reversal,
                            "rs": reversal_result.rs, "rr": reversal_result.rr,
                            "ss": reversal_result.ss, "sr_diff": reversal_result.sr_diff,
                            "fut_reversal": reversal_result.fut_reversal,
                            "ce_tv": reversal_result.ce_tv, "pe_tv": reversal_result.pe_tv,
                            "difference": reversal_result.sr_diff,
                            "price_range": reversal_result.price_range,
                            "trading_signals": {
                                "entry": reversal_result.trading_signals.entry,
                                "stop_loss": reversal_result.trading_signals.stop_loss,
                                "take_profit": reversal_result.trading_signals.take_profit,
                                "risk_reward": reversal_result.trading_signals.risk_reward,
                            },
                            "market_regimes": reversal_result.market_regimes,
                            "recommended_strategy": reversal_result.recommended_strategy,
                            "alert": reversal_result.alert,
                            "time_decay": self.reversal.weekly_theta_decay(T_days)
                        })
                        confidence_scores.append(reversal_result.confidence)
                
                # Calculate PCR
                ce_oi = ce.get("oi", ce.get("OI", 0))
                pe_oi = pe.get("oi", pe.get("OI", 0))
                processed["pcr"] = round(pe_oi / ce_oi, 4) if ce_oi > 0 else 0
                
                processed_strikes[strike_str] = processed
                
            except Exception as e:
                logger.warning(f"Error processing strike {strike_str}: {e}")
                continue
        
        # Find ATM strike
        strikes = sorted([float(s) for s in oc.keys()])
        atm_strike = min(strikes, key=lambda x: abs(x - spot)) if strikes else spot
        
        # Metadata Calculation
        meta = self._calculate_metadata(confidence_scores, atmiv)
        
        result_data = {
            "symbol": symbol.upper(),
            "expiry": actual_expiry,  # Use resolved expiry, not the input parameter
            "spot": chain_data.get("spot", {}),
            "future": chain_data.get("future"),
            "atm_strike": atm_strike,
            "atmiv": atmiv,
            "atmiv_change": chain_data.get("atmiv_change", 0),
            "oc": processed_strikes,
            "strikes": [str(s) for s in strikes],
            "total_ce_oi": chain_data.get("total_call_oi", total_ce_oi),
            "total_pe_oi": chain_data.get("total_put_oi", total_pe_oi),
            "pcr": chain_data.get("pcr_ratio") or (round(total_pe_oi / total_ce_oi, 4) if total_ce_oi > 0 else 0),
            "timestamp": get_ist_isoformat(),
            "days_to_expiry": chain_data.get("dte") or T_days,
            "dte": chain_data.get("dte", T_days),
            "instrument_type": instrument_type,
            "max_pain_strike": chain_data.get("max_pain_strike", 0),
            "u_id": chain_data.get("u_id", 0),
            "lot_size": chain_data.get("lot_size", 75),
            "expiry_list": chain_data.get("expiry_list", []),
            "meta": meta,
            "profiles": profile_service.calculate_profiles(
                oc=processed_strikes, spot_price=spot, atm_strike=atm_strike
            ) if include_profiles else None,
            "hft_analyses": chain_data.get("hft_analyses"),
            "_source": chain_data.get("_source", "dhan_api"),
        }
        
        return result_data

    async def get_batch_live_data(
        self,
        symbols: List[str],
        include_greeks: bool = True,
        include_reversal: bool = True
    ) -> Dict[str, Any]:
        """
        Get live data for multiple symbols in parallel (Batch API).
        """
        import asyncio
        
        results = {}
        tasks = []
        
        for symbol in symbols:
            tasks.append(self.get_live_data(
                symbol=symbol,
                expiry=None,  # Auto-fetch nearest expiry
                include_greeks=include_greeks,
                include_reversal=include_reversal,
                include_profiles=False # Disable profiles for weight reduction in batch mode
            ))
            
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, symbol in enumerate(symbols):
            resp = responses[i]
            if isinstance(resp, Exception):
                logger.error(f"Batch fetch failed for {symbol}: {resp}")
                results[symbol] = {"error": str(resp)}
            else:
                results[symbol] = resp
                
        return results

    def _calculate_metadata(self, confidence_scores: List[float], atmiv: float) -> Dict[str, Any]:
        """Calculate smart auto-detection metadata"""
        meta = {
            "noise_floor": 60,
            "volatility_regime": "medium", 
            "recommended_threshold": 70,
            "std_dev": 0
        }
        
        if confidence_scores:
            mean_conf = float(np.mean(confidence_scores))
            std_conf = float(np.std(confidence_scores))
            
            vol_regime = "medium"
            if atmiv > 30: vol_regime = "high"
            elif atmiv < 12: vol_regime = "low"
            
            base_threshold = mean_conf
            
            if vol_regime == "high":
                rec_threshold = base_threshold + (0.5 * std_conf)
            elif vol_regime == "low":
                rec_threshold = base_threshold - (0.2 * std_conf)
            else:
                rec_threshold = base_threshold
                
            meta = {
                "noise_floor": round(mean_conf, 1),
                "volatility_regime": vol_regime,
                "recommended_threshold": round(min(90, max(50, rec_threshold)), 1),
                "std_dev": round(std_conf, 1)
            }
        return meta
    
    async def save_snapshot(self, data: Dict[str, Any]):
        """Delegated persistence"""
        if self.repository:
            await self.repository.save_snapshot(data)
    
    async def get_percentage_data(self, symbol: str, expiry: str, strike: float, option_type: str) -> Dict[str, Any]:
        """Get percentage/volume analysis for a specific option"""
        chain_data = await self.dhan.get_option_chain(symbol, expiry)
        
        if not chain_data or "oc" not in chain_data: return {"error": "No data found"}
        
        oc = chain_data.get("oc", {})
        strike_key = self.transformer.find_strike_key(oc, strike)
        strike_data = oc.get(strike_key, {})
        
        if not strike_data: return {"error": f"Strike {strike} not found"}
        
        leg_key = "ce" if option_type.upper() == "CE" else "pe"
        leg = strike_data.get(leg_key, {})
        
        return {
            "symbol": symbol, "strike": strike, "option_type": option_type.upper(),
            "ltp": leg.get("ltp", 0), "volume": leg.get("vol", 0),
            "oi": leg.get("OI", leg.get("oi", 0)), "oi_change": leg.get("oichng", 0),
            "iv": leg.get("iv", 0), "btyp": leg.get("btyp", "NT"),
            "BuiltupName": leg.get("BuiltupName", "NEUTRAL"),
        }
    
    async def get_iv_data(self, symbol: str, expiry: str, strike: float, option_type: str) -> Dict[str, Any]:
        """Get IV analysis for a specific option"""
        chain_data = await self.dhan.get_option_chain(symbol, expiry)
        if not chain_data or "oc" not in chain_data: return {"error": "No data found"}
        
        strike_str = str(int(strike))
        strike_data = chain_data.get("oc", {}).get(strike_str, {})
        if not strike_data: return {"error": f"Strike {strike} not found"}
        
        ce = strike_data.get("ce", {})
        pe = strike_data.get("pe", {})
        spot = chain_data.get("spot", {}).get("ltp", 0)
        T_days = self.transformer.calculate_days_to_expiry_ist(int(expiry))
        
        leg_key = "ce" if option_type.upper() == "CE" else "pe"
        leg = strike_data.get(leg_key, {})
        market_iv = leg.get("iv", 0) / 100 if leg.get("iv") else None
        
        if market_iv is None and spot > 0:
            T_years = max(T_days, 1) / 365
            market_price = leg.get("ltp", 0)
            calculated_iv = self.bsm.implied_volatility(
                market_price, spot, strike, T_years, option_type.lower()
            )
            market_iv = calculated_iv or 0.2
        
        return {
            "symbol": symbol, "strike": strike, "option_type": option_type.upper(),
            "iv": round(market_iv * 100, 2) if market_iv else 0,
            "ce_iv": ce.get("iv", 0), "pe_iv": pe.get("iv", 0),
            "iv_skew": round(ce.get("iv", 0) - pe.get("iv", 0), 2),
            "days_to_expiry": T_days,
        }
    
    async def get_delta_data(self, symbol: str, expiry: str, strike: float) -> Dict[str, Any]:
        """Get delta analysis for a strike"""
        chain_data = await self.dhan.get_option_chain(symbol, expiry)
        if not chain_data or "oc" not in chain_data: return {"error": "No data found"}
        
        strike_str = str(int(strike))
        strike_data = chain_data.get("oc", {}).get(strike_str, {})
        if not strike_data: return {"error": f"Strike {strike} not found"}
        
        spot = chain_data.get("spot", {}).get("ltp", 0)
        T_days = self.transformer.calculate_days_to_expiry_ist(int(expiry))
        T_years = max(T_days, 1) / 365
        
        ce = strike_data.get("ce", {})
        pe = strike_data.get("pe", {})
        ce_iv = ce.get("iv", 20) / 100
        pe_iv = pe.get("iv", 20) / 100
        
        ce_greeks = self.greeks.calculate_all_greeks(spot, strike, T_years, ce_iv, "call")
        pe_greeks = self.greeks.calculate_all_greeks(spot, strike, T_years, pe_iv, "put")
        
        return {
            "symbol": symbol, "strike": strike, "spot": spot,
            "ce_delta": ce_greeks.delta, "pe_delta": pe_greeks.delta,
            "net_delta": round(ce_greeks.delta + pe_greeks.delta, 4),
            "ce_gamma": ce_greeks.gamma, "pe_gamma": pe_greeks.gamma,
            "days_to_expiry": T_days,
        }
    
    async def get_future_price_data(self, symbol: str, expiry: str) -> Dict[str, Any]:
        """Get future price analysis"""
        try:
            chain_data = await self.dhan.get_option_chain(symbol, expiry)
            spot = chain_data.get("spot", {}).get("ltp", 0) if chain_data else 0
            T_days = self.transformer.calculate_days_to_expiry_ist(int(expiry)) if expiry else 0
            
            futures_data = []
            try:
                futures_data = await self.dhan.get_futures_data(symbol)
            except Exception as e:
                logger.warning(f"Failed to fetch futures data: {e}")
                
            if not futures_data and chain_data:
                fl = chain_data.get("future", {})
                if fl:
                    futures_data = [{"expiry": exp, "ltp": d.get("ltp"), "oi": d.get("oi")} for exp, d in fl.items()]
            
            current_future = None
            if isinstance(futures_data, list):
                for fut in futures_data:
                    if str(fut.get("expiry")) == str(expiry):
                        current_future = fut
                        break
                if not current_future and futures_data:
                    current_future = futures_data[0]
            
            future_price = current_future.get("ltp", 0) if current_future else 0
            basis = future_price - spot if future_price and spot else 0
            
            return {
                "symbol": symbol, "spot": spot, "future_price": future_price,
                "basis": round(basis, 2),
                "basis_percent": round(basis / spot * 100, 4) if spot > 0 else 0,
                "days_to_expiry": T_days,
                "future_oi": current_future.get("oi", 0) if current_future else 0,
            }
        except Exception as e:
            logger.error(f"Error in get_future_price_data: {e}")
            return {"error": str(e)}


# Factory function
# Factory function
async def get_options_service(
    dhan_client: DhanClient = Depends(get_dhan_client),
    cache: RedisCache = Depends(get_redis),
    db: AsyncSession = Depends(get_db)
) -> OptionsService:
    return OptionsService(dhan_client=dhan_client, cache=cache, db=db)

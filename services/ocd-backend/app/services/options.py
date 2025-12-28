import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import numpy as np

from app.services.dhan_client import DhanClient
from app.services.bsm import BSMService
from app.services.greeks import GreeksService
from app.services.reversal import ReversalService
from app.services.profile_service import profile_service
from app.cache.redis import RedisCache, CacheKeys
from app.config.settings import settings
from app.config.symbols import get_instrument_type
from app.utils.data_processing import fetch_percentage

logger = logging.getLogger(__name__)


class OptionsService:
    """
    High-level options data service.
    Orchestrates data fetching, Greeks, reversal calculations, and transformations.
    Designed for high concurrency and low latency.
    """
    
    def __init__(
        self,
        dhan_client: DhanClient,
        cache: Optional[RedisCache] = None
    ):
        self.dhan = dhan_client
        self.cache = cache
        self.bsm = BSMService()
        self.greeks = GreeksService()
        self.reversal = ReversalService()
    
    def _find_strike_key(self, oc: Dict, strike: float) -> str:
        """
        Find the correct strike key in option chain.
        Dhan returns keys like '26000.000000' but lookups might use '26000'.
        """
        # Try exact integer match first
        int_key = str(int(strike))
        if int_key in oc:
            return int_key
        
        # Try with decimals
        float_key = f"{strike:.6f}"
        if float_key in oc:
            return float_key
        
        # Search for matching strike value
        for key in oc.keys():
            try:
                if float(key) == strike:
                    return key
            except:
                continue
        
        return int_key  # Fallback to integer key
    
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
        
        Args:
            symbol: Trading symbol
            expiry: Expiry timestamp
            include_greeks: Calculate and include Greeks
            include_reversal: Calculate and include reversal points
            include_profiles: Calculate and include chart profiles (server-side)
            
        Returns:
            Complete option chain data with Greeks, reversal, trading signals, profiles
        """
        # Fetch raw option chain (dhan_client auto-fetches expiry if None)
        chain_data = await self.dhan.get_option_chain(symbol, expiry)
        
        if not chain_data or "oc" not in chain_data:
            return chain_data
        
        spot = chain_data.get("spot", {}).get("ltp", 0)
        spot_change = chain_data.get("spot", {}).get("change", 0)
        
        # Get expiry from chain_data if it was auto-fetched (expiry might be None)
        actual_expiry = expiry or chain_data.get("expiry") or chain_data.get("exp_sid")
        
        # Calculate time to expiry using IST market hours
        # Handle both Unix timestamps (int) and ISO date strings (from HFT Engine)
        T_days = self._parse_expiry_to_days(actual_expiry) if actual_expiry else 0
        T_years = max(T_days, 0.001) / 365
        
        # Get instrument type (IDX, EQ, COM)
        instrument_type = get_instrument_type(symbol)
        
        # Process each strike
        oc = chain_data.get("oc", {})
        processed_strikes = {}
        confidence_scores = []  # For global statistics
        
        # Calculate OI averages for liquidity assessment
        all_ce_oi = [s.get("ce", {}).get("oi", s.get("ce", {}).get("OI", 0)) for s in oc.values()]
        all_pe_oi = [s.get("pe", {}).get("oi", s.get("pe", {}).get("OI", 0)) for s in oc.values()]
        avg_ce_oi = sum(all_ce_oi) / len(all_ce_oi) if all_ce_oi else 1
        avg_pe_oi = sum(all_pe_oi) / len(all_pe_oi) if all_pe_oi else 1
        
        # Get ATM IV for reversal calc - now at top level after transform
        atmiv = chain_data.get("atmiv", 0)
        iv_change = chain_data.get("atmiv_change", 0) / 100 if chain_data.get("atmiv_change") else 0
        
        # Get future price from 'future' key (was 'fl', now transformed)
        fut_price = 0
        fl = chain_data.get("future", {})
        if fl:
            first_key = list(fl.keys())[0] if fl else None
            if first_key:
                fut_price = fl.get(first_key, {}).get("ltp", 0)
        
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
                    "ce": self._transform_leg(ce),
                    "pe": self._transform_leg(pe),
                }
                
                # Calculate Greeks if requested
                if include_greeks and spot > 0:
                    # Check if HFT Engine already provided Greeks (optimization)
                    ce_has_greeks = ce.get("optgeeks", {}).get("delta") is not None
                    pe_has_greeks = pe.get("optgeeks", {}).get("delta") is not None
                    
                    # Use HFT Greeks if available and HFT_USE_GREEKS is enabled
                    use_hft_greeks = getattr(settings, 'HFT_USE_GREEKS', True)
                    
                    if ce_has_greeks and use_hft_greeks:
                        # Use pre-calculated Greeks from HFT Engine (already in processed from _transform_leg)
                        pass
                    else:
                        # Calculate Greeks locally
                        ce_greeks = self.greeks.calculate_all_greeks(
                            spot, strike, T_years, ce_iv, "call"
                        )
                        processed["ce"]["optgeeks"] = self._greeks_to_dict(ce_greeks)
                    
                    if pe_has_greeks and use_hft_greeks:
                        # Use pre-calculated Greeks from HFT Engine
                        pass
                    else:
                        # Calculate Greeks locally
                        pe_greeks = self.greeks.calculate_all_greeks(
                            spot, strike, T_years, pe_iv, "put"
                        )
                        processed["pe"]["optgeeks"] = self._greeks_to_dict(pe_greeks)
                    
                    # Calculate full reversal if requested
                    if include_reversal:
                        reversal_result = self.reversal.calculate_reversal(
                            spot=spot,
                            spot_change=spot_change,
                            iv_change=iv_change,
                            strike=strike,
                            T_days=T_days,
                            sigma_call=ce_iv_raw if ce_iv_raw > 0 else ce_iv * 100,
                            sigma_put=pe_iv_raw if pe_iv_raw > 0 else pe_iv * 100,
                            curr_call_price=ce.get("ltp", 0),
                            curr_put_price=pe.get("ltp", 0),
                            fut_price=fut_price,
                            atmiv=atmiv,
                            instrument_type=instrument_type,
                            ce_oi=ce.get("oi", ce.get("OI", 0)),
                            pe_oi=pe.get("oi", pe.get("OI", 0)),
                            avg_ce_oi=avg_ce_oi,
                            avg_pe_oi=avg_pe_oi
                        )
                        
                        # Add full reversal data
                        processed["strike_price"] = reversal_result.strike_price
                        processed["reversal"] = reversal_result.reversal
                        processed["wkly_reversal"] = reversal_result.wkly_reversal
                        processed["rs"] = reversal_result.rs
                        processed["rr"] = reversal_result.rr
                        processed["ss"] = reversal_result.ss
                        processed["sr_diff"] = reversal_result.sr_diff
                        processed["fut_reversal"] = reversal_result.fut_reversal
                        processed["ce_tv"] = reversal_result.ce_tv
                        processed["pe_tv"] = reversal_result.pe_tv
                        processed["difference"] = reversal_result.sr_diff
                        
                        processed["price_range"] = reversal_result.price_range
                        processed["trading_signals"] = {
                            "entry": reversal_result.trading_signals.entry,
                            "stop_loss": reversal_result.trading_signals.stop_loss,
                            "take_profit": reversal_result.trading_signals.take_profit,
                            "risk_reward": reversal_result.trading_signals.risk_reward,
                        }
                        processed["market_regimes"] = reversal_result.market_regimes
                        processed["recommended_strategy"] = reversal_result.recommended_strategy
                        processed["alert"] = reversal_result.alert
                        processed["time_decay"] = self.reversal.weekly_theta_decay(T_days)
                        
                        # Collect confidence score for global stats
                        confidence_scores.append(reversal_result.confidence)
                
                # Calculate PCR for this strike
                ce_oi = ce.get("oi", ce.get("OI", 0))
                pe_oi = pe.get("oi", pe.get("OI", 0))
                processed["pcr"] = round(pe_oi / ce_oi, 4) if ce_oi > 0 else 0
                
                processed_strikes[strike_str] = processed
                
            except Exception as e:
                logger.warning(f"Error processing strike {strike_str}: {e}")
                continue
        
        # Calculate summary metrics
        total_ce_oi = sum(all_ce_oi)
        total_pe_oi = sum(all_pe_oi)
        
        # Find ATM strike
        strikes = sorted([float(s) for s in oc.keys()])
        atm_strike = min(strikes, key=lambda x: abs(x - spot)) if strikes else spot
        
        # ===== SMART AUTO-DETECTION METADATA =====
        meta = {
            "noise_floor": 60,
            "volatility_regime": "medium", 
            "recommended_threshold": 70,
            "std_dev": 0
        }
        
        if confidence_scores:
            mean_conf = float(np.mean(confidence_scores))
            std_conf = float(np.std(confidence_scores))
            
            # Smart Threshold Logic
            vol_regime = "medium"
            if atmiv > 30: vol_regime = "high"
            elif atmiv < 12: vol_regime = "low"
            
            # Base threshold is the chain average (Noise Floor)
            base_threshold = mean_conf
            
            if vol_regime == "high":
                # High Vol: Trust only the Very Best (Mean + 0.5 Sigma)
                rec_threshold = base_threshold + (0.5 * std_conf)
            elif vol_regime == "low":
                # Low Vol: Trust slightly above average (Mean - 0.2 Sigma) to catch subtle moves
                rec_threshold = base_threshold - (0.2 * std_conf)
            else:
                # Normal: Just above average
                rec_threshold = base_threshold
                
            meta = {
                "noise_floor": round(mean_conf, 1),
                "volatility_regime": vol_regime,
                "recommended_threshold": round(min(90, max(50, rec_threshold)), 1),
                "std_dev": round(std_conf, 1)
            }
        
        return {
            "symbol": symbol.upper(),
            "expiry": expiry,
            "spot": chain_data.get("spot", {}),
            "future": chain_data.get("future"),
            "atm_strike": atm_strike,
            "atmiv": atmiv,
            "atmiv_change": chain_data.get("atmiv_change", 0),
            "oc": processed_strikes,
            "strikes": [str(s) for s in strikes],
            "total_ce_oi": chain_data.get("total_call_oi", total_ce_oi),  # Use Dhan's OIC if available
            "total_pe_oi": chain_data.get("total_put_oi", total_pe_oi),  # Use Dhan's OIP if available
            "pcr": chain_data.get("pcr_ratio") or (round(total_pe_oi / total_ce_oi, 4) if total_ce_oi > 0 else 0),
            "timestamp": datetime.utcnow().isoformat(),
            "days_to_expiry": chain_data.get("dte") or T_days,  # Use Dhan's dte if available
            "dte": chain_data.get("dte", T_days),
            "instrument_type": instrument_type,
            # Schema Fields
            "max_pain_strike": chain_data.get("max_pain_strike", 0),
            "u_id": chain_data.get("u_id", 0),
            "lot_size": chain_data.get("lot_size", 75),
            "expiry_list": chain_data.get("expiry_list", []),
            # New Meta Field
            "meta": meta,
            # Server-side calculated profiles (for charts)
            "profiles": profile_service.calculate_profiles(
                oc=processed_strikes,
                spot_price=spot,
                atm_strike=atm_strike
            ) if include_profiles else None,
            # HFT Engine advanced analyses (bonus features when using HFT)
            "hft_analyses": chain_data.get("hft_analyses"),
            # Data source indicator
            "_source": chain_data.get("_source", "dhan_api"),
        }
    
    async def get_percentage_data(
        self,
        symbol: str,
        expiry: str,
        strike: float,
        option_type: str
    ) -> Dict[str, Any]:
        """Get percentage/volume analysis for a specific option"""
        chain_data = await self.dhan.get_option_chain(symbol, expiry)
        
        if not chain_data or "oc" not in chain_data:
            return {"error": "No data found"}
        
        oc = chain_data.get("oc", {})
        strike_key = self._find_strike_key(oc, strike)
        strike_data = oc.get(strike_key, {})
        
        if not strike_data:
            return {"error": f"Strike {strike} not found"}
        
        leg_key = "ce" if option_type.upper() == "CE" else "pe"
        leg = strike_data.get(leg_key, {})
        
        return {
            "symbol": symbol,
            "strike": strike,
            "option_type": option_type.upper(),
            "ltp": leg.get("ltp", 0),
            "volume": leg.get("vol", 0),
            "oi": leg.get("OI", leg.get("oi", 0)),  # Handle both cases
            "oi_change": leg.get("oichng", 0),
            "iv": leg.get("iv", 0),
            "btyp": leg.get("btyp", "NT"),
            "BuiltupName": leg.get("BuiltupName", "NEUTRAL"),
        }
    
    async def get_iv_data(
        self,
        symbol: str,
        expiry: str,
        strike: float,
        option_type: str
    ) -> Dict[str, Any]:
        """Get IV analysis for a specific option"""
        chain_data = await self.dhan.get_option_chain(symbol, expiry)
        
        if not chain_data or "oc" not in chain_data:
            return {"error": "No data found"}
        
        strike_str = str(int(strike))
        strike_data = chain_data.get("oc", {}).get(strike_str, {})
        
        if not strike_data:
            return {"error": f"Strike {strike} not found"}
        
        ce = strike_data.get("ce", {})
        pe = strike_data.get("pe", {})
        
        spot = chain_data.get("spot", {}).get("ltp", 0)
        T_days = self._calculate_days_to_expiry(int(expiry))
        
        leg_key = "ce" if option_type.upper() == "CE" else "pe"
        leg = strike_data.get(leg_key, {})
        
        market_iv = leg.get("iv", 0) / 100 if leg.get("iv") else None
        
        # Calculate IV if not available
        if market_iv is None and spot > 0:
            T_years = max(T_days, 1) / 365
            market_price = leg.get("ltp", 0)
            calculated_iv = self.bsm.implied_volatility(
                market_price, spot, strike, T_years, option_type.lower()
            )
            market_iv = calculated_iv or 0.2
        
        return {
            "symbol": symbol,
            "strike": strike,
            "option_type": option_type.upper(),
            "iv": round(market_iv * 100, 2) if market_iv else 0,
            "ce_iv": ce.get("iv", 0),
            "pe_iv": pe.get("iv", 0),
            "iv_skew": round(ce.get("iv", 0) - pe.get("iv", 0), 2),
            "days_to_expiry": T_days,
        }
    
    async def get_delta_data(
        self,
        symbol: str,
        expiry: str,
        strike: float
    ) -> Dict[str, Any]:
        """Get delta analysis for a strike"""
        chain_data = await self.dhan.get_option_chain(symbol, expiry)
        
        if not chain_data or "oc" not in chain_data:
            return {"error": "No data found"}
        
        strike_str = str(int(strike))
        strike_data = chain_data.get("oc", {}).get(strike_str, {})
        
        if not strike_data:
            return {"error": f"Strike {strike} not found"}
        
        spot = chain_data.get("spot", {}).get("ltp", 0)
        T_days = self._calculate_days_to_expiry(int(expiry))
        T_years = max(T_days, 1) / 365
        
        ce = strike_data.get("ce", {})
        pe = strike_data.get("pe", {})
        
        ce_iv = ce.get("iv", 20) / 100
        pe_iv = pe.get("iv", 20) / 100
        
        ce_greeks = self.greeks.calculate_all_greeks(spot, strike, T_years, ce_iv, "call")
        pe_greeks = self.greeks.calculate_all_greeks(spot, strike, T_years, pe_iv, "put")
        
        return {
            "symbol": symbol,
            "strike": strike,
            "spot": spot,
            "ce_delta": ce_greeks.delta,
            "pe_delta": pe_greeks.delta,
            "net_delta": round(ce_greeks.delta + pe_greeks.delta, 4),
            "ce_gamma": ce_greeks.gamma,
            "pe_gamma": pe_greeks.gamma,
            "days_to_expiry": T_days,
        }
    
    async def get_future_price_data(
        self,
        symbol: str,
        expiry: str
    ) -> Dict[str, Any]:
        """Get future price analysis"""
        try:
            chain_data = await self.dhan.get_option_chain(symbol, expiry)
            spot = chain_data.get("spot", {}).get("ltp", 0) if chain_data else 0
            T_days = self._calculate_days_to_expiry(int(expiry)) if expiry else 0
            
            # Try to get futures data, but handle failures gracefully
            futures_data = []
            try:
                futures_data = await self.dhan.get_futures_data(symbol)
            except Exception as e:
                logger.warning(f"Failed to fetch futures data for {symbol}: {e}")
                
            # If futures_data fetch failed, try to extract from chain_data instead
            if not futures_data and chain_data:
                fl = chain_data.get("future", {})
                if fl:
                    for exp_key, fut_data in fl.items():
                        futures_data.append({
                            "expiry": exp_key,
                            "ltp": fut_data.get("ltp", 0),
                            "oi": fut_data.get("oi", 0),
                        })
            
            # Find matching future
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
                "symbol": symbol,
                "spot": spot,
                "future_price": future_price,
                "basis": round(basis, 2),
                "basis_percent": round(basis / spot * 100, 4) if spot > 0 else 0,
                "days_to_expiry": T_days,
                "future_oi": current_future.get("oi", 0) if current_future else 0,
            }
        except Exception as e:
            logger.error(f"Error in get_future_price_data for {symbol}: {e}")
            return {
                "symbol": symbol,
                "spot": 0,
                "future_price": 0,
                "basis": 0,
                "basis_percent": 0,
                "days_to_expiry": 0,
                "future_oi": 0,
                "error": f"Failed to fetch future price data: {str(e)}"
            }
    
    def _calculate_days_to_expiry(self, expiry_timestamp: int) -> float:
        """Calculate days to expiry from timestamp"""
        expiry_date = datetime.fromtimestamp(expiry_timestamp)
        now = datetime.now()
        return max(0, (expiry_date - now).days)
    
    def _parse_expiry_to_days(self, expiry) -> float:
        """
        Parse expiry and calculate days to expiry.
        Handles both Unix timestamps (int/str) and ISO date strings (YYYY-MM-DD from HFT Engine).
        """
        if expiry is None:
            return 0
        
        expiry_str = str(expiry)
        
        # Check if it's a date string (contains dash)
        if '-' in expiry_str:
            try:
                # Parse ISO date string (e.g., "2024-12-26")
                expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d")
                # Set expiry to 3:30 PM IST
                expiry_date = expiry_date.replace(hour=15, minute=30)
                now = datetime.now()
                return max(0, (expiry_date - now).total_seconds() / (24 * 3600))
            except ValueError:
                logger.warning(f"Failed to parse expiry date string: {expiry_str}")
                return 0
        else:
            # It's a Unix timestamp
            try:
                timestamp = int(expiry_str)
                return self._calculate_days_to_expiry_ist(timestamp)
            except ValueError:
                logger.warning(f"Failed to parse expiry as timestamp: {expiry_str}")
                return 0
    
    def _calculate_days_to_expiry_ist(self, expiry_timestamp: int) -> float:
        """
        Calculate days to expiry using IST market hours.
        Matches the original time_cal.py logic for accurate expiry time.
        
        Rules:
        - Before 9:00 AM IST: Use yesterday 3:30 PM as reference
        - After 3:30 PM IST: Use today 3:30 PM as reference
        - During market hours: Use current time
        """
        IST_OFFSET = timedelta(hours=5, minutes=30)
        
        # Convert timestamp to IST
        expiry_dt_utc = datetime.fromtimestamp(expiry_timestamp, timezone.utc)
        expiry_ist = expiry_dt_utc + IST_OFFSET
        expiry_target = expiry_ist.replace(hour=15, minute=31, second=0, microsecond=0)
        
        # Get current time in IST
        now_utc = datetime.now(timezone.utc)
        now_ist = now_utc + IST_OFFSET
        
        # Define reference times
        today_1530 = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
        today_0900 = now_ist.replace(hour=9, minute=0, second=0, microsecond=0)
        yesterday_1530 = (now_ist - timedelta(days=1)).replace(
            hour=15, minute=30, second=0, microsecond=0
        )
        
        # Choose reference time based on current time
        if now_ist > today_1530:
            reference_time = today_1530
        elif now_ist < today_0900:
            reference_time = yesterday_1530
        else:
            reference_time = now_ist
        
        # Normalize to common year for day difference calculation
        common_year = 2000
        expiry_normalized = expiry_target.replace(year=common_year, tzinfo=None)
        reference_normalized = reference_time.replace(year=common_year, tzinfo=None)
        
        # Calculate difference in days
        day_diff = (expiry_normalized - reference_normalized).total_seconds() / (24 * 3600)
        
        return max(day_diff - 1, 0.000001)
    
    def _transform_leg(self, leg: Dict) -> Dict:
        """Transform option leg to standardized format with all Dhan fields"""
        return {
            # Core prices
            "ltp": leg.get("ltp", 0),
            "atp": leg.get("atp", 0),  # Average traded price
            "pc": leg.get("pc", 0),    # Previous close
            
            # Volume
            "volume": leg.get("vol", 0),
            "vol": leg.get("vol", 0),  # Keep both for compatibility
            "pVol": leg.get("pVol", 0),  # Previous volume
            
            # Open Interest - Dhan uses uppercase OI!
            "oi": leg.get("OI", leg.get("oi", 0)),  # Handle both cases
            "OI": leg.get("OI", leg.get("oi", 0)),  # Keep uppercase for frontend
            "oichng": leg.get("oichng", 0),
            "oi_change": leg.get("oichng", 0),  # Alias for compatibility
            "oiperchnge": leg.get("oiperchnge", 0),
            "p_oi": leg.get("p_oi", 0),  # Previous day OI
            
            # Price change
            "p_chng": leg.get("p_chng", 0),  # Price change
            "p_pchng": leg.get("p_pchng", 0),  # Price change percent
            "change": leg.get("p_chng", 0),  # Alias for frontend
            
            # IV & Greeks
            "iv": leg.get("iv", 0),
            "optgeeks": leg.get("optgeeks", {}),
            
            # Bid/Ask
            "bid": leg.get("bid", 0),
            "ask": leg.get("ask", 0),
            "bid_qty": leg.get("bid_qty", 0),
            "ask_qty": leg.get("ask_qty", 0),
            
            # Build-up signals - CRITICAL for trading
            "btyp": leg.get("btyp", "NT"),  # LB, SB, SC, LC, NT
            "BuiltupName": leg.get("BuiltupName", "NEUTRAL"),  # Full buildup name
            
            # Moneyness
            "mness": leg.get("mness", ""),  # I = ITM, O = OTM
            
            # Symbol info
            "sym": leg.get("sym", ""),
            "sid": leg.get("sid", 0),
            "disp_sym": leg.get("disp_sym", ""),
            "otype": leg.get("otype", ""),  # CE or PE
        }
    
    def _greeks_to_dict(self, greeks) -> Dict:
        """Convert Greeks dataclass to dictionary"""
        return {
            "delta": greeks.delta,
            "gamma": greeks.gamma,
            "theta": greeks.theta,
            "vega": greeks.vega,
            "rho": greeks.rho,
            "vanna": greeks.vanna,
            "vomma": greeks.vomma,
            "charm": greeks.charm,
            "speed": greeks.speed,
            "zomma": greeks.zomma,
            "color": greeks.color,
            "ultima": greeks.ultima,
        }


# Factory function for dependency injection
async def get_options_service(
    dhan_client: DhanClient,
    cache: Optional[RedisCache] = None
) -> OptionsService:
    """Get options service instance"""
    return OptionsService(dhan_client=dhan_client, cache=cache)

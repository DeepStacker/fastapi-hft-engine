"""
Data Cleaner for Option Chain Data

Handles:
- NA/null/blank value replacement
- Data validation
- Extraction of futures, options, global context
- Quality flagging
"""
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone
from core.logging.logger import get_logger
from services.processor.models.raw_data import (
    RawOptionData, StrikeData, FuturesContractData, OptionGreeks
)
from services.processor.models.enriched_data import (
    CleanedOptionData, CleanedFuturesData, CleanedGlobalContext
)

logger = get_logger("data-cleaner")


def deserialize_avro_map(map_data: dict) -> dict:
    """
    Deserialize Avro map<string> values from JSON strings to dicts.
    
    The ingestion service serializes option_chain and futures_list values
    as JSON strings for Avro map<string> schema compliance.
    """
    if not map_data:
        return {}
    
    result = {}
    for key, value in map_data.items():
        if isinstance(value, str):
            try:
                result[key] = json.loads(value)
            except json.JSONDecodeError:
                # If not valid JSON, use as-is
                result[key] = value
        else:
            result[key] = value
    return result


class DataCleaner:
    """
    Clean and validate raw market data from Dhan API
    """
    
    def __init__(self):
        self.stats = {
            'total_processed': 0,
            'missing_ltp': 0,
            'missing_iv': 0,
            'illiquid': 0,
            'invalid': 0
        }
    
    async def clean(self, raw_data: dict) -> Dict:
        """
        Main cleaning pipeline
        
        Args:
            raw_data: Raw API response
            
        Returns:
            Dictionary with cleaned data:
            {
                'context': CleanedGlobalContext,
                'futures': CleanedFuturesData,
                'options': List[CleanedOptionData]
            }
        """
        self.stats['total_processed'] += 1
        
        # Deserialize Avro map<string> values from JSON strings to dicts
        # The ingestion service serializes these for Avro schema compliance
        option_chain = deserialize_avro_map(raw_data.get('option_chain', {}))
        futures_list = deserialize_avro_map(raw_data.get('futures_list', {}))
        
        # Extract global context from new structure
        context = self._extract_global_context(raw_data)
        
        # Extract futures data (current expiry)
        futures = self._extract_futures_data(futures_list, context)
        
        # Extract and clean option chain
        options = self._clean_option_chain(option_chain, context)
        
        logger.debug(
            f"Cleaned data for {context.symbol}: "
            f"{len(options)} options, "
            f"illiquid={self.stats['illiquid']}, "
            f"invalid={self.stats['invalid']}"
        )
        
        return {
            'context': context,
            'futures': futures,
            'options': options,
            'timestamp': datetime.now(timezone.utc)
        }
    
    def _extract_global_context(self, raw_data: dict) -> CleanedGlobalContext:
        """
        Extract and clean global market context from new message structure
        """
        # Get global context from message
        gc = raw_data.get('global_context', {})
        
        # Determine symbol from message or underlying ID
        symbol = raw_data.get('symbol', 'NIFTY')
        symbol_id = int(raw_data.get('symbol_id', 0))
        
        return CleanedGlobalContext(
            symbol=symbol,
            symbol_id=symbol_id,
            spot_price=float(gc.get('spot_ltp', 0)),
            spot_change=float(gc.get('spot_change', 0)),
            spot_change_pct=float(gc.get('spot_pct_change', 0)),
            
            total_call_oi=int(gc.get('total_call_oi', 0)),
            total_put_oi=int(gc.get('total_put_oi', 0)),
            pcr_ratio=float(gc.get('pcr_ratio', 0)),
            
            atm_iv=float(gc.get('atm_iv', 0)),
            atm_iv_change=float(gc.get('atm_iv_pct_change', 0)),
            
            max_pain_strike=float(gc.get('max_pain_strike', 0)),
            days_to_expiry=int(gc.get('days_to_expiry', 0)),
            
            lot_size=int(gc.get('option_lot_size', 75)),
            tick_size=float(gc.get('option_tick_size', 0.05)),
            
            exchange=gc.get('exchange', 'NSE'),
            segment=gc.get('segment', 'D'),
            
            timestamp=datetime.now(timezone.utc)
        )
    
    def _extract_futures_data(
        self,
        futures_dict: dict,
        context: CleanedGlobalContext
    ) -> Optional[CleanedFuturesData]:
        """
        Extract current expiry futures data from 'fl' dict
        
        Args:
            futures_dict: 'fl' data (keyed by expiry timestamp)
            context: Global context
            
        Returns:
            CleanedFuturesData or None if not found
        """
        if not futures_dict:
            logger.warning("No futures data found in response")
            return None
        
        # Find current month futures (usually first one, or closest to expiry)
        # Sort by symbol (DEC comes before JAN, etc.)
        sorted_futures = sorted(
            futures_dict.items(),
            key=lambda x: x[1].get('sym', '')
        )
        
        if not sorted_futures:
            return None
        
        # Take first one (current month)
        expiry_ts, fut_data = sorted_futures[0]
        
        ltp = float(fut_data.get('ltp', 0))
        prev_close = float(fut_data.get('pc', 0))
        
        # Calculate price change (API doesn't provide)
        price_change = ltp - prev_close if prev_close > 0 else 0
        price_change_pct = (price_change / prev_close * 100) if prev_close > 0 else 0
        
        return CleanedFuturesData(
            symbol=fut_data.get('sym', ''),
            ltp=ltp,
            prev_close=prev_close,
            price_change=price_change,
            price_change_pct=price_change_pct,
            
            volume=int(fut_data.get('vol', 0)),
            prev_volume=int(fut_data.get('pvol', 0)),
            volume_change=int(fut_data.get('v_chng', 0)),
            volume_change_pct=float(fut_data.get('v_pchng', 0)),
            
            oi=int(fut_data.get('oi', 0)),
            oi_change=int(fut_data.get('oichng', 0)),
            oi_change_pct=float(fut_data.get('oipchng', 0)),
            
            lot_size=int(fut_data.get('lot', 75)),
            tick_size=float(fut_data.get('ticksize', 0.1))
        )
    
    def _clean_option_chain(
        self,
        oc_dict: dict,
        context: CleanedGlobalContext
    ) -> List[CleanedOptionData]:
        """
        Clean all option strikes
        
        Args:
            oc_dict: 'oc' data (keyed by strike price)
            context: Global context
            
        Returns:
            List of CleanedOptionData
        """
        options = []
        
        for strike_str, strike_data in oc_dict.items():
            strike = float(strike_str)
            
            # Process CE
            if 'ce' in strike_data:
                ce_cleaned = self._clean_single_option(
                    strike_data['ce'],
                    strike,
                    'CE',
                    context
                )
                if ce_cleaned:
                    options.append(ce_cleaned)
            
            # Process PE
            if 'pe' in strike_data:
                pe_cleaned = self._clean_single_option(
                    strike_data['pe'],
                    strike,
                    'PE',
                    context
                )
                if pe_cleaned:
                    options.append(pe_cleaned)
        
        return options
    
    def _clean_single_option(
        self,
        raw_opt: dict,
        strike: float,
        option_type: str,
        context: CleanedGlobalContext
    ) -> Optional[CleanedOptionData]:
        """
        Clean a single option (CE or PE)
        
        Handles:
        - Missing/zero LTP (use mid from bid/ask)
        - Missing/zero IV (flag as invalid)
        - Illiquid options (bid=0 or ask=0)
        """
        # Extract prices
        ltp = raw_opt.get('ltp') or None
        bid = raw_opt.get('bid') or None
        ask = raw_opt.get('ask') or None
        
        # Calculate mid price
        mid_price = None
        if bid is not None and ask is not None and bid > 0 and ask > 0:
            mid_price = (bid + ask) / 2
        
        # If LTP is missing/zero, use mid
        if ltp is None or ltp == 0:
            if mid_price:
                ltp = mid_price
                self.stats['missing_ltp'] += 1
            else:
                # No valid price data
                self.stats['invalid'] += 1
                return None
        
        # IV validation
        iv = raw_opt.get('iv') or None
        if iv is None or iv == 0:
            self.stats['missing_iv'] += 1
            # We can still use the option, but it's less reliable
        
        # Liquidity check
        is_liquid = True
        if bid is None or bid == 0 or ask is None or ask == 0:
            is_liquid = False
            self.stats['illiquid'] += 1
        
        # Greeks
        optgeeks = raw_opt.get('optgeeks', {})
        delta = float(optgeeks.get('delta', 0))
        gamma = float(optgeeks.get('gamma', 0))
        theta = float(optgeeks.get('theta', 0))
        vega = float(optgeeks.get('vega', 0))
        rho = float(optgeeks.get('rho', 0))
        
        # Calculate intrinsic value
        if option_type == 'CE':
            intrinsic = max(context.spot_price - strike, 0)
        else:  # PE
            intrinsic = max(strike - context.spot_price, 0)
        
        # Time value
        time_value = None
        if ltp:
            time_value = ltp - intrinsic
        
        # Moneyness
        moneyness = context.spot_price / strike if strike > 0 else 0
        
        # Classify moneyness
        mness_type = raw_opt.get('mness', 'O')
        if mness_type not in ['I', 'O', 'A']:
            # Determine from moneyness ratio
            if abs(moneyness - 1.0) < 0.01:
                mness_type = 'ATM'
            elif (option_type == 'CE' and moneyness > 1.0) or (option_type == 'PE' and moneyness < 1.0):
                mness_type = 'ITM'
            else:
                mness_type = 'OTM'
        
        return CleanedOptionData(
            strike=strike,
            option_type=option_type,
            
            ltp=ltp,
            bid=bid,
            ask=ask,
            mid_price=mid_price,
            bid_qty=int(raw_opt.get('bid_qty', 0)),
            ask_qty=int(raw_opt.get('ask_qty', 0)),
            prev_close=float(raw_opt.get('pc', 0)),
            price_change=float(raw_opt.get('p_chng', 0)),
            price_change_pct=float(raw_opt.get('p_pchng', 0)),
            avg_traded_price=float(raw_opt.get('atp', 0)),
            
            volume=int(raw_opt.get('vol', 0)),
            prev_volume=int(raw_opt.get('pVol', 0)),
            volume_change=int(raw_opt.get('v_chng', 0)),
            volume_change_pct=float(raw_opt.get('v_pchng', 0)),
            
            oi=int(raw_opt.get('OI', 0)),
            prev_oi=int(raw_opt.get('p_oi', 0)),
            oi_change=int(raw_opt.get('oichng', 0)),
            oi_change_pct=float(raw_opt.get('oiperchnge', 0)),
            
            delta=delta,
            gamma=gamma,
            theta=theta,
            vega=vega,
            rho=rho,
            
            iv=iv,
            
            intrinsic_value=intrinsic,
            time_value=time_value,
            moneyness=moneyness,
            moneyness_type=mness_type,
            
            buildup_type=raw_opt.get('btyp', ''),
            buildup_name=raw_opt.get('BuiltupName', ''),
            
            is_liquid=is_liquid,
            is_valid=iv is not None  # Valid if we have IV
        )
    
    def get_stats(self) -> dict:
        """Get cleaning statistics"""
        return self.stats.copy()
    
    def reset_stats(self):
        """Reset statistics"""
        self.stats = {
            'total_processed': 0,
            'missing_ltp': 0,
            'missing_iv': 0,
            'illiquid': 0,
            'invalid': 0
        }

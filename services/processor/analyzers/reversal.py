"""
Reversal Analyzer

Calculates Support, Resistance, and Reversal levels based on:
1. Premium Disparity (Market Price vs Theoretical Price)
2. IV Skew
3. Greeks (Delta, Gamma, Vega, Theta)
4. Advanced Reversal Point (AVP) logic

Property:
- Lower Strike Resistance ~= Upper Strike Support
- Price difference between them is approximately the Strike Difference.
"""
from typing import Dict, List, Optional
from core.logging.logger import get_logger
from services.processor.models.enriched_data import CleanedOptionData, CleanedGlobalContext
from services.processor.analyzers.avp import advanced_reversal_point

logger = get_logger("reversal-analyzer")

class ReversalAnalyzer:
    """
    Analyzer for calculating reversal points and support/resistance levels
    Matches logic from option-chain-d/Backend/BSM.py and reversal.py
    """
    
    def __init__(self):
        """
        Initialize Reversal Analyzer
        """
        pass
        
    def calculate_reversals(
        self, 
        options: List[CleanedOptionData],
        context: CleanedGlobalContext
    ) -> List[CleanedOptionData]:
        """
        Calculate reversal points for all options
        """
        # Group options by strike
        strikes = {}
        for opt in options:
            if opt.strike not in strikes:
                strikes[opt.strike] = {}
            strikes[opt.strike][opt.option_type] = opt
            
        # Process each strike
        for strike, opts in strikes.items():
            ce = opts.get('CE')
            pe = opts.get('PE')
            
            if not ce or not pe:
                continue
                
            # Ensure we have theoretical prices and Greeks
            if (ce.theoretical_price is None or pe.theoretical_price is None or
                ce.ltp is None or pe.ltp is None):
                continue
                
            # Extract Data
            curr_call_price = ce.ltp
            curr_put_price = pe.ltp
            call_theoretical_price = ce.theoretical_price
            put_theoretical_price = pe.theoretical_price
            
            call_iv = ce.iv if ce.iv else 0.0
            put_iv = pe.iv if pe.iv else 0.0
            
            # Greeks (Default to safe values if missing)
            ce_delta = ce.delta if ce.delta is not None else 0.5
            pe_delta = pe.delta if pe.delta is not None else -0.5
            
            ce_gamma = ce.gamma if ce.gamma is not None else 0.0
            pe_gamma = pe.gamma if pe.gamma is not None else 0.0
            
            ce_vega = ce.vega if ce.vega is not None else 0.0
            pe_vega = pe.vega if pe.vega is not None else 0.0
            
            ce_theta = ce.theta if ce.theta is not None else 0.0
            pe_theta = pe.theta if pe.theta is not None else 0.0
            
            # Calculate Alpha (Theoretical Put - Theoretical Call)
            # Note: In BSM.py this is used as 'alpha' in adjusted_reversal_price
            alpha = put_theoretical_price - call_theoretical_price
            
            # --- 1. Adjusted Reversal Prices (BSM.py logic) ---
            
            # Weekly Reversal
            # Formula: Strike + (PE_diff) + (CE_diff)
            wkly_rev = strike + (
                (curr_put_price - put_theoretical_price) + 
                (curr_call_price - call_theoretical_price)
            )
            
            # Resistance Range (RR)
            # Formula: Strike + |PE_diff| - |CE_diff| - alpha * (PE_IV - CE_IV)
            # Note: BSM.py uses alpha * (put_iv - call_iv)
            # But wait, alpha is Price difference. IV is percentage (e.g. 15.0 or 0.15).
            # In BSM.py: sigma is /100. So IVs are decimals (0.15).
            # Let's assume our IVs are percentages (e.g. 15.0). We should convert to decimal.
            call_iv_dec = call_iv / 100.0
            put_iv_dec = put_iv / 100.0
            
            rr = (
                strike + 
                (abs(curr_put_price - put_theoretical_price) - abs(curr_call_price - call_theoretical_price)) - 
                (alpha * (put_iv_dec - call_iv_dec))
            )
            
            # Resistance Spot (RS)
            # Formula: Strike + (PE_diff * PE_delta) - (CE_diff * CE_delta) + alpha * (PE_IV - CE_IV)
            rs = (
                strike + 
                ((curr_put_price - put_theoretical_price) * pe_delta) - 
                ((curr_call_price - call_theoretical_price) * ce_delta) + 
                (alpha * (put_iv_dec - call_iv_dec))
            )
            
            # Support Spot (SS)
            # Formula: Strike - (CE_diff - PE_diff) - alpha * (CE_IV - PE_IV)
            ss = (
                strike - 
                ((curr_call_price - call_theoretical_price) - (curr_put_price - put_theoretical_price)) - 
                (alpha * (call_iv_dec - put_iv_dec))
            )
            
            # --- 2. Advanced Reversal Point (AVP) ---
            
            # Parameters for AVP
            # S_chng and iv_chng are not currently in our data model, defaulting
            S_chng = 1.0 # Default
            iv_chng = 0.0 # Default
            
            # Instrument Type (IDX or STK)
            # We can infer from symbol or pass it. Defaulting to IDX for now.
            instrument_type = "IDX" 
            
            # ATM IV (approximate with average IV of this strike)
            current_iv = (call_iv + put_iv) / 2.0
            
            reversal_point, confidence, _ = advanced_reversal_point(
                K=strike,
                ce_delta=ce_delta,
                pe_delta=pe_delta,
                ce_gamma=ce_gamma,
                pe_gamma=pe_gamma,
                ce_vega=ce_vega,
                pe_vega=pe_vega,
                ce_theta=ce_theta,
                pe_theta=pe_theta,
                iv_chng=iv_chng,
                T_days=context.days_to_expiry,
                curr_call_price=curr_call_price,
                curr_put_price=curr_put_price,
                call_price=call_theoretical_price,
                put_price=put_theoretical_price,
                S_chng=S_chng,
                instrument_type=instrument_type,
                current_iv=current_iv
            )
            
            # --- 3. Future Reversal ---
            # Formula: Reversal + (Future - Spot)
            # We don't have Future price in context yet, so we use Spot Reversal as base
            # If we had futures price: fut_rev = reversal_point + (fut_price - spot_price)
            future_rev = reversal_point # Placeholder
            
            # Update Option Objects
            for opt in [ce, pe]:
                opt.reversal_price = round(reversal_point, 2)
                opt.weekly_reversal_price = round(wkly_rev, 2)
                opt.future_reversal_price = round(future_rev, 2)
                
                # Mapping:
                # RS (Resistance Spot) -> resistance_price
                # RR (Resistance Range) -> resistance_range_price
                # SS (Support Spot) -> support_price
                
                opt.support_price = round(ss, 2)
                opt.resistance_price = round(rs, 2)
                opt.resistance_range_price = round(rr, 2)
                
        return options

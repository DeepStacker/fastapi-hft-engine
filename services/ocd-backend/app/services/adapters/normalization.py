"""
HFT Data Normalization Logic
Transforms HFT Engine's enriched data format to option-chain-d format.
"""
from typing import Dict, Any, Optional
import math
from app.services.adapters.utils import format_expiry_date
from core.analytics.approximation import calculate_iv_approximation, calculate_delta_approximation

# Re-use the utility function
def normalize_option_leg(opt: Dict, spot_price: float = 0, dte: float = 1) -> Dict:
    """
    Normalize single option leg (CE or PE) to option-chain-d format.
    """
    option_type = opt.get("option_type", "CE").upper()
    strike = opt.get("strike", 0) or 0
    ltp = opt.get("ltp", 0) or 0
    
    # IV normalization
    raw_iv = opt.get("iv")
    
    if raw_iv is not None and raw_iv > 0:
        if 0 < raw_iv < 1:
            iv = raw_iv * 100  # Convert 0.15 → 15
        elif raw_iv > 1:
            iv = raw_iv  # Already percentage
        else:
            iv = None
    else:
        iv = None
    
    # Delta from HFT
    delta = opt.get("delta")
    if delta == 0:
        delta = None
    
    # Calculate IV dynamically if missing
    if iv is None or iv <= 0:
        if spot_price > 0 and ltp > 0 and dte > 0:
            iv = calculate_iv_approximation(ltp, spot_price, strike, dte, option_type)
        else:
            iv = 15.0
    
    # Calculate Delta dynamically if missing
    if delta is None or delta == 0:
        if spot_price > 0 and strike > 0 and iv > 0:
            delta = calculate_delta_approximation(spot_price, strike, option_type, dte, iv)
        else:
            # Simple moneyness-based fallback
            if option_type == "CE":
                delta = 0.5 if spot_price >= strike else 0.3
            else:
                delta = -0.5 if strike >= spot_price else -0.3
    
    mness = opt.get("moneyness_type", "OTM")
    if mness and len(mness) > 1:
        mness = mness[0]  # 'ITM' → 'I'
    
    oi_value = opt.get("oi", 0) or 0
    oi_change = opt.get("change_oi", 0) or opt.get("oi_change", 0) or 0
    
    gamma = opt.get("gamma", 0) or 0
    theta = opt.get("theta", 0) or 0
    vega = opt.get("vega", 0) or 0
    rho = opt.get("rho", 0) or 0
    
    # Approximate gamma/theta/vega if missing
    if gamma == 0 and spot_price > 0 and iv > 0:
        time_to_exp = max(dte / 365.0, 1/365.0)
        gamma = 0.01 / (spot_price * (iv / 100) * math.sqrt(time_to_exp) + 0.001)
        gamma = min(0.01, gamma)
    
    if theta == 0 and iv > 0 and dte > 0:
        theta = -(ltp * (iv / 100) / (2 * math.sqrt(max(dte, 1)))) * 0.1
        if option_type == "PE":
            theta = abs(theta) * -1
    
    if vega == 0 and iv > 0 and dte > 0:
        vega = spot_price * math.sqrt(max(dte / 365.0, 1/365.0)) * 0.001
    
    return {
        "ltp": ltp,
        "atp": opt.get("avg_traded_price", 0) or 0,
        "pc": opt.get("prev_close", 0) or 0,
        "bid": opt.get("bid") or 0,
        "ask": opt.get("ask") or 0,
        "bid_qty": opt.get("bid_qty", 0) or 0,
        "ask_qty": opt.get("ask_qty", 0) or 0,
        "vol": opt.get("volume", 0) or 0,
        "volume": opt.get("volume", 0) or 0,
        "pVol": opt.get("prev_volume", 0) or 0,
        "OI": oi_value,
        "oi": oi_value,
        "oichng": oi_change,
        "oi_change": oi_change,
        "oiperchnge": opt.get("oi_change_pct", 0) or 0,
        "p_oi": opt.get("prev_oi", 0) or 0,
        "p_chng": opt.get("price_change", 0) or 0,
        "p_pchng": opt.get("price_change_pct", 0) or 0,
        "change": opt.get("price_change", 0) or 0,
        "iv": round(iv, 2),
        "btyp": opt.get("buildup_type", "NT") or "NT",
        "BuiltupName": opt.get("buildup_name", "NEUTRAL") or "NEUTRAL",
        "mness": mness or "O",
        "delta": round(delta, 4) if isinstance(delta, float) else delta,
        "gamma": round(gamma, 6) if gamma else 0,
        "theta": round(theta, 4) if theta else 0,
        "vega": round(vega, 4) if vega else 0,
        "optgeeks": {
            "delta": round(delta, 4) if isinstance(delta, float) else delta,
            "gamma": round(gamma, 6) if gamma else 0,
            "theta": round(theta, 4) if theta else 0,
            "vega": round(vega, 4) if vega else 0,
            "rho": rho,
        },
        "sym": opt.get("symbol", ""),
        "sid": opt.get("symbol_id", 0) or 0,
        "is_liquid": opt.get("is_liquid", True),
        "is_valid": opt.get("is_valid", True),
    }


def normalize_data(
    hft_data: Dict, 
    symbol: str, 
    requested_expiry: Optional[str] = None
) -> Dict[str, Any]:
    """
    Transform HFT Engine's enriched data to option-chain-d format.
    Includes Reversal Calculation Logic.
    """
    from app.utils.timezone import get_ist_isoformat
    
    context = hft_data.get("context", {})
    options = hft_data.get("options", [])
    futures_data = hft_data.get("futures")
    analyses = hft_data.get("analyses", {})
    
    spot_price = context.get("spot_price", 0) or 0
    dte = context.get("days_to_expiry", 1) or 1
    expiry_list = hft_data.get("expiry_list", [])
    
    # Build option chain structure
    oc = {}
    for opt in options:
        strike = opt.get("strike")
        if strike is None:
            continue
            
        strike_str = str(int(strike))
        if strike_str not in oc:
            oc[strike_str] = {"ce": {}, "pe": {}}
        
        option_type = opt.get("option_type", "").upper()
        leg_key = "ce" if option_type == "CE" else "pe"
        oc[strike_str][leg_key] = normalize_option_leg(opt, spot_price, dte)
    
    # Build future structure
    future_dict = {}
    
    if requested_expiry:
        expiry = requested_expiry
    else:
        raw_expiry = hft_data.get("expiry", "")
        expiry = format_expiry_date(raw_expiry, expiry_list)
    
    if futures_data:
        future_dict[str(expiry)] = {
            "ltp": futures_data.get("ltp", 0),
            "oi": futures_data.get("oi", 0),
            "oichng": futures_data.get("oi_change", 0),
            "vol": futures_data.get("volume", 0),
            "sym": futures_data.get("symbol", f"{symbol}FUT"),
        }
    
    strikes = sorted(oc.keys(), key=lambda x: float(x))
    
    # REVERSAL CALCULATION
    if strikes and spot_price > 0:
        max_oi = 1
        for s_key in strikes:
            s = oc[s_key]
            ce_oi = s.get("ce", {}).get("OI", 0) or 0
            pe_oi = s.get("pe", {}).get("OI", 0) or 0
            max_oi = max(max_oi, ce_oi, pe_oi)
        
        for strike_str in strikes:
            strike_val = float(strike_str)
            s = oc[strike_str]
            ce = s.get("ce", {})
            pe = s.get("pe", {})
            
            ce_oi = ce.get("OI", 0) or 0
            pe_oi = pe.get("OI", 0) or 0
            ce_vol = ce.get("volume", 0) or 0
            pe_vol = pe.get("volume", 0) or 0
            
            ce_gamma = abs(ce.get("optgeeks", {}).get("gamma", 0) or 0)
            pe_gamma = abs(pe.get("optgeeks", {}).get("gamma", 0) or 0)
            ce_iv = ce.get("iv", 0) or 0
            pe_iv = pe.get("iv", 0) or 0
            
            ce_gamma_mult = 1 + (ce_gamma * 50)
            pe_gamma_mult = 1 + (pe_gamma * 50)
            ce_iv_mult = 1 + (ce_iv / 100)
            pe_iv_mult = 1 + (pe_iv / 100)
            
            ce_strength = (ce_oi * 0.7 + ce_vol * 0.3) * ce_gamma_mult * ce_iv_mult
            pe_strength = (pe_oi * 0.7 + pe_vol * 0.3) * pe_gamma_mult * pe_iv_mult
            
            oi_ratio = (ce_oi + pe_oi) / (max_oi * 2 + 0.001)
            strength_factor = min(0.02, oi_ratio * 0.05)
            
            if strike_val > spot_price:
                reversal = strike_val * (1 - strength_factor * 0.5)
            else:
                reversal = strike_val * (1 + strength_factor * 0.5)
            
            wkly_factor = strength_factor * 0.3
            wkly_reversal = strike_val * (1 + wkly_factor if strike_val < spot_price else 1 - wkly_factor)
            
            fut_ltp = futures_data.get("ltp", spot_price) if futures_data else spot_price
            fut_factor = strength_factor * 0.4
            if strike_val > fut_ltp:
                fut_reversal = strike_val * (1 - fut_factor * 0.5)
            else:
                fut_reversal = strike_val * (1 + fut_factor * 0.5)
            
            oc[strike_str]["reversal"] = round(reversal, 2)
            oc[strike_str]["wkly_reversal"] = round(wkly_reversal, 2)
            oc[strike_str]["fut_reversal"] = round(fut_reversal, 2)
            oc[strike_str]["ce_strength"] = round(ce_strength, 2)
            oc[strike_str]["pe_strength"] = round(pe_strength, 2)
            
    atm_strike = 0
    if strikes and spot_price > 0:
        atm_strike = min(strikes, key=lambda x: abs(float(x) - spot_price))
    
    return {
        "symbol": symbol.upper(),
        "expiry": expiry,
        "timestamp": hft_data.get("timestamp", get_ist_isoformat()),
        "spot": {
            "ltp": context.get("spot_price", 0),
            "change": context.get("spot_change", 0),
            "change_percent": context.get("spot_change_pct", 0),
        },
        "future": future_dict,
        "fl": future_dict,
        "oc": oc,
        "strikes": strikes,
        "atm_strike": float(atm_strike) if atm_strike else spot_price,
        "atmiv": context.get("atm_iv", 0),
        "atmiv_change": context.get("atm_iv_change", 0),
        "u_id": hft_data.get("symbol_id", context.get("symbol_id", 0)),
        "dte": context.get("days_to_expiry", 0),
        "days_to_expiry": context.get("days_to_expiry", 0),
        "max_pain_strike": context.get("max_pain_strike", 0),
        "total_ce_oi": context.get("total_call_oi", 0),
        "total_call_oi": context.get("total_call_oi", 0),
        "total_pe_oi": context.get("total_put_oi", 0),
        "total_put_oi": context.get("total_put_oi", 0),
        "pcr": context.get("pcr_ratio", 0),
        "pcr_ratio": context.get("pcr_ratio", 0),
        "lot_size": context.get("lot_size", 75),
        "expiry_list": hft_data.get("expiry_list", []),
        "expiry_dates": hft_data.get("expiry_dates", []),
        "sltp": context.get("spot_price", 0),
        "schng": context.get("spot_change", 0),
        "sperchng": context.get("spot_change_pct", 0),
        "hft_analyses": analyses,
        "data_quality": hft_data.get("data_quality", {}),
        "_source": "hft_engine",
    }

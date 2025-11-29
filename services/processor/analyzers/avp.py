import json
from math import tanh

def advanced_reversal_point(
    K,
    ce_delta,
    pe_delta,
    ce_gamma,
    pe_gamma,
    ce_vega,
    pe_vega,
    ce_theta,
    pe_theta,
    iv_chng,
    T_days,
    curr_call_price, # ce_ltp
    curr_put_price, # pe_ltp
    call_price, # ce_theory
    put_price, # pe_theory
    S_chng=1,
    instrument_type="IDX",
    current_iv=15.0,
):
    """
    Calculate Advanced Reversal Point using Greeks and Market Conditions.
    Ported from option-chain-d/Backend/avp.py
    """
    # ✅ Net Greeks
    net_delta = ce_delta + pe_delta
    net_gamma = ce_gamma + pe_gamma
    net_vega = ce_vega + pe_vega
    net_theta = ce_theta + pe_theta

    # ✅ Greek weights
    total_mag = sum(map(abs, [net_delta, net_gamma, net_vega, net_theta])) or 1
    delta_weight = abs(net_delta) / total_mag
    gamma_weight = abs(net_gamma) / total_mag
    vega_weight = abs(net_vega) / total_mag
    theta_weight = abs(net_theta) / total_mag

    # ✅ Greek contributions (undamped)
    delta_contrib = delta_weight * net_delta
    gamma_contrib = gamma_weight * 0.5 * net_gamma * (S_chng**2)
    vega_contrib = vega_weight * net_vega * iv_chng
    theta_contrib = theta_weight * net_theta

    raw_adjustment = delta_contrib + gamma_contrib + vega_contrib + theta_contrib

    # ⚡ Smart time and volatility sensitivity
    time_sensitivity = 1 / (1 + (1 / (T_days + 1e-8)))  # near expiry → ~0.5-1.0
    vol_sensitivity = min(1.0, current_iv / 30)  # 0.0 to 1.0
    normalized_adjustment = (
        tanh(raw_adjustment / 5) * time_sensitivity * vol_sensitivity
    )

    # ⚙️ Dynamic max shift
    if instrument_type.upper() == "IDX":
        max_dynamic_shift = min(150, K * (current_iv / 100) * 0.03)  # 0.5% to 1.5%
    else:
        max_dynamic_shift = min(20, K * (current_iv / 100) * 0.05)  # up to 2%

    scaled_adjustment = normalized_adjustment * max_dynamic_shift

    # 🎯 Confidence score
    mean_greek = (abs(net_delta) + abs(net_gamma) + abs(net_vega) + abs(net_theta)) / 4
    confidence_score = round(tanh(mean_greek / 2) * 100)

    # theoritical price weight
    pweight = (curr_call_price - call_price) + (curr_put_price - put_price)
    reversal_point = round(K + scaled_adjustment + pweight, 2)

    # 📦 Debug + telemetry (Simplified for new app, returning dict)
    all_data = {
        "reversal_point": reversal_point,
        "confidence_score": confidence_score,
        "net_delta": net_delta,
        "net_gamma": net_gamma,
        "net_vega": net_vega,
        "net_theta": net_theta,
        "scaled_adjustment": scaled_adjustment,
        "pweight": pweight
    }

    return reversal_point, confidence_score, all_data

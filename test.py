import numpy as np

# =============================
# INPUT DATA (YOUR DATA)
# =============================

spot = 26082

option_chain = [
    {
        "strike": 25950,
        "call": {"oi": 30337, "delta": 0.8071, "gamma": 0.0017},
        "put":  {"oi": 117935, "delta": -0.1478, "gamma": 0.0017}
    },
    {
        "strike": 26000,
        "call": {"oi": 183071, "delta": 0.7290, "gamma": 0.0022},
        "put":  {"oi": 324613, "delta": -0.2408, "gamma": 0.0024}
    },
    {
        "strike": 26050,
        "call": {"oi": 167413, "delta": 0.6156, "gamma": 0.0027},
        "put":  {"oi": 250294, "delta": -0.3688, "gamma": 0.0030}
    },
    {
        "strike": 26100,
        "call": {"oi": 327253, "delta": 0.4771, "gamma": 0.0029},
        "put":  {"oi": 203697, "delta": -0.5261, "gamma": 0.0032}
    }
]

# =============================
# DELTA FUNCTION (LOCAL GAMMA)
# =============================

def delta_at_price(base_delta, gamma, price, strike):
    return base_delta + gamma * (price - strike)

# =============================
# TOTAL DEALER HEDGE PRESSURE
# =============================

def total_hedge_pressure(price):
    total = 0.0
    for opt in option_chain:
        K = opt["strike"]

        ce = opt["call"]
        pe = opt["put"]

        ce_delta = delta_at_price(ce["delta"], ce["gamma"], price, K)
        pe_delta = delta_at_price(pe["delta"], pe["gamma"], price, K)

        total += ce["oi"] * ce_delta
        total += pe["oi"] * pe_delta

    return total

# =============================
# SCAN PRICE RANGE
# =============================

prices = np.arange(spot - 150, spot + 150, 0.1)
H = np.array([total_hedge_pressure(p) for p in prices])

# =============================
# FIND TURNING POINTS
# =============================

dH = np.gradient(H)
ddH = np.gradient(dH)

support = None
resistance = None

for i in range(2, len(prices) - 2):
    # Support = local minimum
    if ddH[i] > 0 and dH[i-1] < 0 and dH[i+1] > 0:
        if prices[i] < spot:
            support = prices[i]

    # Resistance = local maximum
    if ddH[i] < 0 and dH[i-1] > 0 and dH[i+1] < 0:
        if prices[i] > spot and resistance is None:
            resistance = prices[i]

print("Spot:", spot)
print("Calculated Support:", support)
print("Calculated Resistance:", resistance)

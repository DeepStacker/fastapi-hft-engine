/**
 * Greeks Calculation Web Worker
 * Offloads Black-Scholes-Merton calculations to background thread
 * Prevents UI jank when calculating Greeks for many strikes
 */

// Black-Scholes-Merton Normal CDF approximation
function normalCDF(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}

// Normal PDF
function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Calculate d1 and d2 for BSM
function calculateD1D2(S, K, T, r, sigma) {
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    return { d1, d2 };
}

// Calculate all Greeks for a single option
function calculateGreeks(params) {
    const { spot, strike, timeToExpiry, riskFreeRate, volatility, optionType } = params;

    // Validate inputs
    if (timeToExpiry <= 0 || volatility <= 0 || spot <= 0 || strike <= 0) {
        return {
            delta: 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0,
            iv: volatility || 0
        };
    }

    const S = spot;
    const K = strike;
    const T = timeToExpiry / 365; // Convert days to years
    const r = riskFreeRate || 0.05;
    const sigma = volatility;
    const isCall = optionType === 'CE';

    const { d1, d2 } = calculateD1D2(S, K, T, r, sigma);
    const sqrtT = Math.sqrt(T);

    // Delta
    let delta;
    if (isCall) {
        delta = normalCDF(d1);
    } else {
        delta = normalCDF(d1) - 1;
    }

    // Gamma (same for call and put)
    const gamma = normalPDF(d1) / (S * sigma * sqrtT);

    // Theta (per day)
    const term1 = -(S * normalPDF(d1) * sigma) / (2 * sqrtT);
    let theta;
    if (isCall) {
        theta = term1 - r * K * Math.exp(-r * T) * normalCDF(d2);
    } else {
        theta = term1 + r * K * Math.exp(-r * T) * normalCDF(-d2);
    }
    theta = theta / 365; // Convert to daily theta

    // Vega (per 1% change in volatility)
    const vega = S * sqrtT * normalPDF(d1) * 0.01;

    // Rho (per 1% change in interest rate)
    let rho;
    if (isCall) {
        rho = K * T * Math.exp(-r * T) * normalCDF(d2) * 0.01;
    } else {
        rho = -K * T * Math.exp(-r * T) * normalCDF(-d2) * 0.01;
    }

    return {
        delta: Number(delta.toFixed(4)),
        gamma: Number(gamma.toFixed(6)),
        theta: Number(theta.toFixed(4)),
        vega: Number(vega.toFixed(4)),
        rho: Number(rho.toFixed(4)),
        iv: Number((sigma * 100).toFixed(2)) // IV as percentage
    };
}

// Calculate Greeks for batch of options
function calculateBatchGreeks(options, spot, riskFreeRate) {
    const results = [];

    for (const option of options) {
        const greeks = calculateGreeks({
            spot,
            strike: option.strike,
            timeToExpiry: option.daysToExpiry,
            riskFreeRate,
            volatility: option.iv / 100, // Convert percentage to decimal
            optionType: option.type
        });

        results.push({
            strike: option.strike,
            type: option.type,
            ...greeks
        });
    }

    return results;
}

// Message handler
self.onmessage = function (e) {
    const { type, data, id } = e.data;

    try {
        let result;

        switch (type) {
            case 'CALCULATE_SINGLE':
                result = calculateGreeks(data);
                break;

            case 'CALCULATE_BATCH':
                result = calculateBatchGreeks(data.options, data.spot, data.riskFreeRate);
                break;

            case 'PING':
                result = 'PONG';
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }

        self.postMessage({ id, type: 'SUCCESS', result });
    } catch (error) {
        self.postMessage({ id, type: 'ERROR', error: error.message });
    }
};

// Indicate worker is ready
self.postMessage({ type: 'READY' });

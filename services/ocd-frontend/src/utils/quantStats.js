/**
 * Quantitative Statistics Library for Options Analysis
 * Provides regression, correlation, and probability models.
 */

// ============ REGRESSION MODELS ============

/**
 * Calculates OI-Weighted Linear Regression to detect positioning skew.
 * Weights strike prices by their OI to see where the "Center of Gravity" is moving.
 * @param {Array} levels - Array of level objects {strike, totalOI}
 * @returns {Object} {slope, rSquared, bias}
 */
export const calculateOIRegression = (levels) => {
    if (!levels || levels.length < 2) return { slope: 0, rSquared: 0, bias: 'neutral' };

    let n = 0;
    let sumX = 0; // Strike
    let sumY = 0; // OI
    let sumXY = 0;
    let sumX2 = 0;
    let sumWeights = 0;

    // We accept raw levels, but to make regression meaningful for "Skew",
    // we often regress (Index) vs (OI) or (Strike) vs (OI).
    // Here we strictly check if HIGHER STRIKES have MORE OI (Bullish Skew? or Resistance?).
    // Actually, widespread high OI at high strikes usually means Resistance (Bearish).
    // High OI at lower strikes means Support (Bullish).
    // Slope > 0 means OI increases as Strike Increases -> Resistance Heavy -> Bearish Pressure.
    // Slope < 0 means OI decreases as Strike Increases -> Support Heavy -> Bullish Support.

    // Let's normalize data first
    const maxOI = Math.max(...levels.map(l => l.totalOI)) || 1;
    const minStrike = Math.min(...levels.map(l => l.strike));

    levels.forEach(level => {
        const x = (level.strike - minStrike) / 100; // Scale down strike 
        const y = level.totalOI / maxOI; // Normalized OI (0-1)

        n++;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    });

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = (n * sumX2) - (sumX * sumX);

    if (denominator === 0) return { slope: 0, rSquared: 0, bias: 'neutral' };

    const slope = numerator / denominator;

    // R-Squared (Coeff of Determination)
    const intercept = (sumY - slope * sumX) / n;
    let ssTotal = 0;
    let ssRes = 0;
    const avgY = sumY / n;

    levels.forEach(level => {
        const x = (level.strike - minStrike) / 100;
        const y = level.totalOI / maxOI;
        const predY = slope * x + intercept;
        ssTotal += Math.pow(y - avgY, 2);
        ssRes += Math.pow(y - predY, 2);
    });

    const rSquared = ssTotal === 0 ? 0 : 1 - (ssRes / ssTotal);

    // Interpretation
    // Positive Slope = More OI at higher strikes = Resistance building = Bearish/Capped
    // Negative Slope = More OI at lower strikes = Support building = Bullish/Floored
    const bias = slope > 0.1 ? 'bearish (resistance heavy)'
        : slope < -0.1 ? 'bullish (support heavy)'
            : 'neutral';

    return { slope, rSquared, bias, intercept };
};

// ============ VOLATILITY MODELS ============

/**
 * Fits a Quadratic Curve (y = ax^2 + bx + c) to OTM IVs ("The Smile")
 * @param {Array} callIVs - Array of {strike, iv} for OTM Calls
 * @param {Array} putIVs - Array of {strike, iv} for OTM Puts
 * @param {Number} atmStrike 
 */
export const fitVolatilitySmile = (callIVs, putIVs, atmStrike) => {
    // Combine and sort by strike
    const data = [...putIVs, ...callIVs]
        .filter(d => d.iv > 0)
        .sort((a, b) => a.strike - b.strike);

    if (data.length < 3) return { curvature: 0, skew: 0, minIV: 0 };

    // We'll use a simplified least squares for quadratic fit on centered strikes
    // x = (strike - atm) / atm  (Moneyness)
    // y = iv

    let n = data.length;
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;

    data.forEach(p => {
        const x = (p.strike - atmStrike) / atmStrike; // Moneyness
        const y = p.iv;

        sumX += x;
        sumX2 += x * x;
        sumX3 += x * x * x;
        sumX4 += x * x * x * x;
        sumY += y;
        sumXY += x * y;
        sumX2Y += x * x * y;
    });

    // Solve 3x3 System for a, b, c using Cramer's Rule or Substitution
    // Matrix:
    // [ sumX4 sumX3 sumX2 ] [ a ]   [ sumX2Y ]
    // [ sumX3 sumX2 sumX  ] [ b ] = [ sumXY  ]
    // [ sumX2 sumX  n     ] [ c ]   [ sumY   ]

    // Simplified approx extraction for specific "Curvature" vs "Skew"
    // Curvature ~ a (from ax^2)
    // Skew ~ b (from bx)

    // Determinant of main matrix
    const det = n * (sumX2 * sumX4 - sumX3 * sumX3)
        - sumX * (sumX * sumX4 - sumX2 * sumX3)
        + sumX2 * (sumX * sumX3 - sumX2 * sumX2);

    if (Math.abs(det) < 1e-9) return { curvature: 0, skew: 0, minIV: 0 }; // Singular

    // We only really care about 'a' (curvature) and 'b' (skew)
    // Coeff a (Curvature)
    // Replace col 1 with result info
    const detA = sumX2Y * (sumX2 * n - sumX * sumX)
        - sumXY * (sumX3 * n - sumX2 * sumX)
        + sumY * (sumX3 * sumX - sumX2 * sumX2);

    const a = detA / det; // Curvature

    // Coeff b (Skew) - Rough approximation for speed, as full Cramer is verbose
    // We can infer skew from the raw IV difference of equidistant wings usually, 
    // but let's just return 'a' as "Smile convexity"

    return {
        curvature: a * 100, // Scale up
        skew: 0, // Todo: implement full solver if needed
        minIV: Math.min(...data.map(d => d.iv))
    };
};

// ============ PROBABILITY MODELS ============

/**
 * Calculates Gaussian Probability Cones for Spot Price
 * @param {Number} spot 
 * @param {Number} iv (annualized, e.g. 12.5)
 * @param {Number} daysToExpiry
 */
export const calculateProbabilityCones = (spot, iv, daysToExpiry = 1) => {
    const sigma = iv / 100;
    const t = daysToExpiry / 365;
    const stdDev = spot * sigma * Math.sqrt(t);

    return {
        oneSigma: {
            upper: spot + stdDev,
            lower: spot - stdDev,
            prob: '68%'
        },
        twoSigma: {
            upper: spot + (2 * stdDev),
            lower: spot - (2 * stdDev),
            prob: '95%'
        },
        dailyMove: stdDev // Expected daily range
    };
};

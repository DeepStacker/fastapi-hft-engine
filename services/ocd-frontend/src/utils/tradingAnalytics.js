// Advanced Statistical Measures
export const calculateBetaAlpha = (returns, marketReturns) => {
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const avgMarketReturn = marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;
    
    const covariance = returns.reduce((acc, ret, i) => 
        acc + (ret - avgReturn) * (marketReturns[i] - avgMarketReturn), 0
    ) / returns.length;
    
    const marketVariance = marketReturns.reduce((acc, ret) => 
        acc + Math.pow(ret - avgMarketReturn, 2), 0
    ) / marketReturns.length;
    
    const beta = covariance / marketVariance;
    const alpha = avgReturn - beta * avgMarketReturn;
    
    return { beta, alpha };
};

// Advanced Risk Metrics
export const calculateVaR = (returns, confidenceLevel = 0.95) => {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * returns.length);
    return sortedReturns[index];
};

export const calculateCVaR = (returns, confidenceLevel = 0.95) => {
    const var_ = calculateVaR(returns, confidenceLevel);
    const tailReturns = returns.filter(ret => ret <= var_);
    return tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length;
};

// Predictive Analytics
export const calculateTrendStrength = (values) => {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const yMean = sumY / n;
    const ssTotal = y.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((acc, yi, i) => {
        const yPred = slope * x[i] + intercept;
        return acc + Math.pow(yi - yPred, 2);
    }, 0);
    
    const rSquared = 1 - (ssResidual / ssTotal);
    
    return {
        slope,
        intercept,
        rSquared,
        prediction: slope * n + intercept
    };
};

export const calculateMomentum = (values, period = 14) => {
    return values.map((val, i) => {
        if (i < period) return null;
        return ((val - values[i - period]) / values[i - period]) * 100;
    }).slice(period);
};

export const calculateRSI = (values, period = 14) => {
    const changes = values.map((val, i) => 
        i === 0 ? 0 : val - values[i - 1]
    );
    
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);
    
    const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    const rsi = 100 - (100 / (1 + avgGain / avgLoss));
    return rsi;
};

// Pattern Recognition
export const identifyPatterns = (trades) => {
    const patterns = {
        reversals: 0,
        breakouts: 0,
        consolidations: 0
    };
    
    trades.forEach((day, i) => {
        if (i === 0) return;
        
        const prevDay = trades[i - 1];
        const currentWins = day.filter(t => t === 'Profit').length;
        const prevWins = prevDay.filter(t => t === 'Profit').length;
        
        // Reversal pattern
        if (
            (prevWins === 0 && currentWins === day.length) ||
            (prevWins === prevDay.length && currentWins === 0)
        ) {
            patterns.reversals++;
        }
        
        // Breakout pattern
        if (currentWins > prevWins * 1.5) {
            patterns.breakouts++;
        }
        
        // Consolidation pattern
        if (Math.abs(currentWins - prevWins) <= 1) {
            patterns.consolidations++;
        }
    });
    
    return patterns;
};

// Performance Attribution
export const calculatePerformanceAttribution = (returns, factorReturns) => {
    const factors = Object.keys(factorReturns);
    const attribution = {};
    
    factors.forEach(factor => {
        const correlation = calculateCorrelation(returns, factorReturns[factor]);
        const contribution = correlation * 
            (Math.std(factorReturns[factor]) / Math.std(returns));
        attribution[factor] = contribution;
    });
    
    return attribution;
};

// Volatility Analysis
export const calculateVolatilityRegimes = (returns) => {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, ret) => 
        acc + Math.pow(ret - mean, 2), 0
    ) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return returns.map(ret => {
        const z = (ret - mean) / stdDev;
        if (Math.abs(z) > 2) return 'High';
        if (Math.abs(z) > 1) return 'Medium';
        return 'Low';
    });
};

// Helper Functions
export const calculateCorrelation = (array1, array2) => {
    const mean1 = array1.reduce((a, b) => a + b, 0) / array1.length;
    const mean2 = array2.reduce((a, b) => a + b, 0) / array2.length;
    
    const variance1 = array1.reduce((acc, val) => 
        acc + Math.pow(val - mean1, 2), 0
    );
    const variance2 = array2.reduce((acc, val) => 
        acc + Math.pow(val - mean2, 2), 0
    );
    
    const covariance = array1.reduce((acc, val, i) => 
        acc + (val - mean1) * (array2[i] - mean2), 0
    );
    
    return covariance / Math.sqrt(variance1 * variance2);
};

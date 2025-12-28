// Advanced Position Sizing Analytics

// Kelly Criterion calculation
export const calculateKellyCriterion = (winRate, riskRewardRatio) => {
    const winProbability = winRate / 100;
    const lossProbability = 1 - winProbability;
    const kelly = (winProbability * riskRewardRatio - lossProbability) / riskRewardRatio;
    return Math.max(0, kelly); // Never suggest negative position sizes
};

// Optimal position size based on market conditions
export const calculateOptimalPosition = (baseSize, marketConditions) => {
    const {
        volatility,      // market volatility (low: 0.8, medium: 1, high: 1.2)
        trend,          // market trend strength (0 to 1)
        liquidity,      // market liquidity (0 to 1)
        correlation     // correlation with other positions (0 to 1)
    } = marketConditions;

    let multiplier = 1;

    // Adjust for volatility
    multiplier *= (2 - volatility);

    // Adjust for trend alignment
    multiplier *= (1 + trend * 0.2);

    // Adjust for liquidity
    multiplier *= liquidity;

    // Reduce size for high correlation
    multiplier *= (1 - correlation * 0.3);

    return baseSize * multiplier;
};

// Risk metrics calculation
export const calculateRiskMetrics = (position, marketData) => {
    const {
        price,
        stopLoss,
        _target,
        volatility,
        volume
    } = marketData;

    // Calculate Average True Range (ATR) based volatility
    const atrMultiplier = volatility === 'high' ? 2 : volatility === 'medium' ? 1.5 : 1;
    const normalizedRange = Math.abs(price - stopLoss) * atrMultiplier;

    // Calculate volume-based liquidity risk
    const liquidityRisk = volume < 100000 ? 'high' : volume < 500000 ? 'medium' : 'low';

    // Calculate position impact
    const positionImpact = (position.quantity * price) / volume;

    return {
        volatilityRisk: normalizedRange / price,
        liquidityRisk,
        positionImpact,
        slippageEstimate: calculateSlippage(positionImpact, liquidityRisk)
    };
};

// Slippage estimation
const calculateSlippage = (positionImpact, liquidityRisk) => {
    const baseSlippage = positionImpact * 100; // Base slippage in percentage
    const liquidityMultiplier = {
        'high': 2,
        'medium': 1.5,
        'low': 1
    }[liquidityRisk];

    return baseSlippage * liquidityMultiplier;
};

// Monte Carlo simulation for risk assessment
export const runMonteCarloSimulation = (position, marketData, iterations = 1000) => {
    const results = [];
    const { price, volatility, target, stopLoss } = marketData;
    const dailyVolatility = volatility === 'high' ? 0.02 : volatility === 'medium' ? 0.015 : 0.01;

    for (let i = 0; i < iterations; i++) {
        let currentPrice = price;
        let days = 0;

        while (currentPrice > stopLoss && currentPrice < target && days < 20) {
            // Random walk with drift
            const drift = (target - price) / (price * 100); // Slight bias towards target
            const randomMove = (Math.random() - 0.5) * dailyVolatility;
            currentPrice *= (1 + randomMove + drift);
            days++;
        }

        results.push({
            finalPrice: currentPrice,
            days,
            outcome: currentPrice >= target ? 'win' : 'loss'
        });
    }

    return analyzeMonteCarloResults(results);
};

// Analyze Monte Carlo simulation results
const analyzeMonteCarloResults = (results) => {
    const wins = results.filter(r => r.outcome === 'win');
    const winRate = (wins.length / results.length) * 100;
    const avgDays = results.reduce((sum, r) => sum + r.days, 0) / results.length;

    return {
        winProbability: winRate.toFixed(2),
        averageDaysToOutcome: avgDays.toFixed(1),
        confidenceScore: calculateConfidenceScore(winRate, avgDays)
    };
};

// Calculate confidence score for the trade
const calculateConfidenceScore = (winRate, avgDays) => {
    // Higher win rate and lower duration = better confidence
    const winRateScore = winRate / 100;
    const durationScore = Math.max(0, 1 - (avgDays / 20)); // Normalize to 0-1 range
    return ((winRateScore * 0.7) + (durationScore * 0.3)) * 100;
};

// Generate advanced trading suggestions
export const generateTradingSuggestions = (position, analysis, marketData) => {
    const suggestions = [];
    const { riskRewardRatio, portfolioHeat, volatilityImpact } = analysis;
    const { volatility, trend, volume } = marketData;

    // Risk:Reward Analysis
    if (riskRewardRatio < 1.5) {
        suggestions.push({
            type: 'warning',
            message: 'Risk:Reward ratio is below recommended minimum of 1.5:1',
            action: 'Consider adjusting entry price or target to improve R:R ratio'
        });
    }

    // Portfolio Heat Analysis
    if (portfolioHeat > 0.4) {
        suggestions.push({
            type: 'danger',
            message: 'High portfolio heat detected',
            action: 'Reduce position size or hedge existing positions'
        });
    }

    // Volatility-based Suggestions
    if (volatility === 'high' && volatilityImpact > 15) {
        suggestions.push({
            type: 'info',
            message: 'High market volatility detected',
            action: 'Consider using options strategies or scaling in gradually'
        });
    }

    // Volume Analysis
    if (volume < position.quantity * 100) {
        suggestions.push({
            type: 'warning',
            message: 'Position size may impact market liquidity',
            action: 'Consider breaking up the order or using TWAP/VWAP'
        });
    }

    // Trend Analysis
    if (trend === 'weak' && position.type === 'long') {
        suggestions.push({
            type: 'info',
            message: 'Weak market trend for long position',
            action: 'Consider waiting for trend confirmation or reducing size'
        });
    }

    return suggestions;
};

// Calculate optimal entry points
export const calculateOptimalEntries = (position, marketData) => {
    const { price, volatility, volume: _volume } = marketData;
    const volatilityFactor = volatility === 'high' ? 0.02 : volatility === 'medium' ? 0.015 : 0.01;

    return {
        conservative: {
            price: price * (1 - volatilityFactor),
            size: Math.floor(position.quantity * 0.4),
            conditions: 'Market volatility decrease or support level test'
        },
        moderate: {
            price: price,
            size: Math.floor(position.quantity * 0.3),
            conditions: 'Current market price with volume confirmation'
        },
        aggressive: {
            price: price * (1 + volatilityFactor),
            size: Math.floor(position.quantity * 0.3),
            conditions: 'Momentum confirmation or breakout'
        }
    };
};

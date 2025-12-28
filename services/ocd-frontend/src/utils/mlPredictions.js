// Simple Moving Average
export const calculateSMA = (data, period) => {
    return data.map((val, idx) => {
        if (idx < period - 1) return null;
        const sum = data.slice(idx - period + 1, idx + 1).reduce((a, b) => a + b, 0);
        return sum / period;
    });
};

// Exponential Moving Average
export const calculateEMA = (data, period) => {
    const k = 2 / (period + 1);
    let ema = [data[0]];

    for (let i = 1; i < data.length; i++) {
        ema.push(data[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
};

// MACD (Moving Average Convergence Divergence)
export const calculateMACD = (data) => {
    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);
    const macd = ema12.map((val, i) => val - ema26[i]);
    const signal = calculateEMA(macd, 9);
    const histogram = macd.map((val, i) => val - signal[i]);

    return { macd, signal, histogram };
};

// Bollinger Bands
export const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
    const sma = calculateSMA(data, period);
    const bands = sma.map((mean, i) => {
        if (mean === null) return { upper: null, middle: null, lower: null };
        const slice = data.slice(i - period + 1, i + 1);
        const std = Math.sqrt(slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period);
        return {
            upper: mean + stdDev * std,
            middle: mean,
            lower: mean - stdDev * std
        };
    });
    return bands;
};

// Linear Regression Forecast
export const linearRegressionForecast = (data, forecastDays) => {
    const x = Array.from({ length: data.length }, (_, i) => i);
    const y = data;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const forecast = Array.from({ length: forecastDays }, (_, i) => {
        const x = data.length + i;
        return slope * x + intercept;
    });

    const confidence = 1 - Math.abs(
        data.reduce((acc, yi, i) => {
            const predicted = slope * i + intercept;
            return acc + Math.abs(yi - predicted) / yi;
        }, 0) / data.length
    );

    return { forecast, confidence };
};

// Support and Resistance Levels
export const findSupportResistance = (data, sensitivity = 2) => {
    const levels = [];
    const prices = [...data];

    for (let i = sensitivity; i < prices.length - sensitivity; i++) {
        const current = prices[i];
        const leftPrices = prices.slice(i - sensitivity, i);
        const rightPrices = prices.slice(i + 1, i + sensitivity + 1);

        // Check for support
        if (leftPrices.every(p => p >= current) && rightPrices.every(p => p >= current)) {
            levels.push({ type: 'support', price: current, index: i });
        }
        // Check for resistance
        if (leftPrices.every(p => p <= current) && rightPrices.every(p => p <= current)) {
            levels.push({ type: 'resistance', price: current, index: i });
        }
    }

    return levels;
};

// Fibonacci Retracement Levels
export const calculateFibonacciLevels = (high, low) => {
    const diff = high - low;
    return {
        level0: high,
        level23_6: high - diff * 0.236,
        level38_2: high - diff * 0.382,
        level50_0: high - diff * 0.5,
        level61_8: high - diff * 0.618,
        level100: low
    };
};

// Pattern Recognition using Machine Learning
export const recognizePatterns = (data, windowSize = 5) => {
    const patterns = [];

    for (let i = windowSize; i < data.length; i++) {
        const window = data.slice(i - windowSize, i);
        const normalized = normalizeWindow(window);

        // Head and Shoulders
        if (isHeadAndShoulders(normalized)) {
            patterns.push({ type: 'Head and Shoulders', index: i });
        }

        // Double Top
        if (isDoubleTop(normalized)) {
            patterns.push({ type: 'Double Top', index: i });
        }

        // Double Bottom
        if (isDoubleBottom(normalized)) {
            patterns.push({ type: 'Double Bottom', index: i });
        }

        // Triangle
        if (isTriangle(normalized)) {
            patterns.push({ type: 'Triangle', index: i });
        }
    }

    return patterns;
};

// Helper functions for pattern recognition
const normalizeWindow = (window) => {
    const min = Math.min(...window);
    const max = Math.max(...window);
    return window.map(val => (val - min) / (max - min));
};

const isHeadAndShoulders = (normalized) => {
    // Simplified head and shoulders pattern detection
    const [a, b, c, d, e] = normalized;
    return (b > a && b > c && d > c && d < b && e < d);
};

const isDoubleTop = (normalized) => {
    const [a, b, c, d, e] = normalized;
    return (b > a && b > c && d > c && Math.abs(b - d) < 0.1 && e < d);
};

const isDoubleBottom = (normalized) => {
    const [a, b, c, d, e] = normalized;
    return (b < a && b < c && d < c && Math.abs(b - d) < 0.1 && e > d);
};

const isTriangle = (normalized) => {
    const [a, b, c, d] = normalized;
    const slope1 = (c - a) / 2;
    const slope2 = (d - b) / 2;
    return Math.abs(slope1 + slope2) < 0.1;
};

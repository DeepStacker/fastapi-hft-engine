/**
 * Strategy Optimizer API Service
 * 
 * Provides methods to interact with the backend strategy optimization endpoints.
 */

import api from './apiClient';

/**
 * Convert expiry value to string format required by API.
 * The backend expects numeric timestamps as strings.
 * @param {string|number} expiry - Expiry as Unix timestamp (seconds) or date string
 * @returns {string} Formatted expiry string (numeric timestamp)
 */
function formatExpiry(expiry) {
    if (!expiry) return '';

    // If it's a number (Unix timestamp), just convert to string
    if (typeof expiry === 'number') {
        return String(expiry);
    }

    // If already a string, return as-is (should be numeric timestamp string)
    return String(expiry);
}

/**
 * Get optimized strategy legs
 * @param {Object} params - Optimization parameters
 * @param {string} params.strategy_type - Strategy type (e.g., 'iron_condor')
 * @param {string} params.symbol - Underlying symbol (default: 'NIFTY')
 * @param {string|number} params.expiry - Expiry date (timestamp or string)
 * @param {string} params.risk_profile - Risk profile: conservative, moderate, aggressive
 * @param {number} params.max_capital - Maximum capital to allocate
 * @returns {Promise<Object>} Optimization response with structures
 */
export async function optimizeStrategy(params) {
    const response = await api.post('/strategies/optimize', {
        strategy_type: params.strategyType || params.strategy_type,
        symbol: params.symbol || 'NIFTY',
        expiry: formatExpiry(params.expiry),
        risk_profile: params.riskProfile || params.risk_profile || 'moderate',
        max_capital: params.maxCapital || params.max_capital || 100000,
    });
    return response.data;
}

/**
 * Get strategy recommendations based on market conditions
 * @param {Object} params - Market parameters
 * @param {string} params.symbol - Underlying symbol
 * @param {string|number} params.expiry - Expiry date (timestamp or string)
 * @param {string} params.risk_profile - Risk profile
 * @param {number} params.iv_percentile - Optional IV percentile
 * @param {number} params.pcr - Optional PCR
 * @returns {Promise<Object>} Recommendations response
 */
export async function recommendStrategies(params) {
    const response = await api.post('/strategies/recommend', {
        symbol: params.symbol || 'NIFTY',
        expiry: formatExpiry(params.expiry),
        risk_profile: params.riskProfile || params.risk_profile || 'moderate',
        iv_percentile: params.ivPercentile || params.iv_percentile,
        pcr: params.pcr,
    });
    return response.data;
}

/**
 * Get list of supported strategy types
 * @returns {Promise<Object>} Strategy types list
 */
export async function getStrategyTypes() {
    const response = await api.get('/strategies/types');
    return response.data;
}

/**
 * Intelligent auto-strategy generation
 * Automatically detects market conditions and generates optimal strategy
 * @param {Object} params - Generation parameters
 * @param {string} params.symbol - Underlying symbol (default: 'NIFTY')
 * @param {string} params.riskProfile - Risk profile: conservative, moderate, aggressive
 * @param {number} params.maxCapital - Maximum capital to allocate
 * @param {string} params.strategyType - Optional strategy type override
 * @param {string|number} params.expiry - Optional expiry override
 * @param {boolean} params.includeCalendarSpread - Include calendar spreads when IV is high (default: true)
 * @returns {Promise<Object>} Auto-generated strategy with legs
 */
export async function autoGenerateStrategy(params = {}) {
    const response = await api.post('/strategies/auto-generate', {
        symbol: params.symbol || 'NIFTY',
        risk_profile: params.riskProfile || params.risk_profile || 'moderate',
        max_capital: params.maxCapital || params.max_capital || 100000,
        strategy_type: params.strategyType || params.strategy_type || null,
        expiry: params.expiry ? formatExpiry(params.expiry) : null,
        include_calendar_spread: params.includeCalendarSpread !== false,
    });
    return response.data;
}

/**
 * Strategy type constants
 */
export const STRATEGY_TYPES = {
    IRON_CONDOR: 'iron_condor',
    BULL_PUT_SPREAD: 'bull_put_spread',
    BEAR_CALL_SPREAD: 'bear_call_spread',
    LONG_STRADDLE: 'long_straddle',
    SHORT_STRADDLE: 'short_straddle',
    STRANGLE: 'strangle',
    BULL_CALL_SPREAD: 'bull_call_spread',
    BEAR_PUT_SPREAD: 'bear_put_spread',
    JADE_LIZARD: 'jade_lizard',
    CUSTOM: 'custom',
};

/**
 * Risk profile constants
 */
export const RISK_PROFILES = {
    CONSERVATIVE: 'conservative',
    MODERATE: 'moderate',
    AGGRESSIVE: 'aggressive',
};

/**
 * Human-readable strategy names
 */
export const STRATEGY_NAMES = {
    [STRATEGY_TYPES.IRON_CONDOR]: 'Iron Condor',
    [STRATEGY_TYPES.BULL_PUT_SPREAD]: 'Bull Put Spread',
    [STRATEGY_TYPES.BEAR_CALL_SPREAD]: 'Bear Call Spread',
    [STRATEGY_TYPES.LONG_STRADDLE]: 'Long Straddle',
    [STRATEGY_TYPES.SHORT_STRADDLE]: 'Short Straddle',
    [STRATEGY_TYPES.STRANGLE]: 'Strangle',
    [STRATEGY_TYPES.BULL_CALL_SPREAD]: 'Bull Call Spread',
    [STRATEGY_TYPES.BEAR_PUT_SPREAD]: 'Bear Put Spread',
    [STRATEGY_TYPES.JADE_LIZARD]: 'Jade Lizard',
    [STRATEGY_TYPES.CUSTOM]: 'Custom Structure',
};

/**
 * Strategy category groupings
 */
export const STRATEGY_CATEGORIES = {
    NEUTRAL: [STRATEGY_TYPES.IRON_CONDOR, STRATEGY_TYPES.SHORT_STRADDLE, STRATEGY_TYPES.STRANGLE],
    BULLISH: [STRATEGY_TYPES.BULL_PUT_SPREAD, STRATEGY_TYPES.BULL_CALL_SPREAD],
    BEARISH: [STRATEGY_TYPES.BEAR_CALL_SPREAD, STRATEGY_TYPES.BEAR_PUT_SPREAD],
    VOLATILITY: [STRATEGY_TYPES.LONG_STRADDLE, STRATEGY_TYPES.STRANGLE],
};

export default {
    optimizeStrategy,
    recommendStrategies,
    getStrategyTypes,
    autoGenerateStrategy,
    STRATEGY_TYPES,
    RISK_PROFILES,
    STRATEGY_NAMES,
    STRATEGY_CATEGORIES,
};

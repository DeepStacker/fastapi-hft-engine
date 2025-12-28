/**
 * Options API Service
 * Centralized service for all options-related API calls
 */
import apiClient from './apiClient';

// Cache configuration
const CACHE_DURATION = 5000; // 5 seconds
const cache = new Map();

/**
 * Get cached data if still valid
 */
const getCachedData = (key) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    cache.delete(key);
    return null;
};

/**
 * Set data in cache
 */
const setCachedData = (key, data) => {
    cache.set(key, { data, timestamp: Date.now() });
};

/**
 * Generate cache key from method and params
 */
const getCacheKey = (method, params) => {
    return `${method}:${JSON.stringify(params)}`;
};

/**
 * Options Service with all API methods
 */
export const optionsService = {
    /**
     * Get live options data for a symbol and expiry
     */
    getLiveData: async (symbol, expiry) => {
        const cacheKey = getCacheKey('liveData', { symbol, expiry });
        const cached = getCachedData(cacheKey);
        if (cached) return cached;

        const response = await apiClient.get('/options/live', {
            params: { sid: symbol, exp_sid: expiry }
        });
        setCachedData(cacheKey, response.data);
        return response.data;
    },

    /**
     * Get expiry dates for a symbol
     */
    getExpiryDates: async (symbol) => {
        const cacheKey = getCacheKey('expiry', { symbol });
        const cached = getCachedData(cacheKey);
        if (cached) return cached;

        const response = await apiClient.get(`/options/expiry/${symbol}`);
        setCachedData(cacheKey, response.data);
        return response.data;
    },

    /**
     * Get option chain data with Greeks and reversal points
     * @param {string} symbol - Trading symbol (e.g., 'NIFTY')
     * @param {string} expiry - Expiry timestamp
     * @param {Object} options - Optional parameters
     * @param {boolean} options.includeGreeks - Include Greeks data (default: true)
     * @param {boolean} options.includeReversal - Include reversal data (default: true)
     */
    getOptionChain: async (symbol, expiry, options = {}) => {
        const { includeGreeks = true, includeReversal = true } = options;
        const cacheKey = getCacheKey('optionChain', { symbol, expiry, includeGreeks, includeReversal });
        const cached = getCachedData(cacheKey);
        if (cached) return cached;

        const response = await apiClient.get(`/options/chain/${symbol}/${expiry}`, {
            params: {
                include_greeks: includeGreeks,
                include_reversal: includeReversal
            }
        });
        setCachedData(cacheKey, response.data);
        return response.data;
    },

    /**
     * Get percentage/volume data for a specific option
     */
    getPercentageData: async (params) => {
        const response = await apiClient.post('/options/percentage', params);
        return response.data;
    },

    /**
     * Get IV data for a specific option
     */
    getIVData: async (params) => {
        const response = await apiClient.post('/options/iv', params);
        return response.data;
    },

    /**
     * Get delta/Greeks data for a strike
     */
    getDeltaData: async (params) => {
        const response = await apiClient.post('/options/delta', params);
        return response.data;
    },

    /**
     * Get future price data
     */
    getFuturePriceData: async (params) => {
        const response = await apiClient.post('/options/future', params);
        return response.data;
    },

    /**
     * Clear all cached data
     */
    clearCache: () => {
        cache.clear();
    },
};

export default optionsService;

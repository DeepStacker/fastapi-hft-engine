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
     * Unified endpoint supporting both live and historical modes
     * 
     * @param {string} symbol - Trading symbol (e.g., 'NIFTY')
     * @param {string} expiry - Expiry timestamp
     * @param {Object} options - Optional parameters
     * @param {boolean} options.includeGreeks - Include Greeks data (default: true)
     * @param {boolean} options.includeReversal - Include reversal data (default: true)
     * @param {string} options.mode - 'live' (default) or 'historical'
     * @param {string} options.date - For historical mode: date in YYYY-MM-DD format
     * @param {string} options.time - For historical mode: time in HH:MM format
     */
    getOptionChain: async (symbol, expiry, options = {}) => {
        const {
            includeGreeks = true,
            includeReversal = true,
            mode = 'live',
            date = null,
            time = null
        } = options;

        // Don't cache historical queries - they should always return exact snapshot
        const shouldCache = mode === 'live';
        const cacheKey = getCacheKey('optionChain', { symbol, expiry, includeGreeks, includeReversal });

        if (shouldCache) {
            const cached = getCachedData(cacheKey);
            if (cached) return cached;
        }

        const params = {
            include_greeks: includeGreeks,
            include_reversal: includeReversal,
            mode
        };

        // Add historical-specific params
        if (mode === 'historical') {
            if (date) params.date = date;
            if (time) params.time = time;
        }

        const response = await apiClient.get(`/options/chain/${symbol}/${expiry}`, { params });

        if (shouldCache) {
            setCachedData(cacheKey, response.data);
        }

        return response.data;
    },

    /**
     * Get available dates for historical data
     * @param {string} symbol - Trading symbol
     * @returns {Promise<string[]>} Array of dates in YYYY-MM-DD format
     */
    getAvailableDates: async (symbol) => {
        const response = await apiClient.get(`/historical/dates/${symbol}`);
        return response.data?.dates || [];
    },

    /**
     * Get available times for a specific date
     * @param {string} symbol - Trading symbol
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<string[]>} Array of times in HH:MM format
     */
    getAvailableTimes: async (symbol, date) => {
        const response = await apiClient.get(`/historical/times/${symbol}/${date}`);
        return response.data?.times || [];
    },

    /**
     * Get historical snapshot
     * @param {string} symbol - Trading symbol
     * @param {string} expiry - Expiry timestamp
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string} time - Time in HH:MM format
     * @returns {Promise<Object>} Historical option chain snapshot
     */
    getHistoricalSnapshot: async (symbol, expiry, date, time) => {
        const response = await apiClient.get(`/historical/snapshot/${symbol}/${expiry}`, {
            params: { date, time }
        });
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

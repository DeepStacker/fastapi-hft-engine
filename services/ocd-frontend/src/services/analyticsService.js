/**
 * Analytics Service
 * Centralized service for all analytics-related API calls
 * Migrated from api/analyticsApi.js for consistent API layer
 */
import apiClient from './apiClient';

const ANALYTICS_BASE = '/analytics';

/**
 * Analytics Service with all API methods
 */
export const analyticsService = {
    /**
     * Get time-series data for a specific strike
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {number} params.strike - Strike price
     * @param {string} [params.optionType='CE'] - Option type
     * @param {string} [params.field='oi'] - Field to query (oi, volume, price, iv)
     * @param {string} [params.interval='5m'] - Time interval
     * @param {number} [params.limit=50] - Number of data points
     */
    getStrikeTimeSeries: async ({
        symbol,
        strike,
        expiry,
        optionType = 'CE',
        field = 'oi',
        interval = 'auto',
        limit = 50,
        date = null,
    }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/timeseries/${symbol}/${strike}`,
            {
                params: {
                    expiry,
                    option_type: optionType,
                    field,
                    interval,
                    limit,
                    date,
                },
            }
        );
        return response.data;
    },

    /**
     * Get multi-view time-series data for a strike (CE, PE, differences, ratios)
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {number} params.strike - Strike price
     * @param {string} params.expiry - Expiry date
     * @param {string} [params.field='oi'] - Field to query
     * @param {string} [params.interval='5m'] - Time interval
     */
    getMultiViewTimeSeries: async ({
        symbol,
        strike,
        expiry,
        field = 'oi',
        interval = 'auto',
        date = null,
    }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/timeseries/${symbol}/${strike}/multi`,
            {
                params: {
                    expiry,
                    field,
                    interval,
                    date,
                },
            }
        );
        return response.data;
    },

    /**
     * Get spot price time-series
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} [params.interval='5m'] - Time interval
     * @param {number} [params.limit=100] - Number of data points
     */
    getSpotTimeSeries: async ({ symbol, interval = 'auto', limit = 100 }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/timeseries/spot/${symbol}`,
            {
                params: { interval, limit },
            }
        );
        return response.data;
    },

    /**
     * Get comprehensive strike analysis
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {number} params.strike - Strike price
     * @param {string} params.expiry - Expiry timestamp
     */
    getStrikeAnalysis: async ({ symbol, strike, expiry }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/strike/${symbol}/${strike}`,
            {
                params: { expiry },
            }
        );
        return response.data;
    },

    /**
     * Get futures summary for all contracts
     * @param {string} symbol - Trading symbol
     */
    getFuturesSummary: async (symbol) => {
        const response = await apiClient.get(`${ANALYTICS_BASE}/futures/${symbol}`);
        return response.data;
    },

    /**
     * Get OI distribution across strikes
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     * @param {number} [params.topN=20] - Number of top strikes
     */
    getOIDistribution: async ({ symbol, expiry, topN = 20 }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/oi-distribution/${symbol}/${expiry}`,
            {
                params: { top_n: topN },
            }
        );
        return response.data;
    },

    /**
     * Get max pain analysis
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     */
    getMaxPainAnalysis: async ({ symbol, expiry }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/maxpain/${symbol}/${expiry}`
        );
        return response.data;
    },

    /**
     * Get IV skew analysis
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     */
    getIVSkew: async ({ symbol, expiry }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/iv-skew/${symbol}/${expiry}`
        );
        return response.data;
    },

    /**
     * Get aggregate Change in OI (COI) across all strikes
     * Similar to LOC Calculator's "COi" and "Overall COi" views
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     * @param {number} [params.topN=30] - Number of strikes to return
     */
    getAggregateCOI: async ({ symbol, expiry, topN = 30 }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/aggregate/coi/${symbol}/${expiry}`,
            {
                params: { top_n: topN },
            }
        );
        return response.data;
    },

    /**
     * Get aggregate OI across all strikes
     * Similar to LOC Calculator's "Oi" and "Overall Oi" views
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     * @param {number} [params.topN=30] - Number of strikes to return
     */
    getAggregateOI: async ({ symbol, expiry, topN = 30 }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/aggregate/oi/${symbol}/${expiry}`,
            {
                params: { top_n: topN },
            }
        );
        return response.data;
    },

    /**
     * Get aggregate PCR (Put-Call Ratio) across all strikes
     * Similar to LOC Calculator's "PCR" view
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     */
    getAggregatePCR: async ({ symbol, expiry }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/aggregate/pcr/${symbol}/${expiry}`
        );
        return response.data;
    },

    /**
     * Get aggregate percentage changes across all strikes
     * Similar to LOC Calculator's "Percentage" view
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     */
    getAggregatePercentage: async ({ symbol, expiry }) => {
        const response = await apiClient.get(
            `${ANALYTICS_BASE}/aggregate/percentage/${symbol}/${expiry}`
        );
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════════
    // Chart Data Methods
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get available trading symbols for charts
     * @returns {Promise<{success: boolean, data: Array}>}
     */
    getSymbols: async () => {
        const response = await apiClient.get('/symbols');
        // Adapt response from DB-backed endpoint to match frontend expectations
        const raw = response.data;

        // Flatten segments to get all symbol objects
        const allSymbols = [
            ...(raw.by_segment?.indices || []),
            ...(raw.by_segment?.equities || []),
            ...(raw.by_segment?.commodities || [])
        ].map(s => ({
            ...s,
            name: s.display_name || s.symbol // Map display_name to name for UI
        }));

        return {
            success: true,
            data: allSymbols
        };
    },

    /**
     * Get OHLC chart data for a symbol
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} [params.interval='5'] - Time interval in minutes
     * @param {number} [params.days=30] - Number of days of data
     */
    getChartData: async ({ symbol, interval = '5', days = 30 }) => {
        const response = await apiClient.get('/charts/data', {
            params: { symbol, interval, days },
        });
        return response.data;
    },

    /**
     * Get available chart intervals
     * @returns {Promise<{success: boolean, data: Array}>}
     */
    getChartIntervals: async () => {
        const response = await apiClient.get('/charts/intervals');
        return response.data;
    },
};

export default analyticsService;

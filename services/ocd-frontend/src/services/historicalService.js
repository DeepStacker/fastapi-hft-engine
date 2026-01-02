/**
 * Historical Service
 * Centralized service for historical option chain data API calls
 * Migrated from api/historicalApi.js for consistent API layer
 */
import apiClient from './apiClient';

const HISTORICAL_BASE = '/historical';

/**
 * Historical Service with all API methods
 */
export const historicalService = {
    /**
     * Get available expiries for historical data
     * @param {string} symbol - Trading symbol (e.g., 'NIFTY')
     * @returns {Promise<{success: boolean, symbol: string, expiries: string[]}>}
     */
    getAvailableExpiries: async (symbol) => {
        const response = await apiClient.get(
            `${HISTORICAL_BASE}/expiries/${symbol}`
        );
        return response.data;
    },

    /**
     * Get available historical dates for a symbol/expiry
     * @param {string} symbol - Trading symbol (e.g., 'NIFTY')
     * @param {string} expiry - Optional expiry to filter dates
     * @returns {Promise<{success: boolean, symbol: string, dates: string[]}>}
     */
    getAvailableDates: async (symbol, expiry = null) => {
        const params = expiry ? { expiry } : {};
        const response = await apiClient.get(
            `${HISTORICAL_BASE}/dates/${symbol}`,
            { params }
        );
        return response.data;
    },

    /**
     * Get available snapshot times for a specific date
     * @param {string} symbol - Trading symbol
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<{success: boolean, symbol: string, date: string, times: string[]}>}
     */
    getAvailableTimes: async (symbol, date) => {
        const response = await apiClient.get(
            `${HISTORICAL_BASE}/times/${symbol}/${date}`
        );
        return response.data;
    },

    /**
     * Get a specific historical snapshot
     * Now uses the unified /options/chain endpoint with mode=historical
     * 
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     * @param {string} params.date - Date in YYYY-MM-DD format
     * @param {string} params.time - Time in HH:MM format
     * @returns {Promise<{success: boolean, symbol: string, expiry: string, date: string, time: string, option_chain: Object}>}
     */
    getHistoricalSnapshot: async ({ symbol, expiry, date, time }) => {
        // Use unified endpoint with historical mode
        const response = await apiClient.get(`/options/chain/${symbol}/${expiry}`, {
            params: {
                mode: 'historical',
                date,
                time,
                include_greeks: true,
                include_reversal: false
            }
        });
        return response.data;
    },


    /**
     * Get multiple snapshots for replay functionality
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     * @param {string} params.date - Date in YYYY-MM-DD format
     * @param {string} params.startTime - Start time in HH:MM format
     * @param {string} params.endTime - End time in HH:MM format
     * @param {number} [params.interval=5] - Interval in minutes
     * @returns {Promise<{success: boolean, snapshots: Object[]}>}
     */
    getReplayData: async ({
        symbol,
        expiry,
        date,
        startTime,
        endTime,
        interval = 5,
    }) => {
        const response = await apiClient.get(`${HISTORICAL_BASE}/replay`, {
            params: {
                symbol,
                expiry,
                date,
                start_time: startTime,
                end_time: endTime,
                interval,
            },
        });
        return response.data;
    },
};

export default historicalService;

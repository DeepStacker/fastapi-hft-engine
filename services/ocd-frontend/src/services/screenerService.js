/**
 * Screener Service
 * Centralized service for all screener-related API calls
 * Migrated from api/screenerApi.js for consistent API layer
 */
import apiClient from './apiClient';

const SCREENER_BASE = '/screeners';

/**
 * Screener Service with all API methods
 */
export const screenerService = {
    /**
     * Get scalp trading signals
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol (e.g., 'NIFTY')
     * @param {string} params.expiry - Expiry timestamp
     * @param {number} [params.minOiChangePct=5.0] - Minimum OI change percentage
     * @param {number} [params.minVolume=1000] - Minimum volume threshold
     */
    getScalpSignals: async ({
        symbol,
        expiry,
        minOiChangePct = 5.0,
        minVolume = 1000,
    }) => {
        const response = await apiClient.get(
            `${SCREENER_BASE}/scalp/${symbol}/${expiry}`,
            {
                params: {
                    min_oi_change_pct: minOiChangePct,
                    min_volume: minVolume,
                },
            }
        );
        return response.data;
    },

    /**
     * Get positional trading signals
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     * @param {number} [params.minOiBuildup=100000] - Minimum OI buildup threshold
     */
    getPositionalSignals: async ({
        symbol,
        expiry,
        minOiBuildup = 100000,
    }) => {
        const response = await apiClient.get(
            `${SCREENER_BASE}/positional/${symbol}/${expiry}`,
            {
                params: { min_oi_buildup: minOiBuildup },
            }
        );
        return response.data;
    },

    /**
     * Get support/resistance trading signals
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     */
    getSRSignals: async ({ symbol, expiry }) => {
        const response = await apiClient.get(
            `${SCREENER_BASE}/sr/${symbol}/${expiry}`
        );
        return response.data;
    },

    /**
     * Get all screener signals combined
     * @param {Object} params - Query parameters
     * @param {string} params.symbol - Trading symbol
     * @param {string} params.expiry - Expiry timestamp
     */
    getAllSignals: async ({ symbol, expiry }) => {
        const response = await apiClient.get(
            `${SCREENER_BASE}/all/${symbol}/${expiry}`
        );
        return response.data;
    },
};

export default screenerService;


/**
 * Analytics Pro Service
 * centralized service for advanced analytics endpoints
 * Maps to /api/v1/analytics/aggregate and /api/v1/analytics/analysis routes
 */
import apiClient from './apiClient';

const BASE_URL = '/analytics';

export const analyticsProService = {
    // ============================================
    // AGGREGATE ENDPOINTS
    // ============================================

    /**
     * Get Change in OI (COI) aggregated across strikes
     * @param {string} symbol - e.g. 'NIFTY'
     * @param {string} expiry - Expiry timestamp
     * @param {number} topN - Number of top strikes to return (default: 30)
     */
    getAggregateCOI: async (symbol, expiry, topN = 30) => {
        const response = await apiClient.get(`${BASE_URL}/aggregate/coi/${symbol}/${expiry}`, {
            params: { top_n: topN }
        });
        return response.data;
    },

    /**
     * Get Total OI aggregated across strikes
     */
    getAggregateOI: async (symbol, expiry, topN = 30) => {
        const response = await apiClient.get(`${BASE_URL}/aggregate/oi/${symbol}/${expiry}`, {
            params: { top_n: topN }
        });
        return response.data;
    },

    /**
     * Get Put-Call Ratio (PCR) analysis
     */
    getAggregatePCR: async (symbol, expiry) => {
        const response = await apiClient.get(`${BASE_URL}/aggregate/pcr/${symbol}/${expiry}`);
        return response.data;
    },

    /**
     * Get Percentage Change view
     */
    getAggregatePercentage: async (symbol, expiry) => {
        const response = await apiClient.get(`${BASE_URL}/aggregate/percentage/${symbol}/${expiry}`);
        return response.data;
    },

    // ============================================
    // ANALYSIS ENDPOINTS
    // ============================================

    /**
     * Get comprehensive analysis for a single strike
     */
    getStrikeAnalysis: async (symbol, strike, expiry) => {
        const response = await apiClient.get(`${BASE_URL}/analysis/strike/${symbol}/${strike}`, {
            params: { expiry }
        });
        return response.data;
    },

    /**
     * Get precise Reversal Levels (LOC Style)
     */
    getReversalLevels: async (symbol, strike, expiry) => {
        const response = await apiClient.get(`${BASE_URL}/analysis/reversal/${symbol}/${strike}`, {
            params: { expiry }
        });
        return response.data;
    },

    /**
     * Get summary of all futures contracts
     */
    getFuturesSummary: async (symbol) => {
        const response = await apiClient.get(`${BASE_URL}/futures/${symbol}`);
        return response.data;
    },

    /**
     * Get OI Distribution for visualization
     */
    getOIDistribution: async (symbol, expiry) => {
        const response = await apiClient.get(`${BASE_URL}/analysis/oi-distribution/${symbol}/${expiry}`);
        return response.data;
    },

    /**
     * Get Max Pain calculation
     */
    getMaxPain: async (symbol, expiry) => {
        const response = await apiClient.get(`${BASE_URL}/analysis/maxpain/${symbol}/${expiry}`);
        return response.data;
    },

    /**
     * Get IV Skew analysis
     */
    getIVSkew: async (symbol, expiry) => {
        const response = await apiClient.get(`${BASE_URL}/analysis/iv-skew/${symbol}/${expiry}`);
        return response.data;
    },
};

export default analyticsProService;

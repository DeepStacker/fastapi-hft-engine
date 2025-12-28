import apiClient from './apiClient';

/**
 * Market Data Service - Aligned with FastAPI Backend
 * Endpoints: /api/v1/options/*
 */
export const marketDataService = {
    /**
     * Get expiry dates for a symbol
     * Endpoint: GET /api/v1/options/expiry/{symbol}
     */
    getExpiryDates: async (symbol) => {
        try {
            const response = await apiClient.get(`/options/expiry/${symbol}`);
            return response.data;
        } catch (error) {
            throw error.message || 'Failed to fetch expiry dates';
        }
    },

    /**
     * Get option chain data
     * Endpoint: GET /api/v1/options/chain/{symbol}/{expiry}
     */
    getOptionChain: async (symbol, expiry) => {
        try {
            const response = await apiClient.get(`/options/chain/${symbol}/${expiry}`);
            return response.data;
        } catch (error) {
            throw error.message || 'Failed to fetch option chain';
        }
    },

    /**
     * Get live options data
     * Endpoint: GET /api/v1/options/live
     */
    getLiveData: async (params) => {
        try {
            const response = await apiClient.get('/options/live', { params });
            return response.data;
        } catch (error) {
            throw error.message || 'Failed to fetch live data';
        }
    },

    /**
     * Get percentage analysis data
     * Endpoint: POST /api/v1/options/percentage
     */
    getPercentageData: async (data) => {
        try {
            const response = await apiClient.post('/options/percentage', data);
            return response.data;
        } catch (error) {
            throw error.message || 'Failed to fetch percentage data';
        }
    },

    /**
     * Get IV (Implied Volatility) data
     * Endpoint: POST /api/v1/options/iv
     */
    getIVData: async (data) => {
        try {
            const response = await apiClient.post('/options/iv', data);
            return response.data;
        } catch (error) {
            throw error.message || 'Failed to fetch IV data';
        }
    },

    /**
     * Get Delta/Greeks data
     * Endpoint: POST /api/v1/options/delta
     */
    getGreeksData: async (data) => {
        try {
            const response = await apiClient.post('/options/delta', data);
            return response.data;
        } catch (error) {
            throw error.message || 'Failed to fetch Greeks data';
        }
    },

    /**
     * Get futures data
     * Endpoint: POST /api/v1/options/future
     */
    getFuturesData: async (data) => {
        try {
            const response = await apiClient.post('/options/future', data);
            return response.data;
        } catch (error) {
            throw error.message || 'Failed to fetch futures data';
        }
    },
};

export default marketDataService;

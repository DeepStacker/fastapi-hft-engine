import apiClient from './apiClient';

/**
 * Admin Service - Backend Admin API Integration
 * All endpoints require admin role authentication
 */
export const adminService = {
    // ═══════════════════════════════════════════════════════════════════
    // Configuration Management
    // ═══════════════════════════════════════════════════════════════════

    /**
     * List all configurations
     */
    listConfigs: async (category = null) => {
        const params = category ? { category } : {};
        const response = await apiClient.get('/admin/config', { params });
        return response.data;
    },

    /**
     * Get configuration by key
     */
    getConfig: async (key) => {
        const response = await apiClient.get(`/admin/config/${key}`);
        return response.data;
    },

    /**
     * Create new configuration
     */
    createConfig: async (configData) => {
        const response = await apiClient.post('/admin/config', configData);
        return response.data;
    },

    /**
     * Update configuration
     */
    updateConfig: async (key, updateData) => {
        const response = await apiClient.put(`/admin/config/${key}`, updateData);
        return response.data;
    },

    /**
     * Delete configuration
     */
    deleteConfig: async (key) => {
        const response = await apiClient.delete(`/admin/config/${key}`);
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════════
    // Instrument Management
    // ═══════════════════════════════════════════════════════════════════

    /**
     * List all instruments
     */
    listInstruments: async (activeOnly = true) => {
        const response = await apiClient.get('/admin/instruments', {
            params: { active_only: activeOnly }
        });
        return response.data;
    },

    /**
     * Create new instrument
     */
    createInstrument: async (instrumentData) => {
        const response = await apiClient.post('/admin/instruments', instrumentData);
        return response.data;
    },

    /**
     * Update instrument
     */
    updateInstrument: async (instrumentId, updateData) => {
        const response = await apiClient.put(`/admin/instruments/${instrumentId}`, updateData);
        return response.data;
    },

    /**
     * Delete instrument
     */
    deleteInstrument: async (instrumentId) => {
        const response = await apiClient.delete(`/admin/instruments/${instrumentId}`);
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════════
    // User Management
    // ═══════════════════════════════════════════════════════════════════

    /**
     * List all users (paginated)
     */
    listUsers: async (page = 1, pageSize = 20, search = null) => {
        const params = { page, page_size: pageSize };
        if (search) params.search = search;
        const response = await apiClient.get('/users', { params });
        return response.data;
    },

    /**
     * Get user by ID
     */
    getUser: async (userId) => {
        const response = await apiClient.get(`/users/${userId}`);
        return response.data;
    },

    /**
     * Update user
     */
    updateUser: async (userId, updateData) => {
        const response = await apiClient.put(`/users/${userId}`, updateData);
        return response.data;
    },

    /**
     * Deactivate user
     */
    deactivateUser: async (userId) => {
        const response = await apiClient.post(`/users/${userId}/deactivate`);
        return response.data;
    },

    /**
     * Activate user
     */
    activateUser: async (userId) => {
        const response = await apiClient.post(`/users/${userId}/activate`);
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════════
    // Cache Management
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Clear cache
     */
    clearCache: async (pattern = null, clearAll = false) => {
        const response = await apiClient.post('/admin/cache/clear', {
            pattern,
            clear_all: clearAll
        });
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════════
    // Health & System
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get system health
     */
    getHealth: async () => {
        const response = await apiClient.get('/health');
        return response.data;
    },

    /**
     * Get runtime settings from .env (read-only)
     */
    getRuntimeSettings: async () => {
        const response = await apiClient.get('/admin/settings/runtime');
        return response.data;
    },

    /**
     * Re-seed missing configs and instruments
     */
    seedDatabase: async () => {
        const response = await apiClient.post('/admin/seed');
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════════
    // Monitoring Endpoints
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get system metrics (CPU, memory, disk)
     */
    getSystemMetrics: async () => {
        const response = await apiClient.get('/admin/monitoring/system');
        return response.data;
    },

    /**
     * Get WebSocket connection stats
     */
    getWebSocketStats: async () => {
        const response = await apiClient.get('/admin/monitoring/websockets');
        return response.data;
    },

    /**
     * Get database statistics
     */
    getDatabaseStats: async () => {
        const response = await apiClient.get('/admin/monitoring/database');
        return response.data;
    },

    /**
     * Get Redis stats
     */
    getRedisStats: async () => {
        const response = await apiClient.get('/admin/monitoring/redis');
        return response.data;
    },

    /**
     * Get application logs
     */
    getLogs: async (level = null, limit = 100, search = null) => {
        const params = { limit };
        if (level) params.level = level;
        if (search) params.search = search;
        const response = await apiClient.get('/admin/monitoring/logs', { params });
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════════
    // Feature Flags
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get all feature flags
     */
    getFeatureFlags: async () => {
        const response = await apiClient.get('/admin/features');
        return response.data;
    },

    /**
     * Toggle a feature flag
     */
    toggleFeature: async (key, enabled) => {
        const response = await apiClient.put(`/admin/features/${key}`, { enabled });
        return response.data;
    },
};

export default adminService;

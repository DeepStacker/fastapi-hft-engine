/**
 * Profile Service
 * Centralized service for user profile-related API calls
 */
import apiClient from './apiClient';

/**
 * Profile Service with all API methods
 */
export const profileService = {
    /**
     * Get current user's profile
     * @returns {Promise<{success: boolean, data: Object}>}
     */
    getMyProfile: async () => {
        const response = await apiClient.get('/profile');
        return response.data;
    },

    /**
     * Update current user's profile
     * @param {Object} data - Profile update data
     * @returns {Promise<{success: boolean, data: Object}>}
     */
    updateMyProfile: async (data) => {
        const response = await apiClient.put('/profile', data);
        return response.data;
    },

    /**
     * Update notification settings
     * @param {Object} settings - Notification settings
     * @returns {Promise<{success: boolean, data: Object}>}
     */
    updateNotificationSettings: async (settings) => {
        const response = await apiClient.put('/profile/notifications', settings);
        return response.data;
    },

    /**
     * Get user's trading stats
     * @returns {Promise<{success: boolean, stats: Object}>}
     */
    getStats: async () => {
        const response = await apiClient.get('/profile/me/stats');
        return response.data;
    },
};

export default profileService;

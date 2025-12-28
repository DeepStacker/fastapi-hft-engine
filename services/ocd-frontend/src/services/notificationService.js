/**
 * Notification Service
 * Centralized service for notification-related API calls
 */
import apiClient from './apiClient';

/**
 * Notification Service with all API methods
 */
export const notificationService = {
    /**
     * Get user's notifications
     * @param {Object} params - Query parameters
     * @param {boolean} [params.unreadOnly=false] - Only unread notifications
     * @param {number} [params.limit=50] - Max notifications to return
     * @returns {Promise<{success: boolean, data: Array}>}
     */
    getNotifications: async ({ unreadOnly = false, limit = 50 } = {}) => {
        const response = await apiClient.get('/notifications', {
            params: { unread_only: unreadOnly, limit },
        });
        return response.data;
    },

    /**
     * Mark all notifications as read
     * @returns {Promise<{success: boolean}>}
     */
    markAllAsRead: async () => {
        const response = await apiClient.put('/notifications/read-all');
        return response.data;
    },

    /**
     * Mark a specific notification as read
     * @param {string} notificationId - Notification ID
     * @returns {Promise<{success: boolean}>}
     */
    markAsRead: async (notificationId) => {
        const response = await apiClient.put(`/notifications/${notificationId}/read`);
        return response.data;
    },

    /**
     * Delete a notification
     * @param {string} notificationId - Notification ID
     * @returns {Promise<{success: boolean}>}
     */
    deleteNotification: async (notificationId) => {
        const response = await apiClient.delete(`/notifications/${notificationId}`);
        return response.data;
    },
};

export default notificationService;

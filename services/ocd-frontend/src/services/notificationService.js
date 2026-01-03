/**
 * Notification Service
 * Centralized service for notification-related API calls
 * Enhanced with preferences, channels, and sound support
 */
import apiClient from './apiClient';

// Sound files for different priorities
const NOTIFICATION_SOUNDS = {
    urgent: '/sounds/urgent.mp3',
    high: '/sounds/alert.mp3',
    normal: '/sounds/notification.mp3',
    low: null, // Silent
};

/**
 * Play notification sound based on priority
 * @param {string} priority - low, normal, high, urgent
 * @param {boolean} enabled - Whether sound is enabled
 */
const playNotificationSound = (priority = 'normal', enabled = true) => {
    if (!enabled) return;

    const soundFile = NOTIFICATION_SOUNDS[priority];
    if (!soundFile) return;

    try {
        const audio = new Audio(soundFile);
        audio.volume = priority === 'urgent' ? 1.0 : 0.5;
        audio.play().catch(() => {
            // Autoplay might be blocked, ignore
        });
    } catch (e) {
        console.warn('Failed to play notification sound:', e);
    }
};

/**
 * Notification Service with all API methods
 */
export const notificationService = {
    /**
     * Get user's notifications
     * @param {Object} params - Query parameters
     * @param {boolean} [params.unreadOnly=false] - Only unread notifications
     * @param {number} [params.limit=50] - Max notifications to return
     * @param {string} [params.purpose] - Filter by purpose
     * @returns {Promise<{success: boolean, data: Array}>}
     */
    getNotifications: async ({ unreadOnly = false, limit = 50, purpose = null } = {}) => {
        const response = await apiClient.get('/notifications', {
            params: { unread_only: unreadOnly, limit, purpose },
        });
        return response.data;
    },

    /**
     * Mark all notifications as read
     * @returns {Promise<{success: boolean}>}
     */
    markAllAsRead: async () => {
        const response = await apiClient.post('/notifications/read-all');
        return response.data;
    },

    /**
     * Mark a specific notification as read
     * @param {string} notificationId - Notification ID
     * @returns {Promise<{success: boolean}>}
     */
    markAsRead: async (notificationId) => {
        const response = await apiClient.post(`/notifications/${notificationId}/read`);
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

    // ============== Preferences ==============

    /**
     * Get user notification preferences
     * @returns {Promise<{success: boolean, preferences: Object}>}
     */
    getPreferences: async () => {
        const response = await apiClient.get('/notifications/preferences');
        return response.data;
    },

    /**
     * Update user notification preferences
     * @param {Object} preferences - Preference updates
     * @returns {Promise<{success: boolean, preferences: Object}>}
     */
    updatePreferences: async (preferences) => {
        const response = await apiClient.put('/notifications/preferences', preferences);
        return response.data;
    },

    /**
     * Register FCM token for push notifications
     * @param {string} fcmToken - Firebase Cloud Messaging token
     * @returns {Promise<{success: boolean}>}
     */
    registerFCMToken: async (fcmToken) => {
        const response = await apiClient.post('/notifications/preferences/fcm-token', {
            fcm_token: fcmToken,
        });
        return response.data;
    },

    /**
     * Send a test notification
     * @returns {Promise<{success: boolean, delivery: Object}>}
     */
    sendTestNotification: async () => {
        const response = await apiClient.post('/notifications/preferences/test');
        return response.data;
    },

    // ============== Sound ==============

    /**
     * Play notification sound
     * @param {string} priority - Notification priority
     * @param {boolean} enabled - Whether sound is enabled
     */
    playSound: playNotificationSound,
};

export default notificationService;


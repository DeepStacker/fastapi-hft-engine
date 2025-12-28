import apiClient from './apiClient';

/**
 * Authentication Service - FastAPI Compatible
 * Handles user profile, verification, and subscription management
 */
export const authService = {
    /**
     * Verify Firebase token with backend
     * Old: /verify-token -> New: /api/v1/auth/verify
     */
    verifyToken: async (idToken) => {
        try {
            const response = await apiClient.post('/auth/verify', {
                id_token: idToken
            });
            return response.data;
        } catch (error) {
            throw error.message || 'Token verification failed';
        }
    },

    /**
     * Register new user
     * Old: /register -> New: /api/v1/auth/register
     */
    register: async (idToken) => {
        try {
            const response = await apiClient.post('/auth/register', {
                id_token: idToken
            });
            return response.data;
        } catch (error) {
            throw error.message || 'Registration failed';
        }
    },

    /**
     * Get user profile
     * Old: /profile (GET) -> New: /api/v1/auth/profile (GET)
     */
    getProfile: async () => {
        try {
            const response = await apiClient.get('/auth/profile');
            return response.data;
        } catch (error) {
            throw error.message || 'Failed to fetch profile';
        }
    },

    /**
     * Update user profile
     * Old: /profile (PUT) -> New: /api/v1/auth/profile (PUT)
     */
    updateProfile: async (profileData) => {
        try {
            const response = await apiClient.put('/auth/profile', profileData);
            return response.data;
        } catch (error) {
            throw error.message || 'Failed to update profile';
        }
    },

    /**
     * Logout user
     * Old: /logout -> New: /api/v1/auth/logout
     */
    logout: async () => {
        try {
            const response = await apiClient.post('/auth/logout');
            return response.data;
        } catch (error) {
            throw error.message || 'Logout failed';
        }
    },

    /**
     * Upgrade to premium subscription (NEW)
     * Endpoint: /api/v1/auth/upgrade
     */
    upgradeToPremium: async () => {
        try {
            const response = await apiClient.post('/auth/upgrade');
            return response.data;
        } catch (error) {
            throw error.message || 'Subscription upgrade failed';
        }
    },
};

export default authService;

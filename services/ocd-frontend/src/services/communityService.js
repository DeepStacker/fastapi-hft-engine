/**
 * Community Service
 * Centralized service for all community-related API calls
 */
import apiClient from './apiClient';

const COMMUNITY_BASE = '/community';

/**
 * Community Service with all API methods
 */
export const communityService = {
    // ═══════════════════════════════════════════════════════════════════
    // ROOMS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get all community rooms
     * @returns {Promise<{rooms: Array, total: number}>}
     */
    getRooms: async () => {
        const response = await apiClient.get(`${COMMUNITY_BASE}/rooms`);
        return response.data;
    },

    /**
     * Get a specific room by slug
     * @param {string} slug - Room slug
     * @returns {Promise<Object>}
     */
    getRoom: async (slug) => {
        const response = await apiClient.get(`${COMMUNITY_BASE}/rooms/${slug}`);
        return response.data;
    },

    /**
     * Create a new room (admin only)
     * @param {Object} roomData - Room data
     * @returns {Promise<Object>}
     */
    createRoom: async (roomData) => {
        const response = await apiClient.post(`${COMMUNITY_BASE}/rooms`, roomData);
        return response.data;
    },

    /**
     * Update a room (admin only)
     * @param {number} roomId - Room ID
     * @param {Object} roomData - Updated room data
     * @returns {Promise<Object>}
     */
    updateRoom: async (roomId, roomData) => {
        const response = await apiClient.patch(`${COMMUNITY_BASE}/rooms/${roomId}`, roomData);
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════════
    // POSTS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get posts in a room
     * @param {string} slug - Room slug
     * @param {Object} params - Query params (page, page_size)
     * @returns {Promise<{posts: Array, total: number, page: number, page_size: number, has_more: boolean}>}
     */
    getPosts: async (slug, { page = 1, pageSize = 20 } = {}) => {
        const response = await apiClient.get(`${COMMUNITY_BASE}/rooms/${slug}/posts`, {
            params: { page, page_size: pageSize },
        });
        return response.data;
    },

    /**
     * Get a post with its replies (thread view)
     * @param {number} postId - Post ID
     * @returns {Promise<{post: Object, replies: Array, total_replies: number}>}
     */
    getThread: async (postId) => {
        const response = await apiClient.get(`${COMMUNITY_BASE}/posts/${postId}`);
        return response.data;
    },

    /**
     * Create a post in a room
     * @param {string} slug - Room slug
     * @param {Object} postData - Post data
     * @returns {Promise<Object>}
     */
    createPost: async (slug, postData) => {
        const response = await apiClient.post(`${COMMUNITY_BASE}/rooms/${slug}/posts`, postData);
        return response.data;
    },

    /**
     * Update a post
     * @param {number} postId - Post ID
     * @param {Object} postData - Updated post data
     * @returns {Promise<Object>}
     */
    updatePost: async (postId, postData) => {
        const response = await apiClient.patch(`${COMMUNITY_BASE}/posts/${postId}`, postData);
        return response.data;
    },

    /**
     * Delete a post
     * @param {number} postId - Post ID
     * @returns {Promise<void>}
     */
    deletePost: async (postId) => {
        await apiClient.delete(`${COMMUNITY_BASE}/posts/${postId}`);
    },

    // ═══════════════════════════════════════════════════════════════════
    // REACTIONS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Add or update a reaction to a post
     * @param {number} postId - Post ID
     * @param {string} reactionType - Reaction type (upvote, downvote, confirm, disagree, neutral)
     * @returns {Promise<Object>}
     */
    addReaction: async (postId, reactionType) => {
        const response = await apiClient.post(`${COMMUNITY_BASE}/posts/${postId}/react`, {
            reaction_type: reactionType,
        });
        return response.data;
    },

    /**
     * Remove a reaction from a post
     * @param {number} postId - Post ID
     * @returns {Promise<void>}
     */
    removeReaction: async (postId) => {
        await apiClient.delete(`${COMMUNITY_BASE}/posts/${postId}/react`);
    },

    // ═══════════════════════════════════════════════════════════════════
    // REPUTATION
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get a user's reputation
     * @param {string} userId - User ID (UUID)
     * @returns {Promise<Object>}
     */
    getUserReputation: async (userId) => {
        const response = await apiClient.get(`${COMMUNITY_BASE}/users/${userId}/reputation`);
        return response.data;
    },

    /**
     * Get the reputation leaderboard
     * @param {number} limit - Number of entries to return
     * @returns {Promise<{entries: Array, total_users: number, user_rank: number|null}>}
     */
    getLeaderboard: async (limit = 20) => {
        const response = await apiClient.get(`${COMMUNITY_BASE}/leaderboard`, {
            params: { limit },
        });
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════════
    // FEATURE REQUESTS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get feature requests
     * @param {Object} params - Query params
     * @returns {Promise<{requests: Array, total: number, page: number, page_size: number}>}
     */
    getFeatureRequests: async ({ page = 1, pageSize = 20, status = null } = {}) => {
        const response = await apiClient.get(`${COMMUNITY_BASE}/features`, {
            params: {
                page,
                page_size: pageSize,
                ...(status && { status }),
            },
        });
        return response.data;
    },

    /**
     * Create a feature request
     * @param {Object} data - Feature request data
     * @returns {Promise<Object>}
     */
    createFeatureRequest: async (data) => {
        const response = await apiClient.post(`${COMMUNITY_BASE}/features`, data);
        return response.data;
    },

    /**
     * Vote for a feature request
     * @param {number} featureId - Feature request ID
     * @returns {Promise<Object>}
     */
    voteForFeature: async (featureId) => {
        const response = await apiClient.post(`${COMMUNITY_BASE}/features/${featureId}/vote`);
        return response.data;
    },

    /**
     * Remove vote from a feature request
     * @param {number} featureId - Feature request ID
     * @returns {Promise<void>}
     */
    unvoteForFeature: async (featureId) => {
        await apiClient.delete(`${COMMUNITY_BASE}/features/${featureId}/vote`);
    },

    // ═══════════════════════════════════════════════════════════════════
    // MODERATION (Admin Only)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Pin or unpin a post (admin only)
     * @param {number} postId - Post ID
     * @param {boolean} isPinned - Pin state
     * @returns {Promise<Object>}
     */
    pinPost: async (postId, isPinned) => {
        const response = await apiClient.post(`${COMMUNITY_BASE}/posts/${postId}/pin`, {
            is_pinned: isPinned,
        });
        return response.data;
    },

    /**
     * Mute a user (admin only)
     * @param {string} userId - User ID
     * @param {number} durationHours - Mute duration in hours
     * @param {string} reason - Mute reason
     * @returns {Promise<Object>}
     */
    muteUser: async (userId, durationHours, reason) => {
        const response = await apiClient.post(`${COMMUNITY_BASE}/users/${userId}/mute`, {
            duration_hours: durationHours,
            reason,
        });
        return response.data;
    },

    /**
     * Unmute a user (admin only)
     * @param {string} userId - User ID
     * @returns {Promise<Object>}
     */
    unmuteUser: async (userId) => {
        const response = await apiClient.post(`${COMMUNITY_BASE}/users/${userId}/unmute`);
        return response.data;
    },

    /**
     * Verify a user as trader (admin only)
     * @param {string} userId - User ID
     * @returns {Promise<Object>}
     */
    verifyTrader: async (userId) => {
        const response = await apiClient.post(`${COMMUNITY_BASE}/users/${userId}/verify`);
        return response.data;
    },

    /**
     * Update a feature request status (admin only)
     * @param {number} featureId - Feature request ID
     * @param {Object} data - Update data
     * @returns {Promise<Object>}
     */
    updateFeatureRequest: async (featureId, data) => {
        const response = await apiClient.patch(`${COMMUNITY_BASE}/features/${featureId}`, data);
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════════
    // BOOKMARKS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get user's bookmarked posts
     * @returns {Promise<{posts: Array}>}
     */
    getBookmarks: async () => {
        const response = await apiClient.get(`${COMMUNITY_BASE}/bookmarks`);
        return response.data;
    },

    /**
     * Bookmark a post
     * @param {number} postId - Post ID
     * @returns {Promise<Object>}
     */
    bookmarkPost: async (postId) => {
        const response = await apiClient.post(`${COMMUNITY_BASE}/posts/${postId}/bookmark`);
        return response.data;
    },

    /**
     * Remove bookmark from a post
     * @param {number} postId - Post ID
     * @returns {Promise<void>}
     */
    removeBookmark: async (postId) => {
        await apiClient.delete(`${COMMUNITY_BASE}/posts/${postId}/bookmark`);
    },
};

export default communityService;

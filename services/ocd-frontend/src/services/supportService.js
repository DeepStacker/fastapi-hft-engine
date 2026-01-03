/**
 * Support Service
 * Handles API calls for the Support System
 */
import apiClient from './apiClient';

export const supportService = {
    /**
     * List user's tickets
     * @param {Object} params - Query params (status, limit)
     * @returns {Promise<{success: boolean, tickets: Array}>}
     */
    getTickets: async (params = {}) => {
        const response = await apiClient.get('/support/tickets', { params });
        return response.data;
    },

    /**
     * Get ticket details with messages
     * @param {string} id - Ticket ID (UUID)
     * @returns {Promise<Object>}
     */
    getTicket: async (id) => {
        const response = await apiClient.get(`/support/tickets/${id}`);
        return response.data;
    },

    /**
     * Create a new ticket
     * @param {Object} data - { subject, category, message, priority }
     * @returns {Promise<Object>}
     */
    createTicket: async (data) => {
        const response = await apiClient.post('/support/tickets', data);
        return response.data;
    },

    /**
     * Send a message to a ticket
     * @param {string} id - Ticket ID (UUID)
     * @param {string} message - Message content
     * @returns {Promise<Object>}
     */
    sendMessage: async (id, message, attachments = []) => {
        const response = await apiClient.post(`/support/tickets/${id}/messages`, {
            message,
            attachments
        });
        return response.data;
    },

    /**
     * Upload a file
     * @param {File} file - File object
     * @returns {Promise<{success: boolean, url: string, filename: string}>}
     */
    uploadFile: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post('/support/tickets/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    /**
     * Get WebSocket URL for ticket chat
     * @param {string} ticketId 
     * @returns {string}
     */
    getWebSocketUrl: (ticketId) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Adjust port if developing locally (frontend 3000, backend 8000)
        // This logic might need refinement based on exact deployment
        const host = window.location.hostname === 'localhost'
            ? 'localhost:8000'
            : window.location.host;

        return `${protocol}//${host}/ws/support/${ticketId}`;
    }
};

export default supportService;

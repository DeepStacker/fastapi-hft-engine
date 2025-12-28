/**
 * Unified API Client
 * Centralized axios instance with interceptors for auth and error handling
 */
import axios from 'axios';
import { toast } from 'react-toastify';

// Create axios instance with default config
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const { response } = error;

        // Handle specific error codes
        if (response) {
            switch (response.status) {
                case 401:
                    // Unauthorized - clear auth and redirect
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    // Optionally dispatch logout action
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                    break;

                case 403:
                    toast.error('You do not have permission to perform this action');
                    break;

                case 404:
                    // Don't show toast for 404s - let component handle it
                    break;

                case 500:
                    toast.error('Server error. Please try again later.');
                    break;

                default:
                    // Show error message from server if available
                    if (response.data?.detail) {
                        toast.error(response.data.detail);
                    }
            }
        } else if (error.code === 'ECONNABORTED') {
            toast.error('Request timed out. Please check your connection.');
        } else if (!navigator.onLine) {
            toast.error('No internet connection');
        }

        return Promise.reject(error);
    }
);

// Helper function to handle API calls with loading state
export const apiRequest = async (requestFn) => {
    try {
        const response = await requestFn();
        return { data: response.data, error: null };
    } catch (error) {
        return {
            data: null,
            error: error.response?.data?.detail || error.message || 'An error occurred'
        };
    }
};

export default apiClient;

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle 401 and auto-refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

      if (refreshToken) {
        try {
          // Try to refresh the token
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token: newRefreshToken } = response.data;

          // Store new tokens
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', newRefreshToken);

          // Update authorization header
          originalRequest.headers.Authorization = `Bearer ${access_token}`;

          processQueue(null, access_token);

          return apiClient(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError as Error, null);

          // Refresh failed, clear tokens and redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token, redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// API functions
export const api = {
  // Auth
  login: (username: string, password: string) =>
    axios.post(`${API_URL}/auth/login`, new URLSearchParams({ username, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),

  refreshToken: (refreshToken: string) =>
    axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken }),

  // System
  getSystemStats: () => apiClient.get('/system/stats'),

  // Services
  getServices: () => apiClient.get('/services'),
  getServiceById: (id: string) => apiClient.get(`/services/${id}`),
  restartService: (name: string) => apiClient.post(`/services/${name}/restart`),
  reloadServiceConfig: (name: string) => apiClient.post(`/services/${name}/reload-config`),

  // Config
  getConfigs: (category?: string) => apiClient.get('/config', { params: { category } }),
  getConfig: (key: string) => apiClient.get(`/config/${key}`),
  updateConfig: (key: string, value: any) => apiClient.put(`/config/${key}`, { value }),
  deleteConfig: (key: string) => apiClient.delete(`/config/${key}`),
  initializeConfigs: () => apiClient.post('/config/initialize'),
  getConfigCategories: () => apiClient.get('/config/categories'),

  // Kafka
  getKafkaTopics: () => apiClient.get('/kafka/topics'),
  createKafkaTopic: (data: { name: string, partitions: number, replication_factor: number }) =>
    apiClient.post('/kafka/topics', data),
  deleteKafkaTopic: (name: string) => apiClient.delete(`/kafka/topics/${name}`),
  getKafkaConsumerGroups: () => apiClient.get('/kafka/consumer-groups'),

  // Instruments
  getInstruments: (params?: any) => apiClient.get('/instruments', { params }),
  getInstrument: (id: number) => apiClient.get(`/instruments/${id}`),
  createInstrument: (data: any) => apiClient.post('/instruments', data),
  updateInstrument: (id: number, data: any) => apiClient.put(`/instruments/${id}`, data),
  deleteInstrument: (id: number) => apiClient.delete(`/instruments/${id}`),
  activateInstrument: (id: number) => apiClient.post(`/instruments/${id}/activate`),
  deactivateInstrument: (id: number) => apiClient.post(`/instruments/${id}/deactivate`),

  // Docker
  getContainers: (all: boolean = true) => apiClient.get('/docker/containers', { params: { all } }),
  restartContainer: (id: string) => apiClient.post(`/docker/containers/${id}/restart`),
  stopContainer: (id: string) => apiClient.post(`/docker/containers/${id}/stop`),
  startContainer: (id: string) => apiClient.post(`/docker/containers/${id}/start`),
  getContainerStats: (id: string) => apiClient.get(`/docker/containers/${id}/stats`),

  // Deployment
  scaleService: (serviceName: string, replicas: number) => apiClient.post('/deployment/scale', { service_name: serviceName, replicas }),
  updateService: (serviceName: string, imageTag: string = 'latest') => apiClient.post('/deployment/update', { service_name: serviceName, image_tag: imageTag }),
  deployStack: () => apiClient.post('/deployment/deploy'),

  // Database
  getDatabaseStats: () => apiClient.get('/database/stats'),
  getDatabaseTables: () => apiClient.get('/database/tables'),
  getTableSchema: (tableName: string) => apiClient.get(`/database/tables/${tableName}/schema`),
  getTableData: (tableName: string, limit?: number, offset?: number) =>
    apiClient.get(`/database/tables/${tableName}/data`, { params: { limit, offset } }),

  // SQL Query
  executeQuery: (query: string, readOnly: boolean = true) =>
    apiClient.post('/database/query', { query, read_only: readOnly }),
  getSlowQueries: (limit: number = 20) =>
    apiClient.get('/database/slow-queries', { params: { limit } }),

  // Traders
  getTraders: (params?: any) => apiClient.get('/traders', { params }),
  updateTrader: (id: string, data: any) => apiClient.put(`/traders/${id}`, data),
  createTrader: (data: any) => apiClient.post('/traders', data),
  deleteTrader: (id: string) => apiClient.delete(`/traders/${id}`),

  // Audit
  getAuditLogs: (params?: any) => apiClient.get('/audit', { params }),

  // Dhan API Tokens
  getDhanTokens: () => apiClient.get('/dhan-tokens'),
  updateDhanTokens: (data: { auth_token?: string, authorization_token?: string }) =>
    apiClient.put('/dhan-tokens', data),
  testDhanTokens: () => apiClient.post('/dhan-tokens/test'),
};

// Export as both 'api' and 'adminAPI' for compatibility
export const adminAPI = api;
export default api;

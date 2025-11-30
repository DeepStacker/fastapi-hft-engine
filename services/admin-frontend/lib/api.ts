import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

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

// Response interceptor - Handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear tokens
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // Redirect to login
        window.location.href = '/login';
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

  // Dhan API Tokens
  getDhanTokens: () => apiClient.get('/dhan-tokens'),
  updateDhanTokens: (data: { auth_token?: string, authorization_token?: string }) =>
    apiClient.put('/dhan-tokens', data),
  testDhanTokens: () => apiClient.post('/dhan-tokens/test'),
};

// Export as both 'api' and 'adminAPI' for compatibility
export const adminAPI = api;
export default api;

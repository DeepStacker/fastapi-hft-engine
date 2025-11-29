#!/bin/bash

# Update API client to check for auth token and redirect to login

cat > services/admin-frontend/lib/api.ts << 'EOF'
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
api.interceptors.request.use(
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
api.interceptors.response.use(
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
export const adminAPI = {
  // Auth
  login: (username: string, password: string) =>
    axios.post(`${API_URL}/auth/login`, new URLSearchParams({ username, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),

  // System
  getSystemStats: () => api.get('/system/stats'),
  
  // Services
  getServices: () => api.get('/services'),
  getServiceById: (id: string) => api.get(`/services/${id}`),
  restartService: (name: string) => api.post(`/services/${name}/restart`),
  
  // Config
  getConfigs: () => api.get('/config'),
  getConfig: (key: string) => api.get(`/config/${key}`),
  updateConfig: (key: string, value: any) => api.put(`/config/${key}`, { value }),
  initializeConfigs: () => api.post('/config/initialize'),
  getConfigCategories: () => api.get('/config/categories'),
  
  // Kafka
  getKafkaTopics: () => api.get('/kafka/topics'),
  createKafkaTopic: (name: string, partitions: number, replicationFactor: number) =>
    api.post('/kafka/topics', { name, partitions, replication_factor: replicationFactor }),
  deleteKafkaTopic: (name: string) => api.delete(`/kafka/topics/${name}`),
  getKafkaConsumerGroups: () => api.get('/kafka/consumer-groups'),
  
  // Instruments
  getInstruments: () => api.get('/instruments'),
  getInstrument: (id: number) => api.get(`/instruments/${id}`),
  createInstrument: (data: any) => api.post('/instruments', data),
  updateInstrument: (id: number, data: any) => api.put(`/instruments/${id}`, data),
  deleteInstrument: (id: number) => api.delete(`/instruments/${id}`),
  activateInstrument: (id: number) => api.post(`/instruments/${id}/activate`),
  deactivateInstrument: (id: number) => api.post(`/instruments/${id}/deactivate`),
  
  // Database
  getDatabaseStats: () => api.get('/database/stats'),
  getDatabaseTables: () => api.get('/database/tables'),
  getTableSchema: (tableName: string) => api.get(`/database/tables/${tableName}/schema`),
  getTableData: (tableName: string, limit?: number, offset?: number) =>
    api.get(`/database/tables/${tableName}/data`, { params: { limit, offset } }),
};

export default api;
EOF

echo "✅ Updated API client at services/admin-frontend/lib/api.ts"

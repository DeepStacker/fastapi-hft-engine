#!/bin/bash

# Stockify Admin Frontend - Complete Setup Script
# This script creates all necessary files for the admin frontend

set -e

FRONTEND_DIR="services/admin-frontend"

echo "🚀 Setting up Stockify Admin Frontend..."

cd "$FRONTEND_DIR"

# Create directories
echo "📁 Creating directories..."
mkdir -p lib components app/{config,kafka,instruments,database,services}

# ===========================================
# 1. Environment Configuration
# ===========================================
echo "⚙️ Creating environment configuration..."
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8001
EOF

# ===========================================
# 2. API Client
# ===========================================
echo "📡 Creating API client..."
cat > lib/api.ts << 'EOF'
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

class AdminAPIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('admin_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          localStorage.removeItem('admin_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    if (typeof window !== 'undefined') localStorage.setItem('admin_token', token);
  }

  clearToken() {
    if (typeof window !== 'undefined') localStorage.removeItem('admin_token');
  }

  // System
  getSystemStats = () => this.client.get('/system/stats');
  getSystemHealth = () => this.client.get('/system/health');

  // Services
  getServices = () => this.client.get('/services');
  getService = (name: string) => this.client.get(`/services/${name}`);
  restartService = (name: string) => this.client.post(`/services/${name}/restart`);

  // Kafka
  getKafkaTopics = () => this.client.get('/kafka/topics');
  createKafkaTopic = (data: any) => this.client.post('/kafka/topics', data);
  deleteKafkaTopic = (name: string) => this.client.delete(`/kafka/topics/${name}`);
  getKafkaConsumerGroups = () => this.client.get('/kafka/consumer-groups');
  getKafkaHealth = () => this.client.get('/kafka/health');

  // Instruments
  getInstruments = (params?: any) => this.client.get('/instruments', { params });
  getInstrument = (id: number) => this.client.get(`/instruments/${id}`);
  createInstrument = (data: any) => this.client.post('/instruments', data);
  updateInstrument = (id: number, data: any) => this.client.put(`/instruments/${id}`, data);
  deleteInstrument = (id: number) => this.client.delete(`/instruments/${id}`);
  activateInstrument = (id: number) => this.client.post(`/instruments/${id}/activate`);
  deactivateInstrument = (id: number) => this.client.post(`/instruments/${id}/deactivate`);

  // Database
  getDatabaseStats = () => this.client.get('/database/stats');
  getDatabaseTables = () => this.client.get('/database/tables');
  getTableSchema = (name: string) => this.client.get(`/database/tables/${name}/schema`);
  getTableData = (name: string, params?: any) => this.client.get(`/database/tables/${name}/data`, { params });
  getSlowQueries = (limit = 20) => this.client.get('/database/queries/slow', { params: { limit } });

  // Config
  getConfigs = (category?: string) => this.client.get('/config', { params: category ? { category } : {} });
  getConfig = (key: string) => this.client.get(`/config/${key}`);
  updateConfig = (key: string, value: string) => this.client.put(`/config/${key}`, { value });
  deleteConfig = (key: string) => this.client.delete(`/config/${key}`);
  initializeConfigs = () => this.client.post('/config/initialize');
  exportConfigs = () => this.client.post('/config/export');
  importConfigs = (configs: any) => this.client.post('/config/import', configs);
  getConfigCategories = () => this.client.get('/config/categories');
}

export const api = new AdminAPIClient();
export default api;
EOF

# ===========================================
# 3. Reusable Components
# ===========================================
echo "🎨 Creating components..."

# Stat Card Component
cat > components/StatCard.tsx << 'EOF'
export default function StatCard({ 
  title, 
  value, 
  subtitle,
  trend 
}: { 
  title: string; 
  value: any; 
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="text-sm font-medium text-gray-600 mb-1">{title}</div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
EOF

# Navigation Component
cat > components/Navigation.tsx << 'EOF'
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Dashboard', href: '/' },
  { name: 'Services', href: '/services' },
  { name: 'Configuration', href: '/config' },
  { name: 'Kafka', href: '/kafka' },
  { name: 'Instruments', href: '/instruments' },
  { name: 'Database', href: '/database' },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold">Stockify Admin</h1>
            <div className="flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-800 text-white'
                      : 'text-blue-100 hover:bg-blue-700'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
EOF

# Loading Spinner Component
cat > components/LoadingSpinner.tsx << 'EOF'
export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div className={`${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`}></div>
    </div>
  );
}
EOF

# ===========================================
# 4. Layout
# ===========================================
echo "📄 Creating layout..."
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navigation from '@/components/Navigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Stockify Admin Dashboard',
  description: 'Real-time market data platform administration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  );
}
EOF

# ===========================================
# 5. Dashboard Page
# ===========================================
echo "🏠 Creating dashboard page..."
cat > app/page.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StatCard from '@/components/StatCard';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, servicesRes] = await Promise.all([
        api.getSystemStats(),
        api.getServices()
      ]);
      setStats(statsRes.data);
      setServices(servicesRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">System Overview</h1>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="CPU Usage" 
          value={`${stats?.cpu_percent?.toFixed(1)}%`}
          subtitle="System CPU"
        />
        <StatCard 
          title="Memory Usage" 
          value={`${stats?.memory_percent?.toFixed(1)}%`}
          subtitle="System Memory"
        />
        <StatCard 
          title="Cache Hit Rate" 
          value={`${stats?.cache_hit_rate?.toFixed(1)}%`}
          subtitle="Redis Performance"
        />
        <StatCard 
          title="Active Connections" 
          value={stats?.active_connections || 0}
          subtitle="WebSocket Clients"
        />
      </div>

      {/* Services Status */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Services Status</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {services.map((service) => (
            <div key={service.name} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-medium text-gray-900">{service.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      service.status === 'running' 
                        ? 'bg-green-100 text-green-800' 
                        : service.status === 'unknown'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {service.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center space-x-6 text-sm text-gray-600">
                    <span>CPU: <strong>{service.cpu_percent?.toFixed(2)}%</strong></span>
                    <span>Memory: <strong>{service.memory_mb?.toFixed(0)} MB</strong></span>
                    <span>Uptime: <strong>{Math.floor(service.uptime / 3600)}h</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
EOF

echo "✅ Frontend setup complete!"
echo ""
echo "Next steps:"
echo "1. cd services/admin-frontend"
echo "2. npm run dev"
echo "3. Open http://localhost:3000"

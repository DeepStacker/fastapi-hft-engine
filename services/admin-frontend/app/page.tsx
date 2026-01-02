'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import LiveChart from '@/components/dashboard/LiveChart';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ServiceCard } from '@/components/dashboard/ServiceCard';
import { Activity, Cpu, HardDrive, Network, Server, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { Service, SystemStats, MetricSnapshot } from '@/lib/types';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [history, setHistory] = useState<MetricSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();

    // WebSocket for real-time updates
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, '')
      : 'localhost:8001';
      
    const wsUrl = `${protocol}//${host}/system/ws?token=${token}`;
    console.log('Connecting to System WebSocket:', wsUrl);

    let ws: WebSocket | null = null;
    let timeoutId: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('✅ Connected to System WebSocket');
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'system_stats') {
              setStats((prev: any) => {
                const newStats = {
                  ...prev,
                  ...message.data
                };
                // Update history for charts
                setHistory(prevHistory => {
                  const now = new Date().toLocaleTimeString();
                  const newPoint = {
                    time: now,
                    cpu: newStats.cpu_percent,
                    memory: newStats.memory_percent,
                  };
                  const updatedHistory = [...prevHistory, newPoint];
                  if (updatedHistory.length > 20) updatedHistory.shift(); // Keep last 20 points
                  return updatedHistory;
                });
                return newStats;
              });
            } else if (message.type === 'service_status') {
              setServices(prevServices => prevServices.map(service => 
                service.name === message.data.name ? { ...service, ...message.data } : service
              ));
            }
          } catch (err) {
            console.error('Failed to parse WS message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = (event) => {
          console.log('System WebSocket closed:', event.code, event.reason);
        };

      } catch (e) {
        console.error('System WebSocket connection failed:', e);
      }
    };

    // Debounce connection
    timeoutId = setTimeout(connect, 100);

    return () => {
      clearTimeout(timeoutId);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const [sysRes, servicesRes] = await Promise.all([
        api.getSystemStats(),
        api.getServices()
      ]);
      setStats(sysRes.data);
      setServices(servicesRes.data);

      // Initialize history with current stats
      setHistory(prev => {
        const now = new Date().toLocaleTimeString();
        const newPoint = {
          time: now,
          cpu: sysRes.data.cpu_percent,
          memory: sysRes.data.memory_percent,
        };
        return [...prev, newPoint];
      });
      
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Real-time system overview and health status.</p>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  const handleRestartService = async (serviceName: string) => {
    try {
      await api.restartService(serviceName);
      // Refresh services after restart
      const servicesRes = await api.getServices();
      setServices(servicesRes.data);
    } catch (error) {
      console.error('Failed to restart service:', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Real-time system overview and health status.</p>
      </motion.div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total CPU"
          value={stats?.cpu_percent || 0}
          icon={Cpu}
          description={`${services.length} active services`}
          gradient="blue"
          delay={0}
        />
        <MetricCard
          title="Memory Usage"
          value={stats?.memory_percent || 0}
          icon={HardDrive}
          description="System wide allocation"
          gradient="purple"
          delay={0.1}
        />
        <MetricCard
          title="Active Users"
          value={stats?.active_connections || 0}
          icon={Network}
          description="WebSocket connections"
          gradient="emerald"
          delay={0.2}
        />
        <MetricCard
          title="Cache Hit Rate"
          value={stats?.cache_hit_rate || 0}
          icon={Zap}
          description="Redis performance"
          gradient="orange"
          delay={0.3}
        />
      </div>

      {/* Charts Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-7"
      >
        <div className="col-span-4">
          <LiveChart 
            title="CPU Usage History" 
            data={history} 
            dataKey="cpu" 
            color="#3b82f6" 
          />
        </div>
        <div className="col-span-3">
          <LiveChart 
            title="Memory Usage History" 
            data={history} 
            dataKey="memory" 
            color="#a855f7" 
          />
        </div>
      </motion.div>

      {/* Services Health Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card hover>
          <CardHeader>
            <CardTitle>Service Health</CardTitle>
            <CardDescription>
              Real-time status of all microservices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {services.map((service, index) => (
                <ServiceCard
                  key={service.name}
                  service={service}
                  onRestart={handleRestartService}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

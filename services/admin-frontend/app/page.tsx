'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import LiveChart from '@/components/dashboard/LiveChart';
import { Activity, Cpu, HardDrive, Network, Server, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardSkeleton } from '@/components/ui/Skeleton';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Real-time system overview and health status.</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total CPU</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Cpu className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.cpu_percent?.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {services.length} active services
            </p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <HardDrive className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.memory_percent?.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              System wide allocation
            </p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Network className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.active_connections || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              WebSocket connections
            </p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Zap className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.cache_hit_rate?.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Redis performance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <LiveChart 
            title="CPU History" 
            data={history} 
            dataKey="cpu" 
            color="#4f46e5" 
          />
        </div>
        <div className="col-span-3">
          <LiveChart 
            title="Memory History" 
            data={history} 
            dataKey="memory" 
            color="#ec4899" 
          />
        </div>
      </div>

      {/* Services Status List */}
      <Card>
        <CardHeader>
          <CardTitle>Service Health</CardTitle>
          <CardDescription>
            Real-time status of all microservices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className={cn(
                    "p-2 rounded-full",
                    service.status === 'running' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  )}>
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none">{service.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Uptime: {Math.floor(service.uptime / 3600)}h {Math.floor((service.uptime % 3600) / 60)}m
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-right">
                    <p className="font-medium">{service.cpu_percent?.toFixed(1)}% CPU</p>
                    <p className="text-muted-foreground">{service.memory_mb?.toFixed(0)} MB</p>
                  </div>
                  <div className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-medium",
                    service.status === 'running' 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"
                  )}>
                    {service.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Activity, Cpu, HardDrive, Server, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface MetricPoint {
  timestamp: number;
  value: number;
}

interface ContainerMetrics {
  id: string;
  name: string;
  cpu: MetricPoint[];
  memory: MetricPoint[];
  currentCpu: number;
  currentMemory: number;
  memoryLimit: number;
}

export default function LiveMetrics() {
  const [metrics, setMetrics] = useState<Record<string, ContainerMetrics>>({});
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  // Calculate Aggregates
  const totalCpu = Object.values(metrics).reduce((acc, curr) => acc + curr.currentCpu, 0);
  const totalMemory = Object.values(metrics).reduce((acc, curr) => acc + curr.currentMemory, 0);

  useEffect(() => {
    // Get auth token
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, '')
      : 'localhost:8001';
      
    // Use /metrics/ws (Nginx routes /api/admin/metrics -> admin-service/metrics)
    // We assume NEXT_PUBLIC_API_URL is "http://localhost/api/admin"
    // So host becomes "localhost/api/admin"
    // URL: ws://localhost/api/admin/metrics/ws?token=...
    const wsUrl = `${protocol}//${host}/metrics/ws?token=${token}`;
    
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
             console.log("WS Connected");
             setStatus('connected');
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'metrics_update') {
              updateMetrics(message.data, message.timestamp);
            }
          } catch (e) {
            console.error("Parse error", e);
          }
        };

        ws.onclose = (e) => {
          console.log("WS Closed", e.code, e.reason);
          setStatus('disconnected');
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = (e) => {
           console.error('WebSocket error:', e);
           ws.close();
        };

      } catch (e) {
        console.error('WebSocket connection error:', e);
        setStatus('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  const updateMetrics = (data: any[], timestamp: number) => {
    setMetrics(prev => {
      const next = { ...prev };
      
      data.forEach((item: any) => {
        const id = item.id;
        
        let containerEntry: ContainerMetrics;
        
        if (!next[id]) {
          containerEntry = {
            id,
            name: item.name.replace('stockify-', ''),
            cpu: [],
            memory: [],
            currentCpu: 0,
            currentMemory: 0,
            memoryLimit: 0
          };
        } else {
             // Clone existing entry deep enough for arrays
             containerEntry = {
                 ...next[id],
                 cpu: [...next[id].cpu],
                 memory: [...next[id].memory]
             };
        }
        
        containerEntry.currentCpu = item.stats.cpu_percent;
        containerEntry.currentMemory = item.stats.memory_usage;
        containerEntry.memoryLimit = item.stats.memory_limit;
        
        containerEntry.cpu.push({ timestamp, value: item.stats.cpu_percent });
        containerEntry.memory.push({ timestamp, value: item.stats.memory_usage / 1024 / 1024 }); // MB
        
        // Keep last 30 points
        if (containerEntry.cpu.length > 30) containerEntry.cpu.shift();
        if (containerEntry.memory.length > 30) containerEntry.memory.shift();
        
        next[id] = containerEntry;
      });
      
      return next;
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
            <Wifi className={`h-4 w-4 ${status === 'connected' ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{status}</div>
             <p className="text-xs text-muted-foreground">Real-time WebSocket stream</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services Monitored</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(metrics).length}</div>
            <p className="text-xs text-muted-foreground">Active Containers</p>
          </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total CPU Load</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{totalCpu.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Across all services</p>
            </CardContent>
        </Card>

        <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Memory</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
                <div className="text-2xl font-bold">{formatBytes(totalMemory)}</div>
                <p className="text-xs text-muted-foreground">Combined RAM Usage</p>
             </CardContent>
        </Card>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.values(metrics).map((container) => (
          <Card key={container.id} className="overflow-hidden border-t-4 border-t-primary/20 hover:shadow-md transition-shadow">
             <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">{container.name}</CardTitle>
                        <CardDescription className="font-mono text-xs">{container.id.substring(0, 8)}</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Running</Badge>
                </div>
             </CardHeader>
             <CardContent className="space-y-4">
                 {/* CPU Chart */}
                 <div>
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground flex items-center gap-1"><Cpu className="w-3 h-3"/> CPU</span>
                        <span className="font-bold">{container.currentCpu.toFixed(1)}%</span>
                    </div>
                    <div className="h-24 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={container.cpu}>
                                <defs>
                                    <linearGradient id={`colorCpu-${container.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="value" stroke="#2563eb" fillOpacity={1} fill={`url(#colorCpu-${container.id})`} strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Memory Chart */}
                 <div>
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="w-3 h-3"/> RAM</span>
                        <span className="font-bold">
                            {formatBytes(container.currentMemory)} <span className="text-muted-foreground font-normal">/ {formatBytes(container.memoryLimit)}</span>
                        </span>
                    </div>
                    <div className="h-24 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={container.memory}>
                                <defs>
                                    <linearGradient id={`colorMem-${container.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="value" stroke="#9333ea" fillOpacity={1} fill={`url(#colorMem-${container.id})`} strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                 </div>
             </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

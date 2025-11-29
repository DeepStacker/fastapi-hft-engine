'use client';

import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  useEffect(() => {
    // Get auth token
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, '')
      : 'localhost:8001';
      
    const wsUrl = `${protocol}//${host}/metrics/ws?token=${token}`;
    
    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setStatus('connected');
        
        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'metrics_update') {
            updateMetrics(message.data, message.timestamp);
          }
        };

        ws.onclose = () => {
          setStatus('disconnected');
          // Reconnect after 5s
          setTimeout(connect, 5000);
        };

      } catch (e) {
        console.error('WebSocket error:', e);
        setStatus('disconnected');
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const updateMetrics = (data: any[], timestamp: number) => {
    setMetrics(prev => {
      const next = { ...prev };
      
      data.forEach((item: any) => {
        const id = item.id;
        if (!next[id]) {
          next[id] = {
            id,
            name: item.name.replace('stockify-', ''),
            cpu: [],
            memory: [],
            currentCpu: 0,
            currentMemory: 0,
            memoryLimit: 0
          };
        }
        
        // Add new points
        const time = new Date(timestamp * 1000).toLocaleTimeString();
        
        next[id].currentCpu = item.stats.cpu_percent;
        next[id].currentMemory = item.stats.memory_usage;
        next[id].memoryLimit = item.stats.memory_limit;
        
        next[id].cpu.push({ timestamp, value: item.stats.cpu_percent });
        next[id].memory.push({ timestamp, value: item.stats.memory_usage / 1024 / 1024 }); // MB
        
        // Keep last 20 points
        if (next[id].cpu.length > 20) next[id].cpu.shift();
        if (next[id].memory.length > 20) next[id].memory.shift();
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Live Container Metrics</h2>
        <span className={`px-2 py-1 text-xs rounded-full ${
          status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {status === 'connected' ? 'Live' : 'Disconnected'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.values(metrics).map((container) => (
          <div key={container.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">{container.name}</h3>
              <div className="text-xs text-gray-500 font-mono">{container.id.substring(0, 8)}</div>
            </div>
            
            <div className="space-y-4">
              {/* CPU Chart */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">CPU Usage</span>
                  <span className="font-bold text-blue-600">{container.currentCpu.toFixed(1)}%</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={container.cpu}>
                      <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} strokeWidth={2} />
                      <YAxis hide domain={[0, 'auto']} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Memory Chart */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Memory</span>
                  <span className="font-bold text-purple-600">
                    {formatBytes(container.currentMemory)} / {formatBytes(container.memoryLimit)}
                  </span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={container.memory}>
                      <Line type="monotone" dataKey="value" stroke="#9333ea" dot={false} strokeWidth={2} />
                      <YAxis hide domain={[0, 'auto']} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

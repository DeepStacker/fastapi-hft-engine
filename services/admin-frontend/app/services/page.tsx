'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Power } from 'lucide-react';

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
    
    // WebSocket for real-time updates
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, '')
      : 'localhost:8001';
      
    const wsUrl = `${protocol}//${host}/services/ws?token=${token}`;
    console.log('Connecting to Services WebSocket:', wsUrl);

    let ws: WebSocket | null = null;
    let timeoutId: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('✅ Connected to Services WebSocket');
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'services_update') {
              console.log('DEBUG: Services data from WS:', message.data);
              setServices(message.data);
              setLoading(false); // Stop loading if WS sends data first
            }
          } catch (err) {
            console.error('Failed to parse WS message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = (event) => {
          console.log('Services WebSocket closed:', event.code, event.reason);
        };

      } catch (e) {
        console.error('Services WebSocket connection failed:', e);
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

  const loadServices = async () => {
    try {
      const res = await api.getServices();
      console.log('DEBUG: Services data from API:', res.data);
      res.data.forEach((s: any, i: number) => {
        console.log(`DEBUG: Service ${i} status type:`, typeof s.status, s.status);
      });
      setServices(res.data);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (name: string, action: 'restart' | 'reload') => {
    if (action === 'restart') {
      if (!confirm(`Are you sure you want to restart ${name}?`)) return;
      
      // Fire and forget - don't await
      api.restartService(name)
        .then(() => {
          alert(`Service ${name} restart initiated`);
          setTimeout(loadServices, 2000);
        })
        .catch((error) => {
          console.error(`Error performing ${action}:`, error);
          alert(`Failed to ${action} service`);
        });
    } else {
      // Fire and forget - don't await
      api.reloadServiceConfig(name)
        .then(() => {
          alert(`Configuration reload triggered for ${name}`);
          setTimeout(loadServices, 1000);
        })
        .catch((error) => {
          console.error(`Error performing ${action}:`, error);
          alert(`Failed to ${action} service`);
        });
    }
  };

  const columns = [
    {
      header: 'Service Name',
      accessorKey: 'name',
      cell: (row: any) => (
        <div className="font-medium">{row.name}</div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row: any) => (
        <Badge variant={
          row.status === 'running' ? 'success' : 
          row.status === 'unknown' ? 'warning' : 'destructive'
        }>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'CPU',
      accessorKey: 'cpu_percent',
      cell: (row: any) => `${row.cpu_percent?.toFixed(1)}%`
    },
    {
      header: 'Memory',
      accessorKey: 'memory_mb',
      cell: (row: any) => `${row.memory_mb?.toFixed(0)} MB`
    },
    {
      header: 'Uptime',
      accessorKey: 'uptime',
      cell: (row: any) => {
        const h = Math.floor(row.uptime / 3600);
        const m = Math.floor((row.uptime % 3600) / 60);
        return `${h}h ${m}m`;
      }
    },
    {
      header: 'Restarts',
      accessorKey: 'restart_count',
      cell: (row: any) => row.restart_count
    },
    {
      header: 'Actions',
      cell: (row: any) => (
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleAction(row.name, 'reload')}
            title="Reload Config"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reload
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => handleAction(row.name, 'restart')}
            title="Restart Service"
          >
            <Power className="h-3 w-3 mr-1" />
            Restart
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Services</h2>
        <p className="text-muted-foreground">Monitor and manage microservices.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Registry</CardTitle>
          <CardDescription>
            Live status of all registered containers in the stack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable 
            data={services} 
            columns={columns} 
            searchKey="name"
          />
        </CardContent>
      </Card>
    </div>
  );
}

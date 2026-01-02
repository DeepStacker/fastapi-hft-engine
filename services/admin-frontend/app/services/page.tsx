'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ServiceCard } from '@/components/dashboard/ServiceCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Power, Server } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import { motion } from 'framer-motion';
import { Service } from '@/lib/types';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
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

  const handleRestartService = async (name: string) => {
    if (!confirm(`Are you sure you want to restart ${name}?`)) return;
    
    try {
      await api.restartService(name);
      toast.success(`Service ${name} restart initiated`);
      setTimeout(loadServices, 2000);
    } catch (error) {
      console.error('Error restarting service:', error);
      toast.error('Failed to restart service');
    }
  };

  const runningServices = services.filter(s => s.status === 'running').length;
  const stoppedServices = services.filter(s => s.status !== 'running').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Services</h2>
          <p className="text-muted-foreground">Monitor and manage microservices.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border bg-card animate-pulse"></div>
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-xl border bg-card animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-3xl font-bold tracking-tight">Services</h2>
        <p className="text-muted-foreground mt-1">Monitor and manage all microservices</p>
      </motion.div>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-3"
      >
        <Card hover className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Services</p>
                <p className="text-3xl font-bold mt-1">{services.length}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card hover className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Running</p>
                <p className="text-3xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{runningServices}</p>
              </div>
              <Badge variant="success" pulse className="text-xs">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card hover className="relative overflow-hidden border-0 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full blur-2xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stopped</p>
                <p className="text-3xl font-bold mt-1 text-rose-600 dark:text-rose-400">{stoppedServices}</p>
              </div>
              {stoppedServices > 0 && (
                <Badge variant="destructive" className="text-xs">
                  Issues
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Services List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card hover>
          <CardHeader>
            <CardTitle>Service Registry</CardTitle>
            <CardDescription>
              Live status of all registered containers in the stack
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

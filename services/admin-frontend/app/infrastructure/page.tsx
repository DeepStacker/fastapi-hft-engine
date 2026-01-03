'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  Database, 
  Server, 
  Radio,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import { motion } from 'framer-motion';

interface ServiceStatus {
  service: string;
  status: 'connected' | 'failed' | 'unknown' | 'testing';
  latency_ms: number | null;
  details: Record<string, any> | null;
  error: string | null;
}

interface ConfigItem {
  key: string;
  value: string;
  description: string;
  category: string;
  data_type: string;
  requires_restart: boolean;
  is_sensitive?: boolean;
}

const INFRASTRUCTURE_SERVICES = [
  { id: 'database', name: 'TimescaleDB', icon: Database, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'redis', name: 'Redis', icon: Server, color: 'text-red-500', bg: 'bg-red-500/10' },
  { id: 'kafka', name: 'Kafka', icon: Radio, color: 'text-purple-500', bg: 'bg-purple-500/10' },
];

export default function InfrastructurePage() {
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, ServiceStatus>>({});
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInfrastructureConfigs();
    // Test all connections on load
    INFRASTRUCTURE_SERVICES.forEach(s => testConnection(s.id));
  }, []);

  const loadInfrastructureConfigs = async () => {
    try {
      const res = await api.getConfigs('infrastructure');
      setConfigs(res.data);
    } catch (err) {
      console.error('Failed to load configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (service: string) => {
    setServiceStatuses(prev => ({
      ...prev,
      [service]: { service, status: 'testing', latency_ms: null, details: null, error: null }
    }));

    try {
      const res = await api.testConnection(service as 'redis' | 'database' | 'kafka');
      setServiceStatuses(prev => ({
        ...prev,
        [service]: res.data
      }));
    } catch (err: any) {
      setServiceStatuses(prev => ({
        ...prev,
        [service]: { 
          service, 
          status: 'failed', 
          latency_ms: null, 
          details: null, 
          error: err.message 
        }
      }));
    }
  };

  const toggleReveal = (key: string) => {
    setRevealedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const maskValue = (value: string) => {
    if (!value) return '';
    // Show first few and last few characters for URLs
    if (value.includes('://')) {
      const protocol = value.split('://')[0];
      return `${protocol}://●●●●●●●●`;
    }
    return '●'.repeat(Math.min(20, value.length));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'testing':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'destructive' | 'secondary'> = {
      connected: 'success',
      failed: 'destructive',
      testing: 'default',
      unknown: 'secondary'
    };
    return variants[status] || 'secondary';
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"/>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Infrastructure</h1>
        <p className="text-muted-foreground text-sm">Service connections and infrastructure configuration</p>
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {INFRASTRUCTURE_SERVICES.map((service) => {
          const status = serviceStatuses[service.id];
          const Icon = service.icon;
          
          return (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className={`${service.bg} border-0`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-6 h-6 ${service.color}`} />
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                    </div>
                    {getStatusIcon(status?.status || 'unknown')}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Badge variant={getStatusBadge(status?.status || 'unknown')}>
                        {status?.status || 'Unknown'}
                      </Badge>
                      {status?.latency_ms !== null && (
                        <p className="text-xs text-muted-foreground">
                          Latency: {status.latency_ms}ms
                        </p>
                      )}
                      {status?.error && (
                        <p className="text-xs text-red-500 truncate max-w-[200px]" title={status.error}>
                          {status.error}
                        </p>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => testConnection(service.id)}
                      disabled={status?.status === 'testing'}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${status?.status === 'testing' ? 'animate-spin' : ''}`} />
                      Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Connection Strings */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Configuration</CardTitle>
          <CardDescription>
            Infrastructure connection strings and settings. Sensitive values are masked by default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {configs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No infrastructure configurations found. Click "Initialize Defaults" on the Config page.
              </p>
            ) : (
              configs.map((config) => (
                <div 
                  key={config.key}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{config.key}</span>
                      {config.requires_restart && (
                        <Badge variant="outline" className="text-[10px]">Requires Restart</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <code className="text-xs bg-background px-2 py-1 rounded border max-w-[300px] truncate">
                      {revealedFields.has(config.key) ? config.value : maskValue(config.value)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleReveal(config.key)}
                      title={revealedFields.has(config.key) ? 'Hide' : 'Reveal'}
                    >
                      {revealedFields.has(config.key) ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

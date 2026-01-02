'use client';

import { Server, Play, Pause, RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Service } from '@/lib/types';
import { motion } from 'framer-motion';

interface ServiceCardProps {
  service: Service;
  onRestart?: (name: string) => void;
}

export function ServiceCard({ service, onRestart }: ServiceCardProps) {
  const isRunning = service.status === 'running';
  const cpuPercent = service.cpu_percent || 0;
  const memoryMB = service.memory_mb || 0;
  const uptime = service.uptime || 0;

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getCpuVariant = (cpu: number): 'default' | 'success' | 'warning' | 'destructive' => {
    if (cpu < 30) return 'success';
    if (cpu < 70) return 'warning';
    return 'destructive';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center justify-between p-4 border rounded-xl transition-all-smooth",
        "hover:shadow-md hover:scale-[1.01]",
        isRunning ? "bg-card border-border" : "bg-muted/50 border-border"
      )}
    >
      {/* Left Section - Service Info */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Status Icon */}
        <div className={cn(
          "p-2.5 rounded-xl shrink-0",
          isRunning ? "bg-emerald-500/10" : "bg-muted"
        )}>
          <Server className={cn(
            "h-5 w-5",
            isRunning ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          )} />
        </div>

        {/* Service Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold truncate">{service.name}</h3>
            <Badge 
              variant={isRunning ? "success" : "secondary"} 
              pulse={isRunning}
              className="shrink-0"
            >
              {service.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Uptime: {formatUptime(uptime)}
          </p>
        </div>
      </div>

      {/* Right Section - Metrics & Actions */}
      <div className="flex items-center gap-6">
        {/* Resource Usage */}
        {isRunning && (
          <div className="hidden md:flex items-center gap-4">
            {/* CPU */}
            <div className="space-y-1 w-24">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">CPU</span>
                <span className="font-medium">{cpuPercent.toFixed(1)}%</span>
              </div>
              <Progress 
                value={cpuPercent} 
                max={100} 
                variant={getCpuVariant(cpuPercent)}
                size="sm"
              />
            </div>

            {/* Memory */}
            <div className="space-y-1 w-24">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Memory</span>
                <span className="font-medium">{memoryMB.toFixed(0)} MB</span>
              </div>
              <Progress 
                value={memoryMB} 
                max={1000} 
                variant="gradient"
                size="sm"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onRestart && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRestart(service.name)}
              className="h-8 w-8"
              title="Restart service"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
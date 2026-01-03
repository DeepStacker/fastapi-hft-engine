'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { 
  Settings2, 
  Database, 
  TrendingUp, 
  Zap, 
  Server,
  Activity,
  Shield,
  LayoutGrid,
  HardDrive,
  Mail,
  Radio,
  Rocket,
  Upload,
  AppWindow,
  Globe,
  Clock,
  Cpu,
  Gauge,
  MessageSquare
} from 'lucide-react';

interface ConfigSidebarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  counts: Record<string, number>;
  className?: string;
}

export function ConfigSidebar({
  categories,
  selectedCategory,
  onSelectCategory,
  counts,
  className
}: ConfigSidebarProps) {

  const getIcon = (category: string) => {
    const icons: Record<string, any> = {
      'all': LayoutGrid,
      'trading': TrendingUp,
      'database': Database,
      'performance': Zap,
      'system': Server,
      'monitoring': Activity,
      'security': Shield,
      'infrastructure': HardDrive,
      'smtp': Mail,
      'websocket': Radio,
      'hft': Rocket,
      'file_upload': Upload,
      'application': AppWindow,
      'dhan_api': Globe,
      'ingestion': Clock,
      'processor': Cpu,
      'storage': Database,
      'realtime': Gauge,
      'gateway': Server,
      'kafka': MessageSquare,
    };
    return icons[category.toLowerCase()] || Settings2;
  };

  return (
    <div className={cn("w-full md:w-64 flex flex-col gap-1 pr-4 border-r border-border/40", className)}>
      <div className="mb-4 px-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Settings</h3>
      </div>
      
      <div className="flex flex-col gap-1">
        {categories.map((cat) => {
          const Icon = getIcon(cat);
          const isSelected = selectedCategory === cat;
          
          return (
            <Button
              key={cat}
              variant="ghost"
              size="sm"
              onClick={() => onSelectCategory(cat)}
              className={cn(
                "w-full justify-between h-9 px-2 font-normal",
                isSelected 
                  ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                <span className="capitalize text-sm">{cat === 'all' ? 'All Settings' : cat}</span>
              </div>
              {counts[cat] > 0 && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-[10px] px-1.5 h-5 min-w-[20px] flex items-center justify-center", 
                    isSelected ? "bg-background text-foreground shadow-sm" : "bg-muted text-muted-foreground"
                  )}
                >
                  {counts[cat]}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

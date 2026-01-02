'use client';

import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  gradient: 'blue' | 'purple' | 'emerald' | 'orange' | 'rose' | 'indigo';
  delay?: number;
}

const gradientClasses = {
  blue: 'from-blue-500/10 via-blue-500/5 to-transparent',
  purple: 'from-purple-500/10 via-purple-500/5 to-transparent',
  emerald: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
  orange: 'from-orange-500/10 via-orange-500/5 to-transparent',
  rose: 'from-rose-500/10 via-rose-500/5 to-transparent',
  indigo: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
};

const iconBgClasses = {
  blue: 'bg-blue-500/10',
  purple: 'bg-purple-500/10',
  emerald: 'bg-emerald-500/10',
  orange: 'bg-orange-500/10',
  rose: 'bg-rose-500/10',
  indigo: 'bg-indigo-500/10',
};

const iconColorClasses = {
  blue: 'text-blue-600 dark:text-blue-400',
  purple: 'text-purple-600 dark:text-purple-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  orange: 'text-orange-600 dark:text-orange-400',
  rose: 'text-rose-600 dark:text-rose-400',
  indigo: 'text-indigo-600 dark:text-indigo-400',
};

const blobColorClasses = {
  blue: 'bg-blue-500/10',
  purple: 'bg-purple-500/10',
  emerald: 'bg-emerald-500/10',
  orange: 'bg-orange-500/10',
  rose: 'bg-rose-500/10',
  indigo: 'bg-indigo-500/10',
};

export function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  gradient,
  delay = 0,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;

  // Animate counter on mount or value change
  useEffect(() => {
    if (typeof value !== 'number') {
      return;
    }

    const duration = 1000; // 1 second
    const steps = 60;
    const increment = numericValue / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(current + increment, numericValue);
      setDisplayValue(current);

      if (step >= steps) {
        clearInterval(timer);
        setDisplayValue(numericValue);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [numericValue, value]);

  const formattedValue = typeof value === 'number'
    ? displayValue.toFixed(1)
    : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card
        hover
        className={`relative overflow-hidden border-0 bg-gradient-to-br ${gradientClasses[gradient]}`}
      >
        {/* Animated blob */}
        <div className={`absolute top-0 right-0 w-32 h-32 ${blobColorClasses[gradient]} rounded-full blur-3xl opacity-50`} />

        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className={`p-2 ${iconBgClasses[gradient]} rounded-lg`}>
              <Icon className={`h-5 w-5 ${iconColorClasses[gradient]}`} />
            </div>
          </div>

          {/* Value */}
          <div className="space-y-1">
            <p className="text-3xl font-bold tracking-tight">
              {formattedValue}{typeof value === 'number' ? '%' : ''}
            </p>
            
            {description && (
              <p className="text-xs text-muted-foreground">
                {description}
              </p>
            )}

            {trend && (
              <div className={`flex items-center gap-1 text-xs font-medium ${
                trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                <span>{trend.isPositive ? '↑' : '↓'}</span>
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
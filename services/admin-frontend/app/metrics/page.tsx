'use client';

import LiveMetrics from '@/components/LiveMetrics';
import { motion } from 'framer-motion';

export default function MetricsPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-3xl font-bold tracking-tight">System Metrics</h2>
        <p className="text-muted-foreground mt-1">Real-time resource usage for all active containers</p>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <LiveMetrics />
      </motion.div>
    </div>
  );
}

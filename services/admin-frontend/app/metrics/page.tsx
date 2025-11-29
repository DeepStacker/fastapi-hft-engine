'use client';

import LiveMetrics from '@/components/LiveMetrics';

export default function MetricsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">System Metrics</h1>
      <p className="text-gray-500">Real-time resource usage for all active containers.</p>
      
      <LiveMetrics />
    </div>
  );
}

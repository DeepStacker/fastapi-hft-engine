/**
 * Monitoring Tab Component
 * System metrics: CPU, Memory, Disk, DB stats, Redis stats
 */
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import adminService from '../../services/adminService';
import { Card, Spinner } from '../../components/common';

const MonitoringTab = () => {
    const [metrics, setMetrics] = useState(null);
    const [dbStats, setDbStats] = useState(null);
    const [redisStats, setRedisStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const fetchAll = useCallback(async () => {
        try {
            const [sysData, dbData, redisData] = await Promise.all([
                adminService.getSystemMetrics(),
                adminService.getDatabaseStats(),
                adminService.getRedisStats(),
            ]);
            setMetrics(Array.isArray(sysData) ? null : (sysData?.data || sysData));
            setDbStats(Array.isArray(dbData) ? null : (dbData?.data || dbData));
            setRedisStats(Array.isArray(redisData) ? null : (redisData?.data || redisData));
        } catch (err) {
            console.error('Failed to fetch metrics:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(fetchAll, 5000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, fetchAll]);

    const formatBytes = (bytes) => {
        if (!bytes) return 'N/A';
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(2)} GB`;
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    const GaugeCard = ({ title, value, max, unit, color }) => {
        const percent = max ? Math.min((value / max) * 100, 100) : value;
        return (
            <Card className="p-4">
                <div className="text-sm text-gray-500 mb-2">{title}</div>
                <div className="text-2xl font-bold mb-2">{typeof value === 'number' ? value.toFixed(1) : value}{unit}</div>
                <div className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div
                        className={`h-full rounded-full transition-all ${percent > 80 ? 'bg-red-500' : percent > 50 ? 'bg-yellow-500' : color || 'bg-green-500'
                            }`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </Card>
        );
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">System Monitoring</h3>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="rounded"
                        />
                        Auto-refresh (5s)
                    </label>
                    <button onClick={fetchAll} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                        <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <GaugeCard title="CPU Usage" value={metrics?.cpu?.percent || 0} max={100} unit="%" color="bg-blue-500" />
                <GaugeCard title="Memory Usage" value={metrics?.memory?.percent || 0} max={100} unit="%" color="bg-purple-500" />
                <GaugeCard title="Disk Usage" value={metrics?.disk?.percent || 0} max={100} unit="%" color="bg-orange-500" />
                <GaugeCard title="Process Memory" value={formatBytes(metrics?.process?.memory_rss)} max={null} unit="" color="bg-green-500" />
            </div>

            <Card className="p-4">
                <h4 className="font-semibold mb-3">Database</h4>
                <div className="grid gap-4 md:grid-cols-3 text-sm">
                    <div><span className="text-gray-500">Size:</span> {formatBytes(dbStats?.database_size_bytes)}</div>
                    <div><span className="text-gray-500">Connections:</span> {dbStats?.active_connections || 0}</div>
                    <div><span className="text-gray-500">Tables:</span> {dbStats?.tables?.length || 0}</div>
                </div>
            </Card>

            <Card className="p-4">
                <h4 className="font-semibold mb-3">Redis Cache</h4>
                <div className="grid gap-4 md:grid-cols-4 text-sm">
                    <div><span className="text-gray-500">Status:</span> {redisStats?.connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
                    <div><span className="text-gray-500">Memory:</span> {redisStats?.used_memory || 'N/A'}</div>
                    <div><span className="text-gray-500">Clients:</span> {redisStats?.connected_clients || 0}</div>
                    <div><span className="text-gray-500">Hit Rate:</span> {redisStats?.hit_rate ? `${redisStats.hit_rate}%` : 'N/A'}</div>
                </div>
            </Card>
        </div>
    );
};

export default MonitoringTab;


import { useState, useEffect, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ServerIcon,
    CpuChipIcon,
    CircleStackIcon,
    SignalIcon,
    ClockIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { selectIsAuthenticated, selectCurrentUser } from '../context/selectors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import apiClient from '../services/apiClient';

/**
 * Metric Card Component
 */
const MetricCard = memo(({ title, value, subValue, icon: Icon, status = 'ok', color }) => {
    const statusColors = {
        ok: 'text-green-500',
        warning: 'text-yellow-500',
        error: 'text-red-500',
    };

    const bgColors = {
        blue: 'from-blue-500 to-cyan-500',
        green: 'from-green-500 to-emerald-500',
        purple: 'from-purple-500 to-pink-500',
        orange: 'from-orange-500 to-amber-500',
    };

    return (
        <Card variant="glass" className="p-4">
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bgColors[color]} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <div className={`${statusColors[status]}`}>
                    {status === 'ok' ? (
                        <CheckCircleIcon className="w-5 h-5" />
                    ) : (
                        <ExclamationTriangleIcon className="w-5 h-5" />
                    )}
                </div>
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{title}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
            {subValue && (
                <div className="text-xs text-gray-400 mt-1">{subValue}</div>
            )}
        </Card>
    );
});
MetricCard.displayName = 'MetricCard';

/**
 * Admin Monitoring Dashboard
 */
const AdminMonitoring = () => {
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const user = useSelector(selectCurrentUser);
    const navigate = useNavigate();
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const [systemMetrics, setSystemMetrics] = useState(null);
    const [dbStats, setDbStats] = useState(null);
    const [redisStats, setRedisStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const isAdmin = user?.role === 'admin' || user?.is_admin;

    const fetchMetrics = async () => {
        setLoading(true);
        setError(null);
        try {
            const [sysRes, dbRes, redisRes] = await Promise.all([
                apiClient.get('/admin/monitoring/system'),
                apiClient.get('/admin/monitoring/database'),
                apiClient.get('/admin/monitoring/redis'),
            ]);

            if (sysRes.data.success) setSystemMetrics(sysRes.data.data);
            if (dbRes.data.success) setDbStats(dbRes.data.data);
            if (redisRes.data.success) setRedisStats(redisRes.data.data);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err) {
            console.error("Monitoring fetch error:", err);
            setError(err.response?.status === 403 ? "Admin access required" : "Failed to fetch metrics");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchMetrics();
            const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, isAdmin]);

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Authentication Required</h2>
                <p className="text-gray-600 dark:text-gray-400">Please log in to access the Admin Dashboard.</p>
                <Button onClick={() => navigate('/login')}>Login Now</Button>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <ExclamationTriangleIcon className="w-16 h-16 text-red-500" />
                <h2 className="text-2xl font-bold dark:text-white">Access Denied</h2>
                <p className="text-gray-600 dark:text-gray-400">You need administrator privileges to access this page.</p>
            </div>
        );
    }

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };

    return (
        <>
            <Helmet>
                <title>Admin Monitoring | DeepStrike</title>
            </Helmet>

            <div className="w-full px-4 py-4 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            <ServerIcon className="w-8 h-8 text-purple-500" />
                            System Monitoring
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Real-time system health and performance metrics
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {lastUpdated && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <ClockIcon className="w-4 h-4" /> Last updated: {lastUpdated}
                            </span>
                        )}
                        <button
                            onClick={fetchMetrics}
                            disabled={loading}
                            className={`p-2 rounded-lg transition-colors ${loading ? 'animate-spin' : ''} ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                        >
                            <ArrowPathIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {error ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center text-red-600 dark:text-red-400">
                        <p>{error}</p>
                        <Button className="mt-4" onClick={fetchMetrics} variant="outline" size="sm">Retry</Button>
                    </div>
                ) : loading && !systemMetrics ? (
                    <div className="flex justify-center py-20">
                        <ArrowPathIcon className="w-10 h-10 text-gray-300 animate-spin" />
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* System Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard
                                title="CPU Usage"
                                value={`${systemMetrics?.cpu?.percent?.toFixed(1) || 0}%`}
                                subValue={`${systemMetrics?.cpu?.count || 0} Cores`}
                                icon={CpuChipIcon}
                                color="blue"
                                status={systemMetrics?.cpu?.percent > 80 ? 'warning' : 'ok'}
                            />
                            <MetricCard
                                title="Memory Usage"
                                value={`${systemMetrics?.memory?.percent?.toFixed(1) || 0}%`}
                                subValue={formatBytes(systemMetrics?.memory?.used)}
                                icon={ServerIcon}
                                color="green"
                                status={systemMetrics?.memory?.percent > 85 ? 'warning' : 'ok'}
                            />
                            <MetricCard
                                title="Disk Usage"
                                value={`${systemMetrics?.disk?.percent?.toFixed(1) || 0}%`}
                                subValue={formatBytes(systemMetrics?.disk?.used)}
                                icon={CircleStackIcon}
                                color="purple"
                                status={systemMetrics?.disk?.percent > 90 ? 'error' : 'ok'}
                            />
                            <MetricCard
                                title="Process Memory"
                                value={formatBytes(systemMetrics?.process?.memory_rss)}
                                subValue="App Memory"
                                icon={SignalIcon}
                                color="orange"
                            />
                        </div>

                        {/* Database & Redis */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Database Stats */}
                            <Card variant="glass" className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <CircleStackIcon className="w-5 h-5 text-blue-500" />
                                    <h3 className="font-bold dark:text-white">Database</h3>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Size</span>
                                        <span className="dark:text-white font-medium">
                                            {formatBytes(dbStats?.database_size_bytes)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Active Connections</span>
                                        <span className="dark:text-white font-medium">
                                            {dbStats?.active_connections || 0}
                                        </span>
                                    </div>
                                    <hr className="border-gray-200 dark:border-gray-700" />
                                    <div className="text-xs text-gray-400 mb-2">Top Tables</div>
                                    {dbStats?.tables?.slice(0, 5).map((table, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400 truncate">{table.name}</span>
                                            <span className="dark:text-white font-mono text-xs">
                                                {table.rows?.toLocaleString()} rows
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* Redis Stats */}
                            <Card variant="glass" className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <SignalIcon className="w-5 h-5 text-red-500" />
                                    <h3 className="font-bold dark:text-white">Redis Cache</h3>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Status</span>
                                        <span className={`font-medium ${redisStats?.connected ? 'text-green-500' : 'text-red-500'}`}>
                                            {redisStats?.connected ? 'Connected' : 'Disconnected'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Memory Used</span>
                                        <span className="dark:text-white font-medium">
                                            {redisStats?.used_memory || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Connected Clients</span>
                                        <span className="dark:text-white font-medium">
                                            {redisStats?.connected_clients || 0}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Hit Rate</span>
                                        <span className={`font-medium ${redisStats?.hit_rate > 80 ? 'text-green-500' :
                                                redisStats?.hit_rate > 50 ? 'text-yellow-500' : 'text-red-500'
                                            }`}>
                                            {redisStats?.hit_rate !== null ? `${redisStats.hit_rate}%` : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Uptime</span>
                                        <span className="dark:text-white font-medium">
                                            {redisStats?.uptime_seconds
                                                ? `${Math.floor(redisStats.uptime_seconds / 3600)}h ${Math.floor((redisStats.uptime_seconds % 3600) / 60)}m`
                                                : 'N/A'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </motion.div>
                )}
            </div>
        </>
    );
};

export default AdminMonitoring;

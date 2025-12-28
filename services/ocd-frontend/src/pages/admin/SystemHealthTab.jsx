/**
 * System Health Tab Component
 * Displays system health status: overall status, uptime, database, redis
 */
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import adminService from '../../services/adminService';
import { Card, Spinner } from '../../components/common';

const SystemHealthTab = () => {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const fetchHealth = async () => {
        setLoading(true);
        try {
            const data = await adminService.getHealth();
            setHealth(data);
        } catch (err) {
            console.error('Health check failed:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'healthy':
            case 'connected':
                return 'text-green-500';
            case 'degraded':
                return 'text-yellow-500';
            default:
                return 'text-red-500';
        }
    };

    if (loading && !health) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">System Health</h3>
                <button
                    onClick={fetchHealth}
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <div className="text-sm text-gray-500 mb-1">Overall Status</div>
                    <div className={`text-xl font-bold ${getStatusColor(health?.status)}`}>
                        {health?.status?.toUpperCase() || 'UNKNOWN'}
                    </div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-500 mb-1">Uptime</div>
                    <div className="text-xl font-bold">
                        {health?.uptime_seconds ? `${Math.floor(health.uptime_seconds / 60)}m` : 'N/A'}
                    </div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-500 mb-1">Database</div>
                    <div className={`text-xl font-bold ${getStatusColor(health?.database)}`}>
                        {health?.database?.toUpperCase() || 'UNKNOWN'}
                    </div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-500 mb-1">Redis Cache</div>
                    <div className={`text-xl font-bold ${getStatusColor(health?.redis)}`}>
                        {health?.redis?.toUpperCase() || 'UNKNOWN'}
                    </div>
                </Card>
            </div>

            <Card>
                <div className="text-sm text-gray-500 mb-1">Version</div>
                <div className="font-mono">{health?.version || 'N/A'}</div>
            </Card>
        </div>
    );
};

export default SystemHealthTab;

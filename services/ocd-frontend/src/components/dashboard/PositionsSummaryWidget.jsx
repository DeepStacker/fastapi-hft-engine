/**
 * Position Summary Widget
 * 
 * Dashboard widget showing:
 * - Active positions count
 * - Today's P&L
 * - Unread alerts count
 * - Quick links to positions page
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ChartBarIcon,
    BellAlertIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ExclamationTriangleIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline';
import { listPositions, getAllAlerts } from '../../services/positionTracker';
import { STRATEGY_NAMES } from '../../services/strategyOptimizer';

const PositionsSummaryWidget = () => {
    const [data, setData] = useState({
        positions: [],
        alerts: [],
        loading: true
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                const [positions, alerts] = await Promise.all([
                    listPositions({ status: 'active' }),
                    getAllAlerts(true, 10)
                ]);
                setData({
                    positions: positions || [],
                    alerts: alerts || [],
                    loading: false
                });
            } catch {
                setData(prev => ({ ...prev, loading: false }));
            }
        };

        loadData();

        // Refresh every 60 seconds
        const interval = setInterval(loadData, 60000);
        return () => clearInterval(interval);
    }, []);

    const { positions, alerts, loading } = data;
    const activeCount = positions.length;
    const totalPnl = positions.reduce((sum, p) => sum + (p.current_pnl || 0), 0);
    const unreadAlerts = alerts.filter(a => !a.is_read).length;
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.is_read).length;

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ChartBarIcon className="w-5 h-5 text-indigo-500" />
                    My Positions
                </h3>
                <Link
                    to="/positions"
                    className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                >
                    View All <ChevronRightIcon className="w-4 h-4" />
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700">
                {/* Active Positions */}
                <div className="p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Active</p>
                </div>

                {/* P&L */}
                <div className="p-4 text-center">
                    <p className={`text-3xl font-bold flex items-center justify-center gap-1 ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {totalPnl >= 0 ? <ArrowTrendingUpIcon className="w-5 h-5" /> : <ArrowTrendingDownIcon className="w-5 h-5" />}
                        ₹{Math.abs(totalPnl).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Total P&L</p>
                </div>

                {/* Alerts */}
                <div className="p-4 text-center">
                    <p className={`text-3xl font-bold ${unreadAlerts > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {unreadAlerts}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                        <BellAlertIcon className="w-3 h-3" />
                        Alerts
                    </p>
                </div>
            </div>

            {/* Critical Alert Banner */}
            {criticalAlerts > 0 && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-900/30">
                    <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        {criticalAlerts} critical alert{criticalAlerts > 1 ? 's' : ''} require attention
                    </p>
                </div>
            )}

            {/* Recent Positions */}
            {positions.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                    {positions.slice(0, 3).map((pos, i) => (
                        <Link
                            key={pos.id}
                            to="/positions"
                            className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''
                                }`}
                        >
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                    {STRATEGY_NAMES[pos.strategy_type] || pos.strategy_type}
                                </p>
                                <p className="text-xs text-gray-500">{pos.symbol} • {pos.expiry}</p>
                            </div>
                            <span className={`text-sm font-bold ${(pos.current_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {(pos.current_pnl || 0) >= 0 ? '+' : ''}₹{(pos.current_pnl || 0).toLocaleString()}
                            </span>
                        </Link>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {positions.length === 0 && (
                <div className="p-6 text-center border-t border-gray-100 dark:border-gray-700">
                    <p className="text-gray-500 text-sm mb-3">No active positions</p>
                    <Link
                        to="/strategies"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                    >
                        Find Strategies
                        <ChevronRightIcon className="w-4 h-4" />
                    </Link>
                </div>
            )}
        </motion.div>
    );
};

export default PositionsSummaryWidget;

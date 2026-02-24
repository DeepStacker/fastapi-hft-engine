/**
 * Performance Dashboard Page
 * 
 * Displays performance analytics for strategy recommendations:
 * - Overview stats (P&L, win rate, positions)
 * - Strategy breakdown with metrics
 * - Time series chart
 * - Top performing strategies
 */
import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import PageLayout from '../components/layout/PageLayout';
import { Card } from '../components/common';
import {
    ChartBarIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    TrophyIcon,
    CalendarDaysIcon,
    CheckBadgeIcon,
    BoltIcon
} from '@heroicons/react/24/outline';
import { getFullAnalytics } from '../services/performanceAnalytics';
import { STRATEGY_NAMES } from '../services/strategyOptimizer';
import { showToast } from '../context/toastSlice';

// ============ STAT CARD ============

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'indigo', trend }) => {
    const colors = {
        indigo: 'from-indigo-500 to-purple-600',
        green: 'from-green-500 to-emerald-600',
        red: 'from-red-500 to-rose-600',
        amber: 'from-amber-500 to-orange-600',
        blue: 'from-blue-500 to-cyan-600',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm"
        >
            <div className="flex items-start justify-between mb-3">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color]} shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                {trend !== undefined && (
                    <span className={`flex items-center gap-1 text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {trend >= 0 ? <ArrowTrendingUpIcon className="w-4 h-4" /> : <ArrowTrendingDownIcon className="w-4 h-4" />}
                        {Math.abs(trend).toFixed(1)}%
                    </span>
                )}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
            <p className="text-sm text-gray-500">{title}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </motion.div>
    );
};

// ============ STRATEGY ROW ============

const StrategyRow = ({ strategy, index }) => {
    const isPositive = strategy.avg_pnl >= 0;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
            <div className="flex items-center gap-4">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold 
                    ${index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                    {index + 1}
                </span>
                <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                        {STRATEGY_NAMES[strategy.strategy_type] || strategy.strategy_type}
                    </h4>
                    <p className="text-xs text-gray-500">{strategy.tracked_count || strategy.count} positions</p>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <p className="text-xs text-gray-500">Win Rate</p>
                    <p className={`font-bold ${strategy.win_rate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {strategy.win_rate?.toFixed(1)}%
                    </p>
                </div>
                <div className="text-right min-w-[80px]">
                    <p className="text-xs text-gray-500">Avg P&L</p>
                    <p className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : ''}₹{(strategy.avg_pnl || 0).toLocaleString()}
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

// ============ TIME SERIES BAR ============

const TimeSeriesChart = ({ data }) => {
    if (!data || data.length === 0) return null;

    const maxPnl = Math.max(...data.map(d => Math.abs(d.total_pnl)), 1);

    return (
        <div className="flex items-end justify-between gap-2 h-40 mt-4">
            {data.map((period, i) => {
                const isPositive = period.total_pnl >= 0;
                const height = Math.abs(period.total_pnl) / maxPnl * 100;

                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(height, 5)}%` }}
                            transition={{ delay: i * 0.05 }}
                            className={`w-full rounded-t-lg ${isPositive ? 'bg-gradient-to-t from-green-500 to-emerald-400' : 'bg-gradient-to-t from-red-500 to-rose-400'
                                }`}
                            title={`${period.period}: ₹${period.total_pnl?.toLocaleString()}`}
                        />
                        <span className="text-xs text-gray-500 truncate w-full text-center">
                            {period.period?.replace('Week ', 'W')}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ============ MAIN COMPONENT ============

const PerformanceDashboard = () => {
    const dispatch = useDispatch();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getFullAnalytics(days);
            setData(result);
        } catch (err) {
            console.error('Failed to load analytics:', err);
            dispatch(showToast({ message: 'Failed to load performance data', type: 'error' }));
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const overview = data?.overall || {};
    const strategies = data?.by_strategy || [];
    const timeSeries = data?.time_series || [];
    const topStrategies = data?.top_strategies || [];

    return (
        <PageLayout title="Performance Analytics" subtitle="Track Recommendation Accuracy & P&L">
            <Helmet><title>Performance | Stockify</title></Helmet>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full" />
                        <span className="text-sm text-gray-500">Loading analytics...</span>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Time Period Selector */}
                    <div className="flex items-center gap-2">
                        {[7, 30, 90, 180].map(d => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                                    ${days === d
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}
                            >
                                {d}D
                            </button>
                        ))}
                    </div>

                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            title="Total P&L"
                            value={`₹${(overview.total_pnl || 0).toLocaleString()}`}
                            icon={ChartBarIcon}
                            color={overview.total_pnl >= 0 ? 'green' : 'red'}
                        />
                        <StatCard
                            title="Win Rate"
                            value={`${(overview.win_rate || 0).toFixed(1)}%`}
                            subtitle={`${overview.win_count}W / ${overview.loss_count}L`}
                            icon={CheckBadgeIcon}
                            color={overview.win_rate >= 50 ? 'green' : 'amber'}
                        />
                        <StatCard
                            title="Total Positions"
                            value={overview.total_positions || 0}
                            subtitle={`${overview.active_positions} active`}
                            icon={BoltIcon}
                            color="blue"
                        />
                        <StatCard
                            title="Avg P&L"
                            value={`₹${(overview.average_pnl || 0).toLocaleString()}`}
                            icon={ArrowTrendingUpIcon}
                            color={overview.average_pnl >= 0 ? 'green' : 'red'}
                        />
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Strategy Breakdown */}
                        <Card className="p-5">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <ChartBarIcon className="w-5 h-5 text-indigo-500" />
                                Performance by Strategy
                            </h3>
                            {strategies.length === 0 ? (
                                <p className="text-gray-500 text-sm">No strategy data yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {strategies.slice(0, 5).map((s, i) => (
                                        <StrategyRow key={s.strategy_type} strategy={s} index={i} />
                                    ))}
                                </div>
                            )}
                        </Card>

                        {/* Top Performers */}
                        <Card className="p-5">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <TrophyIcon className="w-5 h-5 text-amber-500" />
                                Top Performing Strategies
                            </h3>
                            {topStrategies.length === 0 ? (
                                <p className="text-gray-500 text-sm">Need at least 3 positions per strategy</p>
                            ) : (
                                <div className="space-y-3">
                                    {topStrategies.map((s, i) => (
                                        <StrategyRow key={s.strategy_type} strategy={s} index={i} />
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Time Series Chart */}
                    <Card className="p-5">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <CalendarDaysIcon className="w-5 h-5 text-indigo-500" />
                            P&L Over Time
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Weekly performance breakdown</p>
                        {timeSeries.length === 0 ? (
                            <p className="text-gray-500 text-sm">No data for this period</p>
                        ) : (
                            <TimeSeriesChart data={timeSeries} />
                        )}
                    </Card>

                    {/* Accountability Summary */}
                    <Card className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
                        <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-3">
                            📊 Accountability Summary
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {overview.total_positions || 0}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">Tracked Positions</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-green-600">
                                    {(overview.profit_factor || 0).toFixed(2)}x
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">Profit Factor</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-amber-600">
                                    {strategies.length}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">Strategies Used</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-purple-600">
                                    {days}D
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">Analysis Period</p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </PageLayout>
    );
};

export default PerformanceDashboard;

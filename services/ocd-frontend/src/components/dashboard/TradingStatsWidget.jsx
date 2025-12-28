import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
    TrophyIcon,
    FireIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ChartBarIcon,
    CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { profileService } from '../../services/profileService';

/**
 * Trading Stats Widget - Displays user's trading performance
 * Data from /profile/me/stats API
 */
const TradingStatsWidget = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await profileService.getStats();
                if (response.success) {
                    setStats(response.stats);
                }
            } catch (err) {
                setError('Could not load trading stats');
                console.error('Failed to fetch trading stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className={`p-5 rounded-2xl border animate-pulse ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
                <div className="h-6 w-40 bg-slate-700/50 rounded mb-4" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 bg-slate-700/30 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (error || !stats) {
        return null; // Don't show widget if no data
    }

    const statCards = [
        {
            label: 'Win Rate',
            value: `${stats.win_rate}%`,
            icon: TrophyIcon,
            gradient: 'from-amber-500 to-yellow-400',
            detail: `${stats.winning_trades}/${stats.total_trades} trades`,
        },
        {
            label: 'Total P&L',
            value: `₹${(stats.total_pnl / 100000).toFixed(1)}L`,
            icon: stats.total_pnl >= 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon,
            gradient: stats.total_pnl >= 0 ? 'from-emerald-500 to-teal-400' : 'from-rose-500 to-red-400',
            detail: `Avg return: ${stats.avg_return}%`,
        },
        {
            label: 'Win Streak',
            value: stats.streak?.current || 0,
            icon: FireIcon,
            gradient: 'from-orange-500 to-red-400',
            detail: `Best: ${stats.streak?.best || 0}`,
        },
        {
            label: 'Active Days',
            value: stats.active_days,
            icon: CalendarDaysIcon,
            gradient: 'from-blue-500 to-cyan-400',
            detail: stats.most_traded_symbol,
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white/80 border-slate-200'}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <ChartBarIcon className="w-5 h-5 text-blue-500" />
                    Your Trading Performance
                </h2>
                <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                    {stats.active_days} active days
                </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statCards.map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        className={`relative overflow-hidden p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}
                    >
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3 shadow-lg`}>
                            <stat.icon className="w-5 h-5 text-white" />
                        </div>

                        {/* Value */}
                        <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {stat.value}
                        </p>

                        {/* Label */}
                        <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {stat.label}
                        </p>

                        {/* Detail */}
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {stat.detail}
                        </p>
                    </motion.div>
                ))}
            </div>

            {/* Best/Worst Trade Row */}
            <div className="grid grid-cols-2 gap-4 mt-4">
                <div className={`p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <div className="text-2xl">🏆</div>
                    <div>
                        <p className={`text-sm font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                            Best Trade: +₹{(stats.best_trade / 1000).toFixed(1)}K
                        </p>
                    </div>
                </div>
                <div className={`p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
                    <div className="text-2xl">📉</div>
                    <div>
                        <p className={`text-sm font-semibold ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>
                            Worst Trade: -₹{(Math.abs(stats.worst_trade) / 1000).toFixed(1)}K
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default TradingStatsWidget;

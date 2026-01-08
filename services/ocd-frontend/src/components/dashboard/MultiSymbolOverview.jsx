/**
 * Multi-Symbol Overview Widget
 * Shows PCR, Max Pain, OI for ALL symbols (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY)
 * Application-level market overview
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    ChartBarSquareIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    MinusIcon,
    ArrowPathIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import useMultiSymbolData from '../../hooks/useMultiSymbolData';

const MultiSymbolOverview = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const navigate = useNavigate();

    const { data, loading, error, lastUpdate, refresh, aggregate, symbols } = useMultiSymbolData();

    const formatLakhs = (num) => {
        if (!num) return '0L';
        const lakhs = Math.abs(num) / 100000;
        const sign = num >= 0 ? '+' : '-';
        if (Math.abs(lakhs) >= 1000) return `${sign}${(lakhs / 100).toFixed(1)}Cr`;
        return `${sign}${lakhs.toFixed(1)}L`;
    };

    const getTrendIcon = (trend) => {
        switch (trend) {
            case 'BULLISH': return ArrowTrendingUpIcon;
            case 'BEARISH': return ArrowTrendingDownIcon;
            default: return MinusIcon;
        }
    };

    const getTrendColor = (trend) => {
        switch (trend) {
            case 'BULLISH': return 'text-green-500';
            case 'BEARISH': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    const getTrendBg = (trend) => {
        switch (trend) {
            case 'BULLISH': return isDark ? 'bg-green-500/20' : 'bg-green-100';
            case 'BEARISH': return isDark ? 'bg-red-500/20' : 'bg-red-100';
            default: return isDark ? 'bg-gray-500/20' : 'bg-gray-100';
        }
    };

    // Symbol display config
    const symbolConfig = {
        NIFTY: { name: 'NIFTY 50', gradient: 'from-blue-600 to-cyan-500' },
        BANKNIFTY: { name: 'BANK NIFTY', gradient: 'from-purple-600 to-fuchsia-500' },
        FINNIFTY: { name: 'FIN NIFTY', gradient: 'from-green-600 to-emerald-500' },
        MIDCPNIFTY: { name: 'MIDCAP', gradient: 'from-amber-600 to-orange-500' },
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`p-6 rounded-3xl border ${isDark
                ? 'bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 border-slate-700'
                : 'bg-gradient-to-br from-slate-50 via-white to-slate-50 border-slate-200'
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                        <ChartBarSquareIcon className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Market Overview
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            All Indices • Real-time
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Market Sentiment Badge */}
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl ${getTrendBg(aggregate.marketSentiment)}`}>
                        {(() => {
                            const Icon = getTrendIcon(aggregate.marketSentiment);
                            return <Icon className={`w-4 h-4 ${getTrendColor(aggregate.marketSentiment)}`} />;
                        })()}
                        <span className={`text-sm font-bold ${getTrendColor(aggregate.marketSentiment)}`}>
                            {aggregate.marketSentiment}
                        </span>
                    </div>
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} transition-colors`}
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''} ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {loading && Object.keys(data).length === 0 && (
                <div className="flex items-center justify-center py-12">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                    <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Loading all indices...
                    </span>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className={`text-center py-8 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    <p>Failed to load data. <button onClick={refresh} className="underline">Retry</button></p>
                </div>
            )}

            {/* Symbols Grid */}
            {!loading || Object.keys(data).length > 0 ? (
                <div className="space-y-4">
                    {/* Main Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {symbols.map((symbol) => {
                            const symbolData = data[symbol];
                            const config = symbolConfig[symbol] || { name: symbol, gradient: 'from-gray-600 to-slate-600' };
                            const metrics = symbolData?.metrics;
                            const trend = metrics?.trend || 'NEUTRAL';
                            const TrendIcon = getTrendIcon(trend);

                            return (
                                <motion.div
                                    key={symbol}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`relative p-4 rounded-2xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${isDark
                                        ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                                        }`}
                                    onClick={() => navigate(`/option-chain?symbol=${symbol}`)}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${config.gradient}`} />
                                            <span className={`text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {config.name}
                                            </span>
                                        </div>
                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${getTrendBg(trend)}`}>
                                            <TrendIcon className={`w-3 h-3 ${getTrendColor(trend)}`} />
                                        </div>
                                    </div>

                                    {/* Spot Price */}
                                    <div className="mb-3">
                                        <span className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {symbolData?.spot
                                                ? `₹${symbolData.spot.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                                : '--'
                                            }
                                        </span>
                                        {symbolData?.spotChangePercent !== undefined && (
                                            <span className={`ml-2 text-xs font-medium ${symbolData.spotChangePercent >= 0 ? 'text-green-500' : 'text-red-500'
                                                }`}>
                                                {symbolData.spotChangePercent >= 0 ? '+' : ''}
                                                {symbolData.spotChangePercent?.toFixed(2)}%
                                            </span>
                                        )}
                                    </div>

                                    {/* Metrics Grid */}
                                    {metrics ? (
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                                                <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>PCR</div>
                                                <div className={`text-xs font-bold ${metrics.pcrSignal === 'BULLISH' ? 'text-green-500' :
                                                        metrics.pcrSignal === 'BEARISH' ? 'text-red-500' :
                                                            isDark ? 'text-white' : 'text-gray-900'
                                                    }`}>
                                                    {metrics.pcr?.toFixed(2)}
                                                </div>
                                            </div>
                                            <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                                                <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Max Pain</div>
                                                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {metrics.maxPain ? (metrics.maxPain / 1000).toFixed(1) + 'k' : '--'}
                                                </div>
                                            </div>
                                            <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                                                <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>OI Δ</div>
                                                <div className={`text-xs font-bold ${(metrics.totalPECOI - metrics.totalCECOI) > 0 ? 'text-green-500' : 'text-red-500'
                                                    }`}>
                                                    {formatLakhs(metrics.totalPECOI - metrics.totalCECOI)}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`text-xs text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {symbolData?.error || 'Loading...'}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Aggregate Summary */}
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/30' : 'bg-gray-50'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-6">
                                <div className="text-center">
                                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Total CE OI Δ</div>
                                    <div className={`text-sm font-bold ${aggregate.totalCECOI >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {formatLakhs(aggregate.totalCECOI)}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Total PE OI Δ</div>
                                    <div className={`text-sm font-bold ${aggregate.totalPECOI >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {formatLakhs(aggregate.totalPECOI)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-center">
                                    <span className="text-green-500 text-sm font-bold">{aggregate.bullishCount} 🟢</span>
                                    <span className="text-gray-500 text-sm font-bold">{aggregate.neutralCount} ⚪</span>
                                    <span className="text-red-500 text-sm font-bold">{aggregate.bearishCount} 🔴</span>
                                </div>
                            </div>
                            {lastUpdate && (
                                <div className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                    Updated {lastUpdate.toLocaleTimeString()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </motion.div>
    );
};

export default MultiSymbolOverview;

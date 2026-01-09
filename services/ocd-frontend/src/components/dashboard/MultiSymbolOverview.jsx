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

    // Filter valid symbols
    const validSymbols = symbols.filter(symbol => {
        const d = data[symbol];
        return d && !d.loading && !d.error && d.spot > 0;
    });

    const marqueeSymbols = [...validSymbols, ...validSymbols]; // Duplicate for seamless loop

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`p-6 rounded-3xl border overflow-hidden ${isDark
                ? 'bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 border-slate-700'
                : 'bg-gradient-to-br from-slate-50 via-white to-slate-50 border-slate-200'
                }`}
        >
            <style>
                {`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 120s linear infinite;
                }
                .animate-marquee:hover {
                    animation-play-state: paused;
                }
                `}
            </style>

            {/* Header */}
            <div className="flex items-center justify-between mb-5 px-2">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                        <ChartBarSquareIcon className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Market Overview
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Live Options Chain Data
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

            {/* Scrolling Marquee Container */}
            {!loading && validSymbols.length > 0 && (
                <div className="relative w-full overflow-hidden mask-linear-fade">
                    <div className="flex gap-4 animate-marquee w-fit py-2">
                        {marqueeSymbols.map((symbol, index) => {
                            // Use index in key to handle duplicates
                            const symbolData = data[symbol];
                            const config = symbolConfig[symbol] || { name: symbol, gradient: 'from-gray-600 to-slate-600' };
                            const metrics = symbolData?.metrics;
                            const trend = metrics?.trend || 'NEUTRAL';
                            const TrendIcon = getTrendIcon(trend);
                            const rawData = symbolData?.rawData || {};
                            const ivChange = rawData.atmiv_change || 0;

                            return (
                                <motion.div
                                    key={`${symbol}-${index}`}
                                    className={`relative flex-shrink-0 w-72 p-4 rounded-2xl border cursor-pointer hover:scale-[1.02] transition-transform ${isDark
                                        ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                                        }`}
                                    onClick={() => navigate(`/option-chain?symbol=${symbol}`)}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${config.gradient}`} />
                                            <span className={`text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                {config.name}
                                            </span>
                                        </div>
                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${getTrendBg(trend)}`}>
                                            <TrendIcon className={`w-3 h-3 ${getTrendColor(trend)}`} />
                                        </div>
                                    </div>

                                    {/* Spot Price & Change */}
                                    <div className="flex items-baseline justify-between mb-4">
                                        <div className="flex items-baseline gap-2">
                                            <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {symbolData?.spot?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                        <span className={`text-sm font-medium ${symbolData.spotChangePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {symbolData.spotChangePercent >= 0 ? '+' : ''}{symbolData.spotChangePercent?.toFixed(2)}%
                                        </span>
                                    </div>

                                    {/* Enhanced Metrics Grid */}
                                    {metrics && (
                                        <div className="grid grid-cols-2 gap-2 text-center text-xs">

                                            {/* Top Row: IV & IV Change */}
                                            <div className={`p-2 rounded-lg col-span-2 flex justify-between items-center ${isDark ? 'bg-slate-900/50' : 'bg-gray-100'}`}>
                                                <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ATM IV</span>
                                                <div className="flex gap-2">
                                                    <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {symbolData.atmIV?.toFixed(1)}%
                                                    </span>
                                                    <span className={`font-medium ${ivChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        ({ivChange >= 0 ? '+' : ''}{ivChange.toFixed(1)}%)
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Max Pain */}
                                            <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-900/50' : 'bg-gray-100'}`}>
                                                <div className={`mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Max Pain</div>
                                                <div className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {metrics.maxPain ? metrics.maxPain : '--'}
                                                </div>
                                            </div>

                                            {/* PCR */}
                                            <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-900/50' : 'bg-gray-100'}`}>
                                                <div className={`mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>PCR</div>
                                                <div className={`font-bold ${metrics.pcrSignal === 'BULLISH' ? 'text-green-500' :
                                                    metrics.pcrSignal === 'BEARISH' ? 'text-red-500' :
                                                        isDark ? 'text-white' : 'text-gray-900'
                                                    }`}>
                                                    {metrics.pcr?.toFixed(2)}
                                                </div>
                                            </div>

                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && validSymbols.length === 0 && (
                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No active market data available.
                </div>
            )}
        </motion.div>
    );
};

export default MultiSymbolOverview;

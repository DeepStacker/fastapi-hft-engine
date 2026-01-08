/**
 * Live Market Summary Widget
 * Replaces static Quick Tips with real-time market insights
 * Aggregates PCR, Max Pain, OI, and Trend signals
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectOptionChain, selectSpotPrice, selectSelectedSymbol } from '../../context/selectors';
import {
    SparklesIcon,
    ChartBarIcon,
    FireIcon,
    ScaleIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    MinusIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';

const LiveMarketSummaryWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const navigate = useNavigate();
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const symbol = useSelector(selectSelectedSymbol);

    // Calculate all metrics
    const marketData = useMemo(() => {
        if (!optionChain || Object.keys(optionChain).length === 0) {
            return null;
        }

        const strikes = Object.keys(optionChain)
            .map(s => parseFloat(s))
            .sort((a, b) => a - b);

        // PCR Calculation
        let totalCEOI = 0, totalPEOI = 0;
        let totalCECOI = 0, totalPECOI = 0;

        // Max Pain Calculation
        let minPain = Infinity;
        let maxPainStrike = strikes[0];

        strikes.forEach(strike => {
            const data = optionChain[strike] || optionChain[String(strike)];
            const ceOI = data?.ce?.oi || data?.ce?.OI || 0;
            const peOI = data?.pe?.oi || data?.pe?.OI || 0;
            const ceCOI = data?.ce?.coi || data?.ce?.COI || 0;
            const peCOI = data?.pe?.coi || data?.pe?.COI || 0;

            totalCEOI += ceOI;
            totalPEOI += peOI;
            totalCECOI += ceCOI;
            totalPECOI += peCOI;
        });

        // Max Pain calculation
        strikes.forEach(targetStrike => {
            let totalPain = 0;
            strikes.forEach(strike => {
                const data = optionChain[strike] || optionChain[String(strike)];
                const ceOI = data?.ce?.oi || data?.ce?.OI || 0;
                const peOI = data?.pe?.oi || data?.pe?.OI || 0;

                if (targetStrike > strike) totalPain += ceOI * (targetStrike - strike);
                if (targetStrike < strike) totalPain += peOI * (strike - targetStrike);
            });
            if (totalPain < minPain) {
                minPain = totalPain;
                maxPainStrike = targetStrike;
            }
        });

        const pcr = totalCEOI > 0 ? totalPEOI / totalCEOI : 0;

        // Determine overall trend
        let trend = 'NEUTRAL';
        let trendScore = 0;

        // PCR signal
        if (pcr > 1.2) trendScore += 2;
        else if (pcr < 0.7) trendScore -= 2;

        // OI Buildup signal
        if (totalPECOI > totalCECOI * 1.2) trendScore += 1;
        else if (totalCECOI > totalPECOI * 1.2) trendScore -= 1;

        // Max Pain signal
        if (spotPrice) {
            if (maxPainStrike > spotPrice * 1.01) trendScore += 1;
            else if (maxPainStrike < spotPrice * 0.99) trendScore -= 1;
        }

        if (trendScore >= 2) trend = 'BULLISH';
        else if (trendScore <= -2) trend = 'BEARISH';

        return {
            pcr: pcr.toFixed(2),
            pcrSignal: pcr > 1.2 ? 'BULLISH' : pcr < 0.7 ? 'BEARISH' : 'NEUTRAL',
            maxPain: maxPainStrike,
            maxPainDistance: spotPrice ? ((maxPainStrike - spotPrice) / spotPrice * 100).toFixed(2) : 0,
            totalCECOI,
            totalPECOI,
            oiSignal: totalPECOI > totalCECOI ? 'BULLISH' : totalCECOI > totalPECOI ? 'BEARISH' : 'NEUTRAL',
            trend,
            trendScore,
        };
    }, [optionChain, spotPrice]);

    const formatLakhs = (num) => {
        if (!num) return '0L';
        const lakhs = Math.abs(num) / 100000;
        const sign = num >= 0 ? '+' : '-';
        return `${sign}${lakhs.toFixed(1)}L`;
    };

    const getTrendConfig = (trend) => {
        switch (trend) {
            case 'BULLISH':
                return {
                    icon: ArrowTrendingUpIcon,
                    color: 'text-green-500',
                    bg: 'bg-green-500/20',
                    gradient: 'from-green-600 to-emerald-500'
                };
            case 'BEARISH':
                return {
                    icon: ArrowTrendingDownIcon,
                    color: 'text-red-500',
                    bg: 'bg-red-500/20',
                    gradient: 'from-red-600 to-rose-500'
                };
            default:
                return {
                    icon: MinusIcon,
                    color: 'text-gray-500',
                    bg: 'bg-gray-500/20',
                    gradient: 'from-gray-600 to-slate-500'
                };
        }
    };

    // Empty state
    if (!marketData) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={`p-6 rounded-2xl border ${isDark
                    ? 'bg-gradient-to-r from-slate-900/90 to-slate-800/90 border-slate-700'
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100'
                    }`}
            >
                <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <SparklesIcon className="w-5 h-5 text-amber-500" />
                    Live Market Summary
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Visit the Option Chain page to load market data and see live insights.
                </p>
                <button
                    onClick={() => navigate('/option-chain')}
                    className={`mt-4 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${isDark
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        } transition-colors`}
                >
                    Load Option Chain
                    <ArrowRightIcon className="w-4 h-4" />
                </button>
            </motion.div>
        );
    }

    const trendConfig = getTrendConfig(marketData.trend);
    const TrendIcon = trendConfig.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`p-6 rounded-2xl border ${isDark
                ? 'bg-gradient-to-r from-slate-900/90 to-slate-800/90 border-slate-700'
                : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100'
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <SparklesIcon className="w-5 h-5 text-amber-500" />
                    Live Market Summary
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                        {symbol}
                    </span>
                </h3>
                {/* Overall Trend Badge */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${trendConfig.bg}`}>
                    <TrendIcon className={`w-5 h-5 ${trendConfig.color}`} />
                    <span className={`text-sm font-bold ${trendConfig.color}`}>
                        {marketData.trend}
                    </span>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* PCR */}
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white/80'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <ScaleIcon className="w-4 h-4 text-blue-500" />
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PCR</span>
                    </div>
                    <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {marketData.pcr}
                    </div>
                    <div className={`text-xs font-medium ${marketData.pcrSignal === 'BULLISH' ? 'text-green-500' :
                            marketData.pcrSignal === 'BEARISH' ? 'text-red-500' : 'text-gray-500'
                        }`}>
                        {marketData.pcrSignal === 'BULLISH' ? '🟢 Bullish' :
                            marketData.pcrSignal === 'BEARISH' ? '🔴 Bearish' : '⚪ Neutral'}
                    </div>
                </div>

                {/* Max Pain */}
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white/80'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <FireIcon className="w-4 h-4 text-purple-500" />
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Max Pain</span>
                    </div>
                    <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {marketData.maxPain.toLocaleString('en-IN')}
                    </div>
                    <div className={`text-xs font-medium ${parseFloat(marketData.maxPainDistance) > 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                        {parseFloat(marketData.maxPainDistance) > 0 ? '↑' : '↓'} {Math.abs(parseFloat(marketData.maxPainDistance))}% from spot
                    </div>
                </div>

                {/* CE OI Change */}
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white/80'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <ChartBarIcon className="w-4 h-4 text-green-500" />
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>CE Buildup</span>
                    </div>
                    <div className={`text-2xl font-black ${marketData.totalCECOI >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                        {formatLakhs(marketData.totalCECOI)}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {marketData.totalCECOI >= 0 ? 'Resistance forming' : 'Resistance weakening'}
                    </div>
                </div>

                {/* PE OI Change */}
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white/80'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <ChartBarIcon className="w-4 h-4 text-red-500" />
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PE Buildup</span>
                    </div>
                    <div className={`text-2xl font-black ${marketData.totalPECOI >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                        {formatLakhs(marketData.totalPECOI)}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {marketData.totalPECOI >= 0 ? 'Support forming' : 'Support weakening'}
                    </div>
                </div>
            </div>

            {/* Quick Action */}
            <div className="mt-4 flex items-center justify-between">
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    📊 Data updates in real-time from Option Chain
                </p>
                <button
                    onClick={() => navigate('/analytics')}
                    className={`text-xs font-medium flex items-center gap-1 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
                >
                    View Analytics
                    <ArrowRightIcon className="w-3 h-3" />
                </button>
            </div>
        </motion.div>
    );
};

export default LiveMarketSummaryWidget;

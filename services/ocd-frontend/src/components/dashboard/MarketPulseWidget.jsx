import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    SignalIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    MinusIcon,
    SparklesIcon
} from '@heroicons/react/24/outline';
import { selectLiveDataSnapshot } from '../../context/selectors';

/**
 * Market Pulse Widget
 * 
 * Aggregates all analysis signals into a single sentiment view:
 * - Overall market sentiment (BULLISH/BEARISH/NEUTRAL)
 * - Key metrics summary
 * - Signal strength meter
 */
const MarketPulseWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const liveData = useSelector(selectLiveDataSnapshot);
    const isDark = theme === 'dark';

    // Extract all analyses
    const analyses = liveData?.analyses || {};

    const parseAnalysis = (key) => {
        if (!analyses[key]) return null;
        return typeof analyses[key] === 'string' ? JSON.parse(analyses[key]) : analyses[key];
    };

    const gexData = parseAnalysis('gamma_exposure');
    const basisData = parseAnalysis('futures_basis');
    const pcrData = parseAnalysis('pcr_analysis');
    const vixData = parseAnalysis('vix_divergence');
    const skewData = parseAnalysis('iv_skew');

    // Calculate overall sentiment
    const calculateSentiment = () => {
        let bullishCount = 0;
        let bearishCount = 0;
        let signals = [];

        // GEX analysis
        if (gexData?.market_regime === 'EXPLOSIVE') {
            signals.push({ text: 'High volatility expected', type: 'warning' });
        }

        // Futures basis
        if (basisData?.sentiment === 'BULLISH') {
            bullishCount++;
            signals.push({ text: 'Futures in premium', type: 'bullish' });
        } else if (basisData?.sentiment === 'BEARISH') {
            bearishCount++;
            signals.push({ text: 'Futures in discount', type: 'bearish' });
        }

        // PCR
        if (pcrData?.sentiment === 'BULLISH') {
            bullishCount++;
            signals.push({ text: 'Low PCR ratio', type: 'bullish' });
        } else if (pcrData?.sentiment === 'BEARISH') {
            bearishCount++;
            signals.push({ text: 'High PCR ratio', type: 'bearish' });
        }

        // VIX divergence
        if (vixData?.signal?.includes('BUY')) {
            signals.push({ text: 'IV underpriced vs VIX', type: 'info' });
        } else if (vixData?.signal?.includes('SELL')) {
            signals.push({ text: 'IV overpriced vs VIX', type: 'warning' });
        }

        // IV Skew
        if (skewData?.skew > 3) {
            signals.push({ text: 'Strong put skew', type: 'bearish' });
            bearishCount++;
        } else if (skewData?.skew < -3) {
            signals.push({ text: 'Strong call skew', type: 'bullish' });
            bullishCount++;
        }

        // Calculate overall
        const total = bullishCount + bearishCount;
        let overallSentiment = 'NEUTRAL';
        let strength = 50;

        if (total > 0) {
            if (bullishCount > bearishCount) {
                overallSentiment = 'BULLISH';
                strength = 50 + ((bullishCount - bearishCount) / total) * 50;
            } else if (bearishCount > bullishCount) {
                overallSentiment = 'BEARISH';
                strength = 50 - ((bearishCount - bullishCount) / total) * 50;
            }
        }

        return { sentiment: overallSentiment, strength, signals, bullishCount, bearishCount };
    };

    const marketPulse = calculateSentiment();

    // Styling based on sentiment
    const getStyle = () => {
        if (marketPulse.sentiment === 'BULLISH') {
            return {
                gradient: 'from-emerald-500 to-teal-500',
                bg: isDark ? 'bg-emerald-900/20' : 'bg-emerald-50',
                border: 'border-emerald-500/50',
                text: isDark ? 'text-emerald-400' : 'text-emerald-600',
                meterColor: 'bg-emerald-500',
            };
        }
        if (marketPulse.sentiment === 'BEARISH') {
            return {
                gradient: 'from-red-500 to-rose-500',
                bg: isDark ? 'bg-red-900/20' : 'bg-red-50',
                border: 'border-red-500/50',
                text: isDark ? 'text-red-400' : 'text-red-600',
                meterColor: 'bg-red-500',
            };
        }
        return {
            gradient: 'from-amber-500 to-orange-500',
            bg: isDark ? 'bg-amber-900/20' : 'bg-amber-50',
            border: 'border-amber-500/50',
            text: isDark ? 'text-amber-400' : 'text-amber-600',
            meterColor: 'bg-amber-500',
        };
    };

    const style = getStyle();

    // Signal badge styling
    const getSignalBadgeStyle = (type) => {
        switch (type) {
            case 'bullish':
                return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
            case 'bearish':
                return 'bg-red-500/20 text-red-500 border-red-500/30';
            case 'warning':
                return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
            default:
                return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-6 border ${style.bg} ${style.border}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-lg`}>
                        <SignalIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Market Pulse
                        </h3>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Aggregated sentiment
                        </p>
                    </div>
                </div>

                {/* Sentiment Badge */}
                <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${style.bg} border ${style.border}`}>
                    {marketPulse.sentiment === 'BULLISH' ? (
                        <ArrowTrendingUpIcon className={`w-5 h-5 ${style.text}`} />
                    ) : marketPulse.sentiment === 'BEARISH' ? (
                        <ArrowTrendingDownIcon className={`w-5 h-5 ${style.text}`} />
                    ) : (
                        <MinusIcon className={`w-5 h-5 ${style.text}`} />
                    )}
                    <span className={`font-bold ${style.text}`}>
                        {marketPulse.sentiment}
                    </span>
                </div>
            </div>

            {/* Sentiment Meter */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-red-500 font-medium">BEARISH</span>
                    <span className="text-xs text-emerald-500 font-medium">BULLISH</span>
                </div>
                <div className={`h-3 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} relative overflow-hidden`}>
                    {/* Center line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/50 z-10" />

                    {/* Meter fill */}
                    <motion.div
                        initial={{ width: '50%' }}
                        animate={{ width: `${marketPulse.strength}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${style.meterColor}`}
                    />
                </div>
                <div className="text-center mt-2">
                    <span className={`text-2xl font-bold ${style.text}`}>
                        {Math.round(marketPulse.strength)}%
                    </span>
                </div>
            </div>

            {/* Signal Score */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white/80'} text-center`}>
                    <ArrowTrendingUpIcon className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-emerald-500">
                        {marketPulse.bullishCount}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Bullish Signals
                    </p>
                </div>
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white/80'} text-center`}>
                    <ArrowTrendingDownIcon className="w-6 h-6 text-red-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-red-500">
                        {marketPulse.bearishCount}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Bearish Signals
                    </p>
                </div>
            </div>

            {/* Active Signals */}
            {marketPulse.signals.length > 0 && (
                <div className="space-y-2">
                    <h4 className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <SparklesIcon className="w-4 h-4 inline-block mr-1" />
                        ACTIVE SIGNALS
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {marketPulse.signals.slice(0, 4).map((signal, idx) => (
                            <span
                                key={idx}
                                className={`text-xs px-2.5 py-1 rounded-full border ${getSignalBadgeStyle(signal.type)}`}
                            >
                                {signal.text}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default MarketPulseWidget;

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ChartBarIcon,
    BuildingLibraryIcon
} from '@heroicons/react/24/outline';
import { selectLiveDataSnapshot } from '../../context/selectors';

/**
 * Futures Basis Widget
 * 
 * Displays futures-spot basis analysis:
 * - Premium/discount percentage
 * - Fair value comparison
 * - Rollover pressure signals
 * - Arbitrage opportunities
 */
const FuturesBasisWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const liveData = useSelector(selectLiveDataSnapshot);
    const isDark = theme === 'dark';

    // Extract futures basis data from analyses OR calculate from live data
    const analyses = liveData?.analyses || {};
    const fl = liveData?.fl || {};
    const spotPrice = liveData?.sltp || 0;

    let basisData = analyses.futures_basis ?
        (typeof analyses.futures_basis === 'string' ? JSON.parse(analyses.futures_basis) : analyses.futures_basis)
        : null;

    // Fallback: Calculate basis from live futures data
    if (!basisData && spotPrice > 0 && Object.keys(fl).length > 0) {
        // Get first available futures contract
        const futuresContracts = Object.values(fl);
        const nearMonthFuture = futuresContracts[0] || {};

        const futuresPrice = nearMonthFuture.ltp || 0;
        const futuresOi = nearMonthFuture.oi || 0;
        const daysToExpiry = nearMonthFuture.daystoexp || liveData?.dte || 30;

        if (futuresPrice > 0) {
            const basisCalc = futuresPrice - spotPrice;
            const basisPctCalc = (basisCalc / spotPrice) * 100;

            // Fair value using cost-of-carry model (approx 7% annual rate)
            const riskFreeRate = 0.07;
            const T = daysToExpiry / 365;
            const fairValueBasis = spotPrice * (Math.exp(riskFreeRate * T) - 1);
            const fairValuePctCalc = (fairValueBasis / spotPrice) * 100;

            const mispricingCalc = Math.abs(basisCalc - fairValueBasis);
            const mispricingPctCalc = (mispricingCalc / spotPrice) * 100;

            const sentimentCalc = basisCalc > fairValueBasis * 1.2 ? 'BULLISH' :
                basisCalc < fairValueBasis * 0.5 ? 'BEARISH' : 'NEUTRAL';

            const signalsCalc = [];
            if (basisCalc > fairValueBasis * 1.5) signalsCalc.push('STRONG_PREMIUM');
            if (basisCalc < 0) signalsCalc.push('DISCOUNT_ALERT');
            if (daysToExpiry < 5) signalsCalc.push('ROLLOVER_NEAR');

            basisData = {
                basis: basisCalc,
                basis_pct: basisPctCalc,
                fair_value_basis_pct: fairValuePctCalc,
                mispricing_pct: mispricingPctCalc,
                futures_oi_millions: futuresOi / 1000000,
                signals: signalsCalc,
                sentiment: sentimentCalc
            };
        }
    }

    const basis = basisData?.basis || 0;
    const basisPct = basisData?.basis_pct || 0;
    const fairValuePct = basisData?.fair_value_basis_pct || 0;
    const mispricingPct = basisData?.mispricing_pct || 0;
    const futuresOI = basisData?.futures_oi_millions || 0;
    const signals = basisData?.signals || [];
    const sentiment = basisData?.sentiment || 'NEUTRAL';

    // Determine if premium or discount
    const isPremium = basis > 0;

    // Sentiment styling
    const getSentimentStyle = (sent) => {
        switch (sent) {
            case 'BULLISH':
                return {
                    gradient: 'from-emerald-500 to-teal-500',
                    bg: isDark ? 'bg-emerald-900/20' : 'bg-emerald-50',
                    border: 'border-emerald-500/50',
                    text: isDark ? 'text-emerald-400' : 'text-emerald-600',
                };
            case 'BEARISH':
                return {
                    gradient: 'from-red-500 to-rose-500',
                    bg: isDark ? 'bg-red-900/20' : 'bg-red-50',
                    border: 'border-red-500/50',
                    text: isDark ? 'text-red-400' : 'text-red-600',
                };
            default:
                return {
                    gradient: 'from-slate-500 to-gray-500',
                    bg: isDark ? 'bg-slate-800/50' : 'bg-slate-100',
                    border: 'border-slate-500/50',
                    text: isDark ? 'text-slate-400' : 'text-slate-600',
                };
        }
    };

    const sentimentStyle = getSentimentStyle(sentiment);

    // Signal badges
    const getSignalStyle = (signal) => {
        if (signal.includes('BULLISH') || signal.includes('ROLLOVER')) {
            return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
        }
        if (signal.includes('BEARISH')) {
            return 'bg-red-500/20 text-red-500 border-red-500/30';
        }
        if (signal.includes('ARBITRAGE')) {
            return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
        }
        return 'bg-slate-500/20 text-slate-500 border-slate-500/30';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-5 border ${sentimentStyle.bg} ${sentimentStyle.border}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${sentimentStyle.gradient} flex items-center justify-center shadow-lg`}>
                        <BuildingLibraryIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Futures Basis
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Premium/Discount
                        </p>
                    </div>
                </div>

                {/* Sentiment Badge */}
                <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${sentimentStyle.bg} border ${sentimentStyle.border}`}>
                    {sentiment === 'BULLISH' ? (
                        <ArrowTrendingUpIcon className={`w-4 h-4 ${sentimentStyle.text}`} />
                    ) : sentiment === 'BEARISH' ? (
                        <ArrowTrendingDownIcon className={`w-4 h-4 ${sentimentStyle.text}`} />
                    ) : (
                        <ChartBarIcon className={`w-4 h-4 ${sentimentStyle.text}`} />
                    )}
                    <span className={`text-xs font-bold ${sentimentStyle.text}`}>
                        {sentiment}
                    </span>
                </div>
            </div>

            {/* Basis Value */}
            <div className="mb-4">
                <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${isPremium ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isPremium ? '+' : ''}{basis.toFixed(2)}
                    </span>
                    <span className={`text-sm ${isPremium ? 'text-emerald-400' : 'text-red-400'}`}>
                        ({isPremium ? '+' : ''}{basisPct.toFixed(3)}%)
                    </span>
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isPremium ? 'Futures trading at premium' : 'Futures trading at discount'}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white/80'}`}>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Fair Value
                    </p>
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {fairValuePct.toFixed(3)}%
                    </p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white/80'}`}>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Mispricing
                    </p>
                    <p className={`text-sm font-bold ${mispricingPct > 0.5 ? 'text-amber-500' : isDark ? 'text-white' : 'text-slate-900'}`}>
                        {mispricingPct.toFixed(3)}%
                    </p>
                </div>
            </div>

            {/* Futures OI */}
            <div className="mb-3">
                <div className="flex items-center justify-between">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Futures OI
                    </span>
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {futuresOI.toFixed(2)}M contracts
                    </span>
                </div>
            </div>

            {/* Signals */}
            {signals.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {signals.slice(0, 2).map((signal, idx) => (
                        <span
                            key={idx}
                            className={`text-xs px-2 py-1 rounded-full border ${getSignalStyle(signal)}`}
                        >
                            {signal.replace(/_/g, ' ')}
                        </span>
                    ))}
                </div>
            )}

            {/* No data state */}
            {!basisData && (
                <div className={`text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <BuildingLibraryIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Loading futures data...</p>
                </div>
            )}
        </motion.div>
    );
};

export default FuturesBasisWidget;

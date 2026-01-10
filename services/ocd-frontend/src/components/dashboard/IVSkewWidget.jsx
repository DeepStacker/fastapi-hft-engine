import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    ChartBarSquareIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    MinusIcon
} from '@heroicons/react/24/outline';
import { selectLiveDataSnapshot } from '../../context/selectors';

/**
 * IV Skew Widget
 * 
 * Displays IV skew analysis:
 * - ATM IV vs OTM Put/Call IV
 * - Skew direction and magnitude
 * - Trading signal based on skew
 */
const IVSkewWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const liveData = useSelector(selectLiveDataSnapshot);
    const isDark = theme === 'dark';

    // Extract IV skew data from analyses OR calculate from option chain
    const analyses = liveData?.analyses || {};
    const oc = liveData?.oc || {};
    const spotPrice = liveData?.sltp || 0;

    let skewData = analyses.iv_skew ?
        (typeof analyses.iv_skew === 'string' ? JSON.parse(analyses.iv_skew) : analyses.iv_skew)
        : null;

    // Fallback: Calculate IV skew from option chain if no HFT data
    if (!skewData && Object.keys(oc).length > 0 && spotPrice > 0) {
        const strikes = Object.values(oc);
        const sortedStrikes = strikes.sort((a, b) => a.strike - b.strike);

        // Find ATM strike
        const atmStrike = sortedStrikes.reduce((prev, curr) =>
            Math.abs(curr.strike - spotPrice) < Math.abs(prev.strike - spotPrice) ? curr : prev
        );

        // Find OTM options (2-3 strikes away)
        const atmIdx = sortedStrikes.findIndex(s => s.strike === atmStrike.strike);
        const otmPutIdx = Math.max(0, atmIdx - 3);
        const otmCallIdx = Math.min(sortedStrikes.length - 1, atmIdx + 3);

        const atmCeIv = atmStrike.ce?.iv || 0;
        const atmPeIv = atmStrike.pe?.iv || 0;
        const atmIvCalc = (atmCeIv + atmPeIv) / 2 || liveData?.atmiv || 15;

        const otmPutRow = sortedStrikes[otmPutIdx];
        const otmCallRow = sortedStrikes[otmCallIdx];

        const otmPutIvCalc = otmPutRow?.pe?.iv || atmIvCalc;
        const otmCallIvCalc = otmCallRow?.ce?.iv || atmIvCalc;

        const skewCalc = otmPutIvCalc - otmCallIvCalc;

        skewData = {
            atm_iv: atmIvCalc,
            otm_put_iv: otmPutIvCalc,
            otm_call_iv: otmCallIvCalc,
            skew: skewCalc,
            put_strike: otmPutRow?.strike || 0,
            call_strike: otmCallRow?.strike || 0,
            signal: skewCalc > 3 ? 'PUT_SKEW' : skewCalc < -3 ? 'CALL_SKEW' : 'NORMAL_SKEW',
            sentiment: skewCalc > 3 ? 'BEARISH' : skewCalc < -3 ? 'BULLISH' : 'NEUTRAL'
        };
    }

    const atmIV = skewData?.atm_iv || liveData?.atmiv || 0;
    const otmPutIV = skewData?.otm_put_iv || 0;
    const otmCallIV = skewData?.otm_call_iv || 0;
    const skew = skewData?.skew || 0;
    const putStrike = skewData?.put_strike || 0;
    const callStrike = skewData?.call_strike || 0;
    const signal = skewData?.signal || 'NORMAL_SKEW';
    const sentiment = skewData?.sentiment || 'NEUTRAL';

    // Determine skew direction
    const isPositiveSkew = skew > 0; // Puts more expensive
    const isNegativeSkew = skew < 0; // Calls more expensive

    // Styling based on sentiment
    const getStyle = () => {
        if (sentiment === 'BULLISH' || signal.includes('CALL')) {
            return {
                gradient: 'from-emerald-500 to-teal-500',
                bg: isDark ? 'bg-emerald-900/20' : 'bg-emerald-50',
                border: 'border-emerald-500/50',
                accent: 'text-emerald-500',
            };
        }
        if (sentiment === 'BEARISH' || signal.includes('PUT')) {
            return {
                gradient: 'from-red-500 to-rose-500',
                bg: isDark ? 'bg-red-900/20' : 'bg-red-50',
                border: 'border-red-500/50',
                accent: 'text-red-500',
            };
        }
        return {
            gradient: 'from-violet-500 to-purple-500',
            bg: isDark ? 'bg-violet-900/20' : 'bg-violet-50',
            border: 'border-violet-500/50',
            accent: 'text-violet-500',
        };
    };

    const style = getStyle();

    // IV Bar component
    const IVBar = ({ label, value, max, color }) => {
        const pct = Math.min(100, (value / max) * 100);
        return (
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {label}
                    </span>
                    <span className={`text-sm font-bold ${color}`}>
                        {value.toFixed(2)}%
                    </span>
                </div>
                <div className={`h-2 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                        className={`h-full rounded-full bg-gradient-to-r ${style.gradient}`}
                    />
                </div>
            </div>
        );
    };

    const maxIV = Math.max(atmIV, otmPutIV, otmCallIV, 30);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-5 border ${style.bg} ${style.border}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-lg`}>
                        <ChartBarSquareIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            IV Skew
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Volatility smile
                        </p>
                    </div>
                </div>

                {/* Skew Direction */}
                <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${style.bg} border ${style.border}`}>
                    {isPositiveSkew ? (
                        <ArrowTrendingUpIcon className="w-4 h-4 text-red-500" />
                    ) : isNegativeSkew ? (
                        <ArrowTrendingDownIcon className="w-4 h-4 text-emerald-500" />
                    ) : (
                        <MinusIcon className="w-4 h-4 text-slate-500" />
                    )}
                    <span className={`text-xs font-bold ${style.accent}`}>
                        {Math.abs(skew).toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Skew Value */}
            <div className="mb-4">
                <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${style.accent}`}>
                        {skew > 0 ? '+' : ''}{skew.toFixed(2)}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isPositiveSkew ? 'Put skew' : isNegativeSkew ? 'Call skew' : 'Neutral'}
                    </span>
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {signal.replace(/_/g, ' ')}
                </p>
            </div>

            {/* IV Bars */}
            <div className="space-y-3">
                <IVBar
                    label={`OTM Put (${putStrike.toLocaleString()})`}
                    value={otmPutIV}
                    max={maxIV}
                    color="text-red-500"
                />
                <IVBar
                    label="ATM"
                    value={atmIV}
                    max={maxIV}
                    color={isDark ? 'text-white' : 'text-slate-900'}
                />
                <IVBar
                    label={`OTM Call (${callStrike.toLocaleString()})`}
                    value={otmCallIV}
                    max={maxIV}
                    color="text-emerald-500"
                />
            </div>

            {/* No data state */}
            {!skewData && (
                <div className={`text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <ChartBarSquareIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Loading IV data...</p>
                </div>
            )}
        </motion.div>
    );
};

export default IVSkewWidget;

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    ArrowsUpDownIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { selectLiveDataSnapshot, selectSpotPrice } from '../../context/selectors';

/**
 * Reversal Levels Pro Component
 * 
 * Displays LOC-style calculated reversal levels for key strikes.
 * Identifies strong Support, Resistance, and Breakout/Breakdown levels.
 */
const ReversalLevelsPro = () => {
    const theme = useSelector((state) => state.theme.theme);
    const liveData = useSelector(selectLiveDataSnapshot);
    const spotPrice = useSelector(selectSpotPrice) || 0;
    const isDark = theme === 'dark';

    const oc = liveData?.oc || {};

    // Identify key levels
    const levels = useMemo(() => {
        const oc = liveData?.oc || {};
        const optionsArray = Object.values(oc);

        if (!optionsArray.length || !spotPrice) return [];

        // Find ATM
        const strikes = optionsArray.map(o => o.strike).sort((a, b) => a - b);
        const uniqueStrikes = [...new Set(strikes)];

        if (uniqueStrikes.length === 0) return [];

        const atmStrike = uniqueStrikes.reduce((prev, curr) =>
            Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
        );

        // Filter relevant options (ATM +/- 5)
        const atmIdx = uniqueStrikes.indexOf(atmStrike);
        const start = Math.max(0, atmIdx - 5);
        const end = Math.min(uniqueStrikes.length, atmIdx + 6);
        const relevantStrikes = uniqueStrikes.slice(start, end);

        return relevantStrikes.map(strike => {
            // Since data is normalized by strike, we can just grab the object directly
            const strikeKey = strike.toString();
            // Try specific key or fallback to numeric conversion lookup if needed
            // But object values loop ensures we have data.
            // Actually, we need to find the specific strike object from the array we created or map via key
            const combinedData = oc[strikeKey] || optionsArray.find(o => o.strike === strike);

            if (!combinedData) return null;

            const ce = combinedData.ce || {};
            const pe = combinedData.pe || {};

            // Use Backend Calculated Reversal Levels if available
            // standard options.py response includes: rs, ss, rr, fut_reversal
            const ceReversal = combinedData.rs || (strike + (ce.ltp || 0)); // Resistance
            const peReversal = combinedData.ss || (strike - (pe.ltp || 0)); // Support

            // Backend provides 'trading_signals' which might verify this
            const isResistance = spotPrice < ceReversal;
            const isSupport = spotPrice > peReversal;

            return {
                strike,
                ceReversal,
                peReversal,
                ceLtp: ce.ltp || 0,
                peLtp: pe.ltp || 0,
                type: isResistance ? 'RESISTANCE' : isSupport ? 'SUPPORT' : 'NEUTRAL',
                strength: (ce.oi || 0) + (pe.oi || 0) // Simple strength proxy
            };
        }).filter(Boolean);
    }, [liveData, spotPrice]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-6 border ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
                        <ArrowsUpDownIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Reversal Levels (LOC)
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Key support & resistance based on premium pricing
                        </p>
                    </div>
                </div>
            </div>

            {/* Levels Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className={`text-xs uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            <th className="px-4 py-3 text-left">Call Reversal (Res)</th>
                            <th className="px-4 py-3 text-center">Strike</th>
                            <th className="px-4 py-3 text-right">Put Reversal (Sup)</th>
                            <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {levels.map((level, idx) => {
                            const isATM = Math.abs(level.strike - spotPrice) < 50; // Approx check
                            return (
                                <tr key={idx} className={`${isATM ? (isDark ? 'bg-slate-800/50' : 'bg-amber-50') : ''}`}>
                                    <td className="px-4 py-3 text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-red-500">{level.ceReversal.toFixed(2)}</span>
                                            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                (₹{level.ceLtp})
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded font-bold ${isATM
                                            ? 'bg-amber-500 text-white'
                                            : isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'
                                            }`}>
                                            {level.strike}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                (₹{level.peLtp})
                                            </span>
                                            <span className="font-bold text-emerald-500">{level.peReversal.toFixed(2)}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {spotPrice > level.peReversal && spotPrice < level.ceReversal ? (
                                            <span className="text-xs px-2 py-1 rounded bg-slate-500/20 text-slate-500">Range</span>
                                        ) : spotPrice >= level.ceReversal ? (
                                            <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-500 flex items-center justify-center gap-1">
                                                <ArrowTrendingUpIcon className="w-3 h-3" /> ABOV RES
                                            </span>
                                        ) : (
                                            <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-500 flex items-center justify-center gap-1">
                                                <ArrowTrendingDownIcon className="w-3 h-3" /> BLO SUP
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

export default ReversalLevelsPro;

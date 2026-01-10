import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    ChartBarIcon,
    MagnifyingGlassIcon,
    ArrowsPointingOutIcon
} from '@heroicons/react/24/outline';
import { selectLiveDataSnapshot, selectSpotPrice } from '../../context/selectors';

/**
 * OI Heatmap Pro Component
 * 
 * Professional OI distribution heatmap with:
 * - Color-coded cells by OI intensity
 * - CE/PE separation
 * - Spot price indicator
 * - Interactive hover details
 */
const OIHeatmapPro = () => {
    const theme = useSelector((state) => state.theme.theme);
    const liveData = useSelector(selectLiveDataSnapshot);
    const spotPrice = useSelector(selectSpotPrice) || 0;
    const isDark = theme === 'dark';

    const oc = liveData?.oc || {};

    // Process options into heatmap data
    const heatmapData = useMemo(() => {
        const strikesData = Object.values(oc);
        if (!strikesData.length) return { strikes: [], data: {} };

        // Group by strike
        const byStrike = {};
        strikesData.forEach(row => {
            const strike = row.strike;
            // The normalized data already has ce/pe populated
            byStrike[strike] = {
                ce: row.ce,
                pe: row.pe
            };
        });

        // Sort strikes
        const strikes = Object.keys(byStrike)
            .map(Number)
            .sort((a, b) => a - b);

        // Find max OI for color scaling
        let maxOI = 0;
        let maxOIChange = 0;
        strikes.forEach(strike => {
            const { ce, pe } = byStrike[strike];
            if (ce?.oi) maxOI = Math.max(maxOI, ce.oi);
            if (pe?.oi) maxOI = Math.max(maxOI, pe.oi);
            if (ce?.change_oi) maxOIChange = Math.max(maxOIChange, Math.abs(ce.change_oi));
            if (pe?.change_oi) maxOIChange = Math.max(maxOIChange, Math.abs(pe.change_oi));
        });

        return { strikes, data: byStrike, maxOI, maxOIChange };
    }, [oc]);

    // Color intensity based on OI
    const getOIColor = (oi, type, isChange = false) => {
        if (!oi) return isDark ? 'bg-slate-800' : 'bg-slate-100';

        const max = isChange ? heatmapData.maxOIChange : heatmapData.maxOI;
        const intensity = Math.min(1, Math.abs(oi) / (max || 1));

        if (type === 'CE') {
            if (isChange && oi < 0) {
                return `bg-red-${Math.round(intensity * 4 + 4)}00/50`;
            }
            const level = Math.round(intensity * 4 + 4);
            return isDark
                ? `bg-emerald-${Math.min(900, level * 100)}/40`
                : `bg-emerald-${Math.min(500, level * 100)}/30`;
        } else {
            if (isChange && oi < 0) {
                return `bg-emerald-${Math.round(intensity * 4 + 4)}00/50`;
            }
            const level = Math.round(intensity * 4 + 4);
            return isDark
                ? `bg-red-${Math.min(900, level * 100)}/40`
                : `bg-red-${Math.min(500, level * 100)}/30`;
        }
    };

    // Get opacity based on intensity
    const getOpacity = (oi) => {
        if (!oi || !heatmapData.maxOI) return 0.1;
        return 0.2 + (Math.abs(oi) / heatmapData.maxOI) * 0.6;
    };

    // Format large numbers
    const formatOI = (value) => {
        if (!value) return '-';
        if (Math.abs(value) >= 1e7) return `${(value / 1e7).toFixed(1)}Cr`;
        if (Math.abs(value) >= 1e5) return `${(value / 1e5).toFixed(1)}L`;
        if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
        return value.toLocaleString();
    };

    // Find ATM strike
    const atmStrike = useMemo(() => {
        if (!spotPrice || !heatmapData.strikes.length) return null;
        return heatmapData.strikes.reduce((prev, curr) =>
            Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
        );
    }, [spotPrice, heatmapData.strikes]);

    // Filter strikes around ATM for focused view
    const [showAll, setShowAll] = useState(false);
    const displayStrikes = useMemo(() => {
        if (showAll) return heatmapData.strikes;
        if (!atmStrike) return heatmapData.strikes.slice(0, 20);

        const atmIdx = heatmapData.strikes.indexOf(atmStrike);
        const start = Math.max(0, atmIdx - 10);
        const end = Math.min(heatmapData.strikes.length, atmIdx + 10);
        return heatmapData.strikes.slice(start, end);
    }, [heatmapData.strikes, atmStrike, showAll]);

    const [viewMode, setViewMode] = useState('oi'); // 'oi' or 'change'

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`rounded-2xl p-6 border ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                        <ChartBarIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            OI Heatmap Pro
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {displayStrikes.length} strikes • Spot: {spotPrice?.toLocaleString()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className={`flex rounded-lg p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <button
                            onClick={() => setViewMode('oi')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'oi'
                                ? 'bg-blue-500 text-white'
                                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Total OI
                        </button>
                        <button
                            onClick={() => setViewMode('change')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'change'
                                ? 'bg-blue-500 text-white'
                                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            OI Change
                        </button>
                    </div>

                    <button
                        onClick={() => setShowAll(!showAll)}
                        className={`p-2 rounded-lg ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}
                    >
                        <ArrowsPointingOutIcon className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                    </button>
                </div>
            </div>

            {/* Heatmap Grid */}
            <div className="overflow-x-auto">
                <div className="min-w-full">
                    {/* Header Row */}
                    <div className="grid grid-cols-5 gap-1 mb-1">
                        <div className={`text-center text-xs font-semibold py-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            CE {viewMode === 'change' ? 'Chg' : 'OI'}
                        </div>
                        <div className={`text-center text-xs font-semibold py-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            CE Buildup
                        </div>
                        <div className={`text-center text-xs font-bold py-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Strike
                        </div>
                        <div className={`text-center text-xs font-semibold py-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                            PE Buildup
                        </div>
                        <div className={`text-center text-xs font-semibold py-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                            PE {viewMode === 'change' ? 'Chg' : 'OI'}
                        </div>
                    </div>

                    {/* Data Rows */}
                    {displayStrikes.map((strike, idx) => {
                        const { ce, pe } = heatmapData.data[strike] || {};
                        const isATM = strike === atmStrike;
                        const ceValue = viewMode === 'change' ? ce?.change_oi : ce?.oi;
                        const peValue = viewMode === 'change' ? pe?.change_oi : pe?.oi;
                        const ceOpacity = getOpacity(ceValue);
                        const peOpacity = getOpacity(peValue);

                        return (
                            <motion.div
                                key={strike}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.02 }}
                                className={`grid grid-cols-5 gap-1 mb-1 ${isATM ? 'ring-2 ring-amber-500 rounded-lg' : ''}`}
                            >
                                {/* CE OI */}
                                <div
                                    className={`text-center p-2 rounded-lg transition-all hover:scale-105 cursor-pointer`}
                                    style={{
                                        backgroundColor: ce?.oi
                                            ? `rgba(16, 185, 129, ${ceOpacity})`
                                            : isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(241, 245, 249, 1)'
                                    }}
                                >
                                    <span className={`text-sm font-medium ${ceValue && viewMode === 'change' && ceValue < 0 ? 'text-red-400' : isDark ? 'text-white' : 'text-slate-900'}`}>
                                        {formatOI(ceValue)}
                                    </span>
                                </div>

                                {/* CE Buildup */}
                                <div className={`text-center p-2 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${ce?.buildup_type === 'LB' ? 'bg-emerald-500/20 text-emerald-500' :
                                        ce?.buildup_type === 'SB' ? 'bg-red-500/20 text-red-500' :
                                            ce?.buildup_type === 'LU' ? 'bg-amber-500/20 text-amber-500' :
                                                ce?.buildup_type === 'SU' ? 'bg-blue-500/20 text-blue-500' :
                                                    isDark ? 'text-slate-500' : 'text-slate-400'
                                        }`}>
                                        {ce?.buildup_type || '-'}
                                    </span>
                                </div>

                                {/* Strike */}
                                <div className={`text-center p-2 rounded-lg ${isATM
                                    ? 'bg-amber-500 text-white font-bold'
                                    : isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'
                                    }`}>
                                    <span className="text-sm font-bold">{strike.toLocaleString()}</span>
                                    {isATM && <span className="block text-[10px]">ATM</span>}
                                </div>

                                {/* PE Buildup */}
                                <div className={`text-center p-2 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${pe?.buildup_type === 'LB' ? 'bg-emerald-500/20 text-emerald-500' :
                                        pe?.buildup_type === 'SB' ? 'bg-red-500/20 text-red-500' :
                                            pe?.buildup_type === 'LU' ? 'bg-amber-500/20 text-amber-500' :
                                                pe?.buildup_type === 'SU' ? 'bg-blue-500/20 text-blue-500' :
                                                    isDark ? 'text-slate-500' : 'text-slate-400'
                                        }`}>
                                        {pe?.buildup_type || '-'}
                                    </span>
                                </div>

                                {/* PE OI */}
                                <div
                                    className={`text-center p-2 rounded-lg transition-all hover:scale-105 cursor-pointer`}
                                    style={{
                                        backgroundColor: pe?.oi
                                            ? `rgba(239, 68, 68, ${peOpacity})`
                                            : isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(241, 245, 249, 1)'
                                    }}
                                >
                                    <span className={`text-sm font-medium ${peValue && viewMode === 'change' && peValue < 0 ? 'text-emerald-400' : isDark ? 'text-white' : 'text-slate-900'}`}>
                                        {formatOI(peValue)}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-500/30" />
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>CE OI</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500/30" />
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>PE OI</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-500" />
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ATM Strike</span>
                </div>
            </div>

            {/* Buildup Legend */}
            <div className="mt-2 flex items-center justify-center gap-4">
                <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-500">LB = Long Buildup</span>
                <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-500">SB = Short Buildup</span>
                <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-500">LU = Long Unwinding</span>
                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-500">SU = Short Covering</span>
            </div>
        </motion.div>
    );
};

export default OIHeatmapPro;

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    BoltIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { selectLiveDataSnapshot } from '../../context/selectors';

/**
 * GEX (Gamma Exposure) Widget
 * 
 * Displays live gamma exposure analysis:
 * - Gamma walls (key levels)
 * - Market regime (EXPLOSIVE/RANGE_BOUND/NEUTRAL)
 * - Squeeze risk indicators
 */
const GEXWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const liveData = useSelector(selectLiveDataSnapshot);
    const isDark = theme === 'dark';

    // Extract GEX data from live analyses OR calculate fallback from option chain
    const analyses = liveData?.analyses || {};
    const oc = liveData?.oc || {};

    // Try to get pre-computed GEX from HFT analyses
    let gexData = analyses.gamma_exposure ?
        (typeof analyses.gamma_exposure === 'string' ? JSON.parse(analyses.gamma_exposure) : analyses.gamma_exposure)
        : null;

    // Fallback: Calculate approximate GEX from option chain if no HFT data
    if (!gexData && Object.keys(oc).length > 0) {
        const strikes = Object.values(oc);
        let totalGex = 0;
        const walls = [];
        const spotPrice = liveData?.sltp || 0;

        strikes.forEach(row => {
            const ce = row.ce || {};
            const pe = row.pe || {};
            const strike = row.strike;

            // Simplified GEX approximation: GEX ≈ OI × |delta| × gamma_proxy
            // Since we may not have gamma, use delta as proxy
            const ceDelta = Math.abs(ce.delta || 0.5);
            const peDelta = Math.abs(pe.delta || 0.5);
            const ceOi = ce.oi || 0;
            const peOi = pe.oi || 0;

            // Call gamma positive, Put gamma negative for dealers
            const ceGex = ceOi * ceDelta * 0.01;
            const peGex = -peOi * peDelta * 0.01;
            const strikeGex = ceGex + peGex;

            totalGex += strikeGex;

            if (Math.abs(strikeGex) > 1000) {
                const distancePct = spotPrice ? ((strike - spotPrice) / spotPrice) * 100 : 0;
                walls.push({
                    strike,
                    gex: strikeGex,
                    distance_pct: distancePct,
                    squeeze_risk: Math.abs(strikeGex) > 10000 ? 'HIGH' : 'MODERATE'
                });
            }
        });

        // Sort walls by absolute GEX
        walls.sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex));

        gexData = {
            gamma_walls: walls.slice(0, 5),
            market_regime: totalGex > 5000 ? 'RANGE_BOUND' : totalGex < -5000 ? 'EXPLOSIVE' : 'NEUTRAL',
            total_market_gex: totalGex,
            regime_description: totalGex > 0 ? 'Dealer long gamma (range bound)' : 'Dealer short gamma (trending)'
        };
    }

    const gammaWalls = gexData?.gamma_walls || [];
    const marketRegime = gexData?.market_regime || 'NEUTRAL';
    const totalGEX = gexData?.total_market_gex || 0;
    const regimeDescription = gexData?.regime_description || 'Loading GEX data...';

    // Regime styling
    const getRegimeStyle = (regime) => {
        switch (regime) {
            case 'EXPLOSIVE':
                return {
                    gradient: 'from-red-500 to-orange-500',
                    bg: isDark ? 'bg-red-900/20' : 'bg-red-50',
                    border: 'border-red-500/50',
                    text: isDark ? 'text-red-400' : 'text-red-600',
                    icon: ExclamationTriangleIcon,
                };
            case 'RANGE_BOUND':
                return {
                    gradient: 'from-emerald-500 to-teal-500',
                    bg: isDark ? 'bg-emerald-900/20' : 'bg-emerald-50',
                    border: 'border-emerald-500/50',
                    text: isDark ? 'text-emerald-400' : 'text-emerald-600',
                    icon: ArrowTrendingDownIcon,
                };
            default:
                return {
                    gradient: 'from-slate-500 to-gray-500',
                    bg: isDark ? 'bg-slate-800/50' : 'bg-slate-100',
                    border: 'border-slate-500/50',
                    text: isDark ? 'text-slate-400' : 'text-slate-600',
                    icon: BoltIcon,
                };
        }
    };

    const regimeStyle = getRegimeStyle(marketRegime);
    const RegimeIcon = regimeStyle.icon;

    // Format large numbers
    const formatGEX = (value) => {
        if (!value) return '0';
        const absValue = Math.abs(value);
        if (absValue >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
        if (absValue >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
        if (absValue >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
        return value.toFixed(0);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-5 border ${regimeStyle.bg} ${regimeStyle.border}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${regimeStyle.gradient} flex items-center justify-center shadow-lg`}>
                        <BoltIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Gamma Exposure
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Dealer positioning
                        </p>
                    </div>
                </div>

                {/* Market Regime Badge */}
                <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${regimeStyle.bg} border ${regimeStyle.border}`}>
                    <RegimeIcon className={`w-4 h-4 ${regimeStyle.text}`} />
                    <span className={`text-xs font-bold ${regimeStyle.text}`}>
                        {marketRegime}
                    </span>
                </div>
            </div>

            {/* Total GEX */}
            <div className="mb-4">
                <div className={`text-2xl font-bold ${totalGEX < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {totalGEX < 0 ? '-' : '+'}{formatGEX(Math.abs(totalGEX))}
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {regimeDescription}
                </p>
            </div>

            {/* Gamma Walls */}
            {gammaWalls.length > 0 && (
                <div className="space-y-2">
                    <h4 className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        KEY GAMMA LEVELS
                    </h4>
                    {gammaWalls.slice(0, 3).map((wall, idx) => (
                        <div
                            key={idx}
                            className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-white/80'}`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {wall.strike?.toLocaleString() || '-'}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${wall.squeeze_risk === 'EXTREME'
                                    ? 'bg-red-500/20 text-red-500'
                                    : wall.squeeze_risk === 'HIGH'
                                        ? 'bg-orange-500/20 text-orange-500'
                                        : 'bg-slate-500/20 text-slate-500'
                                    }`}>
                                    {wall.squeeze_risk || 'LOW'}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className={`text-sm ${wall.gex < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {formatGEX(wall.gex)}
                                </span>
                                <span className={`text-xs block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {wall.distance_pct?.toFixed(2) || 0}% away
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* No data state */}
            {!gexData && (
                <div className={`text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <BoltIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Loading GEX data...</p>
                </div>
            )}
        </motion.div>
    );
};

export default GEXWidget;

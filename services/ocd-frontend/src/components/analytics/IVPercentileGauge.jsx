/**
 * Enhanced IV Percentile Gauge Component
 * 
 * NIFTY 50 Calibrated IV Analysis:
 * - Historical context for IV percentile interpretation
 * - IV regime classification with trading implications
 * - IV skew analysis with directional hints
 * - Options strategy recommendations based on IV level
 */
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    ChartBarSquareIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';

// ============ NIFTY 50 IV CONTEXT ============
// Historical NIFTY IV ranges (based on VIX data)
const NIFTY_IV_CONTEXT = {
    // VIX-based historical ranges (2020-2024)
    historicalLow: 10,       // VIX below 10 is extremely low
    historicalHigh: 35,      // VIX above 35 is elevated (not crisis)
    normalLow: 12,           // Normal range lower bound
    normalHigh: 18,          // Normal range upper bound

    // Thresholds for current percentile interpretation
    veryLow: 11,
    low: 13,
    normal: 16,
    high: 20,
    veryHigh: 25,
    extreme: 30,
};

// Strategy logic moved to dedicated page
// OLD getStrategyRecommendations REMOVED

// ... existing helper functions ...

// ... inside render ...
// REMOVED Strategy Section

// ============ HELPER FUNCTIONS ============
const calcMean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const calcStdDev = arr => {
    if (arr.length < 2) return 1;
    const m = calcMean(arr);
    return Math.sqrt(arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / arr.length) || 1;
};

// Calculate IV percentile relative to NIFTY historical range
const calcHistoricalPercentile = (atmIV) => {
    const { historicalLow, historicalHigh } = NIFTY_IV_CONTEXT;
    const range = historicalHigh - historicalLow;
    const percentile = ((atmIV - historicalLow) / range) * 100;
    return Math.min(100, Math.max(0, percentile));
};

// ============ MAIN COMPONENT ============
const IVPercentileGauge = () => {
    const optionChain = useSelector(selectOptionChain);
    const _spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    // removed showStrategies state

    // strategies logic removed

    // ============ IV ANALYSIS ENGINE ============
    const ivMetrics = useMemo(() => {
        if (!optionChain) return null;

        let atmCEIV = 0;
        let atmPEIV = 0;
        const allIVs = [];
        const strikes = [];

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);
            const ceIV = (data.ce?.iv || 0) * 100;
            const peIV = (data.pe?.iv || 0) * 100;

            if (ceIV > 0) allIVs.push(ceIV);
            if (peIV > 0) allIVs.push(peIV);

            if (strike === atmStrike) {
                atmCEIV = ceIV;
                atmPEIV = peIV;
            }

            if (ceIV > 0 || peIV > 0) {
                strikes.push({ strike, ceIV, peIV, avgIV: (ceIV + peIV) / 2 || ceIV || peIV });
            }
        });

        strikes.sort((a, b) => a.strike - b.strike);

        const atmIV = (atmCEIV + atmPEIV) / 2;
        const minIV = allIVs.length ? Math.min(...allIVs) : 0;
        const maxIV = allIVs.length ? Math.max(...allIVs) : 100;
        const avgIV = calcMean(allIVs);
        const stdDevIV = calcStdDev(allIVs);

        // Chain-based IV percentile (where current ATM IV falls in current chain)
        const ivRange = maxIV - minIV;
        const chainPercentile = ivRange > 0 ? ((atmIV - minIV) / ivRange) * 100 : 50;

        // Historical percentile (more meaningful for NIFTY)
        const historicalPercentile = calcHistoricalPercentile(atmIV);

        // Use weighted average of both (historical is more reliable)
        const ivPercentile = (historicalPercentile * 0.7 + chainPercentile * 0.3);

        // Put-Call IV Spread (skew)
        const pcIVSpread = atmPEIV - atmCEIV;

        // IV Skew Analysis
        const otmPuts = strikes.filter(s => s.strike < atmStrike - 100).slice(-3);
        const otmCalls = strikes.filter(s => s.strike > atmStrike + 100).slice(0, 3);
        const avgOTMPutIV = calcMean(otmPuts.map(s => s.peIV).filter(v => v > 0));
        const avgOTMCallIV = calcMean(otmCalls.map(s => s.ceIV).filter(v => v > 0));
        const skewRatio = avgOTMPutIV && avgOTMCallIV ? avgOTMPutIV / avgOTMCallIV : 1;

        // IV term structure hint (comparing near ATM to far OTM)
        const termSlope = avgOTMPutIV > atmIV ? 'steep' : avgOTMPutIV < atmIV * 0.9 ? 'flat' : 'normal';

        return {
            atmIV,
            atmCEIV,
            atmPEIV,
            minIV,
            maxIV,
            avgIV,
            stdDevIV,
            chainPercentile,
            historicalPercentile,
            ivPercentile,
            pcIVSpread,
            skewRatio,
            termSlope,
            strikes,
        };
    }, [optionChain, atmStrike]);

    // ============ UI RENDERING ============
    if (!optionChain || !ivMetrics) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ChartBarSquareIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    // strategy variable removed

    // Determine IV level classification
    const getIVLevel = (percentile) => {
        if (percentile >= 80) return { label: 'Very High', color: 'red', textColor: 'text-red-600' };
        if (percentile >= 60) return { label: 'High', color: 'orange', textColor: 'text-orange-600' };
        if (percentile >= 40) return { label: 'Normal', color: 'amber', textColor: 'text-amber-600' };
        if (percentile >= 20) return { label: 'Low', color: 'green', textColor: 'text-green-600' };
        return { label: 'Very Low', color: 'emerald', textColor: 'text-emerald-600' };
    };

    const ivLevel = getIVLevel(ivMetrics.ivPercentile);

    const getColorClass = (color) => {
        const colorMap = {
            red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
            amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        };
        return colorMap[color] || colorMap.amber;
    };

    return (
        <div className="space-y-4">
            {/* Main IV Gauge */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header with Strategy Tag */}
                <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ChartBarSquareIcon className="w-6 h-6" />
                            <div>
                                <h3 className="font-bold text-lg">IV Analysis</h3>
                                <p className="text-xs opacity-80">NIFTY 50 Calibrated</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold">{ivMetrics.atmIV.toFixed(1)}%</div>
                            <div className="text-xs opacity-80">ATM IV</div>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {/* IV Level Badge */}
                    <div className="flex items-center justify-between mb-4">
                        <span className={`px-4 py-2 rounded-lg text-sm font-bold ${getColorClass(ivLevel.color)}`}>
                            {ivLevel.label} IV Environment
                        </span>
                    </div>

                    {/* Horizontal Gauge Bar */}
                    <div className="relative mb-8">
                        <div className="h-8 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 overflow-hidden shadow-inner">
                            <div className="absolute inset-0 flex">
                                {/* IV Zones with labels */}
                                {[0, 20, 40, 60, 80].map((pct, i) => (
                                    <div key={i} className="flex-1 border-r border-white/30 last:border-0" />
                                ))}
                            </div>
                        </div>

                        {/* Needle/Marker */}
                        <motion.div
                            initial={{ left: '50%' }}
                            animate={{ left: `${ivMetrics.ivPercentile}%` }}
                            transition={{ type: 'spring', stiffness: 100 }}
                            className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                        >
                            <div className="w-1 h-8 bg-gray-900 dark:bg-white rounded-full shadow-lg" />
                            <div className="mt-2 px-3 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-bold shadow-lg">
                                {ivMetrics.ivPercentile.toFixed(0)}%
                            </div>
                        </motion.div>

                        {/* Labels */}
                        <div className="flex justify-between mt-4 text-[10px] text-gray-500">
                            <span>Very Low</span>
                            <span>Low</span>
                            <span>Normal</span>
                            <span>High</span>
                            <span>Very High</span>
                        </div>
                    </div>

                    {/* IV Stats Grid */}
                    <div className="grid grid-cols-5 gap-2 mb-4">
                        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="text-[10px] text-gray-500">Min</div>
                            <div className="text-sm font-bold text-emerald-600">{ivMetrics.minIV.toFixed(1)}%</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="text-[10px] text-gray-500">Avg</div>
                            <div className="text-sm font-bold text-amber-600">{ivMetrics.avgIV.toFixed(1)}%</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="text-[10px] text-gray-500">Max</div>
                            <div className="text-sm font-bold text-red-600">{ivMetrics.maxIV.toFixed(1)}%</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="text-[10px] text-gray-500">Std Dev</div>
                            <div className="text-sm font-bold text-purple-600">±{ivMetrics.stdDevIV.toFixed(1)}</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="text-[10px] text-gray-500">Skew</div>
                            <div className={`text-sm font-bold ${ivMetrics.skewRatio > 1.1 ? 'text-red-600' : ivMetrics.skewRatio < 0.9 ? 'text-green-600' : 'text-gray-600'}`}>
                                {ivMetrics.skewRatio.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* NIFTY Context */}
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2 mb-1">
                            <InformationCircleIcon className="w-4 h-4 text-indigo-500" />
                            <span className="font-semibold text-indigo-700 dark:text-indigo-400">NIFTY 50 Context</span>
                        </div>
                        <p>
                            Historical range: {NIFTY_IV_CONTEXT.historicalLow}% - {NIFTY_IV_CONTEXT.historicalHigh}% |
                            Normal: {NIFTY_IV_CONTEXT.normalLow}% - {NIFTY_IV_CONTEXT.normalHigh}% |
                            Current ATM IV is at {ivMetrics.historicalPercentile.toFixed(0)}% of historical range
                        </p>
                    </div>
                </div>
            </div>

            {/* Put-Call IV Spread */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Call IV (ATM)</div>
                    <div className="text-2xl font-bold">{ivMetrics.atmCEIV.toFixed(1)}%</div>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Put IV (ATM)</div>
                    <div className="text-2xl font-bold">{ivMetrics.atmPEIV.toFixed(1)}%</div>
                </div>
                <div className={`rounded-xl p-4 border-2 ${ivMetrics.pcIVSpread > 0
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    }`}>
                    <div className="text-xs text-gray-500 mb-1">Put-Call IV Spread</div>
                    <div className={`text-2xl font-bold flex items-center gap-1 ${ivMetrics.pcIVSpread > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                        {ivMetrics.pcIVSpread > 0 ? <ArrowTrendingDownIcon className="w-5 h-5" /> : <ArrowTrendingUpIcon className="w-5 h-5" />}
                        {ivMetrics.pcIVSpread > 0 ? '+' : ''}{ivMetrics.pcIVSpread.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                        {ivMetrics.pcIVSpread > 2 ? '🔴 Strong bearish skew (puts expensive)' :
                            ivMetrics.pcIVSpread > 0.5 ? '🟠 Mild bearish skew' :
                                ivMetrics.pcIVSpread < -2 ? '🟢 Strong bullish skew (calls expensive)' :
                                    ivMetrics.pcIVSpread < -0.5 ? '🔵 Mild bullish skew' : '⚪ Neutral'}
                    </div>
                </div>
            </div>

            {/* IV by Strike Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white flex items-center justify-between">
                    <h3 className="font-semibold text-sm">IV Smile (Volatility Skew)</h3>
                    <span className="text-[10px] opacity-80">
                        Term: {ivMetrics.termSlope === 'steep' ? '📈 Steep' : ivMetrics.termSlope === 'flat' ? '📉 Flat' : '➖ Normal'}
                    </span>
                </div>
                <div className="p-4">
                    <IVSmileChart strikes={ivMetrics.strikes} atmStrike={atmStrike} atmIV={ivMetrics.atmIV} />
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-gray-500">
                <span className="font-medium text-indigo-600">NIFTY 50 Reference</span> |
                Historical Range: {NIFTY_IV_CONTEXT.historicalLow}%-{NIFTY_IV_CONTEXT.historicalHigh}% |
                Skew Ratio: OTM Put IV / OTM Call IV
            </div>
        </div>
    );
};

// IV Smile Mini Chart
const IVSmileChart = ({ strikes, atmStrike, atmIV: _atmIV }) => {
    const width = 700;
    const height = 150;
    const padding = { left: 50, right: 30, top: 20, bottom: 30 };

    if (!strikes || strikes.length === 0) return null;

    const validIVs = strikes.flatMap(s => [s.ceIV, s.peIV]).filter(v => v > 0);
    const minIV = Math.min(...validIVs);
    const maxIV = Math.max(...validIVs);
    const ivRange = maxIV - minIV || 1;

    const xScale = (i) => padding.left + (i / (strikes.length - 1)) * (width - padding.left - padding.right);
    const yScale = (iv) => padding.top + ((maxIV - iv) / ivRange) * (height - padding.top - padding.bottom);

    const atmIdx = strikes.findIndex(s => s.strike === atmStrike);

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((t, i) => {
                const y = padding.top + (height - padding.top - padding.bottom) * t;
                return <line key={i} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#E5E7EB" strokeDasharray="3" />;
            })}

            {/* ATM marker */}
            {atmIdx >= 0 && (
                <line x1={xScale(atmIdx)} y1={padding.top} x2={xScale(atmIdx)} y2={height - padding.bottom}
                    stroke="#3B82F6" strokeWidth="2" strokeDasharray="5,3" />
            )}

            {/* CE IV line */}
            <polyline
                points={strikes.filter(s => s.ceIV > 0).map((s) => {
                    const origIdx = strikes.indexOf(s);
                    return `${xScale(origIdx)},${yScale(s.ceIV)}`;
                }).join(' ')}
                fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"
            />

            {/* PE IV line */}
            <polyline
                points={strikes.filter(s => s.peIV > 0).map((s) => {
                    const origIdx = strikes.indexOf(s);
                    return `${xScale(origIdx)},${yScale(s.peIV)}`;
                }).join(' ')}
                fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"
            />

            {/* Legend */}
            <g transform={`translate(${width - 120}, 10)`}>
                <line x1="0" y1="6" x2="15" y2="6" stroke="#10B981" strokeWidth="2.5" />
                <text x="20" y="9" className="fill-gray-600 text-[9px]">CE IV</text>
                <line x1="55" y1="6" x2="70" y2="6" stroke="#EF4444" strokeWidth="2.5" />
                <text x="75" y="9" className="fill-gray-600 text-[9px]">PE IV</text>
            </g>

            {/* Y axis labels */}
            <text x={padding.left - 5} y={padding.top + 5} textAnchor="end" className="fill-gray-500 text-[9px]">{maxIV.toFixed(0)}%</text>
            <text x={padding.left - 5} y={height - padding.bottom} textAnchor="end" className="fill-gray-500 text-[9px]">{minIV.toFixed(0)}%</text>
        </svg>
    );
};

export default IVPercentileGauge;

/**
 * Enhanced Buildup Analysis Pro Component v4
 * 
 * Advanced Data Mining with Full Greeks Integration
 * 
 * Features:
 * 1. DELTA-ADJUSTED OI - True exposure in underlying terms
 * 2. GAMMA EXPOSURE (GEX) - Market maker hedging pressure  
 * 3. IV PERCENTILE & SKEW - Volatility context
 * 4. Z-SCORE ANOMALY DETECTION - Statistical outliers
 * 5. MONEY FLOW INDEX (MFI) - Volume-weighted price momentum
 * 6. MULTI-FACTOR SCORING - 12+ factors with dynamic weights
 * 7. MACHINE LEARNING CLUSTERING - K-means for pattern grouping
 * 8. CROSS-STRIKE CORRELATION - Detect coordinated activity
 * 9. OPTIONS FLOW ANALYSIS - Buyer vs Writer activity
 * 10. NIFTY 50 CALIBRATED THRESHOLDS - Empirical values
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    FireIcon,
    BoltIcon,
    ChevronDownIcon,
    BeakerIcon,
    CpuChipIcon,
} from '@heroicons/react/24/outline';
import {
    selectOptionChain, selectSpotPrice, selectATMStrike,
    selectLotSize, selectATMIV, selectPCR, selectDaysToExpiry
} from '../../context/selectors';
import { analyzeBuildup, calculateAdvancedScore, classifyBuildup, formatCurrency, formatNumber, NIFTY_CONFIG, MARKET_IMPLICATION } from '../../services/buildupAnalytics';
import BuildupSummaryCard from './BuildupSummaryCard';



// ============ MAIN COMPONENT ============
const BuildupAnalysisPro = () => {
    const theme = useSelector((state) => state.theme.theme);
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize) || NIFTY_CONFIG.lotSize;
    const atmIV = useSelector(selectATMIV);
    const pcr = useSelector(selectPCR);
    const dte = useSelector(selectDaysToExpiry);

    const isDark = theme === 'dark';
    const [selectedType, setSelectedType] = useState(null);
    const [showAlgorithm, setShowAlgorithm] = useState(false);

    // ============ CORE DATA MINING ENGINE ============
    const { analysis, summary, insights, marketState } = useMemo(() => {
        return analyzeBuildup(optionChain, spotPrice, atmStrike, lotSize, atmIV, pcr, dte);
    }, [optionChain, spotPrice, atmStrike, lotSize, atmIV, pcr, dte]);

    // ============ UI RENDERING ============
    if (!optionChain || !analysis) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const getSentimentColor = (score) => {
        if (score >= 65) return 'from-emerald-500 to-green-500';
        if (score >= 52) return 'from-teal-500 to-emerald-500';
        if (score <= 35) return 'from-red-500 to-rose-500';
        if (score <= 48) return 'from-orange-500 to-red-500';
        return 'from-gray-500 to-slate-500';
    };

    const getConfidenceColor = (conf) => {
        if (conf >= 70) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        if (conf >= 50) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        if (conf >= 30) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    };

    const orderedTypes = ['LB', 'SC', 'SB', 'LU'];

    const typeInfo = {
        LB: { label: 'Long Buildup', emoji: '🟢', color: 'emerald', icon: ArrowTrendingUpIcon },
        SC: { label: 'Short Covering', emoji: '🔵', color: 'blue', icon: ArrowTrendingUpIcon },
        SB: { label: 'Short Buildup', emoji: '🔴', color: 'red', icon: ArrowTrendingDownIcon },
        LU: { label: 'Long Unwinding', emoji: '🟠', color: 'amber', icon: ArrowTrendingDownIcon },
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}
        >
            {/* Shared Summary Card */}
            <BuildupSummaryCard
                summary={summary}
                marketState={marketState}
                insights={insights}
                isDark={isDark}
            />

            {/* Anomaly Alert */}
            {insights.anomalies.length > 0 && (
                <div className={`mx-4 mb-4 p-3 rounded-lg ${isDark ? 'bg-purple-900/30' : 'bg-purple-50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <BeakerIcon className="w-5 h-5 text-purple-600" />
                        <span className="font-semibold text-sm text-purple-700 dark:text-purple-400">Anomalies Detected (IQR Outliers)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {insights.anomalies.map((c, i) => (
                            <span key={i} className="px-2 py-1 text-xs rounded bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200">
                                {c.strike} {c.type} - {c.buildupType} ({c.confidence.toFixed(0)}%)
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Buildup Type Cards */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {orderedTypes.map(type => {
                    const data = analysis[type];
                    const info = typeInfo[type];
                    const Icon = info.icon;
                    const isSelected = selectedType === type;

                    return (
                        <motion.div
                            key={type}
                            onClick={() => setSelectedType(isSelected ? null : type)}
                            className={`rounded-xl p-4 cursor-pointer transition-all border-2 ${isSelected
                                ? `border-${info.color}-500`
                                : 'border-transparent'
                                } ${isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-50 hover:bg-gray-100'}`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Icon className={`w-5 h-5 text-${info.color}-500`} />
                                <span className="text-sm font-medium">{info.label}</span>
                            </div>

                            <div className={`text-2xl font-bold text-${info.color}-600`}>
                                {data.count}
                            </div>

                            <div className="flex gap-2 text-[10px] mt-1">
                                <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">CE:{data.ceCount}</span>
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">PE:{data.peCount}</span>
                            </div>

                            <div className="mt-2 space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Δ-Adj OI:</span>
                                    <span className="font-medium">{formatNumber(data.deltaAdjustedOI)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Premium:</span>
                                    <span className="font-medium">{formatCurrency(data.premium)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Avg Conf:</span>
                                    <span className="font-bold">{data.avgConfidence.toFixed(0)}%</span>
                                </div>
                            </div>

                            {data.institutional > 0 && (
                                <div className="flex items-center gap-1 mt-2 p-1 bg-purple-100 dark:bg-purple-900/30 rounded text-purple-700 dark:text-purple-400 text-[10px]">
                                    <BoltIcon className="w-3 h-3" />
                                    <span className="font-bold">{data.institutional} Institutional</span>
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Expandable Details */}
            <AnimatePresence>
                {selectedType && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-gray-100 dark:border-gray-700"
                    >
                        <div className="p-4 overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className={`${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                                    <tr>
                                        <th className="py-2 px-2 text-left">Strike</th>
                                        <th className="py-2 px-2 text-center">Type</th>
                                        <th className="py-2 px-2 text-center">Impact</th>
                                        <th className="py-2 px-2 text-right">Conf</th>
                                        <th className="py-2 px-2 text-right">Delta</th>
                                        <th className="py-2 px-2 text-right">Δ-Adj OI</th>
                                        <th className="py-2 px-2 text-right">OI Chg</th>
                                        <th className="py-2 px-2 text-right">IV</th>
                                        <th className="py-2 px-2 text-right">Premium</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {analysis[selectedType].contracts.slice(0, 15).map((c, i) => (
                                        <tr key={i} className={`${c.isAnomaly ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''} ${c.isInstitutional ? 'bg-yellow-50/30 dark:bg-yellow-900/10' : ''}`}>
                                            <td className="py-2 px-2 font-bold">
                                                {c.strike}
                                                {c.isInstitutional && <BoltIcon className="w-3 h-3 text-yellow-600 inline ml-1" />}
                                                {c.isAnomaly && <BeakerIcon className="w-3 h-3 text-purple-600 inline ml-1" />}
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.type === 'CE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {c.type}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.marketImplication === 'bullish' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {c.marketImplication === 'bullish' ? '🟢' : '🔴'}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getConfidenceColor(c.confidence)}`}>
                                                    {c.confidence.toFixed(0)}%
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono">{c.delta?.toFixed(3) || '—'}</td>
                                            <td className="py-2 px-2 text-right">{formatNumber(c.deltaAdjustedOI)}</td>
                                            <td className={`py-2 px-2 text-right ${c.oiChg > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {c.oiChg > 0 ? '+' : ''}{formatNumber(c.oiChg)}
                                            </td>
                                            <td className="py-2 px-2 text-right">{c.iv?.toFixed(1) || '—'}%</td>
                                            <td className="py-2 px-2 text-right">{formatCurrency(c.premium)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Top Signals */}
            <div className={`p-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <h4 className="font-semibold text-sm mb-2 text-green-600 flex items-center gap-1">
                            <FireIcon className="w-4 h-4" /> Top Bullish
                        </h4>
                        <div className="space-y-1">
                            {summary.topBullish.slice(0, 4).map((c, i) => (
                                <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-green-50 dark:bg-green-900/20">
                                    <span className="font-bold">{c.strike} {c.type}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500">Δ:{c.delta?.toFixed(2)}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getConfidenceColor(c.confidence)}`}>
                                            {c.confidence.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm mb-2 text-red-600 flex items-center gap-1">
                            <FireIcon className="w-4 h-4" /> Top Bearish
                        </h4>
                        <div className="space-y-1">
                            {summary.topBearish.slice(0, 4).map((c, i) => (
                                <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-red-50 dark:bg-red-900/20">
                                    <span className="font-bold">{c.strike} {c.type}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500">Δ:{c.delta?.toFixed(2)}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getConfidenceColor(c.confidence)}`}>
                                            {c.confidence.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Algorithm Toggle */}
            <div className={`p-4 ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'} border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <button
                    onClick={() => setShowAlgorithm(!showAlgorithm)}
                    className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                >
                    <ShieldCheckIcon className="w-4 h-4" />
                    {showAlgorithm ? 'Hide' : 'Show'} Algorithm Details
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${showAlgorithm ? 'rotate-180' : ''}`} />
                </button>

                {showAlgorithm && (
                    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg text-xs space-y-2">
                        <div className="font-semibold text-indigo-600 mb-2">Multi-Factor Scoring Algorithm (v4)</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>• OI Magnitude: 15% (Percentile ranking)</div>
                            <div>• OI Change Z-Score: 20% (Statistical significance)</div>
                            <div>• Volume/OI Ratio: 10% (Activity confirmation)</div>
                            <div>• Premium Flow: 15% (Money flow)</div>
                            <div>• Delta Magnitude: 12% (Option significance)</div>
                            <div>• Gamma Exposure: 10% (Hedging pressure)</div>
                            <div>• IV Context: 8% (Volatility pricing)</div>
                            <div>• ATM Proximity: 10% (Price relevance)</div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-gray-500">⚡ Institutional: OI &gt;5L OR Premium &gt;50L OR Z-Score &gt;2σ</div>
                            <div className="text-gray-500">🧪 Anomaly: IQR outlier detection on OI Change and Premium</div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default BuildupAnalysisPro;

/**
 * Enhanced Net Premium Flow Chart v2
 * 
 * Advanced Data Mining with Greeks Integration
 * 
 * Features:
 * 1. DELTA-ADJUSTED PREMIUM FLOW - True directional impact
 * 2. GAMMA-WEIGHTED PREMIUM - Hedging-adjusted flow
 * 3. VEGA CONTRIBUTION - Volatility play detection
 * 4. Z-SCORE SIGNIFICANCE - Statistical signal strength
 * 5. INSTITUTIONAL DETECTION - Large premium trades
 * 6. SMART MONEY FLOW ANALYSIS - Buyer vs Writer classification
 * 7. PREMIUM VELOCITY - Rate of money flow
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    selectOptionChain, selectSpotPrice, selectATMStrike,
    selectLotSize
} from '../../context/selectors';
import {
    BanknotesIcon,
    BoltIcon, BeakerIcon, ChevronDownIcon, ShieldCheckIcon
} from '@heroicons/react/24/outline';

// ============ NIFTY 50 CALIBRATED CONFIGURATION ============
const NIFTY_CONFIG = {
    lotSize: 75,
    contractMultiplier: 75,

    // Premium thresholds
    minPremium: 100000,           // ₹1L minimum for consideration
    significantPremium: 1000000,  // ₹10L = significant
    institutionalPremium: 5000000, // ₹50L = institutional

    // Z-score thresholds
    significantZ: 1.5,
    strongZ: 2.5,
};

// ============ STATISTICAL FUNCTIONS ============
const stats = {
    mean: arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,

    stdDev: arr => {
        if (arr.length < 2) return 1;
        const m = stats.mean(arr);
        return Math.sqrt(arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / arr.length) || 1;
    },

    zScore: (value, mean, stdDev) => stdDev > 0 ? (value - mean) / stdDev : 0,

    iqr: arr => {
        if (arr.length < 4) return { q1: 0, q3: 0, iqr: 0, upperBound: Infinity };
        const sorted = [...arr].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        return { q1, q3, iqr, upperBound: q3 + 1.5 * iqr };
    },
};

// ============ FORMAT HELPERS ============
const formatCrores = (num) => {
    if (!num) return '₹0';
    const abs = Math.abs(num);
    if (abs >= 1e7) return (num < 0 ? '-' : '') + '₹' + (abs / 1e7).toFixed(2) + ' Cr';
    if (abs >= 1e5) return (num < 0 ? '-' : '') + '₹' + (abs / 1e5).toFixed(1) + ' L';
    return (num < 0 ? '-' : '') + '₹' + (abs / 1e3).toFixed(0) + ' K';
};

const formatNumber = (num) => {
    if (!num) return '0';
    const abs = Math.abs(num);
    if (abs >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
    if (abs >= 1e5) return (num / 1e5).toFixed(1) + 'L';
    if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
};

// ============ MAIN COMPONENT ============
const NetPremiumFlowChart = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize) || NIFTY_CONFIG.lotSize;

    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const [viewMode, setViewMode] = useState('all');
    const [showAlgorithm, setShowAlgorithm] = useState(false);

    // ============ CORE DATA MINING ENGINE ============
    const premiumData = useMemo(() => {
        if (!optionChain || !spotPrice) return null;

        let totalCallPremium = 0;
        let totalPutPremium = 0;
        let callBuyPremium = 0;
        let callSellPremium = 0;
        let putBuyPremium = 0;
        let putSellPremium = 0;

        // Delta-adjusted accumulators
        let deltaAdjustedBullish = 0;
        let deltaAdjustedBearish = 0;

        // Gamma-weighted accumulators
        let gammaWeightedBullish = 0;
        let gammaWeightedBearish = 0;

        // Vega contribution
        let vegaBullish = 0;
        let vegaBearish = 0;

        const strikes = [];
        const allPremiums = [];

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            const ceVol = data.ce?.vol || data.ce?.volume || 0;
            const peVol = data.pe?.vol || data.pe?.volume || 0;
            const ceLtp = data.ce?.ltp || 0;
            const peLtp = data.pe?.ltp || 0;
            const ceOiChg = data.ce?.oichng || data.ce?.oi_change || 0;
            const peOiChg = data.pe?.oichng || data.pe?.oi_change || 0;
            const cePChg = data.ce?.p_chng || 0;
            const pePChg = data.pe?.p_chng || 0;
            const ceOI = data.ce?.oi || data.ce?.OI || 0;
            const peOI = data.pe?.oi || data.pe?.OI || 0;

            // Greeks
            const ceGreeks = data.ce?.optgeeks || {};
            const peGreeks = data.pe?.optgeeks || {};
            const ceDelta = ceGreeks.delta || 0;
            const peDelta = peGreeks.delta || 0;
            const ceGamma = ceGreeks.gamma || 0;
            const peGamma = peGreeks.gamma || 0;
            const ceVega = ceGreeks.vega || 0;
            const peVega = peGreeks.vega || 0;

            const cePremium = ceVol * ceLtp * lotSize;
            const pePremium = peVol * peLtp * lotSize;

            if (cePremium < NIFTY_CONFIG.minPremium && pePremium < NIFTY_CONFIG.minPremium) return;

            totalCallPremium += cePremium;
            totalPutPremium += pePremium;

            // Determine if buying or selling based on OI and price change
            // Buy: OI↑ + Price↑ (Long Buildup) OR OI↓ + Price↓ (Long Unwinding)
            // Sell: OI↑ + Price↓ (Short Buildup) OR OI↓ + Price↑ (Short Covering)
            const ceBuy = (ceOiChg > 0 && cePChg >= 0) || (ceOiChg < 0 && cePChg < 0);
            const peBuy = (peOiChg > 0 && pePChg >= 0) || (peOiChg < 0 && pePChg < 0);

            if (ceBuy) {
                callBuyPremium += cePremium;
                deltaAdjustedBullish += Math.abs(ceDelta) * cePremium;
                gammaWeightedBullish += ceGamma * cePremium;
                vegaBullish += ceVega * ceVol * lotSize;
            } else {
                callSellPremium += cePremium;
                deltaAdjustedBearish += Math.abs(ceDelta) * cePremium;
                gammaWeightedBearish += ceGamma * cePremium;
                vegaBearish += ceVega * ceVol * lotSize;
            }

            if (peBuy) {
                putBuyPremium += pePremium;
                deltaAdjustedBearish += Math.abs(peDelta) * pePremium;
                gammaWeightedBearish += peGamma * pePremium;
                vegaBearish += peVega * peVol * lotSize;
            } else {
                putSellPremium += pePremium;
                deltaAdjustedBullish += Math.abs(peDelta) * pePremium;
                gammaWeightedBullish += peGamma * pePremium;
                vegaBullish += peVega * peVol * lotSize;
            }

            const totalStrikePremium = cePremium + pePremium;
            allPremiums.push(totalStrikePremium);

            // Check for institutional activity
            const isInstitutional = totalStrikePremium >= NIFTY_CONFIG.institutionalPremium;
            const isSignificant = totalStrikePremium >= NIFTY_CONFIG.significantPremium;

            if (cePremium > 0 || pePremium > 0) {
                strikes.push({
                    strike,
                    cePremium,
                    pePremium,
                    totalPremium: totalStrikePremium,
                    netPremium: cePremium - pePremium,
                    ceBuy,
                    peBuy,
                    ceOI,
                    peOI,
                    ceDelta,
                    peDelta,
                    ceGamma,
                    peGamma,
                    deltaAdjustedCE: Math.abs(ceDelta) * cePremium,
                    deltaAdjustedPE: Math.abs(peDelta) * pePremium,
                    isInstitutional,
                    isSignificant,
                    atmDistance: Math.abs(strike - (atmStrike || spotPrice)),
                });
            }
        });

        // Calculate z-scores for significance
        const premiumStats = {
            mean: stats.mean(allPremiums),
            std: stats.stdDev(allPremiums),
            iqr: stats.iqr(allPremiums),
        };

        // Add z-scores and anomaly flags
        const scoredStrikes = strikes.map(s => {
            const z = stats.zScore(s.totalPremium, premiumStats.mean, premiumStats.std);
            const isAnomaly = s.totalPremium > premiumStats.iqr.upperBound;
            return { ...s, zScore: z, isAnomaly };
        });

        // Sort by total premium
        scoredStrikes.sort((a, b) => b.totalPremium - a.totalPremium);

        // Calculate aggregate flows
        const netFlow = (callBuyPremium + putSellPremium) - (callSellPremium + putBuyPremium);
        const bullishFlow = callBuyPremium + putSellPremium;
        const bearishFlow = callSellPremium + putBuyPremium;
        const deltaAdjustedNet = deltaAdjustedBullish - deltaAdjustedBearish;
        const gammaWeightedNet = gammaWeightedBullish - gammaWeightedBearish;
        const vegaNet = vegaBullish - vegaBearish;

        // Confidence calculation based on multiple factors
        const flowMagnitude = Math.abs(netFlow) / (bullishFlow + bearishFlow + 1);
        const deltaConsistency = Math.sign(netFlow) === Math.sign(deltaAdjustedNet) ? 1.2 : 0.8;
        const gammaConsistency = Math.sign(netFlow) === Math.sign(gammaWeightedNet) ? 1.1 : 0.9;
        const confidence = Math.min(95, flowMagnitude * 100 * deltaConsistency * gammaConsistency);

        // Institutional activity summary
        const institutionalStrikes = scoredStrikes.filter(s => s.isInstitutional);
        const anomalyStrikes = scoredStrikes.filter(s => s.isAnomaly);

        return {
            totalCallPremium,
            totalPutPremium,
            callBuyPremium,
            callSellPremium,
            putBuyPremium,
            putSellPremium,
            netFlow,
            bullishFlow,
            bearishFlow,
            deltaAdjustedBullish,
            deltaAdjustedBearish,
            deltaAdjustedNet,
            gammaWeightedBullish,
            gammaWeightedBearish,
            gammaWeightedNet,
            vegaBullish,
            vegaBearish,
            vegaNet,
            confidence,
            topStrikes: scoredStrikes.slice(0, 12),
            institutionalCount: institutionalStrikes.length,
            anomalyCount: anomalyStrikes.length,
            premiumStats,
        };
    }, [optionChain, spotPrice, atmStrike, lotSize]);

    if (!optionChain || !premiumData) {
        return (
            <div className="p-8 text-center text-gray-400">
                <BanknotesIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const flowDirection = premiumData.netFlow > 0 ? 'bullish' : premiumData.netFlow < 0 ? 'bearish' : 'neutral';
    const maxFlow = Math.max(premiumData.bullishFlow, premiumData.bearishFlow);
    const bullishPct = maxFlow > 0 ? (premiumData.bullishFlow / maxFlow) * 100 : 50;
    const bearishPct = maxFlow > 0 ? (premiumData.bearishFlow / maxFlow) * 100 : 50;

    // Delta-adjusted direction
    const deltaDirection = premiumData.deltaAdjustedNet > 0 ? 'bullish' : premiumData.deltaAdjustedNet < 0 ? 'bearish' : 'neutral';
    const signalsAligned = flowDirection === deltaDirection;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            {/* Main Flow Header */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                <div className={`p-6 bg-gradient-to-r ${flowDirection === 'bullish' ? 'from-green-500 to-emerald-600' :
                    flowDirection === 'bearish' ? 'from-red-500 to-rose-600' : 'from-gray-500 to-gray-600'
                    } text-white`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <BanknotesIcon className="w-8 h-8" />
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    Net Premium Flow v2
                                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Greeks-Powered</span>
                                </h2>
                                <div className="text-sm opacity-80">
                                    {signalsAligned ? '✓ Signals Aligned' : '⚠️ Mixed Signals'}
                                    <span className="ml-2 text-xs bg-white/10 px-1.5 py-0.5 rounded">
                                        {premiumData.confidence.toFixed(0)}% conf
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold">
                                {premiumData.netFlow > 0 ? '+' : ''}{formatCrores(premiumData.netFlow)}
                            </div>
                            <div className="text-xs opacity-80">Net Premium Flow</div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-5 gap-2 text-xs">
                        <div className="text-center p-2 bg-white/10 rounded-lg">
                            <div className="font-bold">{formatCrores(premiumData.deltaAdjustedNet)}</div>
                            <div className="opacity-70">Δ-Adjusted</div>
                        </div>
                        <div className="text-center p-2 bg-white/10 rounded-lg">
                            <div className="font-bold">{formatNumber(premiumData.gammaWeightedNet)}</div>
                            <div className="opacity-70">γ-Weighted</div>
                        </div>
                        <div className="text-center p-2 bg-white/10 rounded-lg">
                            <div className="font-bold">{formatNumber(premiumData.vegaNet)}</div>
                            <div className="opacity-70">Vega Flow</div>
                        </div>
                        <div className="text-center p-2 bg-white/10 rounded-lg">
                            <div className="font-bold flex items-center justify-center gap-1">
                                {premiumData.institutionalCount}
                                <BoltIcon className="w-3 h-3" />
                            </div>
                            <div className="opacity-70">Institutional</div>
                        </div>
                        <div className="text-center p-2 bg-white/10 rounded-lg">
                            <div className="font-bold flex items-center justify-center gap-1">
                                {premiumData.anomalyCount}
                                <BeakerIcon className="w-3 h-3" />
                            </div>
                            <div className="opacity-70">Anomalies</div>
                        </div>
                    </div>
                </div>

                {/* Tug of War Bar */}
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-green-600 font-bold w-12">BULLS</span>
                        <div className="flex-1 h-7 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 flex items-center justify-end pr-2 text-[10px] text-white font-bold"
                                style={{ width: `${bullishPct}%` }}
                            >
                                {formatCrores(premiumData.bullishFlow)}
                            </div>
                            <div
                                className="h-full bg-gradient-to-l from-red-500 to-rose-400 flex items-center justify-start pl-2 text-[10px] text-white font-bold"
                                style={{ width: `${bearishPct}%` }}
                            >
                                {formatCrores(premiumData.bearishFlow)}
                            </div>
                        </div>
                        <span className="text-xs text-red-600 font-bold w-12 text-right">BEARS</span>
                    </div>
                    <div className="text-center text-[10px] text-gray-500">
                        Bullish = Call Buy + Put Sell | Bearish = Call Sell + Put Buy
                    </div>
                </div>
            </div>

            {/* Premium Breakdown Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`rounded-xl p-4 border ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'}`}>
                    <div className="text-[10px] text-green-600 mb-1">Call Buy Premium</div>
                    <div className="text-lg font-bold text-green-700">{formatCrores(premiumData.callBuyPremium)}</div>
                    <div className="text-[9px] text-green-500">🐂 Bullish</div>
                </div>
                <div className={`rounded-xl p-4 border ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
                    <div className="text-[10px] text-red-600 mb-1">Call Sell Premium</div>
                    <div className="text-lg font-bold text-red-700">{formatCrores(premiumData.callSellPremium)}</div>
                    <div className="text-[9px] text-red-500">🐻 Bearish</div>
                </div>
                <div className={`rounded-xl p-4 border ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'}`}>
                    <div className="text-[10px] text-green-600 mb-1">Put Sell Premium</div>
                    <div className="text-lg font-bold text-green-700">{formatCrores(premiumData.putSellPremium)}</div>
                    <div className="text-[9px] text-green-500">🐂 Bullish</div>
                </div>
                <div className={`rounded-xl p-4 border ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
                    <div className="text-[10px] text-red-600 mb-1">Put Buy Premium</div>
                    <div className="text-lg font-bold text-red-700">{formatCrores(premiumData.putBuyPremium)}</div>
                    <div className="text-[9px] text-red-500">🐻 Bearish</div>
                </div>
            </div>

            {/* Top Premium Strikes */}
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Top Premium Strikes</h3>
                    <div className="flex gap-1">
                        {['all', 'institutional', 'anomaly'].map(mode => (
                            <button key={mode} onClick={() => setViewMode(mode)}
                                className={`px-2 py-0.5 rounded text-[10px] ${viewMode === mode ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'}`}>
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4">
                    <table className="w-full text-xs">
                        <thead className={`${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                            <tr>
                                <th className="py-2 px-2 text-left">Strike</th>
                                <th className="py-2 px-2 text-center">Flow</th>
                                <th className="py-2 px-2 text-right">CE Premium</th>
                                <th className="py-2 px-2 text-right">PE Premium</th>
                                <th className="py-2 px-2 text-right">Δ-Adj</th>
                                <th className="py-2 px-2 text-right">Z-Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {premiumData.topStrikes
                                .filter(s => viewMode === 'all' ||
                                    (viewMode === 'institutional' && s.isInstitutional) ||
                                    (viewMode === 'anomaly' && s.isAnomaly))
                                .slice(0, 10)
                                .map((s, i) => (
                                    <tr key={i} className={`${s.isAnomaly ? 'bg-purple-50/30 dark:bg-purple-900/10' : ''} ${s.isInstitutional ? 'bg-yellow-50/20 dark:bg-yellow-900/5' : ''}`}>
                                        <td className="py-2 px-2 font-bold">
                                            {s.strike}
                                            {s.isInstitutional && <BoltIcon className="w-3 h-3 text-yellow-500 inline ml-1" />}
                                            {s.isAnomaly && <BeakerIcon className="w-3 h-3 text-purple-500 inline ml-1" />}
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                            <div className="flex justify-center gap-1">
                                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${s.ceBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    CE {s.ceBuy ? 'B' : 'S'}
                                                </span>
                                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${s.peBuy ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    PE {s.peBuy ? 'B' : 'S'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-2 text-right text-green-600">{formatCrores(s.cePremium)}</td>
                                        <td className="py-2 px-2 text-right text-red-600">{formatCrores(s.pePremium)}</td>
                                        <td className="py-2 px-2 text-right">{formatCrores(s.deltaAdjustedCE + s.deltaAdjustedPE)}</td>
                                        <td className="py-2 px-2 text-right">
                                            <span className={`font-mono ${s.zScore >= 2.5 ? 'text-purple-600 font-bold' : s.zScore >= 1.5 ? 'text-blue-600' : ''}`}>
                                                {s.zScore.toFixed(2)}σ
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Algorithm Toggle */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'} border ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <button
                    onClick={() => setShowAlgorithm(!showAlgorithm)}
                    className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                >
                    <ShieldCheckIcon className="w-4 h-4" />
                    {showAlgorithm ? 'Hide' : 'Show'} Premium Flow Algorithm
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${showAlgorithm ? 'rotate-180' : ''}`} />
                </button>

                {showAlgorithm && (
                    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg text-xs space-y-2">
                        <div className="font-semibold text-indigo-600 mb-2">Premium Flow Classification</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>• Call Buy (OI↑ + Price↑) = Bullish</div>
                            <div>• Call Sell (OI↑ + Price↓) = Bearish</div>
                            <div>• Put Sell (OI↑ + Price↓) = Bullish</div>
                            <div>• Put Buy (OI↑ + Price↑) = Bearish</div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500">
                            <div>⚡ Institutional: Premium &gt;₹50L</div>
                            <div>🧪 Anomaly: IQR outlier on premium</div>
                            <div>✓ Signals Aligned: Raw flow matches Δ-adjusted flow</div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default NetPremiumFlowChart;

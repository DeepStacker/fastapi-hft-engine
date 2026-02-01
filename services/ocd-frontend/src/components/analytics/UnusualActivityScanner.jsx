/**
 * Enhanced Unusual OI Activity Scanner v2
 * 
 * Advanced Data Mining with Full Greeks Integration
 * 
 * Features:
 * 1. DELTA-ADJUSTED OI - True exposure in underlying terms
 * 2. GAMMA EXPOSURE (GEX) - Market maker hedging pressure  
 * 3. VEGA CONTRIBUTION - Volatility sensitivity weighting
 * 4. Z-SCORE STATISTICAL ANALYSIS - Multi-factor outlier detection
 * 5. IQR ANOMALY DETECTION - Interquartile range outliers
 * 6. 10-FACTOR WEIGHTED SCORING - Comprehensive signal quality
 * 7. INSTITUTIONAL DETECTION - High-value activity flagging
 * 8. SMART MONEY FLOW ANALYSIS - Buyer vs Writer positioning
 */
import { useMemo, useState, memo } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    selectOptionChain, selectSpotPrice, selectATMStrike,
    selectLotSize, selectATMIV
} from '../../context/selectors';
import {
    EyeIcon, FunnelIcon, ShieldCheckIcon,
    BoltIcon, BeakerIcon, CpuChipIcon, ChevronDownIcon
} from '@heroicons/react/24/outline';

// ============ NIFTY 50 CALIBRATED CONFIGURATION ============
const NIFTY_CONFIG = {
    lotSize: 75,
    contractMultiplier: 75,

    // Minimum thresholds to qualify as "unusual" (NIFTY 50 specific)
    minOI: 30000,                  // Min OI to consider
    minOIChange: 8000,             // Min OI change to be significant
    minVolume: 2000,               // Min volume to consider
    minPremium: 300000,            // Min premium traded (₹3L)

    // Institutional thresholds
    institutionalOI: 500000,       // 5L+ OI = institutional
    institutionalPremium: 10000000, // ₹1Cr+ premium = institutional
    institutionalOIChange: 100000, // 1L+ OI change = institutional

    // Greeks thresholds
    deltaThreshold: 0.15,          // Min delta for significance
    gammaThreshold: 0.0005,        // Min gamma for hedging impact
    vegaThreshold: 5,              // Min vega for vol sensitivity
};

// ============ SCORING WEIGHTS (Total = 100%) ============
const SCORING_WEIGHTS = {
    oiChange: 0.20,        // OI change z-score
    deltaAdjustedOI: 0.15, // Delta-weighted exposure
    gammaExposure: 0.12,   // GEX for hedging pressure
    volume: 0.12,          // Volume spike
    premiumValue: 0.15,    // Money flow
    volOIRatio: 0.08,      // Intraday activity
    atmProximity: 0.08,    // Price relevance
    ivDeviation: 0.05,     // IV premium
    vegaContrib: 0.05,     // Volatility sensitivity
};

// Confidence thresholds
const CONFIDENCE_LEVELS = {
    VERY_HIGH: 78,
    HIGH: 60,
    MEDIUM: 45,
    LOW: 30,
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

    // IQR for outlier detection
    iqr: arr => {
        if (arr.length < 4) return { q1: 0, q3: 0, iqr: 0, upperBound: Infinity };
        const sorted = [...arr].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        return { q1, q3, iqr, upperBound: q3 + 1.5 * iqr };
    },

    percentile: (value, sortedArr) => {
        if (sortedArr.length === 0) return 50;
        const idx = sortedArr.findIndex(v => v >= value);
        return idx === -1 ? 100 : (idx / sortedArr.length) * 100;
    },

    // Normalize z-score to 0-100 scale
    normalize: z => Math.min(100, Math.max(0, z * 25 + 40)),
};

// ============ FORMAT HELPERS ============
const formatNumber = (num) => {
    if (!num) return '0';
    const abs = Math.abs(num);
    if (abs >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
    if (abs >= 1e5) return (num / 1e5).toFixed(2) + 'L';
    if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
};

const formatCurrency = (num) => {
    if (!num) return '₹0';
    const abs = Math.abs(num);
    if (abs >= 1e7) return '₹' + (num / 1e7).toFixed(1) + 'Cr';
    if (abs >= 1e5) return '₹' + (num / 1e5).toFixed(1) + 'L';
    if (abs >= 1e3) return '₹' + (num / 1e3).toFixed(0) + 'K';
    return '₹' + num.toFixed(0);
};

// ============ MARKET IMPLICATION MATRIX ============
const MARKET_IMPLICATION = {
    CE: { LB: 'bullish', SB: 'bearish', SC: 'bullish', LU: 'bearish' },
    PE: { LB: 'bearish', SB: 'bullish', SC: 'bearish', LU: 'bullish' },
};

// ============ BUILDUP CLASSIFIER ============
const classifyBuildup = (pChgPct, oiChg) => {
    const priceUp = pChgPct > 0.5;
    const priceDown = pChgPct < -0.5;

    if (priceUp && oiChg > 0) return { code: 'LB', name: 'Long Buildup' };
    if (priceDown && oiChg > 0) return { code: 'SB', name: 'Short Buildup' };
    if (priceUp && oiChg < 0) return { code: 'SC', name: 'Short Covering' };
    if (priceDown && oiChg < 0) return { code: 'LU', name: 'Long Unwinding' };
    return { code: 'NT', name: 'Neutral' };
};

// ============ SIGNAL ANALYSIS WITH GREEKS ============
const analyzeSignal = (contract) => {
    const { type, buildup, delta } = contract;
    const code = buildup.code;

    if (code === 'NT') {
        return {
            signal: 'neutral',
            interpretation: 'No significant directional activity',
            marketImpact: 'neutral',
        };
    }

    const marketImpact = MARKET_IMPLICATION[type]?.[code] || 'neutral';

    const interpretations = {
        CE: {
            LB: 'Call buyers entering - expecting upside',
            SB: 'Call writers capping - expecting sideways/down',
            SC: 'Call writers exiting - could accelerate up',
            LU: 'Call longs exiting - upside hope fading',
        },
        PE: {
            LB: 'Put buyers entering - expecting downside',
            SB: 'Put writers supporting - expecting stability',
            SC: 'Put writers exiting - could accelerate down',
            LU: 'Put longs exiting - downside fear fading',
        },
    };

    // Delta context adds meaning
    const deltaStr = delta ? ` (Δ=${Math.abs(delta).toFixed(2)})` : '';

    return {
        signal: marketImpact,
        interpretation: interpretations[type]?.[code] + deltaStr || 'Activity detected',
        marketImpact,
    };
};

// ============ MAIN COMPONENT ============
const UnusualActivityScanner = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize) || NIFTY_CONFIG.lotSize;
    const _atmIV = useSelector(selectATMIV);

    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const [filter, setFilter] = useState('high');
    const [minConfidence, setMinConfidence] = useState(50);
    const [showDetails, setShowDetails] = useState(null);
    const [showAlgorithm, setShowAlgorithm] = useState(false);

    // ============ CORE DATA MINING ENGINE ============
    const { scoredContracts, summaryStats, benchmarks: _benchmarks } = useMemo(() => {
        if (!optionChain || !spotPrice) return { scoredContracts: [], summaryStats: {}, benchmarks: {} };

        const allContracts = [];
        const atm = atmStrike || spotPrice;

        // Step 1: Extract and enrich all contract data
        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            ['ce', 'pe'].forEach(optType => {
                const leg = data[optType];
                if (!leg) return;

                const oi = leg.oi || leg.OI || 0;
                const oiChg = leg.oichng || leg.oi_change || 0;
                const vol = leg.vol || leg.volume || 0;
                const ltp = leg.ltp || 0;
                const pChg = leg.p_chng || 0;
                const iv = leg.iv || 0;
                const greeks = leg.optgeeks || {};

                // Apply minimum filters
                if (oi < NIFTY_CONFIG.minOI) return;
                if (Math.abs(oiChg) < NIFTY_CONFIG.minOIChange && vol < NIFTY_CONFIG.minVolume) return;

                const pChgPct = ltp > 0 ? (pChg / ltp * 100) : 0;
                const premium = vol * ltp * lotSize;
                const volOIRatio = oi > 0 ? (vol / oi * 100) : 0;
                const atmDistance = Math.abs(strike - atm);

                // Greeks-derived metrics
                const delta = greeks.delta || 0;
                const gamma = greeks.gamma || 0;
                const vega = greeks.vega || 0;
                const theta = greeks.theta || 0;

                // Advanced calculations
                const deltaAdjustedOI = Math.abs(delta) * oi * NIFTY_CONFIG.contractMultiplier;
                const gammaExposure = gamma * oi * NIFTY_CONFIG.contractMultiplier * spotPrice / 100;
                const vegaContribution = Math.abs(vega) * oi * lotSize;

                // Classify buildup
                const buildup = classifyBuildup(pChgPct, oiChg);

                allContracts.push({
                    strike,
                    type: optType.toUpperCase(),
                    oi,
                    oiChg,
                    oiChgAbs: Math.abs(oiChg),
                    oiChgPct: oi > 0 ? (oiChg / oi * 100) : 0,
                    vol,
                    volOIRatio,
                    ltp,
                    pChg,
                    pChgPct,
                    iv,
                    premium,
                    atmDistance,
                    delta,
                    gamma,
                    vega,
                    theta,
                    deltaAdjustedOI,
                    gammaExposure,
                    vegaContribution,
                    buildup,
                });
            });
        });

        if (allContracts.length === 0) return { scoredContracts: [], summaryStats: {}, benchmarks: {} };

        // Step 2: Calculate statistical benchmarks
        const oiChanges = allContracts.map(c => c.oiChgAbs).filter(v => v > 0);
        const volumes = allContracts.map(c => c.vol).filter(v => v > 0);
        const volOIRatios = allContracts.map(c => c.volOIRatio).filter(v => v > 0);
        const premiums = allContracts.map(c => c.premium).filter(v => v > 0);
        const ivs = allContracts.map(c => c.iv).filter(v => v > 0);
        const deltaOIs = allContracts.map(c => c.deltaAdjustedOI).filter(v => v > 0);
        const gexValues = allContracts.map(c => Math.abs(c.gammaExposure)).filter(v => v > 0);
        const vegaValues = allContracts.map(c => c.vegaContribution).filter(v => v > 0);

        const benchmarks = {
            oiChg: { mean: stats.mean(oiChanges), std: stats.stdDev(oiChanges), iqr: stats.iqr(oiChanges) },
            vol: { mean: stats.mean(volumes), std: stats.stdDev(volumes) },
            volOI: { mean: stats.mean(volOIRatios), std: stats.stdDev(volOIRatios) },
            premium: { mean: stats.mean(premiums), std: stats.stdDev(premiums), iqr: stats.iqr(premiums) },
            iv: { mean: stats.mean(ivs), std: stats.stdDev(ivs) },
            deltaOI: { mean: stats.mean(deltaOIs), std: stats.stdDev(deltaOIs) },
            gex: { mean: stats.mean(gexValues), std: stats.stdDev(gexValues) },
            vega: { mean: stats.mean(vegaValues), std: stats.stdDev(vegaValues) },
        };

        // Step 3: Score each contract using 10-factor analysis
        const scored = allContracts.map(c => {
            const factors = {};
            let totalScore = 0;

            // Factor 1: OI Change Z-Score (20%)
            const oiZ = stats.zScore(c.oiChgAbs, benchmarks.oiChg.mean, benchmarks.oiChg.std);
            factors.oiChange = { z: oiZ, score: stats.normalize(oiZ), weight: 20 };
            totalScore += factors.oiChange.score * SCORING_WEIGHTS.oiChange;

            // Factor 2: Delta-Adjusted OI (15%)
            const deltaZ = stats.zScore(c.deltaAdjustedOI, benchmarks.deltaOI.mean, benchmarks.deltaOI.std);
            factors.deltaOI = { z: deltaZ, score: stats.normalize(deltaZ), weight: 15 };
            totalScore += factors.deltaOI.score * SCORING_WEIGHTS.deltaAdjustedOI;

            // Factor 3: Gamma Exposure (12%)
            const gexZ = stats.zScore(Math.abs(c.gammaExposure), benchmarks.gex.mean, benchmarks.gex.std);
            factors.gammaExp = { z: gexZ, score: stats.normalize(gexZ), weight: 12 };
            totalScore += factors.gammaExp.score * SCORING_WEIGHTS.gammaExposure;

            // Factor 4: Volume Spike (12%)
            const volZ = stats.zScore(c.vol, benchmarks.vol.mean, benchmarks.vol.std);
            factors.volume = { z: volZ, score: stats.normalize(volZ), weight: 12 };
            totalScore += factors.volume.score * SCORING_WEIGHTS.volume;

            // Factor 5: Premium Value (15%)
            const premZ = stats.zScore(c.premium, benchmarks.premium.mean, benchmarks.premium.std);
            factors.premium = { z: premZ, score: stats.normalize(premZ), weight: 15 };
            totalScore += factors.premium.score * SCORING_WEIGHTS.premiumValue;

            // Factor 6: Vol/OI Ratio (8%)
            const volOIZ = stats.zScore(c.volOIRatio, benchmarks.volOI.mean, benchmarks.volOI.std);
            factors.volOI = { z: volOIZ, score: stats.normalize(volOIZ), weight: 8 };
            totalScore += factors.volOI.score * SCORING_WEIGHTS.volOIRatio;

            // Factor 7: ATM Proximity (8%)
            const atmScore = Math.max(0, 100 - (c.atmDistance / 3));
            factors.atm = { z: 0, score: atmScore, weight: 8 };
            totalScore += atmScore * SCORING_WEIGHTS.atmProximity;

            // Factor 8: IV Deviation (5%)
            const ivZ = Math.abs(stats.zScore(c.iv, benchmarks.iv.mean, benchmarks.iv.std));
            factors.iv = { z: ivZ, score: stats.normalize(ivZ), weight: 5 };
            totalScore += factors.iv.score * SCORING_WEIGHTS.ivDeviation;

            // Factor 9: Vega Contribution (5%)
            const vegaZ = stats.zScore(c.vegaContribution, benchmarks.vega.mean, benchmarks.vega.std);
            factors.vega = { z: vegaZ, score: stats.normalize(vegaZ), weight: 5 };
            totalScore += factors.vega.score * SCORING_WEIGHTS.vegaContrib;

            // Confidence multipliers
            let confidenceMultiplier = 1.0;

            // OI quality bonus
            if (c.oi >= NIFTY_CONFIG.institutionalOI) confidenceMultiplier *= 1.15;
            else if (c.oi >= 200000) confidenceMultiplier *= 1.08;

            // Institutional premium bonus
            if (c.premium >= NIFTY_CONFIG.institutionalPremium) confidenceMultiplier *= 1.12;
            else if (c.premium >= 5000000) confidenceMultiplier *= 1.05;

            // Delta significance (ATM options more meaningful)
            const deltaAbs = Math.abs(c.delta);
            if (deltaAbs >= 0.35 && deltaAbs <= 0.65) confidenceMultiplier *= 1.10; // Near ATM

            // OI change significance
            if (Math.abs(c.oiChgPct) > 20) confidenceMultiplier *= 1.08;

            const finalScore = Math.min(100, totalScore * confidenceMultiplier);

            // Anomaly detection (IQR outlier)
            const isAnomaly =
                c.oiChgAbs > benchmarks.oiChg.iqr.upperBound ||
                c.premium > benchmarks.premium.iqr.upperBound;

            // Institutional detection
            const isInstitutional =
                c.oi >= NIFTY_CONFIG.institutionalOI ||
                c.premium >= NIFTY_CONFIG.institutionalPremium ||
                c.oiChgAbs >= NIFTY_CONFIG.institutionalOIChange;

            // Trust level classification
            let trustLevel, trustLabel;
            if (finalScore >= CONFIDENCE_LEVELS.VERY_HIGH) { trustLevel = 4; trustLabel = 'Very High'; }
            else if (finalScore >= CONFIDENCE_LEVELS.HIGH) { trustLevel = 3; trustLabel = 'High'; }
            else if (finalScore >= CONFIDENCE_LEVELS.MEDIUM) { trustLevel = 2; trustLabel = 'Medium'; }
            else { trustLevel = 1; trustLabel = 'Low'; }

            // Signal analysis with Greeks context
            const signalAnalysis = analyzeSignal({ ...c, buildup: c.buildup });

            return {
                ...c,
                score: finalScore,
                trustLevel,
                trustLabel,
                factors,
                isAnomaly,
                isInstitutional,
                ...signalAnalysis,
            };
        });

        // Sort by score
        const sorted = scored.sort((a, b) => b.score - a.score);

        // Calculate summary stats
        const highConf = sorted.filter(s => s.score >= CONFIDENCE_LEVELS.HIGH);
        const summaryStats = {
            total: sorted.length,
            highConfidence: highConf.length,
            veryHigh: sorted.filter(s => s.score >= CONFIDENCE_LEVELS.VERY_HIGH).length,
            institutional: sorted.filter(s => s.isInstitutional).length,
            anomalies: sorted.filter(s => s.isAnomaly).length,
            bullish: highConf.filter(s => s.marketImpact === 'bullish').length,
            bearish: highConf.filter(s => s.marketImpact === 'bearish').length,
            avgPremium: stats.mean(highConf.map(h => h.premium)),
            totalDeltaExposure: {
                bullish: sorted.filter(s => s.marketImpact === 'bullish').reduce((s, c) => s + c.deltaAdjustedOI, 0),
                bearish: sorted.filter(s => s.marketImpact === 'bearish').reduce((s, c) => s + c.deltaAdjustedOI, 0),
            },
        };

        return { scoredContracts: sorted, summaryStats, benchmarks };
    }, [optionChain, spotPrice, atmStrike, lotSize]);

    // Filter data
    const filteredData = useMemo(() => {
        return scoredContracts.filter(item => {
            if (item.score < minConfidence) return false;
            if (filter === 'calls' && item.type !== 'CE') return false;
            if (filter === 'puts' && item.type !== 'PE') return false;
            if (filter === 'bullish' && item.marketImpact !== 'bullish') return false;
            if (filter === 'bearish' && item.marketImpact !== 'bearish') return false;
            if (filter === 'high' && item.trustLevel < 3) return false;
            if (filter === 'institutional' && !item.isInstitutional) return false;
            if (filter === 'anomaly' && !item.isAnomaly) return false;
            return true;
        }).slice(0, 30);
    }, [scoredContracts, filter, minConfidence]);

    // ============ UI RENDERING ============
    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <EyeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const getScoreColor = (score) => {
        if (score >= 80) return 'from-red-500 to-orange-500';
        if (score >= 65) return 'from-orange-500 to-amber-500';
        if (score >= 50) return 'from-amber-500 to-yellow-500';
        return 'from-gray-400 to-gray-500';
    };

    const getTrustBadge = (level, label) => {
        const styles = {
            4: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg',
            3: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white',
            2: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
            1: 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200',
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[level]}`}>
                {label}
            </span>
        );
    };

    const getSignalBadge = (signal, buildup) => {
        if (signal === 'bullish') {
            return (
                <div className="flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        🟢 {buildup.name}
                    </span>
                </div>
            );
        }
        if (signal === 'bearish') {
            return (
                <div className="flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                        🔴 {buildup.name}
                    </span>
                </div>
            );
        }
        return <span className="text-gray-400 text-xs">Neutral</span>;
    };

    // Sentiment calculation
    const deltaExposure = summaryStats.totalDeltaExposure || { bullish: 0, bearish: 0 };
    const totalExposure = deltaExposure.bullish + deltaExposure.bearish;
    const sentimentPct = totalExposure > 0 ? (deltaExposure.bullish / totalExposure) * 100 : 50;
    const sentimentLabel = sentimentPct >= 60 ? 'Bullish' : sentimentPct <= 40 ? 'Bearish' : 'Mixed';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}
        >
            {/* Header */}
            <div className={`px-6 py-4 bg-gradient-to-r ${getScoreColor(sentimentPct)}`}>
                <div className="flex items-center justify-between text-white">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <CpuChipIcon className="w-6 h-6" />
                            Unusual Activity Scanner v2
                        </h2>
                        <p className="text-sm opacity-80">Greeks + Data Mining + Statistical Analysis</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold">{summaryStats.highConfidence || 0} Signals</div>
                        <div className="text-sm opacity-80">{summaryStats.institutional || 0} Institutional</div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-5 gap-2 mt-3 text-xs text-white">
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{sentimentPct.toFixed(0)}%</div>
                        <div className="opacity-70">{sentimentLabel}</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summaryStats.bullish || 0}</div>
                        <div className="opacity-70">🟢 Bullish</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summaryStats.bearish || 0}</div>
                        <div className="opacity-70">🔴 Bearish</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summaryStats.anomalies || 0}</div>
                        <div className="opacity-70">🧪 Anomalies</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{formatCurrency(summaryStats.avgPremium)}</div>
                        <div className="opacity-70">Avg Premium</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className={`p-3 flex flex-wrap gap-2 items-center border-b ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                <FunnelIcon className="w-4 h-4 text-gray-500" />
                {['all', 'high', 'institutional', 'anomaly', 'bullish', 'bearish', 'calls', 'puts'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filter === f
                            ? 'bg-blue-500 text-white'
                            : isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}

                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-gray-500">Min:</span>
                    <input
                        type="range"
                        min="30"
                        max="80"
                        value={minConfidence}
                        onChange={(e) => setMinConfidence(Number(e.target.value))}
                        className="w-20 h-1"
                    />
                    <span className="text-xs font-bold w-8">{minConfidence}%</span>
                </div>
            </div>

            {/* Results Table */}
            <div className="p-4 overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className={`${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                        <tr>
                            <th className="py-2 px-2 text-left">Strike</th>
                            <th className="py-2 px-2 text-center">Type</th>
                            <th className="py-2 px-2 text-center">Signal</th>
                            <th className="py-2 px-2 text-center">Trust</th>
                            <th className="py-2 px-2 text-right">Score</th>
                            <th className="py-2 px-2 text-right">Delta</th>
                            <th className="py-2 px-2 text-right">Δ-Adj OI</th>
                            <th className="py-2 px-2 text-right">OI Chg</th>
                            <th className="py-2 px-2 text-right">Vol</th>
                            <th className="py-2 px-2 text-right">Premium</th>
                            <th className="py-2 px-2 text-right">IV</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredData.map((item, i) => (
                            <motion.tr
                                key={`${item.strike}-${item.type}-${i}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.02 }}
                                onClick={() => setShowDetails(showDetails === i ? null : i)}
                                className={`cursor-pointer transition-colors ${showDetails === i ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                    } ${item.isAnomaly ? 'bg-purple-50/30 dark:bg-purple-900/10' : ''} ${item.isInstitutional ? 'bg-yellow-50/20 dark:bg-yellow-900/5' : ''}`}
                            >
                                <td className="py-2 px-2 font-bold">
                                    {item.strike}
                                    {item.isInstitutional && <BoltIcon className="w-3 h-3 text-yellow-500 inline ml-1" />}
                                    {item.isAnomaly && <BeakerIcon className="w-3 h-3 text-purple-500 inline ml-1" />}
                                </td>
                                <td className="py-2 px-2 text-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.type === 'CE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {item.type}
                                    </span>
                                </td>
                                <td className="py-2 px-2 text-center">
                                    {getSignalBadge(item.marketImpact, item.buildup)}
                                </td>
                                <td className="py-2 px-2 text-center">
                                    {getTrustBadge(item.trustLevel, item.trustLabel)}
                                </td>
                                <td className="py-2 px-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-gradient-to-r ${getScoreColor(item.score)}`}
                                                style={{ width: `${item.score}%` }}
                                            />
                                        </div>
                                        <span className="font-bold">{item.score.toFixed(0)}</span>
                                    </div>
                                </td>
                                <td className="py-2 px-2 text-right font-mono">{item.delta?.toFixed(3) || '—'}</td>
                                <td className="py-2 px-2 text-right">{formatNumber(item.deltaAdjustedOI)}</td>
                                <td className={`py-2 px-2 text-right ${item.oiChg > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.oiChg > 0 ? '+' : ''}{formatNumber(item.oiChg)}
                                </td>
                                <td className="py-2 px-2 text-right">{formatNumber(item.vol)}</td>
                                <td className="py-2 px-2 text-right font-medium">{formatCurrency(item.premium)}</td>
                                <td className="py-2 px-2 text-right">{item.iv?.toFixed(1) || '—'}%</td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Expandable Details */}
            <AnimatePresence>
                {showDetails !== null && filteredData[showDetails] && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`border-t ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'}`}
                    >
                        <div className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-700">
                                    <div className="text-xs text-gray-500">Interpretation</div>
                                    <div className="text-sm font-medium">{filteredData[showDetails].interpretation}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-700">
                                    <div className="text-xs text-gray-500">Gamma Exposure</div>
                                    <div className="text-sm font-medium">{formatNumber(filteredData[showDetails].gammaExposure)}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-700">
                                    <div className="text-xs text-gray-500">Vega Contribution</div>
                                    <div className="text-sm font-medium">{formatNumber(filteredData[showDetails].vegaContribution)}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-700">
                                    <div className="text-xs text-gray-500">Vol/OI Ratio</div>
                                    <div className="text-sm font-medium">{filteredData[showDetails].volOIRatio.toFixed(1)}%</div>
                                </div>
                            </div>

                            {/* Factor Breakdown */}
                            <div className="text-xs font-semibold mb-2 text-gray-600">Factor Breakdown</div>
                            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                {Object.entries(filteredData[showDetails].factors).map(([key, data]) => (
                                    <div key={key} className="p-2 rounded bg-white dark:bg-slate-700">
                                        <div className="text-[10px] text-gray-500 capitalize">{key}</div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-full h-1 bg-gray-200 dark:bg-gray-600 rounded-full">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{ width: `${data.score}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold">{data.score.toFixed(0)}</span>
                                        </div>
                                        {data.z !== 0 && <div className="text-[9px] text-gray-400">{data.z.toFixed(2)}σ</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                        <div className="font-semibold text-indigo-600 mb-2">10-Factor Scoring Algorithm (v2)</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>• OI Change Z-Score: 20%</div>
                            <div>• Delta-Adjusted OI: 15%</div>
                            <div>• Premium Flow: 15%</div>
                            <div>• Gamma Exposure: 12%</div>
                            <div>• Volume Spike: 12%</div>
                            <div>• Vol/OI Ratio: 8%</div>
                            <div>• ATM Proximity: 8%</div>
                            <div>• Vega Contribution: 5%</div>
                            <div>• IV Deviation: 5%</div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500">
                            <div>⚡ Institutional: OI &gt;5L OR Premium &gt;₹1Cr OR ΔOI &gt;1L</div>
                            <div>🧪 Anomaly: IQR outlier on OI Change or Premium</div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// ============ SUB COMPONENTS ============
const FactorBar = memo(({ label, score, weight }) => (
    <div className="flex items-center gap-2">
        <span className="text-[9px] text-gray-500 w-14">{label} ({weight})</span>
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${score}%` }}
            />
        </div>
        <span className="text-[9px] font-medium w-6">{score}</span>
    </div>
));

FactorBar.displayName = 'FactorBar';

export default UnusualActivityScanner;

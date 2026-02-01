/**
 * Enhanced Volume Spike Detection Component v2
 * 
 * Advanced Data Mining with Full Greeks Integration
 * 
 * Features:
 * 1. Z-SCORE STATISTICAL ANALYSIS - Multi-dimension spike detection
 * 2. DELTA-WEIGHTED VOLUME - True market impact measurement
 * 3. GAMMA EXPOSURE ANALYSIS - MM hedging implications
 * 4. IQR ANOMALY DETECTION - Interquartile range outliers
 * 5. VEGA CONTRIBUTION - Volatility sensitivity
 * 6. 8-FACTOR COMPOSITE SCORING - Comprehensive signal quality
 * 7. INSTITUTIONAL DETECTION - High-value activity flagging
 * 8. SMART MONEY FLOW - Buyer vs Writer analysis
 */
import { useMemo, useState, memo } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    selectOptionChain, selectSpotPrice, selectATMStrike,
    selectLotSize, selectATMIV
} from '../../context/selectors';
import {
    BoltIcon, ChartBarIcon, FunnelIcon,
    ShieldCheckIcon, BeakerIcon, ChevronDownIcon
} from '@heroicons/react/24/outline';

// ============ NIFTY 50 CALIBRATED CONFIGURATION ============
const NIFTY_CONFIG = {
    lotSize: 75,
    contractMultiplier: 75,

    // Minimum thresholds (filter noise)
    minVolume: 3000,
    minOI: 25000,
    minPremium: 200000,       // ₹2L

    // Institutional thresholds
    institutionalVolume: 50000,    // 50K lots in-session
    institutionalPremium: 10000000, // ₹1Cr
    institutionalOI: 300000,        // 3L OI

    // Z-score thresholds
    minZScore: 1.3,           // Minimum z-score to qualify as spike
    highZScore: 2.2,          // High confidence spike
    extremeZScore: 3.0,       // Extreme spike (rare)
};

// ============ SCORING WEIGHTS ============
const SCORING_WEIGHTS = {
    volume: 0.25,            // Volume z-score
    deltaVolume: 0.18,       // Delta-weighted volume
    gammaExposure: 0.12,     // GEX impact
    premium: 0.15,           // Money flow
    volOIRatio: 0.12,        // Activity intensity
    atmProximity: 0.08,      // Price relevance
    vegaContrib: 0.05,       // Vol sensitivity
    oiChange: 0.05,          // Position change
};

// ============ STATISTICAL FUNCTIONS ============
const stats = {
    mean: arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,

    stdDev: arr => {
        if (arr.length < 2) return 1;
        const m = stats.mean(arr);
        return Math.sqrt(arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / arr.length) || 1;
    },

    median: arr => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

    percentile: (arr, p) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        if (lower === upper) return sorted[lower];
        return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
    },

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

// ============ MARKET IMPLICATION MAPPING ============
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

// ============ VOLUME SIGNAL ANALYSIS WITH GREEKS ============
const analyzeVolumeSignal = (contract) => {
    const { type, buildup, delta, volOIRatio } = contract;
    const code = buildup.code;

    if (code === 'NT') {
        if (volOIRatio > 80) {
            return {
                signal: 'neutral',
                interpretation: 'High intraday churning - position rotation',
                action: 'Watch for breakout confirmation',
                marketImpact: 'volatile',
            };
        }
        return {
            signal: 'neutral',
            interpretation: 'No significant directional activity',
            action: 'Monitor for changes',
            marketImpact: 'neutral',
        };
    }

    const marketImpact = MARKET_IMPLICATION[type]?.[code] || 'neutral';
    const deltaStr = delta ? ` (Δ=${Math.abs(delta).toFixed(2)})` : '';

    const interpretations = {
        CE: {
            LB: 'Heavy call buying - institutional longs',
            SB: 'Call writing at volume - capping upside',
            SC: 'Short covering rally potential',
            LU: 'Bull exhaustion - longs exiting',
        },
        PE: {
            LB: 'Put buying - hedging or bear bet',
            SB: 'Put writing - support building',
            SC: 'Bear short covering in progress',
            LU: 'Bear exhaustion - puts unwinding',
        },
    };

    const actions = {
        bullish: 'Consider bullish bias, watch resistance',
        bearish: 'Consider bearish bias, watch support',
        neutral: 'Wait for clearer direction',
    };

    return {
        signal: marketImpact,
        interpretation: interpretations[type]?.[code] + deltaStr || 'Activity detected',
        action: actions[marketImpact] || 'Monitor position',
        marketImpact,
    };
};

// ============ MAIN COMPONENT ============
const VolumeSpikeDetection = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize) || NIFTY_CONFIG.lotSize;
    const _atmIV = useSelector(selectATMIV);

    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const [minZScore, setMinZScore] = useState(NIFTY_CONFIG.minZScore);
    const [filter, setFilter] = useState('all');
    const [showDetails, setShowDetails] = useState(null);
    const [showAlgorithm, setShowAlgorithm] = useState(false);

    // ============ CORE DATA MINING ENGINE ============
    const { spikes, summaryStats } = useMemo(() => {
        if (!optionChain || !spotPrice) return { spikes: [], summaryStats: {} };

        const allContracts = [];
        const atm = atmStrike || spotPrice;

        // Step 1: Extract and enrich all contract data
        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            ['ce', 'pe'].forEach(optType => {
                const leg = data[optType];
                if (!leg) return;

                const vol = leg.vol || leg.volume || 0;
                const oi = leg.oi || leg.OI || 0;
                const oiChg = leg.oichng || leg.oi_change || 0;
                const ltp = leg.ltp || 0;
                const pChg = leg.p_chng || 0;
                const iv = leg.iv || 0;
                const greeks = leg.optgeeks || {};

                // Apply minimum filters
                if (vol < NIFTY_CONFIG.minVolume) return;
                if (oi < NIFTY_CONFIG.minOI) return;

                const pChgPct = ltp > 0 ? (pChg / ltp * 100) : 0;
                const premium = vol * ltp * lotSize;
                const volOIRatio = oi > 0 ? (vol / oi * 100) : 0;
                const atmDistance = Math.abs(strike - atm);

                // Greeks-derived metrics
                const delta = greeks.delta || 0;
                const gamma = greeks.gamma || 0;
                const vega = greeks.vega || 0;

                // Advanced calculations
                const deltaWeightedVolume = Math.abs(delta) * vol * NIFTY_CONFIG.contractMultiplier;
                const gammaExposure = gamma * oi * NIFTY_CONFIG.contractMultiplier * spotPrice / 100;
                const vegaContribution = Math.abs(vega) * vol * lotSize;

                // Classify buildup
                const buildup = classifyBuildup(pChgPct, oiChg);

                allContracts.push({
                    strike,
                    type: optType.toUpperCase(),
                    vol,
                    oi,
                    oiChg,
                    oiChgPct: oi > 0 ? (oiChg / oi * 100) : 0,
                    ltp,
                    pChg,
                    pChgPct,
                    iv,
                    premium,
                    volOIRatio,
                    atmDistance,
                    delta,
                    gamma,
                    vega,
                    deltaWeightedVolume,
                    gammaExposure,
                    vegaContribution,
                    buildup,
                });
            });
        });

        if (allContracts.length === 0) return { spikes: [], summaryStats: {} };

        // Step 2: Calculate statistical benchmarks
        const volumes = allContracts.map(c => c.vol).filter(v => v > 0);
        const deltaVols = allContracts.map(c => c.deltaWeightedVolume).filter(v => v > 0);
        const gexValues = allContracts.map(c => Math.abs(c.gammaExposure)).filter(v => v > 0);
        const premiums = allContracts.map(c => c.premium).filter(v => v > 0);
        const volOIRatios = allContracts.map(c => c.volOIRatio).filter(v => v > 0);
        const vegaValues = allContracts.map(c => c.vegaContribution).filter(v => v > 0);
        const oiChgValues = allContracts.map(c => Math.abs(c.oiChg)).filter(v => v > 0);

        const benchmarks = {
            vol: { mean: stats.mean(volumes), std: stats.stdDev(volumes), median: stats.median(volumes), iqr: stats.iqr(volumes) },
            deltaVol: { mean: stats.mean(deltaVols), std: stats.stdDev(deltaVols) },
            gex: { mean: stats.mean(gexValues), std: stats.stdDev(gexValues) },
            premium: { mean: stats.mean(premiums), std: stats.stdDev(premiums), iqr: stats.iqr(premiums) },
            volOI: { mean: stats.mean(volOIRatios), std: stats.stdDev(volOIRatios) },
            vega: { mean: stats.mean(vegaValues), std: stats.stdDev(vegaValues) },
            oiChg: { mean: stats.mean(oiChgValues), std: stats.stdDev(oiChgValues) },
        };

        // Step 3: Score each contract using 8-factor analysis
        const scored = allContracts.map(c => {
            const factors = {};
            let totalScore = 0;

            // Factor 1: Volume Z-Score (25%)
            const volZ = stats.zScore(c.vol, benchmarks.vol.mean, benchmarks.vol.std);
            factors.volume = { z: volZ, score: stats.normalize(volZ), weight: 25 };
            totalScore += factors.volume.score * SCORING_WEIGHTS.volume;

            // Factor 2: Delta-Weighted Volume (18%)
            const deltaVolZ = stats.zScore(c.deltaWeightedVolume, benchmarks.deltaVol.mean, benchmarks.deltaVol.std);
            factors.deltaVol = { z: deltaVolZ, score: stats.normalize(deltaVolZ), weight: 18 };
            totalScore += factors.deltaVol.score * SCORING_WEIGHTS.deltaVolume;

            // Factor 3: Gamma Exposure (12%)
            const gexZ = stats.zScore(Math.abs(c.gammaExposure), benchmarks.gex.mean, benchmarks.gex.std);
            factors.gammaExp = { z: gexZ, score: stats.normalize(gexZ), weight: 12 };
            totalScore += factors.gammaExp.score * SCORING_WEIGHTS.gammaExposure;

            // Factor 4: Premium Value (15%)
            const premZ = stats.zScore(c.premium, benchmarks.premium.mean, benchmarks.premium.std);
            factors.premium = { z: premZ, score: stats.normalize(premZ), weight: 15 };
            totalScore += factors.premium.score * SCORING_WEIGHTS.premium;

            // Factor 5: Vol/OI Ratio (12%)
            const volOIZ = stats.zScore(c.volOIRatio, benchmarks.volOI.mean, benchmarks.volOI.std);
            factors.volOI = { z: volOIZ, score: stats.normalize(volOIZ), weight: 12 };
            totalScore += factors.volOI.score * SCORING_WEIGHTS.volOIRatio;

            // Factor 6: ATM Proximity (8%)
            const atmScore = Math.max(0, 100 - (c.atmDistance / 3));
            factors.atm = { z: 0, score: atmScore, weight: 8 };
            totalScore += atmScore * SCORING_WEIGHTS.atmProximity;

            // Factor 7: Vega Contribution (5%)
            const vegaZ = stats.zScore(c.vegaContribution, benchmarks.vega.mean, benchmarks.vega.std);
            factors.vega = { z: vegaZ, score: stats.normalize(vegaZ), weight: 5 };
            totalScore += factors.vega.score * SCORING_WEIGHTS.vegaContrib;

            // Factor 8: OI Change (5%)
            const oiChgZ = stats.zScore(Math.abs(c.oiChg), benchmarks.oiChg.mean, benchmarks.oiChg.std);
            factors.oiChg = { z: oiChgZ, score: stats.normalize(oiChgZ), weight: 5 };
            totalScore += factors.oiChg.score * SCORING_WEIGHTS.oiChange;

            // Spike classification
            let spikeLevel = 'none';
            let spikeEmoji = '';
            if (volZ >= NIFTY_CONFIG.extremeZScore) { spikeLevel = 'extreme'; spikeEmoji = '🔥🔥'; }
            else if (volZ >= NIFTY_CONFIG.highZScore) { spikeLevel = 'high'; spikeEmoji = '🔥'; }
            else if (volZ >= NIFTY_CONFIG.minZScore) { spikeLevel = 'moderate'; spikeEmoji = '⚡'; }

            // Confidence adjustments
            let confidence = totalScore;

            // OI quality bonus
            if (c.oi >= NIFTY_CONFIG.institutionalOI) confidence *= 1.12;
            else if (c.oi >= 150000) confidence *= 1.05;

            // Institutional premium bonus
            if (c.premium >= NIFTY_CONFIG.institutionalPremium) confidence *= 1.10;

            // Delta significance (ATM options more meaningful)
            const deltaAbs = Math.abs(c.delta);
            if (deltaAbs >= 0.35 && deltaAbs <= 0.65) confidence *= 1.08;

            const finalScore = Math.min(100, confidence);

            // Anomaly detection (IQR outlier)
            const isAnomaly =
                c.vol > benchmarks.vol.iqr.upperBound ||
                c.premium > benchmarks.premium.iqr.upperBound;

            // Institutional detection
            const isInstitutional =
                c.vol >= NIFTY_CONFIG.institutionalVolume ||
                c.premium >= NIFTY_CONFIG.institutionalPremium ||
                c.oi >= NIFTY_CONFIG.institutionalOI;

            // Signal analysis
            const signalAnalysis = analyzeVolumeSignal({ ...c, buildup: c.buildup });

            return {
                ...c,
                volZScore: volZ,
                compositeScore: finalScore,
                factors,
                spikeLevel,
                spikeEmoji,
                isAnomaly,
                isInstitutional,
                spikeRatio: benchmarks.vol.median > 0 ? (c.vol / benchmarks.vol.median) : 0,
                ...signalAnalysis,
            };
        });

        // Step 4: Filter to only spikes above threshold
        const detectedSpikes = scored
            .filter(c => c.volZScore >= minZScore)
            .sort((a, b) => b.compositeScore - a.compositeScore)
            .slice(0, 25);

        // Summary statistics
        const summaryStats = {
            totalScanned: allContracts.length,
            spikeCount: detectedSpikes.length,
            extremeCount: detectedSpikes.filter(s => s.spikeLevel === 'extreme').length,
            highCount: detectedSpikes.filter(s => s.spikeLevel === 'high').length,
            bullishCount: detectedSpikes.filter(s => s.marketImpact === 'bullish').length,
            bearishCount: detectedSpikes.filter(s => s.marketImpact === 'bearish').length,
            callSpikes: detectedSpikes.filter(s => s.type === 'CE').length,
            putSpikes: detectedSpikes.filter(s => s.type === 'PE').length,
            institutional: detectedSpikes.filter(s => s.isInstitutional).length,
            anomalies: detectedSpikes.filter(s => s.isAnomaly).length,
            totalPremium: detectedSpikes.reduce((sum, s) => sum + s.premium, 0),
            totalDeltaVolume: detectedSpikes.reduce((sum, s) => sum + s.deltaWeightedVolume, 0),
            avgScore: stats.mean(detectedSpikes.map(s => s.compositeScore)),
        };

        return { spikes: detectedSpikes, summaryStats };
    }, [optionChain, spotPrice, atmStrike, lotSize, minZScore]);

    // Filter data
    const filteredSpikes = useMemo(() => {
        return spikes.filter(item => {
            if (filter === 'calls' && item.type !== 'CE') return false;
            if (filter === 'puts' && item.type !== 'PE') return false;
            if (filter === 'bullish' && item.marketImpact !== 'bullish') return false;
            if (filter === 'bearish' && item.marketImpact !== 'bearish') return false;
            if (filter === 'institutional' && !item.isInstitutional) return false;
            if (filter === 'anomaly' && !item.isAnomaly) return false;
            return true;
        });
    }, [spikes, filter]);

    // ============ UI RENDERING ============
    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const getZScoreColor = (z) => {
        if (z >= NIFTY_CONFIG.extremeZScore) return 'from-red-600 to-orange-500';
        if (z >= NIFTY_CONFIG.highZScore) return 'from-orange-500 to-amber-500';
        if (z >= NIFTY_CONFIG.minZScore) return 'from-amber-500 to-yellow-500';
        return 'from-gray-400 to-gray-500';
    };

    const getScoreBadge = (score) => {
        if (score >= 75) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white">Elite</span>;
        if (score >= 60) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white">High</span>;
        if (score >= 45) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white">Medium</span>;
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200">Low</span>;
    };

    const getSignalBadge = (signal, buildup) => {
        if (signal === 'bullish') {
            return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">🟢 {buildup.name}</span>;
        }
        if (signal === 'bearish') {
            return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">🔴 {buildup.name}</span>;
        }
        return <span className="text-gray-400 text-xs">Neutral</span>;
    };

    // Sentiment calculation
    const bullishDelta = spikes.filter(s => s.marketImpact === 'bullish').reduce((s, c) => s + c.deltaWeightedVolume, 0);
    const bearishDelta = spikes.filter(s => s.marketImpact === 'bearish').reduce((s, c) => s + c.deltaWeightedVolume, 0);
    const totalDelta = bullishDelta + bearishDelta;
    const sentimentPct = totalDelta > 0 ? (bullishDelta / totalDelta) * 100 : 50;
    const sentimentLabel = sentimentPct >= 60 ? 'Bullish' : sentimentPct <= 40 ? 'Bearish' : 'Mixed';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}
        >
            {/* Header */}
            <div className={`px-6 py-4 bg-gradient-to-r ${getZScoreColor(summaryStats.avgScore / 30 || 0)}`}>
                <div className="flex items-center justify-between text-white">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <BoltIcon className="w-6 h-6" />
                            Volume Spike Detection v2
                        </h2>
                        <p className="text-sm opacity-80">Greeks + Delta-Weighted + Statistical Analysis</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold">{summaryStats.spikeCount || 0} Spikes</div>
                        <div className="text-sm opacity-80">{summaryStats.extremeCount || 0} Extreme</div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-5 gap-2 mt-3 text-xs text-white">
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{sentimentPct.toFixed(0)}%</div>
                        <div className="opacity-70">{sentimentLabel}</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summaryStats.bullishCount || 0}</div>
                        <div className="opacity-70">🟢 Bullish</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summaryStats.bearishCount || 0}</div>
                        <div className="opacity-70">🔴 Bearish</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summaryStats.institutional || 0}</div>
                        <div className="opacity-70">⚡ Institutional</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{formatCurrency(summaryStats.totalPremium)}</div>
                        <div className="opacity-70">Premium Flow</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className={`p-3 flex flex-wrap gap-2 items-center border-b ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                <FunnelIcon className="w-4 h-4 text-gray-500" />
                {['all', 'institutional', 'anomaly', 'bullish', 'bearish', 'calls', 'puts'].map(f => (
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
                    <span className="text-xs text-gray-500">Min Z:</span>
                    <input
                        type="range"
                        min="1.0"
                        max="3.0"
                        step="0.1"
                        value={minZScore}
                        onChange={(e) => setMinZScore(Number(e.target.value))}
                        className="w-20 h-1"
                    />
                    <span className="text-xs font-bold w-8">{minZScore.toFixed(1)}σ</span>
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
                            <th className="py-2 px-2 text-center">Spike</th>
                            <th className="py-2 px-2 text-right">Score</th>
                            <th className="py-2 px-2 text-right">Vol Z</th>
                            <th className="py-2 px-2 text-right">Volume</th>
                            <th className="py-2 px-2 text-right">Δ-Vol</th>
                            <th className="py-2 px-2 text-right">Vol/OI</th>
                            <th className="py-2 px-2 text-right">Premium</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredSpikes.map((item, i) => (
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
                                    <span className="font-bold">{item.spikeEmoji}</span>
                                    <span className="ml-1 text-gray-500 capitalize">{item.spikeLevel}</span>
                                </td>
                                <td className="py-2 px-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        {getScoreBadge(item.compositeScore)}
                                        <span className="font-bold ml-1">{item.compositeScore.toFixed(0)}</span>
                                    </div>
                                </td>
                                <td className="py-2 px-2 text-right">
                                    <span className={`font-mono font-bold ${item.volZScore >= 3 ? 'text-red-600' : item.volZScore >= 2 ? 'text-orange-500' : 'text-yellow-600'
                                        }`}>
                                        {item.volZScore.toFixed(2)}σ
                                    </span>
                                </td>
                                <td className="py-2 px-2 text-right">{formatNumber(item.vol)}</td>
                                <td className="py-2 px-2 text-right">{formatNumber(item.deltaWeightedVolume)}</td>
                                <td className="py-2 px-2 text-right">{item.volOIRatio.toFixed(0)}%</td>
                                <td className="py-2 px-2 text-right font-medium">{formatCurrency(item.premium)}</td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Expandable Details */}
            <AnimatePresence>
                {showDetails !== null && filteredSpikes[showDetails] && (
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
                                    <div className="text-sm font-medium">{filteredSpikes[showDetails].interpretation}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-700">
                                    <div className="text-xs text-gray-500">Action</div>
                                    <div className="text-sm font-medium">{filteredSpikes[showDetails].action}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-700">
                                    <div className="text-xs text-gray-500">Gamma Exposure</div>
                                    <div className="text-sm font-medium">{formatNumber(filteredSpikes[showDetails].gammaExposure)}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-700">
                                    <div className="text-xs text-gray-500">Spike Ratio</div>
                                    <div className="text-sm font-medium">{filteredSpikes[showDetails].spikeRatio.toFixed(1)}x Median</div>
                                </div>
                            </div>

                            {/* Factor Breakdown */}
                            <div className="text-xs font-semibold mb-2 text-gray-600">Factor Breakdown</div>
                            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                                {Object.entries(filteredSpikes[showDetails].factors).map(([key, data]) => (
                                    <div key={key} className="p-2 rounded bg-white dark:bg-slate-700">
                                        <div className="text-[10px] text-gray-500 capitalize">{key}</div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-full h-1 bg-gray-200 dark:bg-gray-600 rounded-full">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{ width: `${data.score}%` }}
                                                />
                                            </div>
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
                        <div className="font-semibold text-indigo-600 mb-2">8-Factor Spike Scoring Algorithm</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>• Volume Z-Score: 25%</div>
                            <div>• Delta-Weighted Volume: 18%</div>
                            <div>• Premium Flow: 15%</div>
                            <div>• Gamma Exposure: 12%</div>
                            <div>• Vol/OI Ratio: 12%</div>
                            <div>• ATM Proximity: 8%</div>
                            <div>• Vega Contribution: 5%</div>
                            <div>• OI Change: 5%</div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500">
                            <div>⚡ Institutional: Vol &gt;50K OR Premium &gt;₹1Cr OR OI &gt;3L</div>
                            <div>🧪 Anomaly: IQR outlier on Volume or Premium</div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// ============ SUB COMPONENTS ============
const ZScoreBar = memo(({ label, score, weight }) => (
    <div className="flex items-center gap-2">
        <span className="text-[9px] text-gray-500 w-14">{label} ({weight})</span>
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
                className="h-full bg-orange-500 rounded-full"
                style={{ width: `${Math.min(100, score * 25)}%` }}
            />
        </div>
        <span className="text-[9px] font-medium w-8">{score.toFixed(1)}σ</span>
    </div>
));

ZScoreBar.displayName = 'ZScoreBar';

export default VolumeSpikeDetection;

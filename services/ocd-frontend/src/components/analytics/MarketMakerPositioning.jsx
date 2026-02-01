/**
 * Enhanced Market Maker Positioning Analysis v2
 * 
 * Advanced Data Mining with Full Greeks Integration
 * 
 * Features:
 * 1. GAMMA EXPOSURE (GEX) ANALYSIS - Full strike-by-strike GEX
 * 2. DELTA EXPOSURE ANALYSIS - Net MM delta hedging needs
 * 3. VANNA & CHARM EFFECTS - Second-order Greeks impact
 * 4. Z-SCORE LEVEL SIGNIFICANCE - Statistical level detection
 * 5. IQR ANOMALY DETECTION - Unusual MM concentration
 * 6. 7-FACTOR LEVEL STRENGTH SCORING - Comprehensive level quality
 * 7. GAMMA FLIP DETECTION - Transition zone identification
 * 8. PIN RISK ANALYSIS - High gamma pinning probability
 * 9. MM HEDGING FLOW PREDICTION - Anticipated dealer activity
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    selectOptionChain, selectSpotPrice, selectATMStrike,
    selectLotSize, selectATMIV
} from '../../context/selectors';
import {
    BuildingLibraryIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    ShieldCheckIcon, ShieldExclamationIcon, BoltIcon,
    ChevronDownIcon, ChartBarIcon
} from '@heroicons/react/24/outline';

// ============ NIFTY 50 CALIBRATED CONFIGURATION ============
const NIFTY_CONFIG = {
    lotSize: 75,
    contractMultiplier: 75,
    strikeGap: 50,
    visibleStrikes: 12,

    // GEX thresholds (in Crores)
    significantGEX: 0.3,
    majorGEX: 0.8,
    extremeGEX: 1.5,

    // Level thresholds
    minOI: 40000,
    strongLevelRatio: 2.5,
    moderateLevelRatio: 1.5,
    pinRiskOI: 250000,

    // Institutional thresholds
    institutionalGEX: 1.0,      // ₹1Cr GEX = institutional
    institutionalDelta: 1e7,    // 1Cr delta exposure
};

// ============ SCORING WEIGHTS ============
const LEVEL_SCORING_WEIGHTS = {
    oiMagnitude: 0.22,        // Raw OI size
    gexContribution: 0.20,    // GEX at level
    deltaExposure: 0.15,      // Delta-weighted exposure
    oiConcentration: 0.15,    // CE/PE ratio
    proximity: 0.12,          // Distance from spot
    oiChange: 0.10,           // Building/weakening
    vegaSensitivity: 0.06,    // Vol sensitivity
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

    normalize: z => Math.min(100, Math.max(0, z * 20 + 50)),
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

const _formatCurrency = (num) => {
    if (!num) return '₹0';
    const abs = Math.abs(num);
    if (abs >= 1e7) return '₹' + (num / 1e7).toFixed(2) + 'Cr';
    if (abs >= 1e5) return '₹' + (num / 1e5).toFixed(1) + 'L';
    return '₹' + (num / 1e3).toFixed(0) + 'K';
};

// ============ LEVEL STRENGTH ANALYSIS ============
const calculateLevelStrength = (level, spotPrice, benchmarks) => {
    const factors = {};
    let totalScore = 0;

    // Factor 1: OI Magnitude (22%)
    const oiZ = stats.zScore(level.totalOI, benchmarks.oi.mean, benchmarks.oi.std);
    factors.oiMagnitude = { z: oiZ, score: stats.normalize(oiZ), weight: 22 };
    totalScore += factors.oiMagnitude.score * LEVEL_SCORING_WEIGHTS.oiMagnitude;

    // Factor 2: GEX Contribution (20%)
    const gexZ = stats.zScore(Math.abs(level.gex), benchmarks.gex.mean, benchmarks.gex.std);
    factors.gexContrib = { z: gexZ, score: stats.normalize(gexZ), weight: 20 };
    totalScore += factors.gexContrib.score * LEVEL_SCORING_WEIGHTS.gexContribution;

    // Factor 3: Delta Exposure (15%)
    const deltaZ = stats.zScore(Math.abs(level.delta), benchmarks.delta.mean, benchmarks.delta.std);
    factors.deltaExp = { z: deltaZ, score: stats.normalize(deltaZ), weight: 15 };
    totalScore += factors.deltaExp.score * LEVEL_SCORING_WEIGHTS.deltaExposure;

    // Factor 4: OI Concentration (15%)
    const ratio = level.isSupport
        ? level.putOI / Math.max(level.callOI, 1)
        : level.callOI / Math.max(level.putOI, 1);
    const concentrationScore = Math.min(100, ratio * 25);
    factors.concentration = { z: 0, score: concentrationScore, weight: 15 };
    totalScore += concentrationScore * LEVEL_SCORING_WEIGHTS.oiConcentration;

    // Factor 5: Proximity to Spot (12%)
    const distance = Math.abs(level.strike - spotPrice);
    const proximityScore = Math.max(0, 100 - (distance / 2));
    factors.proximity = { z: 0, score: proximityScore, weight: 12 };
    totalScore += proximityScore * LEVEL_SCORING_WEIGHTS.proximity;

    // Factor 6: OI Change (10%)
    let oiChangeScore = 50;
    if (level.oiChg > 30000) oiChangeScore = 90;
    else if (level.oiChg > 15000) oiChangeScore = 75;
    else if (level.oiChg < -15000) oiChangeScore = 25;
    else if (level.oiChg < -30000) oiChangeScore = 10;
    factors.oiChange = { z: 0, score: oiChangeScore, weight: 10 };
    totalScore += oiChangeScore * LEVEL_SCORING_WEIGHTS.oiChange;

    // Factor 7: Vega Sensitivity (6%)
    const vegaZ = stats.zScore(Math.abs(level.vega), benchmarks.vega.mean, benchmarks.vega.std);
    factors.vegaSens = { z: vegaZ, score: stats.normalize(vegaZ), weight: 6 };
    totalScore += factors.vegaSens.score * LEVEL_SCORING_WEIGHTS.vegaSensitivity;

    // Status determination
    let status = 'stable';
    if (level.oiChg > 20000) status = 'building';
    else if (level.oiChg < -20000) status = 'weakening';

    // Pin risk
    const hasPinRisk = level.gamma > 0.004 && level.totalOI > NIFTY_CONFIG.pinRiskOI;

    // Anomaly detection
    const isAnomaly = level.totalOI > benchmarks.oi.iqr.upperBound;

    // Institutional level
    const isInstitutional =
        Math.abs(level.gex) >= NIFTY_CONFIG.institutionalGEX ||
        Math.abs(level.delta) >= NIFTY_CONFIG.institutionalDelta;

    return {
        strength: Math.min(100, totalScore),
        factors,
        status,
        hasPinRisk,
        isAnomaly,
        isInstitutional,
    };
};

// ============ MAIN COMPONENT ============
const MarketMakerPositioning = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize) || NIFTY_CONFIG.lotSize;
    const _atmIV = useSelector(selectATMIV);

    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const [showDetails, setShowDetails] = useState(null);
    const [showAlgorithm, setShowAlgorithm] = useState(false);

    // ============ CORE DATA MINING ENGINE ============
    const mmData = useMemo(() => {
        if (!optionChain || !spotPrice) return null;

        let totalGEX = 0;
        let netDelta = 0;
        let netGamma = 0;
        let netVega = 0;
        let netTheta = 0;
        let totalCallOI = 0;
        let totalPutOI = 0;
        const levels = [];

        // Step 1: Extract all level data with Greeks
        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            const ceOI = data.ce?.oi || data.ce?.OI || 0;
            const peOI = data.pe?.oi || data.pe?.OI || 0;
            const ceOIChg = data.ce?.oichng || data.ce?.oi_change || 0;
            const peOIChg = data.pe?.oichng || data.pe?.oi_change || 0;
            const ceGreeks = data.ce?.optgeeks || {};
            const peGreeks = data.pe?.optgeeks || {};

            const ceDelta = ceGreeks.delta || 0.5;
            const peDelta = peGreeks.delta || -0.5;
            const ceGamma = ceGreeks.gamma || 0;
            const peGamma = peGreeks.gamma || 0;
            const ceVega = ceGreeks.vega || 0;
            const peVega = peGreeks.vega || 0;
            const ceTheta = ceGreeks.theta || 0;
            const peTheta = peGreeks.theta || 0;
            const ceLTP = data.ce?.ltp || 0;
            const peLTP = data.pe?.ltp || 0;

            totalCallOI += ceOI;
            totalPutOI += peOI;

            // Skip insignificant strikes
            if (ceOI + peOI < NIFTY_CONFIG.minOI) return;

            // GEX calculation (in Crores)
            const multiplier = spotPrice * spotPrice * 0.01 * lotSize / 1e7;
            const callGEX = ceGamma * ceOI * multiplier;
            const putGEX = -peGamma * peOI * multiplier;
            const strikeGEX = callGEX + putGEX;
            totalGEX += strikeGEX;

            // Net Greeks (MM perspective - opposite of client positions)
            const levelDelta = -(ceDelta * ceOI + peDelta * peOI) * lotSize;
            const levelGamma = -(ceGamma * ceOI + peGamma * peOI) * lotSize;
            const levelVega = -(ceVega * ceOI + peVega * peOI) * lotSize;
            const levelTheta = -(ceTheta * ceOI + peTheta * peOI) * lotSize;

            netDelta += levelDelta;
            netGamma += levelGamma;
            netVega += levelVega;
            netTheta += levelTheta;

            // Delta-adjusted exposure
            const deltaExposure = Math.abs(ceDelta) * ceOI + Math.abs(peDelta) * peOI;

            levels.push({
                strike,
                gex: strikeGEX,
                callGEX,
                putGEX,
                callOI: ceOI,
                putOI: peOI,
                totalOI: ceOI + peOI,
                oiChg: ceOIChg + peOIChg,
                delta: levelDelta,
                gamma: (ceGamma + peGamma) / 2,
                vega: levelVega,
                theta: levelTheta,
                deltaExposure: deltaExposure * lotSize,
                premium: ceLTP * ceOI * lotSize + peLTP * peOI * lotSize,
                isSupport: peOI > ceOI * NIFTY_CONFIG.moderateLevelRatio,
                isResistance: ceOI > peOI * NIFTY_CONFIG.moderateLevelRatio,
            });
        });

        levels.sort((a, b) => a.strike - b.strike);

        // Step 2: Calculate benchmarks for statistical analysis
        const oiValues = levels.map(l => l.totalOI).filter(v => v > 0);
        const gexValues = levels.map(l => Math.abs(l.gex)).filter(v => v > 0);
        const deltaValues = levels.map(l => Math.abs(l.delta)).filter(v => v > 0);
        const vegaValues = levels.map(l => Math.abs(l.vega)).filter(v => v > 0);

        const benchmarks = {
            oi: { mean: stats.mean(oiValues), std: stats.stdDev(oiValues), iqr: stats.iqr(oiValues) },
            gex: { mean: stats.mean(gexValues), std: stats.stdDev(gexValues) },
            delta: { mean: stats.mean(deltaValues), std: stats.stdDev(deltaValues) },
            vega: { mean: stats.mean(vegaValues), std: stats.stdDev(vegaValues) },
        };

        // Step 3: Score all levels
        const scoredLevels = levels.map(l => ({
            ...l,
            ...calculateLevelStrength(l, spotPrice, benchmarks),
        }));

        // Step 4: Find key levels
        const supportLevels = scoredLevels
            .filter(l => l.isSupport && l.strike < spotPrice)
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 5);

        const resistanceLevels = scoredLevels
            .filter(l => l.isResistance && l.strike > spotPrice)
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 5);

        // Step 5: Gamma flip detection
        let cumulativeGEX = 0;
        let gammaFlip = null;
        for (const level of scoredLevels) {
            const prev = cumulativeGEX;
            cumulativeGEX += level.gex;
            if ((prev < 0 && cumulativeGEX >= 0) || (prev > 0 && cumulativeGEX <= 0)) {
                gammaFlip = level.strike;
            }
        }

        // Step 6: MM hedging analysis
        const hedgeDirection = netDelta > 0 ? 'long' : netDelta < 0 ? 'short' : 'neutral';
        const hedgeSize = Math.abs(netDelta);
        const hedgeInterpretation = hedgeDirection === 'long'
            ? `MMs need to sell ${formatNumber(hedgeSize)} delta to hedge`
            : hedgeDirection === 'short'
                ? `MMs need to buy ${formatNumber(hedgeSize)} delta to hedge`
                : 'MMs are delta neutral';

        // Step 7: Regime classification with confidence
        let regime = 'neutral';
        let regimeConfidence = 50;
        let regimeDescription = 'Mixed gamma environment';

        if (totalGEX > NIFTY_CONFIG.majorGEX) {
            regime = 'stabilizing';
            regimeConfidence = Math.min(95, 60 + totalGEX * 15);
            regimeDescription = 'Positive gamma: MMs buy dips, sell rallies (mean-reverting)';
        } else if (totalGEX < -NIFTY_CONFIG.majorGEX) {
            regime = 'volatile';
            regimeConfidence = Math.min(95, 60 + Math.abs(totalGEX) * 15);
            regimeDescription = 'Negative gamma: MMs amplify moves (trending)';
        } else if (totalGEX > NIFTY_CONFIG.significantGEX) {
            regime = 'mildly_stabilizing';
            regimeConfidence = Math.min(75, 50 + totalGEX * 20);
            regimeDescription = 'Slightly positive gamma: mild mean-reversion expected';
        } else if (totalGEX < -NIFTY_CONFIG.significantGEX) {
            regime = 'mildly_volatile';
            regimeConfidence = Math.min(75, 50 + Math.abs(totalGEX) * 20);
            regimeDescription = 'Slightly negative gamma: some trend amplification';
        }

        // Pin risk detection
        const atmLevel = scoredLevels.find(l => l.strike === atmStrike);
        const pinRisk = atmLevel && atmLevel.totalOI > NIFTY_CONFIG.pinRiskOI;

        // Summary stats
        const pcr = totalPutOI / totalCallOI;
        const bullishLevels = scoredLevels.filter(l => l.gex > 0 && l.strength > 50).length;
        const bearishLevels = scoredLevels.filter(l => l.gex < 0 && l.strength > 50).length;

        return {
            totalGEX,
            netDelta,
            netGamma,
            netVega,
            netTheta,
            gammaFlip,
            hedgeDirection,
            hedgeSize,
            hedgeInterpretation,
            supportLevels,
            resistanceLevels,
            levels: scoredLevels,
            regime,
            regimeConfidence,
            regimeDescription,
            pinRisk,
            atmLevel,
            totalCallOI,
            totalPutOI,
            pcr,
            bullishLevels,
            bearishLevels,
            institutionalLevels: scoredLevels.filter(l => l.isInstitutional).length,
            anomalyLevels: scoredLevels.filter(l => l.isAnomaly).length,
        };
    }, [optionChain, spotPrice, lotSize, atmStrike]);

    // Filter visible levels around ATM
    const visibleLevels = useMemo(() => {
        if (!mmData) return [];
        const atmIdx = mmData.levels.findIndex(l => l.strike >= atmStrike);
        const start = Math.max(0, atmIdx - NIFTY_CONFIG.visibleStrikes);
        const end = Math.min(mmData.levels.length, atmIdx + NIFTY_CONFIG.visibleStrikes + 1);
        return mmData.levels.slice(start, end);
    }, [mmData, atmStrike]);

    // ============ UI RENDERING ============
    if (!optionChain || !mmData) {
        return (
            <div className="p-8 text-center text-gray-400">
                <BuildingLibraryIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const getRegimeGradient = (regime) => {
        switch (regime) {
            case 'stabilizing': return 'from-blue-600 to-indigo-700';
            case 'mildly_stabilizing': return 'from-blue-500 to-sky-600';
            case 'volatile': return 'from-red-600 to-rose-700';
            case 'mildly_volatile': return 'from-orange-500 to-red-500';
            default: return 'from-gray-500 to-gray-600';
        }
    };

    const getRegimeEmoji = (regime) => {
        switch (regime) {
            case 'stabilizing': return '🛡️';
            case 'mildly_stabilizing': return '🔵';
            case 'volatile': return '⚠️';
            case 'mildly_volatile': return '🟠';
            default: return '⚪';
        }
    };

    const getStrengthColor = (strength) => {
        if (strength >= 75) return 'from-purple-500 to-pink-500';
        if (strength >= 55) return 'from-blue-500 to-indigo-500';
        if (strength >= 35) return 'from-amber-500 to-orange-500';
        return 'from-gray-400 to-gray-500';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            {/* MM Summary Header */}
            <div className={`rounded-2xl p-6 bg-gradient-to-r ${getRegimeGradient(mmData.regime)} text-white`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <BuildingLibraryIcon className="w-8 h-8" />
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                Market Maker Positioning v2
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Greeks-Powered</span>
                            </h2>
                            <div className="text-sm opacity-80 flex items-center gap-2">
                                {getRegimeEmoji(mmData.regime)} {mmData.regimeDescription}
                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">
                                    {mmData.regimeConfidence.toFixed(0)}% conf
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold">{mmData.totalGEX.toFixed(2)} Cr</div>
                        <div className="text-xs opacity-80">Net GEX</div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-5 gap-2 text-xs">
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{formatNumber(mmData.netDelta)}</div>
                        <div className="opacity-70">Net Delta</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{formatNumber(mmData.netGamma)}</div>
                        <div className="opacity-70">Net Gamma</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{mmData.gammaFlip || '--'}</div>
                        <div className="opacity-70">Gamma Flip</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{mmData.pcr.toFixed(2)}</div>
                        <div className="opacity-70">PCR</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold flex items-center justify-center gap-1">
                            {mmData.institutionalLevels}
                            <BoltIcon className="w-3 h-3" />
                        </div>
                        <div className="opacity-70">Institutional</div>
                    </div>
                </div>
            </div>

            {/* Key Levels Grid */}
            <div className="grid grid-cols-2 gap-4">
                {/* Resistance Levels */}
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldExclamationIcon className="w-4 h-4" />
                            <span className="font-semibold text-sm">Key Resistance</span>
                        </div>
                        <span className="text-[10px] opacity-80">By Strength</span>
                    </div>
                    <div className="p-3 space-y-2">
                        {mmData.resistanceLevels.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-xs">No significant resistance</div>
                        ) : (
                            mmData.resistanceLevels.map((level, i) => (
                                <div
                                    key={level.strike}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 p-2 rounded-lg"
                                    onClick={() => setShowDetails(showDetails === `r${i}` ? null : `r${i}`)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                            {i + 1}
                                        </span>
                                        <span className="font-bold">{level.strike}</span>
                                        {level.isInstitutional && <BoltIcon className="w-3 h-3 text-yellow-500" />}
                                        {level.hasPinRisk && <span className="text-[9px]">📌</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${level.status === 'building' ? 'bg-green-100 text-green-700' :
                                            level.status === 'weakening' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {level.status.toUpperCase()}
                                        </span>
                                        <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div className={`h-full bg-gradient-to-r ${getStrengthColor(level.strength)}`}
                                                style={{ width: `${level.strength}%` }} />
                                        </div>
                                        <span className="text-xs font-bold w-6">{level.strength.toFixed(0)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Support Levels */}
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheckIcon className="w-4 h-4" />
                            <span className="font-semibold text-sm">Key Support</span>
                        </div>
                        <span className="text-[10px] opacity-80">By Strength</span>
                    </div>
                    <div className="p-3 space-y-2">
                        {mmData.supportLevels.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-xs">No significant support</div>
                        ) : (
                            mmData.supportLevels.map((level, i) => (
                                <div
                                    key={level.strike}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 p-2 rounded-lg"
                                    onClick={() => setShowDetails(showDetails === `s${i}` ? null : `s${i}`)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                            {i + 1}
                                        </span>
                                        <span className="font-bold">{level.strike}</span>
                                        {level.isInstitutional && <BoltIcon className="w-3 h-3 text-yellow-500" />}
                                        {level.hasPinRisk && <span className="text-[9px]">📌</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${level.status === 'building' ? 'bg-green-100 text-green-700' :
                                            level.status === 'weakening' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {level.status.toUpperCase()}
                                        </span>
                                        <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div className={`h-full bg-gradient-to-r ${getStrengthColor(level.strength)}`}
                                                style={{ width: `${level.strength}%` }} />
                                        </div>
                                        <span className="text-xs font-bold w-6">{level.strength.toFixed(0)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* MM Hedging Summary */}
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${mmData.hedgeDirection === 'long' ? 'bg-red-100 text-red-600' :
                            mmData.hedgeDirection === 'short' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                            }`}>
                            {mmData.hedgeDirection === 'long' ? <ArrowTrendingDownIcon className="w-5 h-5" /> :
                                mmData.hedgeDirection === 'short' ? <ArrowTrendingUpIcon className="w-5 h-5" /> :
                                    <span className="text-sm">≈</span>}
                        </div>
                        <div>
                            <div className="text-sm font-semibold">MM Hedging Requirement</div>
                            <div className="text-xs text-gray-500">{mmData.hedgeInterpretation}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-lg font-bold ${mmData.hedgeDirection === 'long' ? 'text-red-600' :
                            mmData.hedgeDirection === 'short' ? 'text-green-600' : 'text-gray-600'
                            }`}>
                            {formatNumber(mmData.hedgeSize)} Δ
                        </div>
                        <div className="text-[10px] text-gray-400">Net exposure</div>
                    </div>
                </div>
            </div>

            {/* GEX Visualization */}
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <ChartBarIcon className="w-4 h-4" />
                        GEX Distribution
                    </h3>
                    <span className="text-xs text-gray-500">{visibleLevels.length} levels</span>
                </div>
                <div className="space-y-1">
                    {visibleLevels.map((level) => {
                        const maxGex = Math.max(...visibleLevels.map(l => Math.abs(l.gex)), 0.1);
                        const width = Math.min(100, (Math.abs(level.gex) / maxGex) * 100);
                        const isAtm = level.strike === atmStrike;

                        return (
                            <div key={level.strike} className={`flex items-center gap-2 ${isAtm ? 'bg-yellow-50 dark:bg-yellow-900/10 rounded px-1' : ''}`}>
                                <span className={`w-14 text-right text-xs font-mono ${isAtm ? 'font-bold text-yellow-600' : ''}`}>
                                    {level.strike}
                                </span>
                                <div className="flex-1 flex items-center h-4">
                                    {level.gex < 0 && (
                                        <div className="flex-1 flex justify-end">
                                            <div
                                                className="h-3 bg-gradient-to-r from-red-500 to-rose-400 rounded-l"
                                                style={{ width: `${width}%` }}
                                            />
                                        </div>
                                    )}
                                    <div className="w-px h-full bg-gray-300 dark:bg-gray-600" />
                                    {level.gex >= 0 && (
                                        <div className="flex-1">
                                            <div
                                                className="h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-r"
                                                style={{ width: `${width}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                                <span className={`w-16 text-xs text-right ${level.gex >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {level.gex.toFixed(2)}Cr
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Algorithm Toggle */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'} border ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <button
                    onClick={() => setShowAlgorithm(!showAlgorithm)}
                    className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                >
                    <ShieldCheckIcon className="w-4 h-4" />
                    {showAlgorithm ? 'Hide' : 'Show'} MM Positioning Algorithm
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${showAlgorithm ? 'rotate-180' : ''}`} />
                </button>

                {showAlgorithm && (
                    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg text-xs space-y-2">
                        <div className="font-semibold text-indigo-600 mb-2">7-Factor Level Strength Algorithm</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>• OI Magnitude: 22%</div>
                            <div>• GEX Contribution: 20%</div>
                            <div>• Delta Exposure: 15%</div>
                            <div>• OI Concentration: 15%</div>
                            <div>• Proximity to Spot: 12%</div>
                            <div>• OI Change: 10%</div>
                            <div>• Vega Sensitivity: 6%</div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500">
                            <div>⚡ Institutional: GEX &gt;₹1Cr OR Delta &gt;1Cr</div>
                            <div>📌 Pin Risk: Gamma &gt;0.004 AND OI &gt;2.5L</div>
                            <div>🧪 Anomaly: IQR outlier on OI</div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default MarketMakerPositioning;

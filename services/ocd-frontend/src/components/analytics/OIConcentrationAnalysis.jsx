/**
 * Enhanced OI Concentration Analysis v2
 * 
 * Advanced Data Mining with Full Greeks Integration
 * 
 * Features:
 * 1. GAMMA EXPOSURE AT WALLS - MM hedging impact analysis
 * 2. DELTA-ADJUSTED OI - True directional exposure
 * 3. Z-SCORE STATISTICAL SIGNIFICANCE - Statistical wall detection
 * 4. IQR ANOMALY DETECTION - Interquartile range outliers
 * 5. 6-FACTOR WALL STRENGTH SCORING - Comprehensive strength analysis
 * 6. PIN RISK ANALYSIS - Gamma pinning probability
 * 7. SMART MONEY POSITIONING - Institutional wall detection
 * 8. DYNAMIC SUPPORT/RESISTANCE - Real-time level updates
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    selectOptionChain, selectSpotPrice, selectATMStrike,
    selectTotalOI, selectLotSize
} from '../../context/selectors';
import {
    ChartBarIcon, ShieldCheckIcon, ShieldExclamationIcon,
    ArrowTrendingUpIcon, BoltIcon, BeakerIcon, ChevronDownIcon
} from '@heroicons/react/24/outline';

// ============ NIFTY 50 CALIBRATED CONFIGURATION ============
const NIFTY_CONFIG = {
    lotSize: 75,
    contractMultiplier: 75,
    strikeGap: 50,
    relevantRange: 12,

    // Wall detection thresholds
    minOI: 80000,             // Min OI for wall consideration
    strongWallPct: 7,         // 7%+ = strong wall
    moderateWallPct: 4.5,     // 4.5-7% = moderate wall
    weakWallPct: 2.5,         // 2.5-4.5% = weak wall
    minOIChange: 15000,       // Min OI change for building status

    // Institutional thresholds
    institutionalOI: 400000,  // 4L+ = institutional
    institutionalGEX: 1e7,    // ₹1Cr GEX = significant

    // Pin risk
    highGammaPinRisk: 0.005,  // High gamma = pin risk
};

// ============ SCORING WEIGHTS ============
const WALL_SCORING_WEIGHTS = {
    oiMagnitude: 0.25,        // Raw OI size
    concentration: 0.20,      // % of total OI
    gammaExposure: 0.18,      // GEX at level
    deltaAdjusted: 0.12,      // Delta-weighted OI
    oiChange: 0.15,           // Building/weakening
    proximity: 0.10,          // Distance from spot
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

    percentile: (value, sortedArr) => {
        if (sortedArr.length === 0) return 50;
        const idx = sortedArr.findIndex(v => v >= value);
        return idx === -1 ? 100 : (idx / sortedArr.length) * 100;
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

const formatCurrency = (num) => {
    if (!num) return '₹0';
    const abs = Math.abs(num);
    if (abs >= 1e7) return '₹' + (num / 1e7).toFixed(1) + 'Cr';
    if (abs >= 1e5) return '₹' + (num / 1e5).toFixed(1) + 'L';
    return '₹' + (num / 1e3).toFixed(0) + 'K';
};

// ============ WALL STRENGTH ANALYSIS WITH GREEKS ============
const analyzeWallStrength = (wall, type, spotPrice, benchmarks, _lotSize) => {
    const { strike, oi, oiChg, pct, delta: _delta, gamma, gammaExposure, deltaAdjustedOI } = wall;

    const factors = {};
    let totalScore = 0;

    // Factor 1: OI Magnitude (25%)
    const oiZ = stats.zScore(oi, benchmarks.oi.mean, benchmarks.oi.std);
    factors.oiMagnitude = { z: oiZ, score: stats.normalize(oiZ), weight: 25, label: 'OI Size' };
    totalScore += factors.oiMagnitude.score * WALL_SCORING_WEIGHTS.oiMagnitude;

    // Factor 2: Concentration (20%)
    const pctScore = Math.min(100, (pct / NIFTY_CONFIG.strongWallPct) * 100);
    factors.concentration = { z: 0, score: pctScore, weight: 20, label: `${pct.toFixed(1)}%` };
    totalScore += pctScore * WALL_SCORING_WEIGHTS.concentration;

    // Factor 3: Gamma Exposure (18%) - Key for pin risk
    const gexZ = stats.zScore(Math.abs(gammaExposure), benchmarks.gex.mean, benchmarks.gex.std);
    factors.gammaExposure = { z: gexZ, score: stats.normalize(gexZ), weight: 18, label: formatCurrency(gammaExposure) };
    totalScore += factors.gammaExposure.score * WALL_SCORING_WEIGHTS.gammaExposure;

    // Factor 4: Delta-Adjusted OI (12%)
    const deltaZ = stats.zScore(deltaAdjustedOI, benchmarks.deltaOI.mean, benchmarks.deltaOI.std);
    factors.deltaAdjusted = { z: deltaZ, score: stats.normalize(deltaZ), weight: 12, label: formatNumber(deltaAdjustedOI) };
    totalScore += factors.deltaAdjusted.score * WALL_SCORING_WEIGHTS.deltaAdjusted;

    // Factor 5: OI Change (15%)
    let oiChangeScore = 50; // Neutral
    if (oiChg > NIFTY_CONFIG.minOIChange) oiChangeScore = 85;
    else if (oiChg > NIFTY_CONFIG.minOIChange / 2) oiChangeScore = 70;
    else if (oiChg < -NIFTY_CONFIG.minOIChange) oiChangeScore = 15;
    else if (oiChg < -NIFTY_CONFIG.minOIChange / 2) oiChangeScore = 30;
    factors.oiChange = { z: 0, score: oiChangeScore, weight: 15, label: oiChg > 0 ? `+${formatNumber(oiChg)}` : formatNumber(oiChg) };
    totalScore += oiChangeScore * WALL_SCORING_WEIGHTS.oiChange;

    // Factor 6: Proximity (10%)
    const distance = Math.abs(strike - spotPrice);
    let proximityScore = Math.max(0, 100 - (distance / 2));
    if (type === 'resistance' && strike < spotPrice) proximityScore = 0; // Wrong side
    if (type === 'support' && strike > spotPrice) proximityScore = 0;
    factors.proximity = { z: 0, score: proximityScore, weight: 10, label: `${distance} pts` };
    totalScore += proximityScore * WALL_SCORING_WEIGHTS.proximity;

    // Determine wall status
    let status = 'stable';
    if (oiChg > NIFTY_CONFIG.minOIChange) status = 'building';
    else if (oiChg < -NIFTY_CONFIG.minOIChange) status = 'weakening';

    // Determine pin risk
    const hasPinRisk = gamma >= NIFTY_CONFIG.highGammaPinRisk;

    // Institutional detection
    const isInstitutional = oi >= NIFTY_CONFIG.institutionalOI || Math.abs(gammaExposure) >= NIFTY_CONFIG.institutionalGEX;

    // Anomaly detection
    const isAnomaly = oi > benchmarks.oi.iqr.upperBound;

    // Interpretation
    let interpretation = '';
    if (type === 'resistance') {
        interpretation = status === 'building'
            ? 'Call writers adding positions - strong ceiling expected'
            : status === 'weakening'
                ? 'Call writers exiting - resistance may break'
                : 'Stable resistance level';
    } else {
        interpretation = status === 'building'
            ? 'Put writers adding positions - strong floor expected'
            : status === 'weakening'
                ? 'Put writers exiting - support may break'
                : 'Stable support level';
    }

    if (hasPinRisk) interpretation += ' ⚠️ High gamma - pin risk';

    return {
        strength: Math.min(100, totalScore),
        factors,
        status,
        interpretation,
        hasPinRisk,
        isInstitutional,
        isAnomaly,
    };
};

// ============ MAIN COMPONENT ============
const OIConcentrationAnalysis = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const totalOI = useSelector(selectTotalOI);
    const lotSize = useSelector(selectLotSize) || NIFTY_CONFIG.lotSize;

    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const [_showType, _setShowType] = useState('both');
    const [showDetails, setShowDetails] = useState({ type: null, index: null });
    const [showAlgorithm, setShowAlgorithm] = useState(false);

    // ============ CORE DATA MINING ENGINE ============
    const { concentration, walls, summaryStats } = useMemo(() => {
        if (!optionChain || !totalOI || !spotPrice) return { concentration: null, walls: null, summaryStats: null };

        const strikes = [];
        const totalCE = totalOI.calls || 1;
        const totalPE = totalOI.puts || 1;
        const totalAll = totalCE + totalPE;

        let totalGEX = 0;
        let netGEX = 0;

        // Step 1: Collect all strike data with Greeks
        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            const ceOI = data.ce?.oi || data.ce?.OI || 0;
            const peOI = data.pe?.oi || data.pe?.OI || 0;
            const ceOIChg = data.ce?.oichng || data.ce?.oi_change || 0;
            const peOIChg = data.pe?.oichng || data.pe?.oi_change || 0;
            const ceGreeks = data.ce?.optgeeks || {};
            const peGreeks = data.pe?.optgeeks || {};

            const cePct = (ceOI / totalCE) * 100;
            const pePct = (peOI / totalPE) * 100;
            const combinedPct = ((ceOI + peOI) / totalAll) * 100;

            // Greeks
            const ceDelta = ceGreeks.delta || 0;
            const peDelta = peGreeks.delta || 0;
            const ceGamma = ceGreeks.gamma || 0;
            const peGamma = peGreeks.gamma || 0;

            // Advanced calculations
            const ceDeltaAdjustedOI = Math.abs(ceDelta) * ceOI * NIFTY_CONFIG.contractMultiplier;
            const peDeltaAdjustedOI = Math.abs(peDelta) * peOI * NIFTY_CONFIG.contractMultiplier;
            const ceGammaExposure = ceGamma * ceOI * NIFTY_CONFIG.contractMultiplier * spotPrice / 100;
            const peGammaExposure = -peGamma * peOI * NIFTY_CONFIG.contractMultiplier * spotPrice / 100; // Negative for PEs

            totalGEX += Math.abs(ceGammaExposure) + Math.abs(peGammaExposure);
            netGEX += ceGammaExposure + peGammaExposure;

            strikes.push({
                strike,
                ceOI, peOI,
                ceOIChg, peOIChg,
                cePct, pePct,
                combinedPct,
                ceDelta, peDelta,
                ceGamma, peGamma,
                ceDeltaAdjustedOI, peDeltaAdjustedOI,
                ceGammaExposure, peGammaExposure,
                ceOIChgPct: ceOI > 0 ? (ceOIChg / ceOI * 100) : 0,
                peOIChgPct: peOI > 0 ? (peOIChg / peOI * 100) : 0,
            });
        });

        strikes.sort((a, b) => a.strike - b.strike);

        // Step 2: Calculate benchmarks for statistical analysis
        const ceOIs = strikes.map(s => s.ceOI).filter(v => v > 0);
        const peOIs = strikes.map(s => s.peOI).filter(v => v > 0);
        const ceGexs = strikes.map(s => Math.abs(s.ceGammaExposure)).filter(v => v > 0);
        const peGexs = strikes.map(s => Math.abs(s.peGammaExposure)).filter(v => v > 0);
        const ceDeltaOIs = strikes.map(s => s.ceDeltaAdjustedOI).filter(v => v > 0);
        const peDeltaOIs = strikes.map(s => s.peDeltaAdjustedOI).filter(v => v > 0);

        const ceBenchmarks = {
            oi: { mean: stats.mean(ceOIs), std: stats.stdDev(ceOIs), iqr: stats.iqr(ceOIs) },
            gex: { mean: stats.mean(ceGexs), std: stats.stdDev(ceGexs) },
            deltaOI: { mean: stats.mean(ceDeltaOIs), std: stats.stdDev(ceDeltaOIs) },
        };

        const peBenchmarks = {
            oi: { mean: stats.mean(peOIs), std: stats.stdDev(peOIs), iqr: stats.iqr(peOIs) },
            gex: { mean: stats.mean(peGexs), std: stats.stdDev(peGexs) },
            deltaOI: { mean: stats.mean(peDeltaOIs), std: stats.stdDev(peDeltaOIs) },
        };

        // Step 3: Identify and score walls
        const ceWalls = strikes
            .map(s => ({
                strike: s.strike,
                oi: s.ceOI,
                oiChg: s.ceOIChg,
                pct: s.cePct,
                delta: s.ceDelta,
                gamma: s.ceGamma,
                gammaExposure: s.ceGammaExposure,
                deltaAdjustedOI: s.ceDeltaAdjustedOI,
            }))
            .filter(w => w.oi >= NIFTY_CONFIG.minOI && w.pct >= NIFTY_CONFIG.weakWallPct)
            .map(w => ({
                ...w,
                ...analyzeWallStrength(w, 'resistance', spotPrice, ceBenchmarks, lotSize),
            }))
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 6);

        const peWalls = strikes
            .map(s => ({
                strike: s.strike,
                oi: s.peOI,
                oiChg: s.peOIChg,
                pct: s.pePct,
                delta: s.peDelta,
                gamma: s.peGamma,
                gammaExposure: s.peGammaExposure,
                deltaAdjustedOI: s.peDeltaAdjustedOI,
            }))
            .filter(w => w.oi >= NIFTY_CONFIG.minOI && w.pct >= NIFTY_CONFIG.weakWallPct)
            .map(w => ({
                ...w,
                ...analyzeWallStrength(w, 'support', spotPrice, peBenchmarks, lotSize),
            }))
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 6);

        // Step 4: Find immediate levels
        const immediateResistance = ceWalls.find(w => w.strike > spotPrice);
        const immediateSupport = [...peWalls].reverse().find(w => w.strike < spotPrice);

        // Gamma regime calculation
        const gammaRegime = netGEX > 0 ? 'Positive' : 'Negative';
        const gammaRegimeDesc = netGEX > 0
            ? 'Mean-reverting (dealers buy dips/sell rallies)'
            : 'Trending (dealers amplify moves)';

        // Summary stats
        const summaryStats = {
            totalCE,
            totalPE,
            pcr: totalPE / totalCE,
            resistanceCount: ceWalls.length,
            supportCount: peWalls.length,
            buildingResistance: ceWalls.filter(w => w.status === 'building').length,
            buildingSupport: peWalls.filter(w => w.status === 'building').length,
            institutionalWalls: ceWalls.filter(w => w.isInstitutional).length + peWalls.filter(w => w.isInstitutional).length,
            pinnedStrikes: ceWalls.filter(w => w.hasPinRisk).length + peWalls.filter(w => w.hasPinRisk).length,
            immediateResistance: immediateResistance?.strike || null,
            immediateSupport: immediateSupport?.strike || null,
            strongestResistance: ceWalls[0]?.strike || null,
            strongestSupport: peWalls[0]?.strike || null,
            totalGEX: formatCurrency(totalGEX),
            netGEX: formatCurrency(netGEX),
            gammaRegime,
            gammaRegimeDesc,
        };

        return {
            concentration: strikes,
            walls: { ce: ceWalls, pe: peWalls },
            summaryStats,
        };
    }, [optionChain, totalOI, spotPrice, lotSize]);

    // Filter visible strikes around ATM
    const _visibleStrikes = useMemo(() => {
        if (!concentration) return [];
        const atmIdx = concentration.findIndex(s => s.strike >= atmStrike);
        const start = Math.max(0, atmIdx - NIFTY_CONFIG.relevantRange);
        const end = Math.min(concentration.length, atmIdx + NIFTY_CONFIG.relevantRange + 1);
        return concentration.slice(start, end);
    }, [concentration, atmStrike]);

    // ============ UI RENDERING ============
    if (!optionChain || !concentration) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const getStrengthColor = (strength) => {
        if (strength >= 75) return 'from-red-500 to-rose-500';
        if (strength >= 55) return 'from-orange-500 to-amber-500';
        if (strength >= 35) return 'from-amber-500 to-yellow-500';
        return 'from-gray-400 to-gray-500';
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'building':
                return <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] rounded font-bold">BUILDING</span>;
            case 'weakening':
                return <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] rounded font-bold">WEAKENING</span>;
            default:
                return <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[9px] rounded font-bold">STABLE</span>;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldExclamationIcon className="w-4 h-4" />
                        <span className="text-xs opacity-80">Resistance</span>
                    </div>
                    <div className="text-2xl font-bold">{summaryStats?.immediateResistance || '--'}</div>
                    <div className="text-[10px] opacity-70">Immediate ceiling</div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheckIcon className="w-4 h-4" />
                        <span className="text-xs opacity-80">Support</span>
                    </div>
                    <div className="text-2xl font-bold">{summaryStats?.immediateSupport || '--'}</div>
                    <div className="text-[10px] opacity-70">Immediate floor</div>
                </div>

                <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="text-[10px] text-gray-500 mb-1">Gamma Regime</div>
                    <div className={`text-lg font-bold ${summaryStats?.gammaRegime === 'Positive' ? 'text-green-600' : 'text-red-600'}`}>
                        {summaryStats?.gammaRegime}
                    </div>
                    <div className="text-[9px] text-gray-400">{summaryStats?.gammaRegime === 'Positive' ? 'Mean-reverting' : 'Trending'}</div>
                </div>

                <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="text-[10px] text-gray-500 mb-1">Walls Building</div>
                    <div className="flex items-center gap-2">
                        <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                        <span className="text-lg font-bold text-green-600">{summaryStats?.buildingResistance || 0}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-lg font-bold text-green-600">{summaryStats?.buildingSupport || 0}</span>
                    </div>
                    <div className="text-[9px] text-gray-400">Res / Sup</div>
                </div>

                <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="text-[10px] text-gray-500 mb-1">PCR (OI)</div>
                    <div className={`text-lg font-bold ${summaryStats?.pcr > 1.2 ? 'text-green-600' : summaryStats?.pcr < 0.8 ? 'text-red-600' : 'text-gray-600'}`}>
                        {summaryStats?.pcr?.toFixed(2) || '--'}
                    </div>
                    <div className="text-[9px] text-gray-400">
                        {summaryStats?.pcr > 1.2 ? 'Bullish' : summaryStats?.pcr < 0.8 ? 'Bearish' : 'Neutral'}
                    </div>
                </div>
            </div>

            {/* Wall Panels */}
            <div className="grid grid-cols-2 gap-4">
                {/* Resistance Walls (CE) */}
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldExclamationIcon className="w-4 h-4" />
                            <span className="font-semibold text-sm">Resistance Walls (CE)</span>
                        </div>
                        <span className="text-[10px] opacity-80">Greeks-Weighted</span>
                    </div>
                    <div className="p-3">
                        {walls?.ce?.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-xs">No significant walls</div>
                        ) : (
                            <div className="space-y-3">
                                {walls?.ce?.map((wall, i) => (
                                    <div key={i} className="space-y-1">
                                        <div
                                            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded p-1 -m-1"
                                            onClick={() => setShowDetails(showDetails.type === 'ce' && showDetails.index === i ? { type: null, index: null } : { type: 'ce', index: i })}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>
                                                    {i + 1}
                                                </span>
                                                <span className="font-bold">{wall.strike}</span>
                                                {wall.isInstitutional && <BoltIcon className="w-3 h-3 text-yellow-500" />}
                                                {wall.isAnomaly && <BeakerIcon className="w-3 h-3 text-purple-500" />}
                                                {wall.hasPinRisk && <span className="text-[9px]">📌</span>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(wall.status)}
                                                <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full bg-gradient-to-r ${getStrengthColor(wall.strength)}`}
                                                        style={{ width: `${wall.strength}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold w-8">{wall.strength.toFixed(0)}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-500 pl-8">
                                            <span>OI: {formatNumber(wall.oi)} ({wall.pct.toFixed(1)}%)</span>
                                            <span>GEX: {formatCurrency(wall.gammaExposure)}</span>
                                        </div>

                                        {/* Expanded Details */}
                                        <AnimatePresence>
                                            {showDetails.type === 'ce' && showDetails.index === i && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="mt-2 pl-8 text-xs"
                                                >
                                                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                                                        <div className="text-gray-600 dark:text-gray-300">{wall.interpretation}</div>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {Object.entries(wall.factors).map(([key, data]) => (
                                                                <div key={key} className="text-center">
                                                                    <div className="text-[9px] text-gray-400">{key}</div>
                                                                    <div className="w-full h-1 bg-gray-200 dark:bg-gray-600 rounded-full">
                                                                        <div
                                                                            className="h-full bg-red-500 rounded-full"
                                                                            style={{ width: `${data.score}%` }}
                                                                        />
                                                                    </div>
                                                                    <div className="text-[9px] font-medium">{data.label}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Support Walls (PE) */}
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheckIcon className="w-4 h-4" />
                            <span className="font-semibold text-sm">Support Walls (PE)</span>
                        </div>
                        <span className="text-[10px] opacity-80">Greeks-Weighted</span>
                    </div>
                    <div className="p-3">
                        {walls?.pe?.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-xs">No significant walls</div>
                        ) : (
                            <div className="space-y-3">
                                {walls?.pe?.map((wall, i) => (
                                    <div key={i} className="space-y-1">
                                        <div
                                            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded p-1 -m-1"
                                            onClick={() => setShowDetails(showDetails.type === 'pe' && showDetails.index === i ? { type: null, index: null } : { type: 'pe', index: i })}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>
                                                    {i + 1}
                                                </span>
                                                <span className="font-bold">{wall.strike}</span>
                                                {wall.isInstitutional && <BoltIcon className="w-3 h-3 text-yellow-500" />}
                                                {wall.isAnomaly && <BeakerIcon className="w-3 h-3 text-purple-500" />}
                                                {wall.hasPinRisk && <span className="text-[9px]">📌</span>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(wall.status)}
                                                <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full bg-gradient-to-r ${getStrengthColor(wall.strength)}`}
                                                        style={{ width: `${wall.strength}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold w-8">{wall.strength.toFixed(0)}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-500 pl-8">
                                            <span>OI: {formatNumber(wall.oi)} ({wall.pct.toFixed(1)}%)</span>
                                            <span>GEX: {formatCurrency(wall.gammaExposure)}</span>
                                        </div>

                                        {/* Expanded Details */}
                                        <AnimatePresence>
                                            {showDetails.type === 'pe' && showDetails.index === i && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="mt-2 pl-8 text-xs"
                                                >
                                                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                                                        <div className="text-gray-600 dark:text-gray-300">{wall.interpretation}</div>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {Object.entries(wall.factors).map(([key, data]) => (
                                                                <div key={key} className="text-center">
                                                                    <div className="text-[9px] text-gray-400">{key}</div>
                                                                    <div className="w-full h-1 bg-gray-200 dark:bg-gray-600 rounded-full">
                                                                        <div
                                                                            className="h-full bg-green-500 rounded-full"
                                                                            style={{ width: `${data.score}%` }}
                                                                        />
                                                                    </div>
                                                                    <div className="text-[9px] font-medium">{data.label}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Algorithm Toggle */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'} border ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <button
                    onClick={() => setShowAlgorithm(!showAlgorithm)}
                    className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                >
                    <ShieldCheckIcon className="w-4 h-4" />
                    {showAlgorithm ? 'Hide' : 'Show'} Wall Scoring Algorithm
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${showAlgorithm ? 'rotate-180' : ''}`} />
                </button>

                {showAlgorithm && (
                    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg text-xs space-y-2">
                        <div className="font-semibold text-indigo-600 mb-2">6-Factor Wall Strength Algorithm</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>• OI Magnitude: 25%</div>
                            <div>• Concentration %: 20%</div>
                            <div>• Gamma Exposure: 18%</div>
                            <div>• OI Change: 15%</div>
                            <div>• Delta-Adjusted OI: 12%</div>
                            <div>• Proximity to Spot: 10%</div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500">
                            <div>⚡ Institutional: OI &gt;4L OR GEX &gt;₹1Cr</div>
                            <div>📌 Pin Risk: Gamma &gt;0.005</div>
                            <div>🧪 Anomaly: IQR outlier on OI</div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default OIConcentrationAnalysis;

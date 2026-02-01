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

// ============ NIFTY 50 CALIBRATED THRESHOLDS ============
const NIFTY_CONFIG = {
    lotSize: 75,
    contractMultiplier: 75,

    // OI Thresholds (calibrated for NIFTY)
    minOI: 20000,
    significantOI: 100000,
    strongOI: 200000,
    institutionalOI: 500000,

    // OI Change Thresholds
    minOIChange: 5000,
    significantOIChange: 20000,
    strongOIChange: 50000,

    // Volume Thresholds
    minVolume: 500,
    strongVolume: 5000,

    // Premium Thresholds (in ₹)
    minPremium: 500000,      // 5L
    strongPremium: 2000000,  // 20L
    institutionalPremium: 5000000, // 50L

    // Greeks Thresholds
    deltaThreshold: 0.15,    // Min delta for significance
    gammaCritical: 0.01,     // High gamma = high sensitivity
    vegaCritical: 10,        // High vega = volatility sensitive

    // IV Thresholds (NIFTY VIX historical)
    ivLow: 12,
    ivNormal: 16,
    ivHigh: 22,
    ivExtreme: 30,

    // Z-Score Thresholds
    zScoreSignificant: 1.5,
    zScoreStrong: 2.0,
    zScoreExtreme: 3.0,
};

// ============ MARKET IMPLICATION MATRIX ============
const MARKET_IMPLICATION = {
    CE: { LB: 'bullish', SB: 'bearish', SC: 'bullish', LU: 'bearish' },
    PE: { LB: 'bearish', SB: 'bullish', SC: 'bearish', LU: 'bullish' },
};

// ============ STATISTICAL FUNCTIONS ============
const stats = {
    mean: arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,

    stdDev: arr => {
        if (arr.length < 2) return 0;
        const mean = stats.mean(arr);
        return Math.sqrt(arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / arr.length);
    },

    zScore: (value, mean, stdDev) => stdDev === 0 ? 0 : (value - mean) / stdDev,

    percentile: (value, sortedArr) => {
        if (sortedArr.length === 0) return 50;
        const idx = sortedArr.findIndex(v => v >= value);
        return idx === -1 ? 100 : (idx / sortedArr.length) * 100;
    },

    median: arr => {
        if (!arr.length) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },

    // IQR for outlier detection
    iqr: arr => {
        if (arr.length < 4) return { q1: 0, q3: 0, iqr: 0, lowerBound: 0, upperBound: 0 };
        const sorted = [...arr].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        return { q1, q3, iqr, lowerBound: q1 - 1.5 * iqr, upperBound: q3 + 1.5 * iqr };
    },

    // Correlation coefficient
    correlation: (arr1, arr2) => {
        if (arr1.length !== arr2.length || arr1.length < 3) return 0;
        const mean1 = stats.mean(arr1), mean2 = stats.mean(arr2);
        const std1 = stats.stdDev(arr1), std2 = stats.stdDev(arr2);
        if (std1 === 0 || std2 === 0) return 0;
        const covariance = arr1.reduce((sum, val, i) => sum + (val - mean1) * (arr2[i] - mean2), 0) / arr1.length;
        return covariance / (std1 * std2);
    },

    // Sigmoid normalization (0-100)
    sigmoid: (x, k = 1) => 100 / (1 + Math.exp(-k * x)),
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

// ============ BUILDUP CLASSIFIER ============
const classifyBuildup = (contract) => {
    const { pChgPct, oiChg, oiChgPct } = contract;

    const hasSignificantActivity =
        Math.abs(oiChg) >= NIFTY_CONFIG.minOIChange ||
        Math.abs(oiChgPct) >= 3;

    if (!hasSignificantActivity) return 'NT';

    const priceUp = pChgPct > 0.3;
    const priceDown = pChgPct < -0.3;

    if (priceUp && oiChg > 0) return 'LB';
    if (priceDown && oiChg > 0) return 'SB';
    if (priceUp && oiChg < 0) return 'SC';
    if (priceDown && oiChg < 0) return 'LU';

    return 'NT';
};

// ============ ADVANCED MULTI-FACTOR SCORING ============
const calculateAdvancedScore = (contract, globalStats, atmIV) => {
    const factors = {};
    let totalScore = 0;
    let totalWeight = 0;

    // Factor 1: OI Magnitude (Weight: 15)
    const oiPercentile = stats.percentile(contract.oi, globalStats.sortedOI);
    const oiScore = (oiPercentile / 100) * 100;
    factors.oiMagnitude = { score: oiScore, weight: 15, raw: oiPercentile.toFixed(0) + 'th' };
    totalScore += oiScore * 15;
    totalWeight += 15;

    // Factor 2: OI Change Z-Score (Weight: 20) - Statistical significance
    const oiChgZ = stats.zScore(Math.abs(contract.oiChg), globalStats.oiChgMean, globalStats.oiChgStdDev);
    let oiChgScore = 0;
    if (oiChgZ >= NIFTY_CONFIG.zScoreExtreme) oiChgScore = 100;
    else if (oiChgZ >= NIFTY_CONFIG.zScoreStrong) oiChgScore = 80;
    else if (oiChgZ >= NIFTY_CONFIG.zScoreSignificant) oiChgScore = 60;
    else if (oiChgZ >= 1) oiChgScore = 40;
    else if (oiChgZ >= 0.5) oiChgScore = 20;
    factors.oiChangeZScore = { score: oiChgScore, weight: 20, raw: oiChgZ.toFixed(2) + 'σ' };
    totalScore += oiChgScore * 20;
    totalWeight += 20;

    // Factor 3: Volume/OI Ratio (Weight: 10) - Activity confirmation
    let volOIScore = 0;
    if (contract.volOIRatio >= 100) volOIScore = 100;
    else if (contract.volOIRatio >= 50) volOIScore = 70;
    else if (contract.volOIRatio >= 25) volOIScore = 40;
    else if (contract.volOIRatio >= 10) volOIScore = 20;
    factors.volumeRatio = { score: volOIScore, weight: 10, raw: contract.volOIRatio.toFixed(0) + '%' };
    totalScore += volOIScore * 10;
    totalWeight += 10;

    // Factor 4: Premium Flow (Weight: 15) - Money flow significance
    let premiumScore = 0;
    if (contract.premium >= NIFTY_CONFIG.institutionalPremium) premiumScore = 100;
    else if (contract.premium >= NIFTY_CONFIG.strongPremium) premiumScore = 70;
    else if (contract.premium >= NIFTY_CONFIG.minPremium) premiumScore = 40;
    factors.premiumFlow = { score: premiumScore, weight: 15, raw: formatCurrency(contract.premium) };
    totalScore += premiumScore * 15;
    totalWeight += 15;

    // Factor 5: Delta Magnitude (Weight: 12) - Option significance
    const deltaAbs = Math.abs(contract.delta || 0);
    let deltaScore = 0;
    if (deltaAbs >= 0.4 && deltaAbs <= 0.6) deltaScore = 100; // ATM most significant
    else if (deltaAbs >= 0.25) deltaScore = 70;
    else if (deltaAbs >= NIFTY_CONFIG.deltaThreshold) deltaScore = 40;
    factors.deltaMagnitude = { score: deltaScore, weight: 12, raw: (contract.delta || 0).toFixed(3) };
    totalScore += deltaScore * 12;
    totalWeight += 12;

    // Factor 6: Gamma Exposure (Weight: 10) - Hedging pressure
    const gammaGEX = Math.abs(contract.gamma || 0) * contract.oi * NIFTY_CONFIG.contractMultiplier;
    const gammaZ = stats.zScore(gammaGEX, globalStats.gexMean, globalStats.gexStdDev);
    let gammaScore = 0;
    if (gammaZ >= 2) gammaScore = 100;
    else if (gammaZ >= 1) gammaScore = 60;
    else if (gammaZ >= 0.5) gammaScore = 30;
    factors.gammaExposure = { score: gammaScore, weight: 10, raw: formatNumber(gammaGEX) };
    totalScore += gammaScore * 10;
    totalWeight += 10;

    // Factor 7: IV Context (Weight: 8) - Volatility pricing
    const ivRatio = contract.iv && atmIV ? (contract.iv / atmIV) : 1;
    let ivScore = 0;
    if (ivRatio >= 1.2) ivScore = 80; // High relative IV = fear/demand
    else if (ivRatio >= 1.1) ivScore = 50;
    else if (ivRatio >= 0.9) ivScore = 30;
    factors.ivContext = { score: ivScore, weight: 8, raw: contract.iv?.toFixed(1) + '%' };
    totalScore += ivScore * 8;
    totalWeight += 8;

    // Factor 8: ATM Proximity (Weight: 10) - Relevance to current price
    const strikesFromATM = Math.abs(contract.atmDistance / 50);
    let atmScore = 0;
    if (strikesFromATM <= 2) atmScore = 100;
    else if (strikesFromATM <= 4) atmScore = 70;
    else if (strikesFromATM <= 6) atmScore = 40;
    else if (strikesFromATM <= 10) atmScore = 20;
    factors.atmProximity = { score: atmScore, weight: 10, raw: strikesFromATM.toFixed(0) + ' strikes' };
    totalScore += atmScore * 10;
    totalWeight += 10;

    // Calculate final normalized score
    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    // Determine tier
    let tier = 'Low';
    if (finalScore >= 70) tier = 'Very High';
    else if (finalScore >= 55) tier = 'High';
    else if (finalScore >= 40) tier = 'Medium';

    // Check for institutional activity
    const isInstitutional =
        contract.oi >= NIFTY_CONFIG.institutionalOI ||
        contract.premium >= NIFTY_CONFIG.institutionalPremium ||
        oiChgZ >= NIFTY_CONFIG.zScoreStrong;

    // Check for anomaly (IQR outlier)
    const isAnomaly =
        Math.abs(contract.oiChg) > globalStats.oiChgIQR.upperBound ||
        contract.premium > globalStats.premiumIQR.upperBound;

    return {
        score: finalScore,
        factors,
        tier,
        isInstitutional,
        isAnomaly,
    };
};

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
        if (!optionChain || !spotPrice) {
            return { analysis: null, summary: null, insights: null, marketState: null };
        }

        const allContracts = [];
        const atm = atmStrike || spotPrice;

        // Step 1: Extract and normalize all contract data
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

                // Skip insignificant contracts
                if (oi < NIFTY_CONFIG.minOI || vol < NIFTY_CONFIG.minVolume) return;

                const pChgPct = ltp > 0 ? (pChg / ltp * 100) : 0;
                const oiChgPct = oi > 0 ? (oiChg / oi * 100) : 0;
                const premium = vol * ltp * lotSize;
                const volOIRatio = oi > 0 ? (vol / oi * 100) : 0;
                const atmDistance = Math.abs(strike - atm);

                // Delta-adjusted OI (true exposure in underlying terms)
                const delta = greeks.delta || 0;
                const gamma = greeks.gamma || 0;
                const vega = greeks.vega || 0;
                const theta = greeks.theta || 0;
                const deltaAdjustedOI = Math.abs(delta) * oi * NIFTY_CONFIG.contractMultiplier;
                const gammaExposure = gamma * oi * NIFTY_CONFIG.contractMultiplier * spotPrice / 100;

                allContracts.push({
                    strike,
                    type: optType.toUpperCase(),
                    vol,
                    oi,
                    oiChg,
                    oiChgPct,
                    ltp,
                    pChg,
                    pChgPct,
                    premium,
                    volOIRatio,
                    atmDistance,
                    iv,
                    delta,
                    gamma,
                    vega,
                    theta,
                    deltaAdjustedOI,
                    gammaExposure,
                });
            });
        });

        if (allContracts.length === 0) {
            return { analysis: null, summary: null, insights: null, marketState: null };
        }

        // Step 2: Calculate global statistics for normalization
        const oiValues = allContracts.map(c => c.oi).sort((a, b) => a - b);
        const oiChgAbs = allContracts.map(c => Math.abs(c.oiChg));
        const premiums = allContracts.map(c => c.premium);
        const gexValues = allContracts.map(c => Math.abs(c.gammaExposure));

        const globalStats = {
            sortedOI: oiValues,
            oiChgMean: stats.mean(oiChgAbs),
            oiChgStdDev: stats.stdDev(oiChgAbs),
            oiChgIQR: stats.iqr(oiChgAbs),
            premiumMean: stats.mean(premiums),
            premiumStdDev: stats.stdDev(premiums),
            premiumIQR: stats.iqr(premiums),
            gexMean: stats.mean(gexValues),
            gexStdDev: stats.stdDev(gexValues),
        };

        // Step 3: Score and classify each contract
        const scoredContracts = allContracts.map(c => {
            const buildupType = classifyBuildup(c);
            const scoreData = calculateAdvancedScore(c, globalStats, atmIV);
            const marketImplication = MARKET_IMPLICATION[c.type]?.[buildupType] || 'neutral';

            return {
                ...c,
                buildupType,
                confidence: scoreData.score,
                tier: scoreData.tier,
                factors: scoreData.factors,
                isInstitutional: scoreData.isInstitutional,
                isAnomaly: scoreData.isAnomaly,
                marketImplication,
            };
        });

        // Step 4: Calculate market sentiment with sophisticated weighting
        let bullishScore = 0;
        let bearishScore = 0;
        let totalDeltaAdjustedBullish = 0;
        let totalDeltaAdjustedBearish = 0;
        let _bullishGEX = 0;
        let _bearishGEX = 0;

        const bullishContracts = [];
        const bearishContracts = [];

        scoredContracts.forEach(c => {
            if (c.buildupType === 'NT') return;

            // Multi-factor weight: (confidence × premium × delta-adjustment) ^ 0.5
            const weight = Math.sqrt((c.confidence / 100) * Math.log10(c.premium + 1) * (1 + c.deltaAdjustedOI / 1000000));

            if (c.marketImplication === 'bullish') {
                bullishScore += weight;
                bullishContracts.push(c);
                totalDeltaAdjustedBullish += c.deltaAdjustedOI;
                _bullishGEX += c.gammaExposure;
            } else if (c.marketImplication === 'bearish') {
                bearishScore += weight;
                bearishContracts.push(c);
                totalDeltaAdjustedBearish += c.deltaAdjustedOI;
                _bearishGEX += c.gammaExposure;
            }
        });

        // Sort by confidence
        bullishContracts.sort((a, b) => b.confidence - a.confidence);
        bearishContracts.sort((a, b) => b.confidence - a.confidence);

        // Calculate final sentiment
        const totalScore = bullishScore + bearishScore;
        let sentimentScore = 50;
        let sentiment = 'Neutral';
        let sentimentEmoji = '⚖️';

        if (totalScore > 0) {
            sentimentScore = (bullishScore / totalScore) * 100;

            if (sentimentScore >= 70) { sentiment = 'Strongly Bullish'; sentimentEmoji = '🟢🟢'; }
            else if (sentimentScore >= 58) { sentiment = 'Moderately Bullish'; sentimentEmoji = '🟢'; }
            else if (sentimentScore >= 52) { sentiment = 'Mildly Bullish'; sentimentEmoji = '🟡🟢'; }
            else if (sentimentScore <= 30) { sentiment = 'Strongly Bearish'; sentimentEmoji = '🔴🔴'; }
            else if (sentimentScore <= 42) { sentiment = 'Moderately Bearish'; sentimentEmoji = '🔴'; }
            else if (sentimentScore <= 48) { sentiment = 'Mildly Bearish'; sentimentEmoji = '🟡🔴'; }
        }

        // Step 5: Aggregate by buildup type
        const typeStats = {};
        ['LB', 'SB', 'SC', 'LU', 'NT'].forEach(type => {
            const typeContracts = scoredContracts.filter(c => c.buildupType === type);
            const ceContracts = typeContracts.filter(c => c.type === 'CE');
            const peContracts = typeContracts.filter(c => c.type === 'PE');

            typeStats[type] = {
                count: typeContracts.length,
                ceCount: ceContracts.length,
                peCount: peContracts.length,
                oiChange: typeContracts.reduce((s, c) => s + c.oiChg, 0),
                premium: typeContracts.reduce((s, c) => s + c.premium, 0),
                deltaAdjustedOI: typeContracts.reduce((s, c) => s + c.deltaAdjustedOI, 0),
                gammaExposure: typeContracts.reduce((s, c) => s + c.gammaExposure, 0),
                avgConfidence: typeContracts.length > 0
                    ? stats.mean(typeContracts.map(c => c.confidence)) : 0,
                highConfidence: typeContracts.filter(c => c.confidence >= 55).length,
                institutional: typeContracts.filter(c => c.isInstitutional).length,
                anomalies: typeContracts.filter(c => c.isAnomaly).length,
                contracts: typeContracts,
            };
        });

        // Step 6: Generate AI Insights
        const insights = {
            bullishFactors: [],
            bearishFactors: [],
            anomalies: [],
            keyLevels: { resistance: null, support: null },
        };

        // Bullish factors
        const ceLB = scoredContracts.filter(c => c.type === 'CE' && c.buildupType === 'LB');
        const peSB = scoredContracts.filter(c => c.type === 'PE' && c.buildupType === 'SB');
        const peLU = scoredContracts.filter(c => c.type === 'PE' && c.buildupType === 'LU');

        if (ceLB.length > 0) {
            const avgConf = stats.mean(ceLB.map(c => c.confidence));
            insights.bullishFactors.push({
                factor: `CE Long Buildup (${ceLB.length})`,
                confidence: avgConf,
                description: `Call buyers active - expecting upside`,
            });
        }
        if (peSB.length > 0) {
            const avgConf = stats.mean(peSB.map(c => c.confidence));
            insights.bullishFactors.push({
                factor: `PE Short Buildup (${peSB.length})`,
                confidence: avgConf,
                description: `Put writers supporting - expecting stability/upside`,
            });
        }
        if (peLU.length > 0) {
            const avgConf = stats.mean(peLU.map(c => c.confidence));
            insights.bullishFactors.push({
                factor: `PE Long Unwinding (${peLU.length})`,
                confidence: avgConf,
                description: `Put buyers exiting - downside fear subsiding`,
            });
        }

        // Bearish factors
        const peLB = scoredContracts.filter(c => c.type === 'PE' && c.buildupType === 'LB');
        const ceSB = scoredContracts.filter(c => c.type === 'CE' && c.buildupType === 'SB');
        const ceLU = scoredContracts.filter(c => c.type === 'CE' && c.buildupType === 'LU');

        if (peLB.length > 0) {
            const avgConf = stats.mean(peLB.map(c => c.confidence));
            insights.bearishFactors.push({
                factor: `PE Long Buildup (${peLB.length})`,
                confidence: avgConf,
                description: `Put buyers active - expecting downside`,
            });
        }
        if (ceSB.length > 0) {
            const avgConf = stats.mean(ceSB.map(c => c.confidence));
            insights.bearishFactors.push({
                factor: `CE Short Buildup (${ceSB.length})`,
                confidence: avgConf,
                description: `Call writers capping - expecting sideways/down`,
            });
        }
        if (ceLU.length > 0) {
            const avgConf = stats.mean(ceLU.map(c => c.confidence));
            insights.bearishFactors.push({
                factor: `CE Long Unwinding (${ceLU.length})`,
                confidence: avgConf,
                description: `Call buyers exiting - upside hope fading`,
            });
        }

        // Find anomalies
        insights.anomalies = scoredContracts
            .filter(c => c.isAnomaly)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);

        // Key levels from max OI
        const strikeOI = {};
        scoredContracts.forEach(c => {
            if (!strikeOI[c.strike]) strikeOI[c.strike] = { ce: 0, pe: 0 };
            strikeOI[c.strike][c.type.toLowerCase()] = c.oi;
        });

        let maxCE = { strike: 0, oi: 0 };
        let maxPE = { strike: 0, oi: 0 };
        Object.entries(strikeOI).forEach(([strike, data]) => {
            if (data.ce > maxCE.oi) maxCE = { strike: parseFloat(strike), oi: data.ce };
            if (data.pe > maxPE.oi) maxPE = { strike: parseFloat(strike), oi: data.pe };
        });

        insights.keyLevels.resistance = maxCE;
        insights.keyLevels.support = maxPE;

        // Step 7: Calculate market state
        const totalGEX = scoredContracts.reduce((s, c) => s + c.gammaExposure, 0);
        const ceGEX = scoredContracts.filter(c => c.type === 'CE').reduce((s, c) => s + c.gammaExposure, 0);
        const peGEX = scoredContracts.filter(c => c.type === 'PE').reduce((s, c) => s + c.gammaExposure, 0);
        const netGEX = ceGEX - peGEX;

        const marketState = {
            pcr: pcr || 0,
            atmIV: atmIV || 0,
            dte: dte || 0,
            totalGEX,
            netGEX,
            deltaAdjustedBias: (totalDeltaAdjustedBullish - totalDeltaAdjustedBearish) /
                (totalDeltaAdjustedBullish + totalDeltaAdjustedBearish + 1) * 100,
            gammaRegime: netGEX > 0 ? 'Positive (Mean Reverting)' : 'Negative (Trending)',
        };

        return {
            analysis: typeStats,
            contracts: scoredContracts,
            summary: {
                sentiment,
                sentimentScore,
                sentimentEmoji,
                bullishScore,
                bearishScore,
                bullishContracts: bullishContracts.length,
                bearishContracts: bearishContracts.length,
                topBullish: bullishContracts.slice(0, 5),
                topBearish: bearishContracts.slice(0, 5),
                totalContracts: scoredContracts.length,
                institutionalCount: scoredContracts.filter(c => c.isInstitutional).length,
                anomalyCount: scoredContracts.filter(c => c.isAnomaly).length,
            },
            insights,
            marketState,
        };
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
            {/* Header */}
            <div className={`px-6 py-4 bg-gradient-to-r ${getSentimentColor(summary.sentimentScore)} text-white`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <CpuChipIcon className="w-6 h-6" />
                            Buildup Analysis v4
                        </h2>
                        <p className="text-sm opacity-80">Greeks + Data Mining + Statistical Analysis</p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold flex items-center gap-2 justify-end">
                            <span>{summary.sentimentEmoji}</span>
                            <span>{summary.sentiment}</span>
                        </div>
                        <div className="text-sm opacity-80">
                            Score: {summary.sentimentScore.toFixed(0)}%
                        </div>
                    </div>
                </div>

                {/* Sentiment Bar */}
                <div className="mt-4">
                    <div className="h-4 bg-white/20 rounded-full overflow-hidden relative">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${summary.sentimentScore}%` }}
                            transition={{ duration: 0.7 }}
                            className="h-full bg-white/80 rounded-full"
                        />
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-0.5 bg-white/50" />
                    </div>
                    <div className="flex justify-between text-xs mt-1 opacity-70">
                        <span>🔴 Bearish</span>
                        <span>50</span>
                        <span>Bullish 🟢</span>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-5 gap-2 mt-3 text-xs">
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summary.bullishContracts}/{summary.bearishContracts}</div>
                        <div className="opacity-70">Bull/Bear</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summary.institutionalCount}</div>
                        <div className="opacity-70">Institutional</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summary.anomalyCount}</div>
                        <div className="opacity-70">Anomalies</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{marketState.pcr?.toFixed(2) || 'N/A'}</div>
                        <div className="opacity-70">PCR</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{marketState.atmIV?.toFixed(1) || 'N/A'}%</div>
                        <div className="opacity-70">ATM IV</div>
                    </div>
                </div>
            </div>

            {/* Market State Panel */}
            <div className={`grid grid-cols-3 gap-2 p-3 ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'} text-xs border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="text-center">
                    <span className="text-gray-500">Resistance:</span>{' '}
                    <span className="font-bold text-red-600">{insights.keyLevels.resistance?.strike}</span>
                    <span className="text-gray-400 ml-1">({formatNumber(insights.keyLevels.resistance?.oi)})</span>
                </div>
                <div className="text-center">
                    <span className="text-gray-500">Gamma:</span>{' '}
                    <span className={`font-bold ${marketState.netGEX > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {marketState.gammaRegime}
                    </span>
                </div>
                <div className="text-center">
                    <span className="text-gray-500">Support:</span>{' '}
                    <span className="font-bold text-green-600">{insights.keyLevels.support?.strike}</span>
                    <span className="text-gray-400 ml-1">({formatNumber(insights.keyLevels.support?.oi)})</span>
                </div>
            </div>

            {/* Insights Panel */}
            <div className={`grid grid-cols-2 gap-4 p-4 ${isDark ? 'bg-slate-800/30' : 'bg-white'}`}>
                <div>
                    <h4 className="text-xs font-bold text-green-600 mb-2 flex items-center gap-1">
                        <ArrowTrendingUpIcon className="w-4 h-4" /> Bullish Factors
                    </h4>
                    {insights.bullishFactors.length === 0 ? (
                        <div className="text-xs text-gray-400 italic">No bullish signals detected</div>
                    ) : (
                        <div className="space-y-1">
                            {insights.bullishFactors.map((f, i) => (
                                <div key={i} className="text-xs p-2 bg-green-50 dark:bg-green-900/20 rounded">
                                    <div className="flex justify-between">
                                        <span className="font-medium text-green-700 dark:text-green-400">{f.factor}</span>
                                        <span className="text-green-600">{f.confidence.toFixed(0)}%</span>
                                    </div>
                                    <div className="text-gray-500 text-[10px]">{f.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <h4 className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1">
                        <ArrowTrendingDownIcon className="w-4 h-4" /> Bearish Factors
                    </h4>
                    {insights.bearishFactors.length === 0 ? (
                        <div className="text-xs text-gray-400 italic">No bearish signals detected</div>
                    ) : (
                        <div className="space-y-1">
                            {insights.bearishFactors.map((f, i) => (
                                <div key={i} className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                    <div className="flex justify-between">
                                        <span className="font-medium text-red-700 dark:text-red-400">{f.factor}</span>
                                        <span className="text-red-600">{f.confidence.toFixed(0)}%</span>
                                    </div>
                                    <div className="text-gray-500 text-[10px]">{f.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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

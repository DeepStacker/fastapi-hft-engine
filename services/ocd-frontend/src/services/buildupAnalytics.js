/**
 * Buildup Analytics Service
 * 
 * Shared logic for Buildup Analysis and Market Pulse
 */

// ============ NIFTY 50 CALIBRATED THRESHOLDS (SCALPING MODE) ============
export const NIFTY_CONFIG = {
    lotSize: 75,
    contractMultiplier: 75,

    // OI Thresholds (calibrated for NIFTY SCALPING)
    minOI: 10000,          // Reduced from 20k
    significantOI: 50000,  // Reduced from 100k
    strongOI: 100000,      // Reduced from 200k
    institutionalOI: 300000, // Reduced from 500k

    // OI Change Thresholds (High Sensitivity)
    minOIChange: 1000,     // Reduced from 5000 for instant detection
    significantOIChange: 5000,
    strongOIChange: 25000,

    // Volume Thresholds
    minVolume: 200,        // Reduced from 500
    strongVolume: 2000,

    // Premium Thresholds (in ₹)
    minPremium: 100000,      // 1L
    strongPremium: 1000000,  // 10L
    institutionalPremium: 2500000, // 25L

    // Greeks Thresholds
    deltaThreshold: 0.10,    // More sensitive delta
    gammaCritical: 0.005,    // More sensitive gamma
    vegaCritical: 5,

    // IV Thresholds (NIFTY VIX historical)
    ivLow: 12,
    ivNormal: 16,
    ivHigh: 22,
    ivExtreme: 30,

    // Z-Score Thresholds (More sensitive)
    zScoreSignificant: 1.0,  // Reduced from 1.5
    zScoreStrong: 1.5,       // Reduced from 2.0
    zScoreExtreme: 2.5,
};

// ============ MARKET IMPLICATION MATRIX ============
export const MARKET_IMPLICATION = {
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
export const formatNumber = (num) => {
    if (!num) return '0';
    const abs = Math.abs(num);
    if (abs >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
    if (abs >= 1e5) return (num / 1e5).toFixed(2) + 'L';
    if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
};

export const formatCurrency = (num) => {
    if (!num) return '₹0';
    const abs = Math.abs(num);
    if (abs >= 1e7) return '₹' + (num / 1e7).toFixed(1) + 'Cr';
    if (abs >= 1e5) return '₹' + (num / 1e5).toFixed(1) + 'L';
    if (abs >= 1e3) return '₹' + (num / 1e3).toFixed(0) + 'K';
    return '₹' + num.toFixed(0);
};

// ============ BUILDUP CLASSIFIER ============
export const classifyBuildup = (contract) => {
    const { pChgPct, oiChg, oiChgPct } = contract;

    // SCALPING SENSITIVITY: Detect even minor institutional activity
    const hasSignificantActivity =
        Math.abs(oiChg) >= NIFTY_CONFIG.minOIChange ||
        Math.abs(oiChgPct) >= 1; // Sensitive to 1% OI change

    if (!hasSignificantActivity) return 'NT';

    // SCALPING SENSITIVITY: 0.05% price move (~10-15 pts on Nifty) is significant for scalping
    const priceUp = pChgPct > 0.05;
    const priceDown = pChgPct < -0.05;

    if (priceUp && oiChg > 0) return 'LB';
    if (priceDown && oiChg > 0) return 'SB';
    if (priceUp && oiChg < 0) return 'SC';
    if (priceDown && oiChg < 0) return 'LU';

    return 'NT';
};

// ============ PATTERN RECOGNITION (DATA MINING) ============
export const detectClusters = (scoredContracts) => {
    // Group by Option Type (CE/PE)
    const ceContracts = scoredContracts.filter(c => c.type === 'CE').sort((a, b) => a.strike - b.strike);
    const peContracts = scoredContracts.filter(c => c.type === 'PE').sort((a, b) => a.strike - b.strike);

    const markClusters = (contracts) => {
        for (let i = 1; i < contracts.length - 1; i++) {
            const prev = contracts[i - 1];
            const curr = contracts[i];
            const next = contracts[i + 1];

            // Check for pattern consistency (e.g., all 3 are Long Buildup)
            // AND ensure they are adjacent strikes (diff matches lot gap, usually 50 or 100)
            // For robustness, we just check if they are the immediate sorted neighbors
            if (curr.buildupType !== 'NT' &&
                prev.buildupType === curr.buildupType &&
                next.buildupType === curr.buildupType) {

                // FOUND A CLUSTER
                prev.isClustered = true;
                curr.isClustered = true;
                next.isClustered = true;

                // Boost Confidence
                prev.confidence = Math.min(100, prev.confidence * 1.2);
                curr.confidence = Math.min(100, curr.confidence * 1.3); // Center gets higher boost
                next.confidence = Math.min(100, next.confidence * 1.2);

                // Add Cluster Factor
                [prev, curr, next].forEach(c => {
                    if (!c.factors) c.factors = {};
                    c.factors.clusterSupport = {
                        score: 100,
                        weight: 25,
                        raw: '3-Strike Pattern'
                    };
                });
            }
        }
    };

    markClusters(ceContracts);
    markClusters(peContracts);
};

// ============ ADVANCED MULTI-FACTOR SCORING ============
export const calculateAdvancedScore = (contract, globalStats, atmIV) => {
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

// ============ CORE ANALYSIS FUNCTION ============
export const analyzeBuildup = (optionChain, spotPrice, atmStrike, lotSize, atmIV, pcr, dte) => {
    if (!optionChain || !spotPrice) {
        return { analysis: null, summary: null, insights: null, marketState: null };
    }

    const allContracts = [];
    const atm = atmStrike || spotPrice;
    const configLotSize = lotSize || NIFTY_CONFIG.lotSize;

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
            const premium = vol * ltp * configLotSize;
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
            isClustered: false, // Default, will be updated by miner
        };
    });

    // Step 3.5: Run Data Mining (Pattern Recognition)
    detectClusters(scoredContracts);

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
        // CLUSTER BOOST: If clustered, weight is significantly amplified (High Precision)
        const clusterMultiplier = c.isClustered ? 2.0 : 1.0;
        const weight = Math.sqrt((c.confidence / 100) * Math.log10(c.premium + 1) * (1 + c.deltaAdjustedOI / 1000000)) * clusterMultiplier;

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
            clustered: typeContracts.filter(c => c.isClustered).length,
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
            clusterCount: scoredContracts.filter(c => c.isClustered).length,
        },
        insights,
        marketState,
    };
};

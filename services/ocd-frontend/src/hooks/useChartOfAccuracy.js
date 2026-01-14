import { useMemo } from 'react';

/**
 * Hook to calculate Chart of Accuracy 1.0 scenario
 * 
 * Detection Logic:
 * - Strong: 100% strike with no other strike >= 75%
 * - WTB (Weak Towards Bottom): 2nd strike at 75-100% with 100% strike losing strength (negative OI CHG)
 * - WTT (Weak Towards Top): 2nd strike at 75-100% with that strike gaining strength (positive OI CHG)
 * 
 * 9 Scenarios:
 * 1.0: S=Strong, R=Strong → Neutral (Trade both EOS and EOR)
 * 1.1: S=Strong, R=WTB   → Bearish (Top=EOR, Bottom=EOS-1)
 * 1.2: S=Strong, R=WTT   → Bullish (Top=WTT-1, Bottom=EOS)
 * 1.3: S=WTB,    R=Strong → Bearish (Top=EOR, Bottom=WTB+1)
 * 1.4: S=WTT,    R=Strong → Bullish (Top=EOR+1, Bottom=EOS)
 * 1.5: S=WTB,    R=WTB   → Blood Bath (No longs)
 * 1.6: S=WTT,    R=WTT   → Bull Run (No shorts)
 * 1.7: S=WTB,    R=WTT   → Not Tradable
 * 1.8: S=WTT,    R=WTB   → Not Tradable
 */

const COLUMNS = ['oi', 'oichng', 'volume']; // Priority order

/**
 * Get ITM depth for strike filtering
 */
const getITMDepth = (strike, atmStrike, side) => {
    if (!atmStrike) return 0;
    const stepSize = 50; // Assuming NIFTY 50-point steps

    if (side === 'ce') {
        return strike < atmStrike ? Math.round((atmStrike - strike) / stepSize) : 0;
    } else {
        return strike > atmStrike ? Math.round((strike - atmStrike) / stepSize) : 0;
    }
};

/**
 * Calculate strength for one side (CE or PE)
 * Returns: { strength: 'Strong'|'WTT'|'WTB', strike100: number, strike2nd: number, pct100: number, pct2nd: number }
 */
const calculateSideStrength = (optionChain, atmStrike, side) => {
    if (!optionChain) return null;

    const strikes = [];

    // Collect OI data for each strike
    Object.entries(optionChain).forEach(([strikeKey, data]) => {
        const strike = parseFloat(strikeKey);
        const sideData = data[side];
        if (!sideData) return;

        const oi = sideData.OI || sideData.oi || 0;
        const oiChng = sideData.oichng || sideData.oi_change || 0;
        const volume = sideData.volume || sideData.vol || 0;
        const ltp = sideData.ltp || 0;

        const itmDepth = getITMDepth(strike, atmStrike, side);
        const isValid = itmDepth <= 2; // Valid for 100% if <= 2 ITM

        if (oi > 0) {
            strikes.push({
                strike,
                oi,
                oiChng,
                volume,
                ltp,
                itmDepth,
                isValid
            });
        }
    });

    if (strikes.length === 0) return null;

    // Find max OI from valid strikes
    const validStrikes = strikes.filter(s => s.isValid);
    if (validStrikes.length === 0) return null;

    const maxOI = Math.max(...validStrikes.map(s => s.oi));
    if (maxOI === 0) return null;

    // Calculate percentages
    const withPct = strikes.map(s => ({
        ...s,
        pct: (s.oi / maxOI) * 100
    }));

    // Sort by OI descending
    withPct.sort((a, b) => b.oi - a.oi);

    const strike100 = withPct[0];
    const strike2nd = withPct.length > 1 ? withPct[1] : null;

    // Determine strength
    let strength = 'Strong';

    if (strike2nd && strike2nd.pct >= 75) {
        // There's a competitor at >= 75%
        // Use OI CHG to determine WTT vs WTB

        // Check if 100% strike is losing strength (negative OI CHG = WTB)
        // Check if 2nd strike is gaining strength (positive OI CHG = WTT)

        const is100Weakening = strike100.oiChng < 0;
        const is2ndStrengthening = strike2nd.oiChng > 0;

        // Determine direction of pressure
        if (side === 'ce') {
            // For Calls (Resistance):
            // WTT = resistance shifting up (2nd strike is HIGHER and gaining)
            // WTB = resistance shifting down (2nd strike is LOWER and gaining)
            if (strike2nd.strike > strike100.strike && is2ndStrengthening) {
                strength = 'WTT'; // Resistance moving up = bullish pressure
            } else if (strike2nd.strike < strike100.strike && (is100Weakening || is2ndStrengthening)) {
                strength = 'WTB'; // Resistance moving down = bearish pressure
            } else if (is100Weakening) {
                strength = strike2nd.strike > strike100.strike ? 'WTT' : 'WTB';
            } else {
                strength = 'WTT'; // Default to WTT if gaining upward
            }
        } else {
            // For Puts (Support):
            // WTT = support shifting up (2nd strike is HIGHER and gaining)
            // WTB = support shifting down (2nd strike is LOWER and gaining)
            if (strike2nd.strike > strike100.strike && is2ndStrengthening) {
                strength = 'WTT'; // Support moving up = bullish pressure
            } else if (strike2nd.strike < strike100.strike && (is100Weakening || is2ndStrengthening)) {
                strength = 'WTB'; // Support moving down = bearish pressure
            } else if (is100Weakening) {
                strength = strike2nd.strike > strike100.strike ? 'WTT' : 'WTB';
            } else {
                strength = 'WTB'; // Default to WTB if uncertain
            }
        }
    }

    return {
        strength,
        strike100: strike100.strike,
        strike2nd: strike2nd?.strike || null,
        pct100: strike100.pct,
        pct2nd: strike2nd?.pct || 0,
        oi100: strike100.oi,
        oi2nd: strike2nd?.oi || 0,
        oiChng100: strike100.oiChng,
        oiChng2nd: strike2nd?.oiChng || 0,
        ltp100: strike100.ltp,
        ltp2nd: strike2nd?.ltp || 0
    };
};

/**
 * Classify into one of 9 COA scenarios
 */
const classifyScenario = (supportStrength, resistanceStrength) => {
    const s = supportStrength;
    const r = resistanceStrength;

    // Scenario matrix
    if (s === 'Strong' && r === 'Strong') return { id: '1.0', bias: 'neutral', name: 'Strong Both', tradable: 'both' };
    if (s === 'Strong' && r === 'WTB') return { id: '1.1', bias: 'bearish', name: 'Bearish Pressure', tradable: 'short' };
    if (s === 'Strong' && r === 'WTT') return { id: '1.2', bias: 'bullish', name: 'Bullish Pressure', tradable: 'long' };
    if (s === 'WTB' && r === 'Strong') return { id: '1.3', bias: 'bearish', name: 'Support Weakness', tradable: 'short' };
    if (s === 'WTT' && r === 'Strong') return { id: '1.4', bias: 'bullish', name: 'Support Strength', tradable: 'long' };
    if (s === 'WTB' && r === 'WTB') return { id: '1.5', bias: 'bearish', name: 'Blood Bath', tradable: 'short_only' };
    if (s === 'WTT' && r === 'WTT') return { id: '1.6', bias: 'bullish', name: 'Bull Run', tradable: 'long_only' };
    if (s === 'WTB' && r === 'WTT') return { id: '1.7', bias: 'unclear', name: 'Not Tradable', tradable: 'none' };
    if (s === 'WTT' && r === 'WTB') return { id: '1.8', bias: 'unclear', name: 'Not Tradable', tradable: 'none' };

    return { id: '?', bias: 'unknown', name: 'Unknown', tradable: 'none' };
};

/**
 * Calculate EOS (Extension of Support) and EOR (Extension of Resistance)
 * EOS = Support Strike - PE LTP
 * EOR = Resistance Strike + CE LTP
 */
const calculateLevels = (optionChain, support, resistance, spotPrice) => {
    if (!support || !resistance || !optionChain) return null;

    const supportData = optionChain[support.strike100]?.pe;
    const resistanceData = optionChain[resistance.strike100]?.ce;

    const eos = supportData ? support.strike100 - (supportData.ltp || 0) : support.strike100;
    const eor = resistanceData ? resistance.strike100 + (resistanceData.ltp || 0) : resistance.strike100;

    // Get adjacent strikes for EOS+1, EOS-1, EOR+1, EOR-1
    const strikes = Object.keys(optionChain).map(Number).sort((a, b) => a - b);
    const stepSize = strikes.length > 1 ? strikes[1] - strikes[0] : 50;

    return {
        eos,
        eor,
        eos_plus1: eos + stepSize,
        eos_minus1: eos - stepSize,
        eor_plus1: eor + stepSize,
        eor_minus1: eor - stepSize,
        spotPrice,
        supportStrike: support.strike100,
        resistanceStrike: resistance.strike100,
        stepSize
    };
};

/**
 * Get trading recommendation based on scenario
 */
const getTradingRecommendation = (scenario, levels, support, resistance) => {
    const { id, bias, tradable } = scenario;

    let top = null;
    let bottom = null;
    let tradeAtEOS = false;
    let tradeAtEOR = false;
    let recommendation = '';

    switch (id) {
        case '1.0':
            top = levels?.eor;
            bottom = levels?.eos;
            tradeAtEOS = true;
            tradeAtEOR = true;
            recommendation = 'Ideal scenario! Trade reversals from both EOS and EOR.';
            break;
        case '1.1':
            top = levels?.eor;
            bottom = levels?.eos_minus1;
            tradeAtEOS = false;
            tradeAtEOR = true;
            recommendation = 'Bearish pressure. Support may break. Bottom at EOS-1.';
            break;
        case '1.2':
            top = resistance?.strike2nd ? resistance.strike100 - levels?.stepSize : levels?.eor;
            bottom = levels?.eos;
            tradeAtEOS = true;
            tradeAtEOR = false;
            recommendation = 'Bullish pressure. Resistance may break. Top at WTT-1.';
            break;
        case '1.3':
            top = levels?.eor;
            bottom = support?.strike2nd ? support.strike100 + levels?.stepSize : levels?.eos;
            tradeAtEOS = false;
            tradeAtEOR = true;
            recommendation = 'Bearish. Support weakening. Bottom at WTB+1.';
            break;
        case '1.4':
            top = levels?.eor_plus1;
            bottom = levels?.eos;
            tradeAtEOS = true;
            tradeAtEOR = false;
            recommendation = 'Bullish. Resistance may break upward. Top at EOR+1.';
            break;
        case '1.5':
            top = levels?.eor;
            bottom = null;
            tradeAtEOS = false;
            tradeAtEOR = true;
            recommendation = '🩸 BLOOD BATH! No bottom. Only short trades allowed.';
            break;
        case '1.6':
            top = null;
            bottom = levels?.eos;
            tradeAtEOS = true;
            tradeAtEOR = false;
            recommendation = '🚀 BULL RUN! No top. Only long trades allowed.';
            break;
        case '1.7':
        case '1.8':
            top = null;
            bottom = null;
            tradeAtEOS = false;
            tradeAtEOR = false;
            recommendation = '⚠️ NOT TRADABLE. Wait for clarity.';
            break;
        default:
            recommendation = 'Unable to determine scenario.';
    }

    return { top, bottom, tradeAtEOS, tradeAtEOR, recommendation };
};

/**
 * Main hook
 */
export const useChartOfAccuracy = (optionChain, spotPrice, atmStrike) => {
    return useMemo(() => {
        if (!optionChain || !spotPrice || !atmStrike) {
            return null;
        }

        // Calculate strength for both sides
        const support = calculateSideStrength(optionChain, atmStrike, 'pe');
        const resistance = calculateSideStrength(optionChain, atmStrike, 'ce');

        if (!support || !resistance) {
            return null;
        }

        // Classify scenario
        const scenario = classifyScenario(support.strength, resistance.strength);

        // Calculate levels
        const levels = calculateLevels(optionChain, support, resistance, spotPrice);

        // Get trading recommendation
        const trading = getTradingRecommendation(scenario, levels, support, resistance);

        return {
            scenario,
            support: {
                ...support,
                type: 'Support (PE)'
            },
            resistance: {
                ...resistance,
                type: 'Resistance (CE)'
            },
            levels,
            trading,
            spotPrice,
            atmStrike
        };
    }, [optionChain, spotPrice, atmStrike]);
};

export default useChartOfAccuracy;

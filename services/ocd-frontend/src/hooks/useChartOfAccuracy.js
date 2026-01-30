import { useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import apiClient from '../services/apiClient';

/**
 * Hook to get Chart of Accuracy 1.0 scenario
 * 
 * Fetches from backend API which calculates from persisted percentage data.
 * Falls back to local calculation if API fails.
 * 
 * 9 Scenarios:
 * 1.0: S=Strong, R=Strong → Neutral (Trade both EOS and EOR)
 * 1.1: S=Strong, R=WTB   → Bearish
 * 1.2: S=Strong, R=WTT   → Bullish
 * 1.3: S=WTB,    R=Strong → Bearish
 * 1.4: S=WTT,    R=Strong → Bullish
 * 1.5: S=WTB,    R=WTB   → Blood Bath
 * 1.6: S=WTT,    R=WTT   → Bull Run
 * 1.7: S=WTB,    R=WTT   → Not Tradable
 * 1.8: S=WTT,    R=WTB   → Not Tradable
 */

// ============== Local Calculation Fallback ==============

const getITMDepth = (strike, atmStrike, side) => {
    if (!atmStrike) return 0;
    const stepSize = 50;
    if (side === 'ce') {
        return strike < atmStrike ? Math.round((atmStrike - strike) / stepSize) : 0;
    } else {
        return strike > atmStrike ? Math.round((strike - atmStrike) / stepSize) : 0;
    }
};

const calculateSideStrengthLocal = (optionChain, atmStrike, side) => {
    if (!optionChain) return null;

    const strikes = [];
    Object.entries(optionChain).forEach(([strikeKey, data]) => {
        const strike = parseFloat(strikeKey);
        const sideData = data[side];
        if (!sideData) return;

        const oi = sideData.OI || sideData.oi || 0;
        const oiChng = sideData.oichng || sideData.oi_change || 0;
        const ltp = sideData.ltp || 0;
        const itmDepth = getITMDepth(strike, atmStrike, side);
        const isValid = itmDepth <= 2;

        if (oi > 0) {
            strikes.push({ strike, oi, oiChng, ltp, itmDepth, isValid });
        }
    });

    if (strikes.length === 0) return null;

    const validStrikes = strikes.filter(s => s.isValid);
    if (validStrikes.length === 0) return null;

    const maxOI = Math.max(...validStrikes.map(s => s.oi));
    if (maxOI === 0) return null;

    const withPct = strikes.map(s => ({ ...s, pct: (s.oi / maxOI) * 100 }));
    withPct.sort((a, b) => b.oi - a.oi);

    const strike100 = withPct[0];
    const strike2nd = withPct.length > 1 ? withPct[1] : null;

    let strength = 'Strong';
    if (strike2nd && strike2nd.pct >= 75) {
        const is100Weakening = strike100.oiChng < 0;
        const is2ndStrengthening = strike2nd.oiChng > 0;

        if (side === 'ce') {
            if (strike2nd.strike > strike100.strike && is2ndStrengthening) {
                strength = 'WTT';
            } else if (is100Weakening || (strike2nd.strike < strike100.strike && is2ndStrengthening)) {
                strength = 'WTB';
            } else {
                strength = 'WTT';
            }
        } else {
            if (strike2nd.strike > strike100.strike && is2ndStrengthening) {
                strength = 'WTT';
            } else if (is100Weakening || (strike2nd.strike < strike100.strike && is2ndStrengthening)) {
                strength = 'WTB';
            } else {
                strength = 'WTB';
            }
        }
    }

    return {
        strength,
        strike100: strike100.strike,
        strike2nd: strike2nd?.strike || null,
        oi_pct100: strike100.pct,
        oi_pct2nd: strike2nd?.pct || 0,
        oi100: strike100.oi,
        oi2nd: strike2nd?.oi || 0,
        oichng100: strike100.oiChng,
        oichng2nd: strike2nd?.oiChng || 0,
    };
};

const classifyScenarioLocal = (s, r) => {
    const scenarios = {
        'Strong_Strong': { id: '1.0', bias: 'neutral', name: 'Strong Both', tradable: 'both' },
        'Strong_WTB': { id: '1.1', bias: 'bearish', name: 'Bearish Pressure', tradable: 'short' },
        'Strong_WTT': { id: '1.2', bias: 'bullish', name: 'Bullish Pressure', tradable: 'long' },
        'WTB_Strong': { id: '1.3', bias: 'bearish', name: 'Support Weakness', tradable: 'short' },
        'WTT_Strong': { id: '1.4', bias: 'bullish', name: 'Support Strength', tradable: 'long' },
        'WTB_WTB': { id: '1.5', bias: 'bearish', name: 'Blood Bath', tradable: 'short' },
        'WTT_WTT': { id: '1.6', bias: 'bullish', name: 'Bull Run', tradable: 'long' },
        'WTB_WTT': { id: '1.7', bias: 'unclear', name: 'Not Tradable', tradable: 'none' },
        'WTT_WTB': { id: '1.8', bias: 'unclear', name: 'Not Tradable', tradable: 'none' },
    };
    return scenarios[`${s}_${r}`] || { id: '?', bias: 'unknown', name: 'Unknown', tradable: 'none' };
};

const calculateLocalCOA = (optionChain, spotPrice, atmStrike) => {
    if (!optionChain || !spotPrice || !atmStrike) return null;

    const support = calculateSideStrengthLocal(optionChain, atmStrike, 'pe');
    const resistance = calculateSideStrengthLocal(optionChain, atmStrike, 'ce');
    if (!support || !resistance) return null;

    const scenario = classifyScenarioLocal(support.strength, resistance.strength);

    // Calculate EOS/EOR
    const supportData = optionChain[support.strike100]?.pe;
    const resistanceData = optionChain[resistance.strike100]?.ce;
    const eos = supportData ? support.strike100 - (supportData.ltp || 0) : support.strike100;
    const eor = resistanceData ? resistance.strike100 + (resistanceData.ltp || 0) : resistance.strike100;
    const stepSize = 50;

    const levels = {
        eos, eor,
        eos_plus1: eos + stepSize,
        eos_minus1: eos - stepSize,
        eor_plus1: eor + stepSize,
        eor_minus1: eor - stepSize,
        top: scenario.tradable !== 'long' ? eor : null,
        bottom: scenario.tradable !== 'short' ? eos : null,
        trade_at_eos: ['both', 'long'].includes(scenario.tradable),
        trade_at_eor: ['both', 'short'].includes(scenario.tradable),
    };

    const recommendations = {
        '1.0': `Trade reversals from both EOS (${eos.toFixed(0)}) and EOR (${eor.toFixed(0)}).`,
        '1.1': `Bearish. Short at EOR (${eor.toFixed(0)}). Avoid longs.`,
        '1.2': `Bullish. Long at EOS (${eos.toFixed(0)}). Avoid shorts.`,
        '1.3': `Bearish. Support weakening. Short at EOR (${eor.toFixed(0)}).`,
        '1.4': `Bullish. Support strong. Long at EOS (${eos.toFixed(0)}).`,
        '1.5': `🩸 Blood bath! Only shorts. No longs.`,
        '1.6': `🚀 Bull run! Only longs. No shorts.`,
        '1.7': `⚠️ Not tradable. Both sides unstable.`,
        '1.8': `⚠️ Not tradable. Both sides unstable.`,
    };

    return {
        scenario,
        support: { ...support, type: 'Support (PE)' },
        resistance: { ...resistance, type: 'Resistance (CE)' },
        levels,
        trading: { recommendation: recommendations[scenario.id] || 'Unknown' },
        spotPrice,
        atmStrike,
        source: 'local'
    };
};

// ============== Main Hook ==============

export const useChartOfAccuracy = (optionChain, spotPrice, atmStrike) => {
    const [apiData, setApiData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Use same selectors as Analytics.jsx for consistency
    const symbol = useSelector(state => state.data.sid || 'NIFTY');
    const expiry = useSelector(state => state.data.exp_sid);

    // Fetch from backend API
    useEffect(() => {
        const fetchCOA = async () => {
            if (!symbol) return;

            setLoading(true);
            setError(null);

            try {
                const params = expiry ? { expiry } : {};
                const response = await apiClient.get(`/analytics/${symbol}/coa`, { params });

                if (response.data?.success) {
                    setApiData({
                        ...response.data,
                        source: 'api'
                    });
                }
            } catch (err) {
                console.warn('COA API failed, using local calculation:', err.message);
                setError(err);
                setApiData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchCOA();

        // Refresh every 30 seconds
        const interval = setInterval(fetchCOA, 30000);
        return () => clearInterval(interval);
    }, [symbol, expiry]);

    // Local calculation fallback
    const localData = useMemo(() => {
        return calculateLocalCOA(optionChain, spotPrice, atmStrike);
    }, [optionChain, spotPrice, atmStrike]);

    // Return API data if available, otherwise local calculation
    return useMemo(() => {
        if (apiData && !error) {
            return apiData;
        }
        return localData;
    }, [apiData, localData, error]);
};

export default useChartOfAccuracy;

/**
 * Multi-Symbol Data Hook
 * Fetches and aggregates option chain data for multiple symbols
 * Used by Dashboard to show app-level market overview
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { optionsService } from '../services/optionsService';

// Default symbols to track
const DEFAULT_SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

// Refresh interval in milliseconds
const REFRESH_INTERVAL = 30000; // 30 seconds

/**
 * Calculate aggregate metrics from option chain data
 */
const calculateMetrics = (optionChain, spot) => {
    if (!optionChain || Object.keys(optionChain).length === 0) {
        return null;
    }

    const strikes = Object.keys(optionChain).map(s => parseFloat(s)).sort((a, b) => a - b);

    let totalCEOI = 0, totalPEOI = 0;
    let totalCECOI = 0, totalPECOI = 0;
    let totalCEVolume = 0, totalPEVolume = 0;

    // Max Pain calculation
    let minPain = Infinity;
    let maxPainStrike = strikes[0];

    strikes.forEach(strike => {
        const data = optionChain[strike] || optionChain[String(strike)];
        const ceOI = data?.ce?.oi || data?.ce?.OI || 0;
        const peOI = data?.pe?.oi || data?.pe?.OI || 0;
        const ceCOI = data?.ce?.coi || data?.ce?.COI || data?.ce?.oiChange || 0;
        const peCOI = data?.pe?.coi || data?.pe?.COI || data?.pe?.oiChange || 0;
        const ceVol = data?.ce?.volume || data?.ce?.Volume || 0;
        const peVol = data?.pe?.volume || data?.pe?.Volume || 0;

        totalCEOI += ceOI;
        totalPEOI += peOI;
        totalCECOI += ceCOI;
        totalPECOI += peCOI;
        totalCEVolume += ceVol;
        totalPEVolume += peVol;
    });

    // Calculate max pain
    strikes.forEach(targetStrike => {
        let totalPain = 0;
        strikes.forEach(strike => {
            const data = optionChain[strike] || optionChain[String(strike)];
            const ceOI = data?.ce?.oi || data?.ce?.OI || 0;
            const peOI = data?.pe?.oi || data?.pe?.OI || 0;

            if (targetStrike > strike) totalPain += ceOI * (targetStrike - strike);
            if (targetStrike < strike) totalPain += peOI * (strike - targetStrike);
        });
        if (totalPain < minPain) {
            minPain = totalPain;
            maxPainStrike = targetStrike;
        }
    });

    const pcr = totalCEOI > 0 ? totalPEOI / totalCEOI : 0;
    const pcrVolume = totalCEVolume > 0 ? totalPEVolume / totalCEVolume : 0;

    // Determine signals
    let pcrSignal = 'NEUTRAL';
    if (pcr > 1.2) pcrSignal = 'BULLISH';
    else if (pcr < 0.7) pcrSignal = 'BEARISH';

    let oiSignal = 'NEUTRAL';
    if (totalPECOI > totalCECOI * 1.2) oiSignal = 'BULLISH';
    else if (totalCECOI > totalPECOI * 1.2) oiSignal = 'BEARISH';

    // Overall trend
    let trendScore = 0;
    if (pcr > 1.2) trendScore += 2;
    else if (pcr < 0.7) trendScore -= 2;
    if (totalPECOI > totalCECOI) trendScore += 1;
    else if (totalCECOI > totalPECOI) trendScore -= 1;
    if (spot && maxPainStrike > spot * 1.01) trendScore += 1;
    else if (spot && maxPainStrike < spot * 0.99) trendScore -= 1;

    let trend = 'NEUTRAL';
    if (trendScore >= 2) trend = 'BULLISH';
    else if (trendScore <= -2) trend = 'BEARISH';

    return {
        pcr: parseFloat(pcr.toFixed(3)),
        pcrSignal,
        pcrVolume: parseFloat(pcrVolume.toFixed(3)),
        maxPain: maxPainStrike,
        maxPainDistance: spot ? ((maxPainStrike - spot) / spot * 100) : 0,
        totalCEOI,
        totalPEOI,
        totalCECOI,
        totalPECOI,
        totalCEVolume,
        totalPEVolume,
        oiSignal,
        trend,
        trendScore,
    };
};

/**
 * Hook to fetch data for multiple symbols
 * @param {string[]} symbols - Array of symbols to track
 * @param {boolean} autoRefresh - Whether to auto-refresh
 * @returns {Object} Multi-symbol data and loading states
 */
export const useMultiSymbolData = (symbols = DEFAULT_SYMBOLS, autoRefresh = true) => {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const fetchingRef = useRef(false);

    const fetchAllSymbols = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        try {
            setError(null);

            // Fetch data for all symbols in a single batch request
            const batchResponse = await optionsService.getBatchLiveOptions(symbols);

            // Process batch results
            const results = Object.keys(batchResponse).map(symbol => {
                const liveData = batchResponse[symbol];

                if (!liveData || liveData.error) {
                    // Silently handle API errors
                    return {
                        symbol,
                        data: null,
                        error: liveData?.error || 'API unavailable',
                        status: 'rejected'
                    };
                }

                try {
                    // Calculate metrics
                    const optionChain = liveData.oc || liveData.options?.data?.oc || {};
                    const spot = liveData.spot?.ltp || liveData.spot_price || liveData.spot;
                    const metrics = calculateMetrics(optionChain, spot);

                    return {
                        symbol,
                        data: {
                            spot,
                            spotChange: liveData.spot?.change || 0,
                            spotChangePercent: liveData.spot?.change_percent || 0,
                            expiry: liveData.expiry,
                            atmStrike: liveData.atm_strike,
                            atmIV: liveData.atmiv || liveData.atm_iv,
                            daysToExpiry: liveData.days_to_expiry || liveData.dte,
                            metrics,
                            rawData: liveData,
                        },
                        error: null,
                        status: 'fulfilled'
                    };
                } catch (err) {
                    return {
                        symbol,
                        data: null,
                        error: 'Processing error',
                        status: 'rejected'
                    };
                }
            });

            // Map to Promise.allSettled format for compatibility
            // (Simulating the structure the rest of the hook expects)
            const simulatedResults = results.map(r => ({
                status: r.status === 'fulfilled' ? 'fulfilled' : 'rejected',
                value: r
            }));

            // Process results (using minimal changes to existing logic)
            const newData = {};
            results.forEach((result) => {
                const { symbol, data: symbolData, error: symbolError } = result;
                newData[symbol] = {
                    ...symbolData,
                    error: symbolError,
                    loading: false,
                };
            });

            setData(newData);
            setLastUpdate(new Date());
            setLoading(false);

            // Process results (using minimal changes to existing logic)
            // (Already handled in the block above)

            setData(newData);
            setLastUpdate(new Date());
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch multi-symbol data:', err);
            setError(err.message);
            setLoading(false);
        } finally {
            fetchingRef.current = false;
        }
    }, [symbols]);

    // Initial fetch
    useEffect(() => {
        fetchAllSymbols();
    }, [fetchAllSymbols]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(fetchAllSymbols, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchAllSymbols]);

    // Aggregate metrics across all symbols
    const aggregate = {
        totalCEOI: Object.values(data).reduce((sum, d) => sum + (d?.metrics?.totalCEOI || 0), 0),
        totalPEOI: Object.values(data).reduce((sum, d) => sum + (d?.metrics?.totalPEOI || 0), 0),
        totalCECOI: Object.values(data).reduce((sum, d) => sum + (d?.metrics?.totalCECOI || 0), 0),
        totalPECOI: Object.values(data).reduce((sum, d) => sum + (d?.metrics?.totalPECOI || 0), 0),
        bullishCount: Object.values(data).filter(d => d?.metrics?.trend === 'BULLISH').length,
        bearishCount: Object.values(data).filter(d => d?.metrics?.trend === 'BEARISH').length,
        neutralCount: Object.values(data).filter(d => d?.metrics?.trend === 'NEUTRAL').length,
    };

    // Overall market sentiment
    let marketSentiment = 'NEUTRAL';
    if (aggregate.bullishCount > aggregate.bearishCount + 1) marketSentiment = 'BULLISH';
    else if (aggregate.bearishCount > aggregate.bullishCount + 1) marketSentiment = 'BEARISH';

    return {
        data,
        loading,
        error,
        lastUpdate,
        refresh: fetchAllSymbols,
        aggregate: {
            ...aggregate,
            marketSentiment,
        },
        symbols,
    };
};

export default useMultiSymbolData;

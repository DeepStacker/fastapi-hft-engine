/**
 * Multi-Symbol Screener Hook
 * Scans ALL symbols for trading signals simultaneously
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { optionsService } from '../services/optionsService';
import { screenerService } from '../services/screenerService';

// Default symbols to scan
const DEFAULT_SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

// Refresh interval
const REFRESH_INTERVAL = 60000; // 60 seconds

/**
 * Hook to fetch screener signals for all symbols
 * @param {string} screenerType - Type of screener (scalp, positional, sr)
 * @param {string[]} symbols - Array of symbols to scan
 * @returns {Object} Multi-symbol screener data
 */
export const useMultiSymbolScreener = (screenerType = 'scalp', symbols = DEFAULT_SYMBOLS) => {
    const [data, setData] = useState({});
    const [allSignals, setAllSignals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const fetchingRef = useRef(false);

    const fetchAllSignals = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        try {
            setLoading(true);
            setError(null);

            // Fetch signals for all symbols in parallel
            const results = await Promise.allSettled(
                symbols.map(async (symbol) => {
                    try {
                        // First get expiry
                        const expiryResponse = await optionsService.getExpiryDates(symbol);
                        const expiries = expiryResponse?.data?.expiry_dates || expiryResponse?.expiry_dates || [];

                        if (expiries.length === 0) {
                            return { symbol, signals: [], error: 'No expiries' };
                        }

                        const nearestExpiry = expiries[0];

                        // Fetch signals based on screener type
                        let response;
                        switch (screenerType) {
                            case 'scalp':
                                response = await screenerService.getScalpSignals({ symbol, expiry: nearestExpiry });
                                break;
                            case 'positional':
                                response = await screenerService.getPositionalSignals({ symbol, expiry: nearestExpiry });
                                break;
                            case 'sr':
                                response = await screenerService.getSRSignals({ symbol, expiry: nearestExpiry });
                                break;
                            default:
                                response = await screenerService.getScalpSignals({ symbol, expiry: nearestExpiry });
                        }

                        const signals = (response?.signals || []).map(sig => ({
                            ...sig,
                            symbol, // Add symbol to each signal
                            expiry: nearestExpiry,
                        }));

                        return {
                            symbol,
                            signals,
                            expiry: nearestExpiry,
                            error: null,
                        };
                    } catch (err) {
                        // Silently handle API errors
                        return { symbol, signals: [], error: 'API unavailable' };
                    }
                })
            );

            // Process results
            const newData = {};
            let combinedSignals = [];

            results.forEach((result) => {
                if (result.status === 'fulfilled') {
                    const { symbol, signals, expiry, error: symbolError } = result.value;
                    newData[symbol] = {
                        signals,
                        expiry,
                        error: symbolError,
                        loading: false,
                    };
                    combinedSignals = [...combinedSignals, ...signals];
                }
            });

            // Sort all signals by strength
            combinedSignals.sort((a, b) => (b.strength || 0) - (a.strength || 0));

            setData(newData);
            setAllSignals(combinedSignals);
            setLastUpdate(new Date());
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch multi-symbol signals:', err);
            setError(err.message);
            setLoading(false);
        } finally {
            fetchingRef.current = false;
        }
    }, [symbols, screenerType]);

    // Initial fetch  
    useEffect(() => {
        fetchAllSignals();
    }, [fetchAllSignals]);

    // Auto-refresh
    useEffect(() => {
        const interval = setInterval(fetchAllSignals, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchAllSignals]);

    // Statistics
    const stats = {
        totalSignals: allSignals.length,
        buySignals: allSignals.filter(s => s.signal === 'BUY').length,
        sellSignals: allSignals.filter(s => s.signal === 'SELL').length,
        bySymbol: Object.fromEntries(
            symbols.map(s => [s, data[s]?.signals?.length || 0])
        ),
        strongSignals: allSignals.filter(s => (s.strength || 0) >= 70).length,
    };

    return {
        data,
        allSignals,
        loading,
        error,
        lastUpdate,
        refresh: fetchAllSignals,
        stats,
        symbols,
    };
};

export default useMultiSymbolScreener;

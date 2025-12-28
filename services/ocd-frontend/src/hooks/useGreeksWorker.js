/**
 * Greeks Worker Hook
 * React hook for using the Greeks calculation Web Worker
 */
import { useRef, useEffect, useCallback, useState } from 'react';

let workerInstance = null;
let pendingRequests = new Map();
let requestId = 0;

/**
 * Initialize shared worker instance
 */
function getWorker() {
    if (!workerInstance && typeof Worker !== 'undefined') {
        try {
            workerInstance = new Worker('/workers/greeks.worker.js');

            workerInstance.onmessage = (e) => {
                const { id, type, result, error } = e.data;

                if (type === 'READY') {
                    console.log('Greeks worker ready');
                    return;
                }

                const pending = pendingRequests.get(id);
                if (pending) {
                    if (type === 'ERROR') {
                        pending.reject(new Error(error));
                    } else {
                        pending.resolve(result);
                    }
                    pendingRequests.delete(id);
                }
            };

            workerInstance.onerror = (error) => {
                console.error('Greeks worker error:', error);
            };
        } catch (err) {
            console.warn('Web Worker not supported:', err);
        }
    }
    return workerInstance;
}

/**
 * Send message to worker and wait for response
 */
function sendToWorker(type, data) {
    return new Promise((resolve, reject) => {
        const worker = getWorker();

        if (!worker) {
            // Fallback: calculate in main thread
            reject(new Error('Worker not available'));
            return;
        }

        const id = ++requestId;
        pendingRequests.set(id, { resolve, reject });

        // Timeout after 5 seconds
        setTimeout(() => {
            if (pendingRequests.has(id)) {
                pendingRequests.delete(id);
                reject(new Error('Worker timeout'));
            }
        }, 5000);

        worker.postMessage({ type, data, id });
    });
}

/**
 * Hook for using Greeks calculations
 */
export function useGreeksWorker() {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const worker = getWorker();
        if (worker) {
            setIsReady(true);
        }
    }, []);

    /**
     * Calculate Greeks for single option
     */
    const calculateSingle = useCallback(async (params) => {
        try {
            return await sendToWorker('CALCULATE_SINGLE', params);
        } catch (err) {
            console.warn('Worker calculation failed, using fallback:', err);
            // Fallback to main thread calculation
            return fallbackCalculateGreeks(params);
        }
    }, []);

    /**
     * Calculate Greeks for batch of options
     */
    const calculateBatch = useCallback(async (options, spot, riskFreeRate = 0.05) => {
        try {
            return await sendToWorker('CALCULATE_BATCH', { options, spot, riskFreeRate });
        } catch (err) {
            console.warn('Batch worker calculation failed:', err);
            // Fallback to main thread
            return options.map(opt => ({
                strike: opt.strike,
                type: opt.type,
                ...fallbackCalculateGreeks({
                    spot,
                    strike: opt.strike,
                    timeToExpiry: opt.daysToExpiry,
                    riskFreeRate,
                    volatility: opt.iv / 100,
                    optionType: opt.type
                })
            }));
        }
    }, []);

    return {
        isReady,
        calculateSingle,
        calculateBatch
    };
}

/**
 * Fallback Greeks calculation for when worker unavailable
 */
function fallbackCalculateGreeks(params) {
    const { spot, strike, timeToExpiry, riskFreeRate = 0.05, volatility, optionType } = params;

    if (timeToExpiry <= 0 || volatility <= 0) {
        return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, iv: 0 };
    }

    const S = spot;
    const K = strike;
    const T = timeToExpiry / 365;
    const r = riskFreeRate;
    const sigma = volatility;
    const isCall = optionType === 'CE';

    // Simplified delta calculation
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const delta = isCall ? normalCDF(d1) : normalCDF(d1) - 1;

    return {
        delta: Number(delta.toFixed(4)),
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
        iv: Number((sigma * 100).toFixed(2))
    };
}

// Simple normal CDF for fallback
function normalCDF(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}

export default useGreeksWorker;

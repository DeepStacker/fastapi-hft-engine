/**
 * useDataFetching - Centralized data fetching hook
 * 
 * Provides consistent loading, error, and data states across the application.
 * Includes automatic retry, caching, and skeleton state management.
 * 
 * @example
 * const { data, isLoading, error, refetch } = useDataFetching({
 *   fetchFn: () => analyticsService.getOIData(symbol),
 *   dependencies: [symbol],
 *   enableCache: true,
 *   cacheKey: `oi-data-${symbol}`
 * });
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_CACHE_TTL = 30000; // 30 seconds

// Simple in-memory cache
const cache = new Map();

/**
 * Hook for data fetching with loading states, error handling, and caching
 */
export function useDataFetching({
    fetchFn,
    dependencies = [],
    initialData = null,
    enabled = true,
    retryCount = DEFAULT_RETRY_COUNT,
    retryDelay = DEFAULT_RETRY_DELAY,
    enableCache = false,
    cacheKey = null,
    cacheTTL = DEFAULT_CACHE_TTL,
    onSuccess = null,
    onError = null,
}) {
    const [data, setData] = useState(initialData);
    const [isLoading, setIsLoading] = useState(enabled);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [error, setError] = useState(null);
    const [retryAttempt, setRetryAttempt] = useState(0);

    const abortControllerRef = useRef(null);
    const mountedRef = useRef(true);

    // Check cache
    const getCachedData = useCallback(() => {
        if (!enableCache || !cacheKey) return null;

        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cacheTTL) {
            return cached.data;
        }

        // Clear expired cache
        if (cached) cache.delete(cacheKey);
        return null;
    }, [enableCache, cacheKey, cacheTTL]);

    // Set cache
    const setCachedData = useCallback((newData) => {
        if (enableCache && cacheKey) {
            cache.set(cacheKey, {
                data: newData,
                timestamp: Date.now()
            });
        }
    }, [enableCache, cacheKey]);

    // Main fetch function
    const fetchData = useCallback(async (isRetry = false) => {
        // Check cache first
        const cachedData = getCachedData();
        if (cachedData && !isRetry) {
            setData(cachedData);
            setIsLoading(false);
            setIsInitialLoad(false);
            return;
        }

        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            if (!isRetry) {
                setIsLoading(true);
                setError(null);
            }

            const result = await fetchFn(abortControllerRef.current.signal);

            if (mountedRef.current) {
                setData(result);
                setCachedData(result);
                setIsLoading(false);
                setIsInitialLoad(false);
                setRetryAttempt(0);

                if (onSuccess) onSuccess(result);
            }
        } catch (err) {
            if (err.name === 'AbortError') return;

            if (mountedRef.current) {
                // Retry logic
                if (retryAttempt < retryCount) {
                    setRetryAttempt(prev => prev + 1);
                    setTimeout(() => {
                        if (mountedRef.current) {
                            fetchData(true);
                        }
                    }, retryDelay * (retryAttempt + 1)); // Exponential backoff
                    return;
                }

                setError(err.message || 'Failed to fetch data');
                setIsLoading(false);
                setIsInitialLoad(false);

                if (onError) onError(err);
            }
        }
    }, [fetchFn, getCachedData, setCachedData, retryAttempt, retryCount, retryDelay, onSuccess, onError]);

    // Refetch function exposed to consumers
    const refetch = useCallback(() => {
        setRetryAttempt(0);
        return fetchData();
    }, [fetchData]);

    // Clear cache for this key
    const clearCache = useCallback(() => {
        if (cacheKey) {
            cache.delete(cacheKey);
        }
    }, [cacheKey]);

    // Effect to trigger fetch
    useEffect(() => {
        mountedRef.current = true;

        if (enabled) {
            fetchData();
        }

        return () => {
            mountedRef.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...dependencies]);

    return {
        data,
        isLoading,
        isInitialLoad, // True only on first load
        error,
        refetch,
        clearCache,
        isRetrying: retryAttempt > 0,
        retryAttempt,
    };
}

/**
 * Hook for mutation operations (POST, PUT, DELETE)
 * 
 * @example
 * const { mutate, isLoading } = useMutation({
 *   mutationFn: (data) => api.updateProfile(data),
 *   onSuccess: () => toast.success('Updated!')
 * });
 */
export function useMutation({
    mutationFn,
    onSuccess = null,
    onError = null,
    onSettled = null,
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const mutate = useCallback(async (variables) => {
        try {
            setIsLoading(true);
            setError(null);

            const result = await mutationFn(variables);
            setData(result);

            if (onSuccess) onSuccess(result, variables);

            return result;
        } catch (err) {
            setError(err.message || 'Mutation failed');
            if (onError) onError(err, variables);
            throw err;
        } finally {
            setIsLoading(false);
            if (onSettled) onSettled();
        }
    }, [mutationFn, onSuccess, onError, onSettled]);

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return {
        mutate,
        isLoading,
        error,
        data,
        reset,
    };
}

/**
 * Clear all cached data
 */
export function clearAllCache() {
    cache.clear();
}

export default useDataFetching;


import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLiveData } from '../context/dataSlice';
import {
    selectSelectedSymbol,
    selectSelectedExpiry,
    selectOptionsData,
    selectSpotData,
    selectFuturesData,
    selectExpiryList,
    selectDataLoading,
} from '../context/selectors';

/**
 * Custom hook for managing option chain data
 * WebSocket is now handled GLOBALLY in AppProvider
 * This hook reads data from Redux and provides controls
 */
export const useOptionsChain = () => {
    const dispatch = useDispatch();

    // Selectors
    const symbol = useSelector(selectSelectedSymbol);
    const expiry = useSelector(selectSelectedExpiry);
    const data = useSelector(selectOptionsData);
    const spotData = useSelector(selectSpotData);
    const futuresData = useSelector(selectFuturesData);
    const expiryList = useSelector(selectExpiryList);
    const isLoading = useSelector(selectDataLoading);

    // Streaming state from Redux (set by AppProvider)
    const isStreaming = useSelector(state => state.data.isStreaming);
    const connectionMethod = useSelector(state => state.data.connectionMethod);

    // Local state
    const [isPaused, setIsPaused] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Memoized: Check if we have valid data
    const hasData = useMemo(() => {
        return !!(data && data.oc && Object.keys(data.oc).length > 0);
    }, [data]);

    // Memoized: Check if expiry is valid
    const isExpiryValid = useMemo(() => {
        return expiry && typeof expiry === 'number' && expiry > 0;
    }, [expiry]);

    // Track data updates
    const prevDataRef = useRef(null);
    useEffect(() => {
        if (data && data !== prevDataRef.current) {
            setLastUpdated(new Date());
            if (isInitialLoad) {
                setIsInitialLoad(false);
            }
            prevDataRef.current = data;
        }
    }, [data, isInitialLoad]);

    // Manual refresh handler
    const handleRefresh = useCallback(() => {
        if (symbol) {
            dispatch(fetchLiveData({
                symbol,
                expiry: isExpiryValid ? String(expiry) : null
            }));
        }
    }, [dispatch, symbol, expiry, isExpiryValid]);

    // Toggle pause/resume (pause is informational - global streaming continues)
    const togglePause = useCallback(() => {
        setIsPaused(prev => !prev);
    }, []);

    // Memoized return object
    return useMemo(() => ({
        // Data
        data,
        spotData,
        futuresData,
        expiryList,
        symbol,
        expiry,

        // Status
        isLoading,
        isInitialLoad,
        isPaused,
        lastUpdated,
        hasData,

        // WebSocket status (from global AppProvider)
        isWebSocketConnected: connectionMethod === 'websocket',
        isStreaming,
        wsError: null,
        useWebSocket: true, // Always using global WebSocket

        // Actions
        refresh: handleRefresh,
        togglePause,
    }), [
        data, spotData, futuresData, expiryList, symbol, expiry,
        isLoading, isInitialLoad, isPaused, lastUpdated, hasData,
        connectionMethod, isStreaming,
        handleRefresh, togglePause
    ]);
};

export default useOptionsChain;

import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import logger from "../utils/logger";

import {
  setExp_sid,
  setIngestedExpiry,
  stopLiveStream,
  setSidAndFetchData,
  updateLiveData,
  fetchLiveData,
  setStreamingState,
  setConnectionMethod,
} from "./dataSlice";
import axios from "axios";
// import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { initializeAuth } from "./authSlice";
import { tokenManager } from "./authSlice";

import { AppContext } from "./AppContext";
import { selectAppState, selectSelectedSymbol, selectSelectedExpiry, selectIngestedExpiry, selectIsExpiryMatch } from "./selectors";
import useSocket from "../hooks/useSocket";



export const AppProvider = ({ children }) => {
  const dispatch = useDispatch();
  const tokenCheckInterval = useRef(null);
  const pollTimerRef = useRef(null);
  const currentSubscriptionRef = useRef(null);

  const {
    user,
    token,
    isAuthenticated,
    authLoading,
    theme,
    isReversed,
    isHighlighting,
    data,
    exp,
    symbol,
    expDate,
    isOc,
    isStreaming,
    exp_sid,
  } = useSelector(selectAppState);

  // Sync theme to DOM when state changes (including rehydration)
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Get selected symbol and expiry for global WebSocket subscription
  const selectedSymbol = useSelector(selectSelectedSymbol);
  const selectedExpiry = useSelector(selectSelectedExpiry);
  const ingestedExpiry = useSelector(selectIngestedExpiry);
  const isExpiryMatch = useSelector(selectIsExpiryMatch);

  // Check if expiry is valid
  const isExpiryValid = selectedExpiry && typeof selectedExpiry === 'number' && selectedExpiry > 0;

  // Global WebSocket data handler - updates Redux store
  // IMPORTANT: Only accept updates if expiry matches user's selection
  const handleWebSocketData = useCallback((wsData) => {
    if (wsData?.type === 'error') {
      console.warn('Global WebSocket error:', wsData.message);
      return;
    }

    if (wsData && (wsData.oc || wsData.spot || wsData.futures)) {
      // Extract the expiry from incoming data to track ingested expiry
      const incomingExpiry = wsData.expiry || wsData.context?.expiry;

      // Set ingested expiry if not already set (first data arrival)
      // IMPORTANT: Store as-is (could be date string or timestamp)
      // The normalized comparison will handle format differences
      if (incomingExpiry && !ingestedExpiry) {
        logger.log('📡 Setting ingested expiry from WebSocket data:', incomingExpiry);
        dispatch(setIngestedExpiry(incomingExpiry)); // Don't convert - keep original format
      }

      // The reducer will check isExpiryMatch and ignore if needed
      dispatch(updateLiveData(wsData));
    }
  }, [dispatch, ingestedExpiry]);

  // Global WebSocket connection for options data
  const {
    isConnected: wsConnected,
    error: wsError,
    subscribe,
    unsubscribe,
    subscription
  } = useSocket(handleWebSocketData, { enabled: isAuthenticated && isOc });

  // Update streaming state in Redux
  useEffect(() => {
    dispatch(setStreamingState(wsConnected && !!subscription));
    dispatch(setConnectionMethod(wsConnected && !!subscription ? 'websocket' : 'api'));
  }, [wsConnected, subscription, dispatch]);

  // Global WebSocket subscription - subscribes when symbol is available
  // NOTE: Expiry is now OPTIONAL - HFT Engine streams latest data by symbol
  useEffect(() => {
    if (!wsConnected || !isAuthenticated || !isOc) return;
    if (!selectedSymbol) return;

    // Use symbol as key (expiry optional)
    const newKey = selectedSymbol;

    // Already subscribed to this symbol
    if (currentSubscriptionRef.current === newKey) return;

    // Unsubscribe from previous if different
    if (currentSubscriptionRef.current) {
      logger.log('📡 Global: Unsubscribing from:', currentSubscriptionRef.current);
      unsubscribe();
    }

    // Subscribe to symbol (expiry optional - HFT streams latest)
    const expiryToUse = isExpiryValid ? String(selectedExpiry) : '';
    logger.log('📡 Global: Subscribing to:', selectedSymbol, expiryToUse || '(latest)');
    subscribe(selectedSymbol, expiryToUse);
    currentSubscriptionRef.current = newKey;

  }, [wsConnected, selectedSymbol, selectedExpiry, isExpiryValid, isAuthenticated, isOc, subscribe, unsubscribe]);

  // Global polling fallback - when WebSocket is not connected OR expiry mismatch
  // SMART LOGIC: 
  // - If isExpiryMatch=true AND WebSocket active → no polling needed
  // - If isExpiryMatch=false → ALWAYS poll for user's selected expiry (ignore WebSocket)
  useEffect(() => {
    // Clear existing interval FIRST (important for cleanup when switching modes)
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      logger.log('🛑 Global: Cleared polling interval');
    }

    // Skip if not authenticated or no symbol
    if (!isAuthenticated || !isOc || !selectedSymbol) return;

    // CASE 1: Expiry matches AND WebSocket active → no polling needed
    if (isExpiryMatch && wsConnected && subscription && !wsError) {
      logger.log('📡 Global: Expiry matches ingested, WebSocket active → polling stopped, using WebSocket');
      return; // Return without starting polling - WebSocket handles it
    }

    // CASE 2: Expiry mismatch → MUST poll for user's selected expiry
    // CASE 3: WebSocket not active → poll as fallback
    const reason = !isExpiryMatch
      ? `expiry mismatch (selected: ${selectedExpiry}, ingested: ${ingestedExpiry})`
      : 'WebSocket fallback';
    logger.log(`⏱️ Global: Starting REST polling - ${reason}`);

    const fetchData = () => {
      dispatch(fetchLiveData({
        sid: selectedSymbol,
        exp_sid: isExpiryValid ? selectedExpiry : null
      }));
    };

    fetchData(); // Initial fetch

    // Poll interval - Priority: User Preferences -> localStorage -> default
    const prefRate = user?.preferences?.refresh_rate;
    const storedRate = localStorage.getItem('app_refresh_rate');

    let customInterval = null;
    if (prefRate) {
      customInterval = prefRate * 1000;
    } else if (storedRate) {
      customInterval = parseInt(storedRate.replace('s', '')) * 1000;
    }

    const pollInterval = customInterval || (!isExpiryMatch ? 5000 : 3000);
    pollTimerRef.current = setInterval(fetchData, pollInterval);
    logger.log(`⏱️ Global: Poll interval set to ${pollInterval}ms`);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        logger.log('🛑 Global: Cleanup - cleared polling interval');
      }
    };
  }, [wsConnected, subscription, wsError, isAuthenticated, isOc, selectedSymbol, selectedExpiry, isExpiryValid, isExpiryMatch, ingestedExpiry, dispatch]);

  // Token expiry check with proper cleanup
  useEffect(() => {
    if (tokenCheckInterval.current) {
      clearInterval(tokenCheckInterval.current);
    }

    tokenCheckInterval.current = setInterval(() => {
      const storedToken =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");
      if (storedToken && tokenManager.isTokenExpired(storedToken)) {
        logger.log("Token expired, re-initializing auth");
        dispatch(initializeAuth());
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      if (tokenCheckInterval.current) {
        clearInterval(tokenCheckInterval.current);
      }
    };
  }, [dispatch]);

  // Set up axios auth header when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // Initialize data on first mount when auth is complete
  // This handles the INITIAL load only - subsequent symbol changes are handled by OptionControls
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    logger.debug('🔍 AppProvider effect check:', {
      authLoading,
      isAuthenticated,
      isOc,
      symbol,
      initialLoadDone: initialLoadDoneRef.current
    });

    if (!authLoading && isAuthenticated && isOc && symbol && !initialLoadDoneRef.current) {
      logger.log('🚀 Initial data load for:', symbol);
      initialLoadDoneRef.current = true;
      dispatch(setSidAndFetchData({ newSid: symbol }));
    }
  }, [dispatch, symbol, isAuthenticated, authLoading, isOc]);

  // Fetch expiry dates when the symbol changes and user is authenticated
  // Fetch expiry dates when the symbol changes - REMOVED (Handled locally)
  /*
  const fetchExpiryDates = useCallback(() => {
    if (!authLoading && symbol && isAuthenticated && isOc) {
      dispatch(fetchExpiryDate({ sid: symbol, exp }));
    }
  }, [dispatch, symbol, isAuthenticated, authLoading, exp, isOc]);

  useEffect(() => {
    fetchExpiryDates();
  }, [fetchExpiryDates]);
  */

  // Fetch live data when expiry changes
  // Fetch live data when expiry changes - REMOVED (Handled locally)
  /*
  useEffect(() => {
    if (!authLoading && isAuthenticated && isOc && symbol && exp_sid) {
      dispatch(fetchLiveData({ sid: symbol, exp_sid }));
    }
  }, [dispatch, symbol, exp_sid, isAuthenticated, authLoading, isOc]);
  */

  // Update expiry when expiry list changes - fixed dependency array
  useEffect(() => {
    if (!authLoading && data?.fut?.data?.explist?.length && isOc && !exp_sid) {
      const firstExpiry = data.fut.data.explist[0];
      if (firstExpiry) {
        dispatch(setExp_sid(firstExpiry));
      }
    }
  }, [dispatch, data?.fut?.data?.explist, isOc, authLoading, exp_sid]);

  // WebSocket streaming is now handled by individual components using useSocket hook
  useEffect(() => {
    // Cleanup any streaming state if component unmounts or auth changes
    if (authLoading) return;

    if (!isOc || !isAuthenticated) {
      if (isStreaming) {
        dispatch(stopLiveStream());
      }
    }

    return () => {
      if (isStreaming) {
        dispatch(stopLiveStream());
      }
    };
  }, [
    dispatch,
    isOc,
    isAuthenticated,
    authLoading,
    isStreaming,
  ]);

  const contextValue = {
    user,
    token,
    isAuthenticated,
    authLoading,
    theme,
    isReversed,
    isHighlighting,
    data,
    exp,
    symbol,
    expDate,
    isOc,
    isStreaming,
    exp_sid,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
};

export const AppWrapper = ({ children }) => {
  return <AppProvider>{children}</AppProvider>;
};

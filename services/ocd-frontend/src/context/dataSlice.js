import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

axios.defaults.withCredentials = true;

const activeRequests = new Map();

// Helpers
const getAuthToken = () => localStorage.getItem("authToken");

const handleApiError = (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem("authToken");
    // Only reload if we have a token that was rejected
    if (getAuthToken()) {
      window.location.reload();
    }
    return "Session expired. Please login again.";
  }
  if (error.response) return error.response.data?.message || "Server error";
  if (error.request) return "No response from server";
  return error.message || "An error occurred";
};

const getLatestExpiry = (expiryArray) => {
  if (!Array.isArray(expiryArray) || expiryArray.length === 0) return null;

  return Math.min(
    ...expiryArray.map((exp) => {
      if (typeof exp === "object") {
        return exp.exp_sid || exp.value || exp.timestamp || 0;
      }
      return typeof exp === "number" ? exp : parseInt(exp) || 0;
    })
  );
};

const createRequestKey = (action, params = {}) => {
  return `${action}_${JSON.stringify(params)}`;
};

/**
 * Normalize expiry to a comparable format (MM-DD string, ignoring year)
 * Handles both Unix timestamps and date strings
 * Uses UTC to avoid timezone issues
 * 
 * IMPORTANT: Dhan API uses old year timestamps (2015-2020) as expiry identifiers.
 * Backend converts these to current year for display. We compare only MONTH-DAY
 * to correctly match "2015-12-30" with "2025-12-30".
 */
const normalizeExpiryForComparison = (expiry) => {
  if (!expiry) return null;

  // If it's already a date string like "2025-12-28"
  if (typeof expiry === 'string' && expiry.includes('-')) {
    const datePart = expiry.split('T')[0]; // Handle ISO format too
    const parts = datePart.split('-');
    if (parts.length >= 3) {
      // Return only MM-DD (month-day), ignoring year
      return `${parts[1]}-${parts[2]}`;
    }
    return null;
  }

  // If it's a Unix timestamp (number or numeric string)
  const ts = Number(expiry);
  if (!isNaN(ts) && ts > 0) {
    const date = new Date(ts * 1000);
    // Use UTC methods to avoid timezone shifts
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    // Return only MM-DD (month-day), ignoring year
    return `${month}-${day}`;
  }

  return null;
};

/**
 * Normalize backend data (from REST or WS) to unified Frontend Redux state shape
 * Ensures consistent keys for Spot, Futures, and Option Chain
 */
const normalizeBackendData = (raw) => {
  if (!raw) return null;

  // Transform oc data to match frontend expected field names
  const transformedOc = {};
  if (raw.oc) {
    Object.entries(raw.oc).forEach(([strikeKey, strikeData]) => {
      // Normalize strike key to number for consistent access
      const numericKey = parseFloat(strikeKey);

      // Helper to transform leg (CE/PE)
      const transformLeg = (leg, type) => ({
        ltp: leg?.ltp || 0,
        atp: leg?.atp || 0,
        pc: leg?.pc || 0,
        volume: leg?.volume || leg?.vol || 0,
        vol: leg?.vol || leg?.volume || 0,
        pVol: leg?.pVol || 0,
        // OI fields - standardize on uppercase OI for display, lowercase for logic if needed
        OI: leg?.OI || leg?.oi || 0,
        oi: leg?.OI || leg?.oi || 0,
        oichng: leg?.oichng || leg?.oi_change || 0,
        oi_change: leg?.oichng || leg?.oi_change || 0,
        p_oi: leg?.p_oi || 0,
        oiperchnge: leg?.oiperchnge || 0,
        // IV & Greeks
        iv: leg?.iv || 0,
        optgeeks: leg?.optgeeks || {},
        delta: leg?.optgeeks?.delta || 0,
        gamma: leg?.optgeeks?.gamma || 0,
        theta: leg?.optgeeks?.theta || 0,
        vega: leg?.optgeeks?.vega || 0,
        // Price change
        p_chng: leg?.p_chng || leg?.change || 0,
        p_pchng: leg?.p_pchng || 0,
        // Bid/Ask
        bid: leg?.bid || 0,
        ask: leg?.ask || 0,
        bid_qty: leg?.bid_qty || 0,
        ask_qty: leg?.ask_qty || 0,
        // Build-up signals
        btyp: leg?.btyp || "NT",
        BuiltupName: leg?.BuiltupName || "NEUTRAL",
        mness: leg?.mness || "",
        // Symbol info
        sym: leg?.sym || "",
        sid: leg?.sid || 0,
        disp_sym: leg?.disp_sym || "",
        otype: leg?.otype || type,
      });

      transformedOc[numericKey] = {
        strike: strikeData.strike || numericKey,
        strike_price: strikeData.strike_price || numericKey,
        ce: transformLeg(strikeData.ce, "CE"),
        pe: transformLeg(strikeData.pe, "PE"),
        // Reversal data
        reversal: strikeData.reversal || 0,
        wkly_reversal: strikeData.wkly_reversal || 0,
        fut_reversal: strikeData.fut_reversal || 0,
        // Support/Resistance
        rs: strikeData.rs || 0,
        rr: strikeData.rr || 0,
        ss: strikeData.ss || 0,
        sr_diff: strikeData.sr_diff || 0,
        // Time value
        ce_tv: strikeData.ce_tv || 0,
        pe_tv: strikeData.pe_tv || 0,
        // Signals
        pcr: strikeData.pcr || 0,
        trading_signals: strikeData.trading_signals || {},
        market_regimes: strikeData.market_regimes || {},
        price_range: strikeData.price_range || {},
      };
    });
  }

  // Construct the unified state shape
  return {
    options: {
      data: {
        oc: transformedOc,
        sltp: raw.spot?.ltp || raw.sltp || 0,
        schng: raw.spot?.change || raw.schng || 0,
        sperchng: raw.spot?.change_percent || raw.sperchng || 0,
        u_id: raw.u_id || 0,
        fl: raw.future || raw.fl || {},
        atmiv: raw.atmiv || 0,
        atmiv_change: raw.atmiv_change || 0,
        atm_strike: raw.atm_strike || 0,
        symbol: raw.symbol,
        expiry: raw.expiry,
        max_pain_strike: raw.max_pain_strike || 0,
        dte: raw.dte || raw.days_to_expiry || 0,
        lot_size: raw.lot_size || 75,
        total_ce_oi: raw.total_ce_oi || 0,
        total_pe_oi: raw.total_pe_oi || 0,
        pcr: raw.pcr || 0,
        expiry_list: raw.expiry_list || [],
      }
    },
    spot: {
      data: {
        Ltp: raw.spot?.ltp || 0,
        Change: raw.spot?.change || 0,
        ChangePercent: raw.spot?.change_percent || 0,
        ltp: raw.spot?.ltp || 0,
        change: raw.spot?.change || 0,
        change_percent: raw.spot?.change_percent || 0,
      }
    },
    fut: {
      data: raw.future || raw.fut?.data || {} // Corrected: Flat structure for Futures
    }
  };
};


// Thunks
export const fetchExpiryDate = createAsyncThunk(
  "data/fetchExpiryDate",
  async (params, { getState, rejectWithValue }) => {
    const requestKey = createRequestKey("fetchExpiryDate", params);
    if (activeRequests.has(requestKey)) return activeRequests.get(requestKey);

    try {
      const token = getAuthToken();
      if (!token) throw new Error("No auth token");

      const {
        config: { baseURL },
      } = getState();

      const symbol = params.sid || params.symbol || "NIFTY";
      const requestPromise = axios
        .get(`${baseURL}/options/expiry/${symbol}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => response.data);

      activeRequests.set(requestKey, requestPromise);
      const result = await requestPromise;
      activeRequests.delete(requestKey);

      return result;
    } catch (err) {
      activeRequests.delete(requestKey);
      return rejectWithValue(handleApiError(err));
    }
  }
);

export const fetchLiveData = createAsyncThunk(
  "data/fetchLiveData",
  async (params = {}, { getState, rejectWithValue }) => {
    const state = getState();

    // Use provided params or fall back to state
    const sid = params?.sid || state.data.sid;
    const exp_sid = params?.exp_sid || state.data.exp_sid;

    const requestKey = createRequestKey("fetchLiveData", { sid, exp_sid });

    if (activeRequests.has(requestKey)) return activeRequests.get(requestKey);

    try {
      const token = getAuthToken();
      if (!token) throw new Error("No auth token");

      const { config: { baseURL } } = state;
      const requestParams = { sid, exp_sid };

      const requestPromise = axios
        .get(`${baseURL}/options/live`, {
          params: requestParams,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
        .then((response) => response.data);

      activeRequests.set(requestKey, requestPromise);
      const result = await requestPromise;
      activeRequests.delete(requestKey);

      return result;
    } catch (err) {
      activeRequests.delete(requestKey);
      return rejectWithValue(handleApiError(err));
    }
  }
);

// Deprecated: Use fetchLiveData instead
export const fetchLiveDataDirectSocket = createAsyncThunk(
  "data/fetchLiveDataDirectSocket",
  async (_, { dispatch }) => {
    // Redirect to fetchLiveData for compatibility
    return dispatch(fetchLiveData()).unwrap();
  }
);

export const initializeLiveData = createAsyncThunk(
  "data/initializeLiveData",
  async (
    { useDirectSocket = false },
    { dispatch, getState, rejectWithValue }
  ) => {
    const state = getState();
    const requestKey = createRequestKey("initializeLiveData", {
      useDirectSocket,
      sid: state.data.sid,
      exp_sid: state.data.exp_sid,
    });

    if (activeRequests.has(requestKey)) return activeRequests.get(requestKey);

    try {
      const requestPromise = useDirectSocket
        ? dispatch(fetchLiveDataDirectSocket()).unwrap()
        : dispatch(fetchLiveData()).unwrap();

      activeRequests.set(requestKey, requestPromise);
      const result = await requestPromise;
      activeRequests.delete(requestKey);

      return result;
    } catch (err) {
      activeRequests.delete(requestKey);
      return rejectWithValue(err.message || "Failed to initialize live data");
    }
  }
);

export const setSidAndFetchData = createAsyncThunk(
  "data/setSidAndFetchData",
  async ({ newSid, useDirectSocket = false }, { dispatch }) => {
    const requestKey = createRequestKey("setSidAndFetchData", {
      newSid,
      useDirectSocket,
    });
    if (activeRequests.has(requestKey)) return activeRequests.get(requestKey);

    try {
      const requestPromise = (async () => {
        dispatch(setSid(newSid));
        const expiryResponse = await dispatch(
          fetchExpiryDate({ sid: newSid })
        ).unwrap();

        // Handle different response formats from backend
        // Backend returns: {success, data: {symbol, expiry_dates: [...]}}
        const expiryDates = Array.isArray(expiryResponse)
          ? expiryResponse
          : expiryResponse?.data?.expiry_dates || expiryResponse?.expiry_dates || [];

        if (!expiryDates?.length)
          throw new Error("No expiry dates available");

        const latestExpiry = getLatestExpiry(expiryDates);
        if (!latestExpiry) throw new Error("No valid expiry date found");

        // Set user-selected expiry (ingestedExpiry is set in fetchExpiryDate.fulfilled reducer)
        dispatch(setExp_sid(latestExpiry));
        await new Promise((resolve) => setTimeout(resolve, 50));
        await dispatch(initializeLiveData({ useDirectSocket })).unwrap();

        return { success: true, sid: newSid, exp_sid: latestExpiry };
      })();

      activeRequests.set(requestKey, requestPromise);
      const result = await requestPromise;
      activeRequests.delete(requestKey);

      return result;
    } catch (err) {
      activeRequests.delete(requestKey);
      throw err;
    }
  }
);



// Slice
export const dataSlice = createSlice({
  name: "data",
  initialState: {
    data: {},
    expDate: [],
    exp_sid: null,            // User-selected expiry
    ingestedExpiry: null,     // Expiry that HFT Engine is streaming (auto-detected)
    isExpiryMatch: true,      // Whether selected matches ingested
    sid: "NIFTY", // Ensure sid has an initial value
    isOc: true,
    error: null,
    isStreaming: false,
    loading: false,
    popupData: null,
    connectionMethod: "api",
  },
  reducers: {
    setExp_sid: (state, action) => {
      const newExpiry = Number(action.payload);
      state.exp_sid = newExpiry;
      // Update isExpiryMatch when user changes expiry
      // Use normalized comparison (YYYY-MM-DD) to handle timestamp vs date string
      const normalizedNew = normalizeExpiryForComparison(newExpiry);
      const normalizedIngested = normalizeExpiryForComparison(state.ingestedExpiry);
      state.isExpiryMatch = !normalizedIngested || normalizedNew === normalizedIngested;
      console.debug('setExp_sid:', {
        newExpiry,
        ingestedExpiry: state.ingestedExpiry,
        normalizedNew,
        normalizedIngested,
        isExpiryMatch: state.isExpiryMatch
      });
    },
    setIngestedExpiry: (state, action) => {
      state.ingestedExpiry = action.payload; // Keep original format
      // Update isExpiryMatch using normalized comparison
      const normalizedIngested = normalizeExpiryForComparison(action.payload);
      const normalizedExpSid = normalizeExpiryForComparison(state.exp_sid);
      state.isExpiryMatch = !normalizedExpSid || normalizedExpSid === normalizedIngested;
      console.debug('setIngestedExpiry:', {
        ingestedExpiry: action.payload,
        exp_sid: state.exp_sid,
        normalizedIngested,
        normalizedExpSid,
        isExpiryMatch: state.isExpiryMatch
      });
    },
    setSid: (state, action) => {
      state.sid = action.payload;
      state.exp_sid = null; // Clear expiry to prevent race condition with old expiry
      state.ingestedExpiry = null; // Also clear ingested expiry on symbol change
      state.isExpiryMatch = true; // Reset to true
      state.data = {}; // Optional: Clear old data to avoid UI confusion
    },
    setIsOc: (state, action) => {
      state.isOc = action.payload;
    },
    updateLiveData: (state, action) => {
      const raw = action.payload;

      if (!raw || !raw.oc) {
        console.warn('updateLiveData: Invalid data received', raw);
        return;
      }

      // IMPORTANT: Check if incoming data's expiry matches user's selected expiry
      // Use BOTH isExpiryMatch flag AND manual normalized comparison for safety
      const incomingExpiry = raw.expiry || raw.context?.expiry;

      if (state.exp_sid && incomingExpiry) {
        // Double-check with normalized comparison
        const normalizedIncoming = normalizeExpiryForComparison(incomingExpiry);
        const normalizedSelected = normalizeExpiryForComparison(state.exp_sid);
        const actualMatch = normalizedSelected === normalizedIncoming;

        if (!actualMatch) {
          // User has selected a different expiry - ignore WebSocket data
          console.debug('updateLiveData: Ignoring WebSocket data (expiry mismatch)', {
            userSelected: state.exp_sid,
            incoming: incomingExpiry,
            normalizedSelected,
            normalizedIncoming,
            isExpiryMatch: state.isExpiryMatch
          });
          return;
        }
      }

      // Use the unified normalizer
      const normalized = normalizeBackendData(raw);

      // Preserve existing expiry list if not present in update
      if (normalized && state.data?.options?.data?.expiry_list && (!normalized.options.data.expiry_list || normalized.options.data.expiry_list.length === 0)) {
        normalized.options.data.expiry_list = state.data.options.data.expiry_list;
      }

      state.data = normalized;
      state.connectionMethod = 'websocket';
    },
    setStreamingState: (state, action) => {
      state.isStreaming = action.payload;
    },
    setConnectionMethod: (state, action) => {
      state.connectionMethod = action.payload;
    },
    resetError: (state) => {
      state.error = null;
    },
    setPopupData: (state, action) => {
      state.popupData = action.payload;
    },
    clearData: (state) => {
      state.data = {};
      state.error = null;
      state.isStreaming = false;
    },
    setLatestExpiry: (state) => {
      if (state.expDate.length > 0) {
        const latestExpiry = getLatestExpiry(state.expDate);
        if (latestExpiry && latestExpiry !== state.exp_sid) {
          state.exp_sid = latestExpiry;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLiveData.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.connectionMethod = "api";
      })
      .addCase(fetchLiveData.fulfilled, (state, action) => {
        // Normalize backend response using the same helper as WebSocket
        const raw = action.payload;

        // Use the unified normalizer
        const normalized = normalizeBackendData(raw);

        // For REST, specifically ensure futures Data logic handles cases where backend might send list vs single
        // The normalizer expects 'future' key which works for standard backend response.

        state.data = normalized;
        state.loading = false;
      })
      .addCase(fetchLiveData.rejected, (state, action) => {
        state.error = action.payload || "Failed to fetch live data";
        state.loading = false;
        state.isStreaming = false;
      })
      .addCase(fetchLiveDataDirectSocket.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.connectionMethod = "socket";
      })
      .addCase(fetchLiveDataDirectSocket.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(fetchLiveDataDirectSocket.rejected, (state, action) => {
        state.error = action.payload || "Failed to connect via socket";
        state.loading = false;
        state.isStreaming = false;
      })
      .addCase(initializeLiveData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeLiveData.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(initializeLiveData.rejected, (state, action) => {
        state.error = action.payload || "Failed to initialize live data";
        state.loading = false;
        state.isStreaming = false;
      })
      .addCase(fetchExpiryDate.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExpiryDate.fulfilled, (state, action) => {
        // Backend returns: {success, data: {symbol, expiry_dates: [...]}}
        const payload = action.payload;
        const expiryDates = Array.isArray(payload)
          ? payload
          : payload?.data?.expiry_dates || payload?.expiry_dates || [];
        state.expDate = expiryDates;
        if (expiryDates.length > 0) {
          const latestExpiry = getLatestExpiry(expiryDates);
          if (latestExpiry) {
            state.exp_sid = latestExpiry;
            // Set ingested expiry to same value on first load
            // This ensures isExpiryMatch is true initially
            state.ingestedExpiry = latestExpiry;
            state.isExpiryMatch = true;
          }
        }
        state.loading = false;
      })
      .addCase(fetchExpiryDate.rejected, (state, action) => {
        state.error = action.payload || "Failed to fetch expiry dates";
        state.loading = false;
      });
  },
});

export const {
  setExp_sid,
  setIngestedExpiry,
  setSid,
  setIsOc,
  updateLiveData,
  setStreamingState,
  setConnectionMethod,
  resetError,
  setPopupData,
  clearData,
  setLatestExpiry,
} = dataSlice.actions;

export const stopLiveStream = () => (dispatch) => {
  // Socket cleanup now handled by useSocket hook
  dispatch(setStreamingState(false));
};

export const clearActiveRequests = () => {
  activeRequests.clear();
};

export default dataSlice.reducer;

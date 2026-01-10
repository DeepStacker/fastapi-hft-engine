import { createSelector } from "@reduxjs/toolkit";

const EMPTY_ARRAY = [];

/**
 * Redux Selectors
 * Memoized selectors for efficient state access
 */

// ============================================
// Data Slice Selectors
// ============================================

export const selectOptionsData = (state) => state.data.data?.options?.data;
export const selectLiveDataSnapshot = (state) => state.data.data?.options?.data;
export const selectOptionChain = (state) => state.data.data?.options?.data?.oc;
export const selectSpotData = (state) => state.data.data?.spot?.data;
export const selectSpotPrice = (state) => state.data.data?.spot?.data?.ltp || state.data.data?.options?.data?.sltp || 0;
export const selectSpotChange = (state) => state.data.data?.spot?.data?.change || state.data.data?.options?.data?.schng || 0;
export const selectFuturesData = (state) => state.data.data?.fut?.data;
export const selectATMStrike = (state) => state.data.data?.options?.data?.atm_strike;
export const selectATMIV = (state) => state.data.data?.options?.data?.atmiv;
export const selectMaxPainStrike = (state) => state.data.data?.options?.data?.max_pain_strike;
export const selectPCR = (state) => state.data.data?.options?.data?.pcr;
export const selectDaysToExpiry = (state) => state.data.data?.options?.data?.dte;
export const selectLotSize = (state) => state.data.data?.options?.data?.lot_size || 75;
export const selectExpiryList = (state) => state.data.data?.options?.data?.expiry_list || EMPTY_ARRAY;

// Loading states
export const selectDataLoading = (state) => state.data.loading;
export const selectDataError = (state) => state.data.error;
export const selectIsLiveDataLoading = (state) => state.data.isLiveDataLoading;

// Expiry & Symbol
export const selectExpDates = (state) => state.data.expDate || EMPTY_ARRAY;
export const selectSelectedExpiry = (state) => state.data.exp_sid;
export const selectSelectedSymbol = (state) => state.data.sid || 'NIFTY';
export const selectIngestedExpiry = (state) => state.data.ingestedExpiry;
export const selectIsExpiryMatch = (state) => state.data.isExpiryMatch;

// ============================================
// Auth Slice Selectors
// ============================================

export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthLoading = (state) => state.auth.authLoading;
export const selectCurrentUser = (state) => state.auth.user;
export const selectAuthError = (state) => state.auth.error;
export const selectIsPremium = (state) => state.auth.user?.isPremium || false;

// ============================================
// Theme Slice Selectors
// ============================================

export const selectTheme = (state) => state.theme.theme;
export const selectIsDarkMode = (state) => state.theme.theme === 'dark';

// ============================================
// Config Slice Selectors
// ============================================

export const selectSymbol = (state) => state.config.sym;
export const selectApiMode = (state) => state.config.useTestApi;

// ============================================
// Chart Slice Selectors
// ============================================

export const selectChartSymbol = (state) => state.chart.chartSymbol;
export const selectChartType = (state) => state.chart.chartType;

// ============================================
// Computed/Derived Selectors
// ============================================

/**
 * Get sorted strikes array from option chain
 */
export const selectSortedStrikes = (state) => {
    const oc = selectOptionChain(state);
    if (!oc) return [];
    return Object.keys(oc)
        .map(k => parseFloat(k))
        .sort((a, b) => a - b);
};

/**
 * Get strikes around ATM (limited range for performance)
 */
export const selectStrikesAroundATM = (strikeCount = 20) => (state) => {
    const strikes = selectSortedStrikes(state);
    const atm = selectATMStrike(state);

    if (!atm || strikes.length === 0) return strikes;

    const atmIndex = strikes.findIndex(s => s >= atm);
    if (atmIndex === -1) return strikes.slice(-strikeCount);

    const start = Math.max(0, atmIndex - Math.floor(strikeCount / 2));
    const end = Math.min(strikes.length, start + strikeCount);

    return strikes.slice(start, end);
};

/**
 * Get total OI for calls and puts
 */
export const selectTotalOI = (state) => {
    const data = selectOptionsData(state);
    return {
        calls: data?.total_ce_oi || 0,
        puts: data?.total_pe_oi || 0,
    };
};

// ============================================
// App State Selectors (Migrated from AppProvider)
// ============================================

export const selectData = (state) => state.data.data;
export const selectExp = (state) => state.data.exp;
export const selectExpDateRaw = (state) => state.data.expDate; // Distinct from selectExpDates
export const selectIsOc = (state) => state.data.isOc;
export const selectIsStreaming = (state) => state.data.isStreaming;
export const selectExpSid = (state) => state.data.exp_sid;
export const selectDataSymbol = (state) => state.data.symbol;
export const selectSid = (state) => state.data.sid; // Symbol ID that setSid action updates

export const selectIsReversed = (state) => state.theme.isReversed;
export const selectIsHighlighting = (state) => state.theme.isHighlighting;

export const selectAppState = createSelector(
    [
        selectCurrentUser,
        (state) => state.auth.token, // selectToken not exported, using inline or adding it
        selectIsAuthenticated,
        selectAuthLoading,
        selectTheme,
        selectIsReversed,
        selectIsHighlighting,
        selectData,
        selectExp,
        selectSid, // Fixed: was selectDataSymbol which returned undefined
        selectExpDateRaw,
        selectIsOc,
        selectIsStreaming,
        selectExpSid,
    ],
    (
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
        exp_sid
    ) => ({
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
    })
);

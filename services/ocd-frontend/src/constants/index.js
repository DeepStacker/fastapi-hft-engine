/**
 * Application Constants
 * Centralized configuration values
 */

// Supported trading symbols
export const SYMBOLS = [
    { value: 'NIFTY', label: 'NIFTY 50' },
    { value: 'BANKNIFTY', label: 'Bank NIFTY' },
    { value: 'FINNIFTY', label: 'Fin NIFTY' },
    { value: 'MIDCPNIFTY', label: 'Midcap NIFTY' },
];

export const SYMBOL_LIST = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

// Option table headers
export const TABLE_HEADERS = {
    CE: [
        { key: 'oi', label: 'OI', subtitle: 'Call' },
        { key: 'oichng', label: 'OI Chg' },
        { key: 'volume', label: 'Vol' },
        { key: 'iv', label: 'IV' },
        { key: 'ltp', label: 'LTP' },
        { key: 'chng', label: 'Chg' },
        { key: 'bid', label: 'Bid' },
        { key: 'ask', label: 'Ask' },
    ],
    PE: [
        { key: 'bid', label: 'Bid' },
        { key: 'ask', label: 'Ask' },
        { key: 'chng', label: 'Chg' },
        { key: 'ltp', label: 'LTP' },
        { key: 'iv', label: 'IV' },
        { key: 'volume', label: 'Vol' },
        { key: 'oichng', label: 'OI Chg' },
        { key: 'oi', label: 'OI', subtitle: 'Put' },
    ],
};

// Theme options
export const THEME = {
    DARK: 'dark',
    LIGHT: 'light',
};

// API endpoints (relative to base URL)
export const API_ENDPOINTS = {
    // Options
    OPTIONS_LIVE: '/options/live',
    OPTIONS_EXPIRY: '/options/expiry',
    OPTIONS_PERCENTAGE: '/options/percentage',
    OPTIONS_IV: '/options/iv',
    OPTIONS_DELTA: '/options/delta',
    OPTIONS_FUTURE: '/options/future',

    // Auth
    AUTH_LOGIN: '/auth/login',
    AUTH_REGISTER: '/auth/register',
    AUTH_LOGOUT: '/auth/logout',
    AUTH_REFRESH: '/auth/refresh',

    // User
    USER_PROFILE: '/user/profile',
    USER_SETTINGS: '/user/settings',
};

// Build-up types from Dhan API
export const BUILDUP_TYPES = {
    LB: { code: 'LB', name: 'LONG BUILDUP', color: 'success', description: 'Bullish - Price up, OI up' },
    SB: { code: 'SB', name: 'SHORT BUILDUP', color: 'danger', description: 'Bearish - Price down, OI up' },
    SC: { code: 'SC', name: 'SHORT COVERING', color: 'success', description: 'Bullish - Price up, OI down' },
    LC: { code: 'LC', name: 'LONG UNWINDING', color: 'danger', description: 'Bearish - Price down, OI down' },
    NT: { code: 'NT', name: 'NEUTRAL', color: 'default', description: 'No significant change' },
};

// Chart colors
export const CHART_COLORS = {
    primary: '#3b82f6',
    success: '#22c55e',
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#6366f1',
    call: '#22c55e',
    put: '#ef4444',
};

// Timeframes for charts
export const TIMEFRAMES = {
    '1m': { label: '1 Min', minutes: 1 },
    '5m': { label: '5 Min', minutes: 5 },
    '15m': { label: '15 Min', minutes: 15 },
    '30m': { label: '30 Min', minutes: 30 },
    '1h': { label: '1 Hour', minutes: 60 },
    '4h': { label: '4 Hours', minutes: 240 },
    '1d': { label: '1 Day', minutes: 1440 },
};

// Market hours (IST)
export const MARKET_HOURS = {
    open: { hour: 9, minute: 15 },
    close: { hour: 15, minute: 30 },
};

// Local storage keys
export const STORAGE_KEYS = {
    AUTH_TOKEN: 'authToken',
    USER: 'user',
    THEME: 'theme',
    SELECTED_SYMBOL: 'selectedSymbol',
    SELECTED_EXPIRY: 'selectedExpiry',
};

// Pagination defaults
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 20,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
};

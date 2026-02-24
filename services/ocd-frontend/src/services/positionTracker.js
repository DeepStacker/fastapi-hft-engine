/**
 * Position Tracking API Service
 * 
 * Methods for tracking strategy positions, fetching alerts, and getting adjustments.
 */

import api from './apiClient';

/**
 * Create and track a new position
 * @param {Object} position - Position data
 * @returns {Promise<Object>} Created position
 */
export async function createPosition(position) {
    const response = await api.post('/positions/', {
        strategy_type: position.strategyType || position.strategy_type,
        symbol: position.symbol || 'NIFTY',
        expiry: position.expiry,
        legs: position.legs,
        entry_spot: position.entrySpot || position.entry_spot,
        entry_atm_iv: position.entryAtmIv || position.entry_atm_iv,
        entry_pcr: position.entryPcr || position.entry_pcr,
        entry_metrics: position.entryMetrics || position.entry_metrics,
        market_context: position.marketContext || position.market_context,
        notes: position.notes,
        tags: position.tags || [],
    });
    return response.data;
}

/**
 * List all tracked positions
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of positions
 */
export async function listPositions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.symbol) params.append('symbol', filters.symbol);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const response = await api.get(`/positions/?${params.toString()}`);
    return response.data;
}

/**
 * Get a single position
 * @param {string} positionId - Position UUID
 * @returns {Promise<Object>} Position data
 */
export async function getPosition(positionId) {
    const response = await api.get(`/positions/${positionId}`);
    return response.data;
}

/**
 * Update a position
 * @param {string} positionId - Position UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Update result
 */
export async function updatePosition(positionId, updates) {
    const response = await api.patch(`/positions/${positionId}`, {
        status: updates.status,
        current_pnl: updates.currentPnl || updates.current_pnl,
        notes: updates.notes,
        tags: updates.tags,
        exit_reason: updates.exitReason || updates.exit_reason,
    });
    return response.data;
}

/**
 * Delete a position
 * @param {string} positionId - Position UUID
 * @returns {Promise<Object>} Delete result
 */
export async function deletePosition(positionId) {
    const response = await api.delete(`/positions/${positionId}`);
    return response.data;
}

/**
 * Analyze a position for risk conditions
 * @param {string} positionId - Position UUID
 * @returns {Promise<Object>} Analysis with alerts and adjustments
 */
export async function analyzePosition(positionId) {
    const response = await api.post(`/positions/${positionId}/analyze`);
    return response.data;
}

/**
 * Get alerts for a position
 * @param {string} positionId - Position UUID
 * @param {boolean} unreadOnly - Only fetch unread alerts
 * @returns {Promise<Array>} List of alerts
 */
export async function getPositionAlerts(positionId, unreadOnly = false) {
    const response = await api.get(`/positions/${positionId}/alerts?unread_only=${unreadOnly}`);
    return response.data;
}

/**
 * Mark alerts as read
 * @param {string} positionId - Position UUID
 * @param {Array<string>} alertIds - Optional specific alert IDs
 * @returns {Promise<Object>} Result
 */
export async function markAlertsRead(positionId, alertIds = null) {
    const response = await api.post(`/positions/${positionId}/alerts/mark-read`, {
        alert_ids: alertIds,
    });
    return response.data;
}

/**
 * Get all alerts across all positions
 * @param {boolean} unreadOnly - Only fetch unread
 * @param {number} limit - Max alerts to return
 * @returns {Promise<Array>} List of alerts
 */
export async function getAllAlerts(unreadOnly = true, limit = 50) {
    const response = await api.get(`/positions/alerts/all?unread_only=${unreadOnly}&limit=${limit}`);
    return response.data;
}

/**
 * Position status constants
 */
export const POSITION_STATUS = {
    RECOMMENDED: 'recommended',
    ACTIVE: 'active',
    ADJUSTED: 'adjusted',
    CLOSED: 'closed',
    EXPIRED: 'expired',
};

/**
 * Alert severity constants
 */
export const ALERT_SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical',
};

/**
 * Alert type constants
 */
export const ALERT_TYPES = {
    DELTA_DRIFT: 'delta_drift',
    GAMMA_RISK: 'gamma_risk',
    THETA_DECAY: 'theta_decay',
    IV_SPIKE: 'iv_spike',
    IV_CRUSH: 'iv_crush',
    LEG_TESTED: 'leg_tested',
    PROFIT_TARGET: 'profit_target',
    STOP_LOSS: 'stop_loss',
    TIME_WARNING: 'time_warning',
};

export default {
    createPosition,
    listPositions,
    getPosition,
    updatePosition,
    deletePosition,
    analyzePosition,
    getPositionAlerts,
    markAlertsRead,
    getAllAlerts,
    POSITION_STATUS,
    ALERT_SEVERITY,
    ALERT_TYPES,
};

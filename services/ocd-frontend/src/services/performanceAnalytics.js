/**
 * Performance Analytics Service
 * 
 * API client for performance analytics and accountability metrics.
 */
import api from './apiClient';

/**
 * Get overview statistics
 */
export async function getAnalyticsOverview(days = 30) {
    const response = await api.get('/analytics/overview', { params: { days } });
    return response.data;
}

/**
 * Get strategy-level breakdown
 */
export async function getStrategyBreakdown(days = 30) {
    const response = await api.get('/analytics/by-strategy', { params: { days } });
    return response.data;
}

/**
 * Get confidence calibration analysis
 */
export async function getCalibration(bucketSize = 0.1) {
    const response = await api.get('/analytics/calibration', { params: { bucket_size: bucketSize } });
    return response.data;
}

/**
 * Get time series performance
 */
export async function getTimeSeries(granularity = 'week', periods = 12) {
    const response = await api.get('/analytics/time-series', {
        params: { granularity, periods }
    });
    return response.data;
}

/**
 * Get top performing strategies
 */
export async function getTopStrategies(limit = 5) {
    const response = await api.get('/analytics/top-strategies', { params: { limit } });
    return response.data;
}

/**
 * Get full analytics dashboard data
 */
export async function getFullAnalytics(days = 30) {
    const response = await api.get('/analytics/full', { params: { days } });
    return response.data;
}

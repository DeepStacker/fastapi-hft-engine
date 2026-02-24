/**
 * Position Alerts Hook
 * 
 * Provides real-time alert monitoring with:
 * - Polling for new alerts
 * - Callback for critical alerts (components can show toasts)
 * - Unread count tracking
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllAlerts, ALERT_SEVERITY } from '../services/positionTracker';

const DEFAULT_POLL_INTERVAL = 30000; // 30 seconds

/**
 * Hook for monitoring position alerts
 * 
 * @param {Object} options - Hook options
 * @param {boolean} options.enabled - Whether to enable polling
 * @param {number} options.pollInterval - Polling interval in ms
 * @param {Function} options.onCriticalAlert - Callback when new critical alert detected
 * @returns {Object} - Alerts data and methods
 */
export function usePositionAlerts({
    enabled = true,
    pollInterval = DEFAULT_POLL_INTERVAL,
    onCriticalAlert = null
} = {}) {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const hasNotifiedRef = useRef(new Set());

    const fetchAlerts = useCallback(async () => {
        try {
            const data = await getAllAlerts(true, 50);
            setAlerts(data || []);
            setError(null);

            // Check for new critical alerts and invoke callback
            if (onCriticalAlert && data && data.length > 0) {
                const newCritical = data.filter(
                    a => a.severity === ALERT_SEVERITY.CRITICAL &&
                        !a.is_read &&
                        !hasNotifiedRef.current.has(a.id)
                );

                newCritical.forEach(alert => {
                    onCriticalAlert(alert);
                    hasNotifiedRef.current.add(alert.id);
                });
            }
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [onCriticalAlert]);

    useEffect(() => {
        if (!enabled) return;

        // Initial fetch
        fetchAlerts();

        // Set up polling
        const interval = setInterval(fetchAlerts, pollInterval);

        return () => clearInterval(interval);
    }, [enabled, pollInterval, fetchAlerts]);

    const unreadCount = alerts.filter(a => !a.is_read).length;
    const criticalCount = alerts.filter(a => a.severity === ALERT_SEVERITY.CRITICAL && !a.is_read).length;
    const warningCount = alerts.filter(a => a.severity === ALERT_SEVERITY.WARNING && !a.is_read).length;

    const refresh = useCallback(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    return {
        alerts,
        loading,
        error,
        unreadCount,
        criticalCount,
        warningCount,
        refresh,
        hasCritical: criticalCount > 0,
        hasWarning: warningCount > 0
    };
}

export default usePositionAlerts;

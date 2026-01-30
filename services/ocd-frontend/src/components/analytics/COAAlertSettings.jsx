/**
 * COA Alert Settings Component
 * Manage COA scenario change alerts for symbols
 */
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import apiClient from '../../services/apiClient';
import {
    BellIcon,
    BellSlashIcon,
    BoltIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const COAAlertSettings = () => {
    const symbol = useSelector(state => state.symbol?.selected || 'NIFTY');
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Settings state
    const [settings, setSettings] = useState({
        alert_on_scenario_change: true,
        alert_on_strength_change: false,
        alert_on_eos_eor_breach: false,
        notify_in_app: true,
        notify_push: true,
        notify_email: false,
    });

    // Fetch current subscription
    const fetchSubscription = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/analytics/coa/alerts/subscriptions');
            if (response.data?.success) {
                const sub = response.data.subscriptions?.find(
                    s => s.symbol.toUpperCase() === symbol.toUpperCase()
                );
                if (sub) {
                    setSubscription(sub);
                    setSettings({
                        alert_on_scenario_change: sub.alert_on_scenario_change,
                        alert_on_strength_change: sub.alert_on_strength_change,
                        alert_on_eos_eor_breach: sub.alert_on_eos_eor_breach,
                        notify_in_app: sub.notify_in_app,
                        notify_push: sub.notify_push,
                        notify_email: sub.notify_email,
                    });
                } else {
                    setSubscription(null);
                }
            }
        } catch (err) {
            // User might not be logged in
            console.log('Could not fetch subscriptions:', err.message);
        } finally {
            setLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    const handleSubscribe = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await apiClient.post(
                `/analytics/${symbol}/coa/alerts/subscribe`,
                settings
            );
            if (response.data?.success) {
                setSubscription(response.data.subscription);
                setSuccess('Successfully subscribed to alerts!');
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to subscribe');
        } finally {
            setSaving(false);
        }
    };

    const handleUnsubscribe = async () => {
        setSaving(true);
        setError(null);

        try {
            const response = await apiClient.delete(
                `/analytics/${symbol}/coa/alerts/unsubscribe`
            );
            if (response.data?.success) {
                setSubscription(null);
                setSuccess('Unsubscribed from alerts');
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to unsubscribe');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateSettings = async () => {
        if (!subscription) return;

        setSaving(true);
        setError(null);

        try {
            const response = await apiClient.patch(
                `/analytics/${symbol}/coa/alerts`,
                settings
            );
            if (response.data?.success) {
                setSuccess('Settings updated!');
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    const Toggle = ({ label, description, checked, onChange, disabled }) => (
        <label className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800' :
                checked ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700' :
                    'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}>
            <div>
                <div className="font-medium text-sm">{label}</div>
                {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
            </div>
            <div className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => !disabled && onChange(e.target.checked)}
                className="sr-only"
                disabled={disabled}
            />
        </label>
    );

    if (loading) {
        return (
            <div className="p-6 text-center text-gray-400">
                <ArrowPathIcon className="w-6 h-6 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                    <BellIcon className="w-5 h-5" />
                    COA Alerts for {symbol}
                </h3>
                {subscription && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Active
                    </span>
                )}
            </div>

            {/* Status Messages */}
            {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    {error}
                </div>
            )}
            {success && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5" />
                    {success}
                </div>
            )}

            {/* Alert Triggers */}
            <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Alert Triggers</div>
                <Toggle
                    label="Scenario Changes"
                    description="Alert when scenario changes (e.g., 1.0 → 1.5)"
                    checked={settings.alert_on_scenario_change}
                    onChange={(v) => setSettings({ ...settings, alert_on_scenario_change: v })}
                />
                <Toggle
                    label="Strength Changes"
                    description="Alert when support/resistance strength changes (e.g., Strong → WTT)"
                    checked={settings.alert_on_strength_change}
                    onChange={(v) => setSettings({ ...settings, alert_on_strength_change: v })}
                />
                <Toggle
                    label="EOS/EOR Breach"
                    description="Alert when spot crosses key trading levels"
                    checked={settings.alert_on_eos_eor_breach}
                    onChange={(v) => setSettings({ ...settings, alert_on_eos_eor_breach: v })}
                />
            </div>

            {/* Notification Channels */}
            <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notification Channels</div>
                <div className="grid grid-cols-3 gap-2">
                    <Toggle
                        label="In-App"
                        checked={settings.notify_in_app}
                        onChange={(v) => setSettings({ ...settings, notify_in_app: v })}
                    />
                    <Toggle
                        label="Push"
                        checked={settings.notify_push}
                        onChange={(v) => setSettings({ ...settings, notify_push: v })}
                    />
                    <Toggle
                        label="Email"
                        checked={settings.notify_email}
                        onChange={(v) => setSettings({ ...settings, notify_email: v })}
                    />
                </div>
            </div>

            {/* Last Alert Info */}
            {subscription?.last_scenario && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-xs">
                    <div className="text-gray-500">Last Known Scenario</div>
                    <div className="font-medium">{subscription.last_scenario}</div>
                    {subscription.last_alert_at && (
                        <div className="text-gray-500 mt-1">
                            Last alert: {new Date(subscription.last_alert_at).toLocaleString()}
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
                {subscription ? (
                    <>
                        <button
                            onClick={handleUpdateSettings}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                            Save Settings
                        </button>
                        <button
                            onClick={handleUnsubscribe}
                            disabled={saving}
                            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                        >
                            <BellSlashIcon className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleSubscribe}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <BoltIcon className="w-4 h-4" />}
                        Enable Alerts for {symbol}
                    </button>
                )}
            </div>
        </div>
    );
};

export default COAAlertSettings;

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import {
    BellIcon,
    XMarkIcon,
    DevicePhoneMobileIcon,
    EnvelopeIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon,
    ClockIcon,
    ChartBarIcon,
    InformationCircleIcon,
    SparklesIcon,
    Cog6ToothIcon,
    ChatBubbleLeftIcon,
    ArrowPathIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";
import notificationService from "../../services/notificationService";
import TimeClockSelector from "../common/TimeClockSelector";

/**
 * Notification Preferences Panel
 * User settings for channels, purposes, and sound
 */
const NotificationPreferences = ({ isOpen, onClose }) => {
    const theme = useSelector((state) => state.theme?.theme || "light");
    const [preferences, setPreferences] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testSending, setTestSending] = useState(false);
    const [testSuccess, setTestSuccess] = useState(false);

    // Time picker state
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [timePickerTarget, setTimePickerTarget] = useState(null); // 'start' or 'end'

    useEffect(() => {
        if (isOpen) {
            loadPreferences();
        }
    }, [isOpen]);

    const loadPreferences = async () => {
        try {
            setLoading(true);
            const result = await notificationService.getPreferences();
            setPreferences(result.preferences);
        } catch (error) {
            console.error("Failed to load preferences:", error);
        } finally {
            setLoading(false);
        }
    };

    const updatePreference = async (key, value) => {
        // Optimistic update
        setPreferences((prev) => ({ ...prev, [key]: value }));

        try {
            setSaving(true);
            await notificationService.updatePreferences({ [key]: value });
        } catch (error) {
            console.error("Failed to update preference:", error);
            // Revert on error
            loadPreferences();
        } finally {
            setSaving(false);
        }
    };

    const sendTestNotification = async () => {
        try {
            setTestSending(true);
            setTestSuccess(false);
            await notificationService.sendTestNotification();
            setTestSuccess(true);
            setTimeout(() => setTestSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to send test:", error);
        } finally {
            setTestSending(false);
        }
    };

    const openTimeSelector = (target) => {
        setTimePickerTarget(target);
        setShowTimePicker(true);
    };

    const handleTimeChange = (newTime) => {
        const key = timePickerTarget === "start" ? "quiet_hours_start" : "quiet_hours_end";
        // Append seconds if backend expects it, though frontend usually handles HH:MM
        // Assuming backend handles "HH:MM" or "HH:MM:00"
        updatePreference(key, newTime + ":00");
    };

    if (!isOpen) return null;

    const isDark = theme === "dark";

    const Toggle = ({ checked, onChange }) => (
        <button
            onClick={() => onChange(!checked)}
            className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-blue-600" : isDark ? "bg-gray-700" : "bg-gray-300"
                }`}
        >
            <motion.div
                animate={{ x: checked ? 20 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
            />
        </button>
    );

    const Section = ({ title, children }) => (
        <div className="mb-6">
            <h3
                className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? "text-gray-400" : "text-gray-500"
                    }`}
            >
                {title}
            </h3>
            <div className={`rounded-2xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                {children}
            </div>
        </div>
    );

    const SettingRow = ({ icon: Icon, label, description, value, onChange }) => (
        <div
            className={`flex items-center justify-between p-4 border-b last:border-0 ${isDark ? "border-white/5" : "border-gray-100"
                }`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? "bg-white/10" : "bg-white shadow-sm"}`}>
                    <Icon className={`w-5 h-5 ${isDark ? "text-gray-300" : "text-gray-600"}`} />
                </div>
                <div>
                    <p className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                        {label}
                    </p>
                    {description && (
                        <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                            {description}
                        </p>
                    )}
                </div>
            </div>
            <Toggle checked={value} onChange={onChange} />
        </div>
    );

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`relative w-full max-w-md max-h-[80vh] overflow-hidden rounded-3xl shadow-2xl ${isDark ? "bg-gray-900" : "bg-white"
                        }`}
                >
                    {/* Header */}
                    <div className={`p-5 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${isDark ? "bg-purple-600/20" : "bg-purple-100"}`}>
                                    <Cog6ToothIcon className={`w-5 h-5 ${isDark ? "text-purple-400" : "text-purple-600"}`} />
                                </div>
                                <div>
                                    <h2 className={`font-bold text-lg ${isDark ? "text-white" : "text-gray-900"}`}>
                                        Notification Settings
                                    </h2>
                                    <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                        Customize how you receive alerts
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                                    }`}
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto max-h-[60vh] p-5">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                            </div>
                        ) : preferences ? (
                            <>
                                {/* Channels */}
                                <Section title="Delivery Channels">
                                    <SettingRow
                                        icon={BellIcon}
                                        label="In-App Notifications"
                                        description="Show in notification center"
                                        value={preferences.enable_in_app}
                                        onChange={(v) => updatePreference("enable_in_app", v)}
                                    />
                                    <SettingRow
                                        icon={DevicePhoneMobileIcon}
                                        label="Push Notifications"
                                        description="Browser notifications"
                                        value={preferences.enable_push}
                                        onChange={(v) => updatePreference("enable_push", v)}
                                    />
                                    <SettingRow
                                        icon={EnvelopeIcon}
                                        label="Email Notifications"
                                        description="Important updates only"
                                        value={preferences.enable_email}
                                        onChange={(v) => updatePreference("enable_email", v)}
                                    />
                                </Section>

                                {/* Categories */}
                                <Section title="Notification Categories">
                                    <SettingRow
                                        icon={ChartBarIcon}
                                        label="Trading"
                                        description="Orders, fills, alerts"
                                        value={preferences.enable_transactional}
                                        onChange={(v) => updatePreference("enable_transactional", v)}
                                    />
                                    <SettingRow
                                        icon={InformationCircleIcon}
                                        label="News & Updates"
                                        description="Market news, announcements"
                                        value={preferences.enable_informative}
                                        onChange={(v) => updatePreference("enable_informative", v)}
                                    />
                                    <SettingRow
                                        icon={SparklesIcon}
                                        label="Personalized"
                                        description="Recommendations, watchlist"
                                        value={preferences.enable_personalized}
                                        onChange={(v) => updatePreference("enable_personalized", v)}
                                    />
                                    <SettingRow
                                        icon={Cog6ToothIcon}
                                        label="System"
                                        description="Maintenance, updates"
                                        value={preferences.enable_system}
                                        onChange={(v) => updatePreference("enable_system", v)}
                                    />
                                    <SettingRow
                                        icon={ChatBubbleLeftIcon}
                                        label="Feedback Requests"
                                        description="Surveys, ratings"
                                        value={preferences.enable_feedback}
                                        onChange={(v) => updatePreference("enable_feedback", v)}
                                    />
                                </Section>

                                {/* Sound */}
                                <Section title="Sound & Behavior">
                                    <SettingRow
                                        icon={preferences.enable_sound ? SpeakerWaveIcon : SpeakerXMarkIcon}
                                        label="Notification Sounds"
                                        description="Play audio alerts"
                                        value={preferences.enable_sound}
                                        onChange={(v) => updatePreference("enable_sound", v)}
                                    />
                                </Section>

                                {/* Quiet Hours */}
                                <Section title="Quiet Hours">
                                    <div className="p-4 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                                Start Time
                                            </label>
                                            <div className="relative cursor-pointer" onClick={() => openTimeSelector("start")}>
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <ClockIcon className={`w-4 h-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={preferences.quiet_hours_start?.slice(0, 5) || "--:--"}
                                                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 bg-transparent transition-colors cursor-pointer ${isDark
                                                        ? "border-gray-700 text-white focus:border-blue-500"
                                                        : "border-gray-200 text-gray-900 focus:border-blue-500"
                                                        }`}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                                End Time
                                            </label>
                                            <div className="relative cursor-pointer" onClick={() => openTimeSelector("end")}>
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <ClockIcon className={`w-4 h-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={preferences.quiet_hours_end?.slice(0, 5) || "--:--"}
                                                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 bg-transparent transition-colors cursor-pointer ${isDark
                                                        ? "border-gray-700 text-white focus:border-blue-500"
                                                        : "border-gray-200 text-gray-900 focus:border-blue-500"
                                                        }`}
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-2 mt-2">
                                            <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                                Notifications (except urgent ones) will be silenced during these hours.
                                            </p>
                                        </div>
                                    </div>
                                </Section>
                            </>
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                Failed to load preferences
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className={`p-5 border-t ${isDark ? "border-white/10" : "border-gray-100"}`}>
                        <button
                            onClick={sendTestNotification}
                            disabled={testSending}
                            className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${testSuccess
                                ? "bg-green-600 text-white"
                                : isDark
                                    ? "bg-white/10 text-white hover:bg-white/20"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                        >
                            {testSending ? (
                                <>
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : testSuccess ? (
                                <>
                                    <CheckCircleIcon className="w-4 h-4" />
                                    Test Sent!
                                </>
                            ) : (
                                <>
                                    <BellIcon className="w-4 h-4" />
                                    Send Test Notification
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>

            {/* Time Picker Modal */}
            {showTimePicker && preferences && (
                <TimeClockSelector
                    value={
                        timePickerTarget === 'start'
                            ? preferences.quiet_hours_start?.slice(0, 5)
                            : preferences.quiet_hours_end?.slice(0, 5)
                    }
                    onChange={handleTimeChange}
                    onClose={() => setShowTimePicker(false)}
                    theme={theme}
                />
            )}
        </AnimatePresence>
    );
};

export default NotificationPreferences;

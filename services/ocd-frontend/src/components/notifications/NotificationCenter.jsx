import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import {
    BellIcon,
    CheckIcon,
    TrashIcon,
    XMarkIcon,
    Cog6ToothIcon,
    ChevronDownIcon,
    ExclamationCircleIcon,
    CheckCircleIcon,
    InformationCircleIcon,
    ExclamationTriangleIcon,
    ChartBarIcon,
    CurrencyDollarIcon,
    ChatBubbleLeftIcon,
    BellSlashIcon,
} from "@heroicons/react/24/outline";
import notificationService from "../../services/notificationService";
import Modal from "../common/Modal";

// Purpose categories with icons and colors
const PURPOSE_TABS = [
    { id: "all", label: "All", icon: BellIcon, color: "text-gray-500" },
    { id: "transactional", label: "Trading", icon: ChartBarIcon, color: "text-blue-500" },
    { id: "informative", label: "News", icon: InformationCircleIcon, color: "text-cyan-500" },
    { id: "system", label: "System", icon: Cog6ToothIcon, color: "text-purple-500" },
    { id: "personalized", label: "For You", icon: CheckCircleIcon, color: "text-green-500" },
    { id: "cta", label: "Action", icon: ExclamationCircleIcon, color: "text-orange-500" },
    { id: "feedback", label: "Feedback", icon: ChatBubbleLeftIcon, color: "text-pink-500" },
];

// Type icons and colors
const TYPE_STYLES = {
    info: { icon: InformationCircleIcon, color: "text-blue-500", bg: "bg-blue-500/10" },
    success: { icon: CheckCircleIcon, color: "text-green-500", bg: "bg-green-500/10" },
    warning: { icon: ExclamationTriangleIcon, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    error: { icon: ExclamationCircleIcon, color: "text-red-500", bg: "bg-red-500/10" },
    trade: { icon: ChartBarIcon, color: "text-blue-600", bg: "bg-blue-600/10" },
    price: { icon: CurrencyDollarIcon, color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

/**
 * Enhanced Notification Center
 * Displays notifications grouped by purpose with filtering
 */
const NotificationCenter = ({ isOpen, onClose, onOpenPreferences }) => {
    const theme = useSelector((state) => state.theme?.theme || "light");
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("all");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [showMarkAllConfirmation, setShowMarkAllConfirmation] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadNotifications();
        }
    }, [isOpen, activeTab]);

    const loadNotifications = async (loadMore = false) => {
        try {
            setLoading(true);
            const result = await notificationService.getNotifications({
                limit: 20,
                purpose: activeTab === "all" ? null : activeTab,
            });

            if (loadMore) {
                setNotifications((prev) => [...prev, ...(result.notifications || [])]);
            } else {
                setNotifications(result.notifications || []);
            }
            setHasMore((result.notifications || []).length === 20);
        } catch (error) {
            console.error("Failed to load notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    };

    const confirmMarkAllAsRead = async () => {
        try {
            setShowMarkAllConfirmation(false);
            await notificationService.markAllAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch (error) {
            console.error("Failed to mark all as read:", error);
        }
    };

    const handleMarkAllAsReadClick = () => {
        if (unreadCount > 0) {
            setShowMarkAllConfirmation(true);
        }
    };

    const handleDelete = async (id) => {
        try {
            await notificationService.deleteNotification(id);
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        } catch (error) {
            console.error("Failed to delete:", error);
        }
    };

    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.is_read).length,
        [notifications]
    );

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    };

    if (!isOpen) return null;

    const isDark = theme === "dark";

    return (
        <>
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-start justify-end"
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: 400, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 400, opacity: 0 }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className={`relative w-full max-w-md h-full shadow-2xl ${isDark ? "bg-gray-900 border-l border-white/10" : "bg-white"
                            }`}
                    >
                        {/* Header */}
                        <div className={`p-4 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${isDark ? "bg-blue-600/20" : "bg-blue-100"}`}>
                                        <BellIcon className={`w-5 h-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                                    </div>
                                    <div>
                                        <h2 className={`font-bold text-lg ${isDark ? "text-white" : "text-gray-900"}`}>
                                            Notifications
                                        </h2>
                                        {unreadCount > 0 && (
                                            <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                                {unreadCount} unread
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={onOpenPreferences}
                                        className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                                            }`}
                                        title="Settings"
                                    >
                                        <Cog6ToothIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                                            }`}
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Purpose tabs */}
                            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                                {PURPOSE_TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setPage(1);
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                            ? isDark
                                                ? "bg-blue-600 text-white"
                                                : "bg-blue-100 text-blue-700"
                                            : isDark
                                                ? "bg-white/5 text-gray-400 hover:bg-white/10"
                                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                            }`}
                                    >
                                        <tab.icon className="w-3.5 h-3.5" />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notifications list */}
                        <div className="overflow-y-auto h-[calc(100%-180px)]">
                            {loading && notifications.length === 0 ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className={`p-4 rounded-full mb-3 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                                        <BellSlashIcon className={`w-8 h-8 opacity-30 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
                                    </div>
                                    {activeTab === 'all' ? "No notifications" : `No ${PURPOSE_TABS.find(t => t.id === activeTab)?.label || activeTab} notifications`}
                                    <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                        {activeTab === 'all'
                                            ? "You're all caught up! Check back later."
                                            : "Try selecting a different category."}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-white/5">
                                    {notifications.map((notification) => {
                                        const typeStyle = TYPE_STYLES[notification.type] || TYPE_STYLES.info;
                                        const TypeIcon = typeStyle.icon;

                                        return (
                                            <motion.div
                                                key={notification.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -100 }}
                                                className={`p-4 transition-colors ${!notification.is_read
                                                    ? isDark
                                                        ? "bg-blue-500/5"
                                                        : "bg-blue-50/50"
                                                    : ""
                                                    } ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
                                            >
                                                <div className="flex gap-3">
                                                    {/* Icon */}
                                                    <div className={`p-2 rounded-xl ${typeStyle.bg} shrink-0`}>
                                                        <TypeIcon className={`w-5 h-5 ${typeStyle.color}`} />
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h4
                                                                className={`font-semibold text-sm leading-tight ${isDark ? "text-white" : "text-gray-900"
                                                                    }`}
                                                            >
                                                                {notification.title}
                                                            </h4>
                                                            <span
                                                                className={`text-xs shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"
                                                                    }`}
                                                            >
                                                                {formatTime(notification.created_at)}
                                                            </span>
                                                        </div>
                                                        <p
                                                            className={`text-sm mt-1 line-clamp-2 ${isDark ? "text-gray-400" : "text-gray-600"
                                                                }`}
                                                        >
                                                            {notification.message}
                                                        </p>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-2 mt-2">
                                                            {notification.action_url && (
                                                                <a
                                                                    href={notification.action_url}
                                                                    className="text-xs font-medium text-blue-500 hover:text-blue-600"
                                                                >
                                                                    {notification.action_label || "View →"}
                                                                </a>
                                                            )}
                                                            {!notification.is_read && (
                                                                <button
                                                                    onClick={() => handleMarkAsRead(notification.id)}
                                                                    className={`text-xs flex items-center gap-1 ${isDark
                                                                        ? "text-gray-400 hover:text-green-400"
                                                                        : "text-gray-500 hover:text-green-600"
                                                                        }`}
                                                                >
                                                                    <CheckIcon className="w-3 h-3" />
                                                                    Mark read
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDelete(notification.id)}
                                                                className={`text-xs flex items-center gap-1 ${isDark
                                                                    ? "text-gray-400 hover:text-red-400"
                                                                    : "text-gray-500 hover:text-red-600"
                                                                    }`}
                                                            >
                                                                <TrashIcon className="w-3 h-3" />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Unread indicator */}
                                                    {!notification.is_read && (
                                                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}

                                    {/* Load more */}
                                    {hasMore && (
                                        <div className="p-4 text-center">
                                            <button
                                                onClick={() => loadNotifications(true)}
                                                disabled={loading}
                                                className={`text-sm font-medium ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"
                                                    }`}
                                            >
                                                {loading ? "Loading..." : "Load more"}
                                            </button>
                                        </div>
                                    )}
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer actions */}
                        <div
                            className={`absolute bottom-0 left-0 right-0 p-4 border-t ${isDark ? "border-white/10 bg-gray-900" : "border-gray-100 bg-white"
                                }`}
                        >
                            <button
                                onClick={handleMarkAllAsReadClick}
                                disabled={unreadCount === 0}
                                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${unreadCount > 0
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : isDark
                                        ? "bg-white/5 text-gray-500"
                                        : "bg-gray-100 text-gray-400"
                                    }`}
                            >
                                Mark all as read
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            {/* Confirmation Modal */}
            <Modal
                isOpen={showMarkAllConfirmation}
                onClose={() => setShowMarkAllConfirmation(false)}
                title="Mark all as read?"
                size="sm"
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowMarkAllConfirmation(false)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDark
                                ? "text-gray-300 hover:text-white hover:bg-white/10"
                                : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                                }`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmMarkAllAsRead}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                        >
                            Confirm
                        </button>
                    </div>
                }
            >
                <div className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    Are you sure you want to mark all {unreadCount} notifications as read? This action cannot be undone.
                </div>
            </Modal>
        </>
    );
};

export default NotificationCenter;

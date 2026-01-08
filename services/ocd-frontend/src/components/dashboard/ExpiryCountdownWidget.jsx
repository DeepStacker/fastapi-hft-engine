/**
 * Expiry Countdown Widget
 * Shows time remaining until the next options expiry
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
    CalendarDaysIcon,
    ClockIcon,
    BellAlertIcon,
} from '@heroicons/react/24/outline';

const ExpiryCountdownWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    // Get selected expiry from Redux or default to weekly
    const selectedExpiry = useSelector((state) => state.chart?.selectedExpiry);
    const selectedSymbol = useSelector((state) => state.chart?.selectedSymbol) || 'NIFTY';

    const [countdown, setCountdown] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpiring: false, // True if expiring today
        expiryDate: null,
        expiryType: 'Weekly', // Weekly, Monthly
    });

    // Calculate next Thursday (weekly expiry) or last Thursday of month
    const getNextExpiry = () => {
        const now = new Date();

        // If we have a selected expiry from Redux, use it
        if (selectedExpiry) {
            // Parse expiry string (format: "09-Jan-2026" or similar)
            const expiryDate = new Date(selectedExpiry);
            if (!isNaN(expiryDate.getTime())) {
                // Set to 3:30 PM IST
                expiryDate.setHours(15, 30, 0, 0);
                return {
                    date: expiryDate,
                    type: expiryDate.getDate() > 21 ? 'Monthly' : 'Weekly'
                };
            }
        }

        // Default: Calculate next Thursday
        const dayOfWeek = now.getDay();
        const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7; // 4 = Thursday

        const nextThursday = new Date(now);
        nextThursday.setDate(now.getDate() + daysUntilThursday);
        nextThursday.setHours(15, 30, 0, 0); // 3:30 PM IST

        // If today is Thursday and market hasn't closed, use today
        if (dayOfWeek === 4) {
            const marketClose = new Date(now);
            marketClose.setHours(15, 30, 0, 0);
            if (now < marketClose) {
                return { date: marketClose, type: 'Weekly' };
            }
        }

        return { date: nextThursday, type: 'Weekly' };
    };

    const updateCountdown = () => {
        const { date: expiryDate, type } = getNextExpiry();
        const now = new Date();
        const diff = expiryDate - now;

        if (diff < 0) {
            // Expiry has passed, recalculate
            setCountdown(prev => ({ ...prev, days: 0, hours: 0, minutes: 0, seconds: 0 }));
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setCountdown({
            days,
            hours,
            minutes,
            seconds,
            isExpiring: days === 0,
            expiryDate,
            expiryType: type,
        });
    };

    useEffect(() => {
        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [selectedExpiry]);

    const formatExpiryDate = (date) => {
        if (!date) return '--';
        return date.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        });
    };

    const isExpiring = countdown.isExpiring;
    const isUrgent = countdown.days === 0 && countdown.hours < 3;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`p-5 rounded-2xl border ${isUrgent
                    ? isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
                    : isExpiring
                        ? isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                        : isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                } shadow-lg`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${isUrgent
                            ? 'bg-red-500/20'
                            : isExpiring
                                ? 'bg-amber-500/20'
                                : isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                        }`}>
                        {isUrgent ? (
                            <BellAlertIcon className="w-5 h-5 text-red-500 animate-pulse" />
                        ) : (
                            <CalendarDaysIcon className={`w-5 h-5 ${isExpiring ? 'text-amber-500' : 'text-blue-500'
                                }`} />
                        )}
                    </div>
                    <div>
                        <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {selectedSymbol} Expiry
                        </h3>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {countdown.expiryType} • {formatExpiryDate(countdown.expiryDate)}
                        </span>
                    </div>
                </div>
                {isExpiring && (
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${isUrgent
                            ? 'bg-red-500 text-white animate-pulse'
                            : 'bg-amber-500 text-white'
                        }`}>
                        {isUrgent ? 'EXPIRING SOON' : 'TODAY'}
                    </span>
                )}
            </div>

            {/* Countdown Display */}
            <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                    { value: countdown.days, label: 'Days' },
                    { value: countdown.hours, label: 'Hours' },
                    { value: countdown.minutes, label: 'Mins' },
                    { value: countdown.seconds, label: 'Secs' },
                ].map((item, i) => (
                    <div key={i} className={`text-center p-2 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'
                        }`}>
                        <div className={`text-2xl font-black ${isUrgent ? 'text-red-500' : isExpiring ? 'text-amber-500' : isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                            {String(item.value).padStart(2, '0')}
                        </div>
                        <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {item.label}
                        </div>
                    </div>
                ))}
            </div>

            {/* Tip */}
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} flex items-center gap-1`}>
                <ClockIcon className="w-3 h-3" />
                {isExpiring
                    ? 'Options will settle at 3:30 PM IST'
                    : `${countdown.days} trading day${countdown.days !== 1 ? 's' : ''} remaining`
                }
            </div>
        </motion.div>
    );
};

export default ExpiryCountdownWidget;

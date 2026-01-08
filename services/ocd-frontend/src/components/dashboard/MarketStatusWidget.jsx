/**
 * Market Status Widget
 * Shows if the market is open/closed with countdown to next session
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
    PlayCircleIcon,
    PauseCircleIcon,
    ClockIcon,
    CalendarDaysIcon,
} from '@heroicons/react/24/outline';

// Market timings (IST)
const MARKET_OPEN = { hour: 9, minute: 15 };
const MARKET_CLOSE = { hour: 15, minute: 30 };

// Indian holidays 2026 (sample - should be fetched from API ideally)
const HOLIDAYS_2026 = [
    '2026-01-26', // Republic Day
    '2026-03-10', // Holi
    '2026-04-06', // Ram Navami
    '2026-04-14', // Ambedkar Jayanti
    '2026-04-18', // Good Friday
    '2026-05-01', // May Day
    '2026-08-15', // Independence Day
    '2026-10-02', // Gandhi Jayanti
    '2026-10-20', // Diwali (Laxmi Puja)
    '2026-10-21', // Diwali Balipratipada
    '2026-11-04', // Gurunanak Jayanti
    '2026-12-25', // Christmas
];

const MarketStatusWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const [marketStatus, setMarketStatus] = useState({
        isOpen: false,
        statusText: 'Loading...',
        nextEvent: '',
        countdown: '',
        isHoliday: false,
        holidayName: '',
    });

    const checkMarketStatus = () => {
        const now = new Date();
        const day = now.getDay(); // 0 = Sunday, 6 = Saturday
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTime = hours * 60 + minutes;
        const openTime = MARKET_OPEN.hour * 60 + MARKET_OPEN.minute;
        const closeTime = MARKET_CLOSE.hour * 60 + MARKET_CLOSE.minute;

        // Format today's date
        const today = now.toISOString().split('T')[0];
        const isHoliday = HOLIDAYS_2026.includes(today);

        // Weekend check
        if (day === 0 || day === 6) {
            const nextMonday = new Date(now);
            nextMonday.setDate(now.getDate() + (8 - day) % 7);
            nextMonday.setHours(MARKET_OPEN.hour, MARKET_OPEN.minute, 0);
            const diff = nextMonday - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            return {
                isOpen: false,
                statusText: 'Weekend',
                nextEvent: 'Opens Monday',
                countdown: `${hours}h ${mins}m`,
                isHoliday: false,
                holidayName: '',
            };
        }

        // Holiday check
        if (isHoliday) {
            return {
                isOpen: false,
                statusText: 'Holiday',
                nextEvent: 'Next trading day',
                countdown: '--',
                isHoliday: true,
                holidayName: 'Market Holiday',
            };
        }

        // Market open check
        if (currentTime >= openTime && currentTime < closeTime) {
            const remainingMins = closeTime - currentTime;
            const hours = Math.floor(remainingMins / 60);
            const mins = remainingMins % 60;

            return {
                isOpen: true,
                statusText: 'Market Open',
                nextEvent: 'Closes at 3:30 PM',
                countdown: `${hours}h ${mins}m remaining`,
                isHoliday: false,
                holidayName: '',
            };
        }

        // Pre-market
        if (currentTime < openTime) {
            const remainingMins = openTime - currentTime;
            const hours = Math.floor(remainingMins / 60);
            const mins = remainingMins % 60;

            return {
                isOpen: false,
                statusText: 'Pre-Market',
                nextEvent: 'Opens at 9:15 AM',
                countdown: `${hours}h ${mins}m`,
                isHoliday: false,
                holidayName: '',
            };
        }

        // Post-market
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(MARKET_OPEN.hour, MARKET_OPEN.minute, 0);
        const diff = tomorrow - now;
        const hoursToOpen = Math.floor(diff / (1000 * 60 * 60));
        const minsToOpen = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return {
            isOpen: false,
            statusText: 'Market Closed',
            nextEvent: 'Opens tomorrow 9:15 AM',
            countdown: `${hoursToOpen}h ${minsToOpen}m`,
            isHoliday: false,
            holidayName: '',
        };
    };

    useEffect(() => {
        setMarketStatus(checkMarketStatus());

        // Update every minute
        const interval = setInterval(() => {
            setMarketStatus(checkMarketStatus());
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    const isOpen = marketStatus.isOpen;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`p-5 rounded-2xl border ${isOpen
                    ? isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'
                    : isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                } shadow-lg`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isOpen
                            ? 'bg-green-500/20'
                            : isDark ? 'bg-gray-700' : 'bg-gray-200'
                        }`}>
                        {isOpen ? (
                            <PlayCircleIcon className="w-6 h-6 text-green-500" />
                        ) : (
                            <PauseCircleIcon className={`w-6 h-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        )}
                    </div>
                    <div>
                        <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            NSE/BSE
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${isOpen ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                                {marketStatus.statusText}
                            </span>
                            {marketStatus.isHoliday && (
                                <span className="text-xs text-amber-500">
                                    {marketStatus.holidayName}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Countdown */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ClockIcon className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {marketStatus.nextEvent}
                    </span>
                </div>
                <span className={`text-lg font-bold ${isOpen ? 'text-green-500' : isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                    {marketStatus.countdown}
                </span>
            </div>

            {/* Session Progress (when open) */}
            {isOpen && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1">
                        <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>9:15</span>
                        <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>3:30</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: '0%' }}
                            animate={{
                                width: `${Math.min(100, ((new Date().getHours() * 60 + new Date().getMinutes() - MARKET_OPEN.hour * 60 - MARKET_OPEN.minute) / (MARKET_CLOSE.hour * 60 + MARKET_CLOSE.minute - MARKET_OPEN.hour * 60 - MARKET_OPEN.minute)) * 100)}%`
                            }}
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                        />
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default MarketStatusWidget;

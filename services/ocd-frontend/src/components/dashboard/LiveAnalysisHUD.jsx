
import { memo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronUpIcon,
    ChevronDownIcon,
    BoltIcon,
    ChartBarIcon,
    FlagIcon,
    BellAlertIcon,
    NoSymbolIcon
} from '@heroicons/react/24/solid';
import optionsService from '../../services/optionsService';

/**
 * Live Analysis HUD
 * Persistent overlay showing realtime market vitals
 */
const LiveAnalysisHUD = memo(() => {
    // Only show if user is authenticated
    const { isAuthenticated } = useSelector((state) => state.auth);
    // Use NIFTY as the primary market indicator
    const [marketData, setMarketData] = useState(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    useEffect(() => {
        if (!isAuthenticated) return;

        const fetchData = async () => {
            try {
                // Fetch NIFTY data for the HUD
                const response = await optionsService.getLiveData('NIFTY');
                if (response) {
                    setMarketData(response);
                }
            } catch (error) {
                // Silent fail for HUD
                console.debug("HUD API Error", error);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000); // Update every 10s
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    if (!isAuthenticated || !marketData) return null;

    // Derived Metrics
    const spot = marketData.spot?.ltp || 0;
    const change = marketData.spot?.change || 0;
    const pcr = marketData.pcr || 0;
    const maxPain = marketData.max_pain_strike || 0;

    // Simple Sentiment Logic
    let sentiment = 'NEUTRAL';
    let sentimentColor = 'text-gray-500';
    let sentimentBg = 'bg-gray-100 dark:bg-gray-800';

    if (pcr > 1.2 && change > 0) {
        sentiment = 'BULLISH';
        sentimentColor = 'text-green-500';
        sentimentBg = 'bg-green-100 dark:bg-green-900/30';
    } else if (pcr < 0.7 && change < 0) {
        sentiment = 'BEARISH';
        sentimentColor = 'text-red-500';
        sentimentBg = 'bg-red-100 dark:bg-red-900/30';
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className={`mb-2 p-4 rounded-xl shadow-2xl border backdrop-blur-md w-72 ${isDark
                                ? 'bg-gray-900/90 border-gray-700 text-white'
                                : 'bg-white/90 border-gray-200 text-gray-900'
                            }`}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-lg">NIFTY</span>
                                <span className={`text-sm font-semibold ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {spot.toFixed(2)}
                                </span>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${sentimentBg} ${sentimentColor}`}>
                                {sentiment}
                            </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <ChartBarIcon className="w-3 h-3" /> PCR
                                </span>
                                <span className={`font-semibold ${pcr > 1 ? 'text-green-500' : pcr < 0.7 ? 'text-red-500' : 'text-gray-500'
                                    }`}>
                                    {pcr.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-xs text-gray-500 flex items-center justify-end gap-1">
                                    <BoltIcon className="w-3 h-3 text-yellow-500" /> Max Pain
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {maxPain}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <FlagIcon className="w-3 h-3 text-blue-500" /> Trend
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {change > 0 ? 'Up' : change < 0 ? 'Down' : 'Flat'}
                                </span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-xs text-gray-500 flex items-center justify-end gap-1">
                                    <BellAlertIcon className="w-3 h-3 text-orange-500" /> Alerts
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    0 Active
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all ${isDark
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
            >
                <BoltIcon className="w-5 h-5" />
                <span className="font-bold text-sm">Live HUD</span>
                {isExpanded ? (
                    <ChevronDownIcon className="w-4 h-4 ml-1" />
                ) : (
                    <ChevronUpIcon className="w-4 h-4 ml-1" />
                )}
            </button>
        </div>
    );
});

LiveAnalysisHUD.displayName = 'LiveAnalysisHUD';

export default LiveAnalysisHUD;

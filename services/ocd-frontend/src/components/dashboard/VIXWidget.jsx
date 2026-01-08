/**
 * India VIX Widget
 * Displays real-time India VIX data with visual indicators
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
    ExclamationTriangleIcon,
    ShieldCheckIcon,
    FireIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

const VIXWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    // Get VIX from Redux store if available
    const spotData = useSelector((state) => state.data?.data?.spot?.data);

    const [vixData, setVixData] = useState({
        value: null,
        change: null,
        changePercent: null,
        timestamp: null,
    });

    // Try to extract VIX from spot data or use fallback
    useEffect(() => {
        if (spotData?.VIX || spotData?.INDIAVIX) {
            const vix = spotData.VIX || spotData.INDIAVIX;
            setVixData({
                value: vix.ltp || vix.last_price || vix,
                change: vix.change || 0,
                changePercent: vix.percent_change || 0,
                timestamp: new Date(),
            });
        }
    }, [spotData]);

    // Get VIX level indicators
    const getVIXLevel = (value) => {
        if (!value) return { level: 'Unknown', color: 'gray', icon: ShieldCheckIcon, description: 'Loading...' };
        if (value < 13) return {
            level: 'Low',
            color: 'green',
            icon: ShieldCheckIcon,
            description: 'Market calm - good for selling options'
        };
        if (value < 18) return {
            level: 'Normal',
            color: 'blue',
            icon: ShieldCheckIcon,
            description: 'Normal volatility levels'
        };
        if (value < 25) return {
            level: 'Elevated',
            color: 'amber',
            icon: ExclamationTriangleIcon,
            description: 'Above average - use caution'
        };
        return {
            level: 'High',
            color: 'red',
            icon: FireIcon,
            description: 'High volatility - expect big moves'
        };
    };

    const vixLevel = getVIXLevel(vixData.value);
    const Icon = vixLevel.icon;

    const colorClasses = {
        green: {
            bg: isDark ? 'bg-green-500/10' : 'bg-green-50',
            border: isDark ? 'border-green-500/30' : 'border-green-200',
            text: isDark ? 'text-green-400' : 'text-green-600',
            glow: 'shadow-green-500/20',
        },
        blue: {
            bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
            border: isDark ? 'border-blue-500/30' : 'border-blue-200',
            text: isDark ? 'text-blue-400' : 'text-blue-600',
            glow: 'shadow-blue-500/20',
        },
        amber: {
            bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
            border: isDark ? 'border-amber-500/30' : 'border-amber-200',
            text: isDark ? 'text-amber-400' : 'text-amber-600',
            glow: 'shadow-amber-500/20',
        },
        red: {
            bg: isDark ? 'bg-red-500/10' : 'bg-red-50',
            border: isDark ? 'border-red-500/30' : 'border-red-200',
            text: isDark ? 'text-red-400' : 'text-red-600',
            glow: 'shadow-red-500/20',
        },
        gray: {
            bg: isDark ? 'bg-gray-500/10' : 'bg-gray-50',
            border: isDark ? 'border-gray-500/30' : 'border-gray-200',
            text: isDark ? 'text-gray-400' : 'text-gray-600',
            glow: 'shadow-gray-500/20',
        },
    };

    const colors = colorClasses[vixLevel.color];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`p-5 rounded-2xl border ${colors.bg} ${colors.border} shadow-lg ${colors.glow}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${colors.bg}`}>
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <div>
                        <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            India VIX
                        </h3>
                        <span className={`text-xs ${colors.text} font-medium`}>
                            {vixLevel.level} Volatility
                        </span>
                    </div>
                </div>
                {vixData.change !== null && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${vixData.change >= 0 ? 'text-red-500' : 'text-green-500'
                        }`}>
                        {vixData.change >= 0 ? (
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                        ) : (
                            <ArrowTrendingDownIcon className="w-4 h-4" />
                        )}
                        {Math.abs(vixData.changePercent || 0).toFixed(2)}%
                    </div>
                )}
            </div>

            {/* Value */}
            <div className="mb-4">
                <span className={`text-4xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {vixData.value?.toFixed(2) || '--'}
                </span>
            </div>

            {/* VIX Gauge */}
            <div className="mb-3">
                <div className="h-2 rounded-full bg-gradient-to-r from-green-500 via-amber-500 to-red-500 relative">
                    {vixData.value && (
                        <motion.div
                            initial={{ left: '0%' }}
                            animate={{ left: `${Math.min(100, (vixData.value / 35) * 100)}%` }}
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-gray-800"
                        />
                    )}
                </div>
                <div className="flex justify-between text-[10px] mt-1 text-gray-500">
                    <span>10</span>
                    <span>15</span>
                    <span>20</span>
                    <span>25</span>
                    <span>30+</span>
                </div>
            </div>

            {/* Description */}
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {vixLevel.description}
            </p>
        </motion.div>
    );
};

export default VIXWidget;

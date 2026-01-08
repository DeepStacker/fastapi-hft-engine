/**
 * OI Buildup Widget
 * Shows CE vs PE Open Interest buildup/unwinding direction
 * Helps identify institutional positioning
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectOptionChain } from '../../context/selectors';
import {
    ArrowsUpDownIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    MinusIcon,
} from '@heroicons/react/24/outline';

const OIBuildupWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const optionChain = useSelector(selectOptionChain);

    // Calculate OI Change (COI) from option chain
    const buildupData = useMemo(() => {
        if (!optionChain || Object.keys(optionChain).length === 0) {
            return null;
        }

        let totalCECOI = 0;
        let totalPECOI = 0;
        let ceBuildupStrikes = 0;
        let ceUnwindStrikes = 0;
        let peBuildupStrikes = 0;
        let peUnwindStrikes = 0;

        Object.values(optionChain).forEach(strike => {
            // CE Change in OI
            const ceCOI = strike.ce?.coi || strike.ce?.COI || strike.ce?.oiChange || 0;
            totalCECOI += ceCOI;
            if (ceCOI > 0) ceBuildupStrikes++;
            if (ceCOI < 0) ceUnwindStrikes++;

            // PE Change in OI
            const peCOI = strike.pe?.coi || strike.pe?.COI || strike.pe?.oiChange || 0;
            totalPECOI += peCOI;
            if (peCOI > 0) peBuildupStrikes++;
            if (peCOI < 0) peUnwindStrikes++;
        });

        // Determine overall signal
        // CE buildup = bearish (resistance), PE buildup = bullish (support)
        const netSignal = totalPECOI - totalCECOI;
        let signal = 'NEUTRAL';
        let description = 'Mixed activity - no clear direction';

        if (totalPECOI > totalCECOI * 1.5) {
            signal = 'BULLISH';
            description = 'Strong PE buildup → Support forming';
        } else if (totalCECOI > totalPECOI * 1.5) {
            signal = 'BEARISH';
            description = 'Strong CE buildup → Resistance forming';
        } else if (totalCECOI < 0 && totalPECOI > 0) {
            signal = 'BULLISH';
            description = 'CE unwinding + PE buildup → Bullish';
        } else if (totalPECOI < 0 && totalCECOI > 0) {
            signal = 'BEARISH';
            description = 'PE unwinding + CE buildup → Bearish';
        }

        return {
            totalCECOI,
            totalPECOI,
            signal,
            description,
            ceBuildupStrikes,
            ceUnwindStrikes,
            peBuildupStrikes,
            peUnwindStrikes,
        };
    }, [optionChain]);

    const formatLakhs = (num) => {
        if (!num) return '0';
        const lakhs = num / 100000;
        const sign = lakhs >= 0 ? '+' : '';
        if (Math.abs(lakhs) >= 100) return `${sign}${(lakhs / 100).toFixed(1)}Cr`;
        return `${sign}${lakhs.toFixed(1)}L`;
    };

    const getSignalConfig = (signal) => {
        switch (signal) {
            case 'BULLISH':
                return {
                    bg: isDark ? 'bg-green-500/10' : 'bg-green-50',
                    border: isDark ? 'border-green-500/30' : 'border-green-200',
                    icon: ArrowTrendingUpIcon,
                    iconColor: 'text-green-500',
                    badgeBg: 'bg-green-500/20',
                    badgeText: 'text-green-500',
                };
            case 'BEARISH':
                return {
                    bg: isDark ? 'bg-red-500/10' : 'bg-red-50',
                    border: isDark ? 'border-red-500/30' : 'border-red-200',
                    icon: ArrowTrendingDownIcon,
                    iconColor: 'text-red-500',
                    badgeBg: 'bg-red-500/20',
                    badgeText: 'text-red-500',
                };
            default:
                return {
                    bg: isDark ? 'bg-gray-800/50' : 'bg-gray-50',
                    border: isDark ? 'border-gray-700' : 'border-gray-200',
                    icon: MinusIcon,
                    iconColor: 'text-gray-500',
                    badgeBg: 'bg-gray-500/20',
                    badgeText: 'text-gray-500',
                };
        }
    };

    if (!buildupData) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'} shadow-lg`}
            >
                <div className="flex items-center gap-2 mb-3">
                    <ArrowsUpDownIcon className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={`text-sm font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>OI Buildup</span>
                </div>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Load Option Chain to see OI buildup
                </p>
            </motion.div>
        );
    }

    const config = getSignalConfig(buildupData.signal);
    const SignalIcon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-2xl border ${config.bg} ${config.border} shadow-lg`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ArrowsUpDownIcon className={`w-5 h-5 ${config.iconColor}`} />
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        OI Buildup
                    </span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${config.badgeBg} ${config.badgeText}`}>
                    <SignalIcon className="w-3 h-3" />
                    {buildupData.signal}
                </span>
            </div>

            {/* CE vs PE Comparison */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-900/50' : 'bg-white/70'}`}>
                    <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>CE OI Change</span>
                    </div>
                    <div className={`text-xl font-black ${buildupData.totalCECOI >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                        {formatLakhs(buildupData.totalCECOI)}
                    </div>
                    <div className="flex gap-2 mt-1 text-[10px]">
                        <span className="text-green-500">↑{buildupData.ceBuildupStrikes}</span>
                        <span className="text-red-500">↓{buildupData.ceUnwindStrikes}</span>
                    </div>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-900/50' : 'bg-white/70'}`}>
                    <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>PE OI Change</span>
                    </div>
                    <div className={`text-xl font-black ${buildupData.totalPECOI >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                        {formatLakhs(buildupData.totalPECOI)}
                    </div>
                    <div className="flex gap-2 mt-1 text-[10px]">
                        <span className="text-green-500">↑{buildupData.peBuildupStrikes}</span>
                        <span className="text-red-500">↓{buildupData.peUnwindStrikes}</span>
                    </div>
                </div>
            </div>

            {/* Visual Balance Bar */}
            <div className="relative h-3 rounded-full overflow-hidden mb-2">
                <div className="absolute inset-0 flex">
                    <div
                        className="bg-green-500 h-full"
                        style={{
                            width: `${50 + (buildupData.totalCECOI / (Math.abs(buildupData.totalCECOI) + Math.abs(buildupData.totalPECOI) + 1)) * 50}%`
                        }}
                    />
                    <div
                        className="bg-red-500 h-full flex-1"
                    />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-full bg-white/80" />
                </div>
            </div>
            <div className="flex justify-between text-[10px] mb-3">
                <span className={isDark ? 'text-green-400' : 'text-green-600'}>CE</span>
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Balance</span>
                <span className={isDark ? 'text-red-400' : 'text-red-600'}>PE</span>
            </div>

            {/* Insight */}
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {buildupData.description}
            </p>
        </motion.div>
    );
};

export default OIBuildupWidget;

/**
 * PCR Summary Widget
 * Displays live Put-Call Ratio with trend indicator
 * Data sourced from Redux option chain state
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    ScaleIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

const PCRSummaryWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);

    // Calculate PCR from option chain data
    const pcrData = useMemo(() => {
        if (!optionChain || Object.keys(optionChain).length === 0) {
            return { pcrOI: null, pcrVolume: null, totalCE: 0, totalPE: 0, signal: 'NEUTRAL' };
        }

        let totalCEOI = 0;
        let totalPEOI = 0;
        let totalCEVol = 0;
        let totalPEVol = 0;

        Object.values(optionChain).forEach(strike => {
            if (strike.ce) {
                totalCEOI += strike.ce.oi || strike.ce.OI || 0;
                totalCEVol += strike.ce.volume || strike.ce.Volume || 0;
            }
            if (strike.pe) {
                totalPEOI += strike.pe.oi || strike.pe.OI || 0;
                totalPEVol += strike.pe.volume || strike.pe.Volume || 0;
            }
        });

        const pcrOI = totalCEOI > 0 ? totalPEOI / totalCEOI : 0;
        const pcrVolume = totalCEVol > 0 ? totalPEVol / totalCEVol : 0;

        // Determine signal
        let signal = 'NEUTRAL';
        if (pcrOI > 1.2) signal = 'BULLISH';
        else if (pcrOI < 0.7) signal = 'BEARISH';

        return {
            pcrOI: pcrOI.toFixed(2),
            pcrVolume: pcrVolume.toFixed(2),
            totalCE: totalCEOI,
            totalPE: totalPEOI,
            signal,
        };
    }, [optionChain]);

    const getSignalColor = (signal) => {
        switch (signal) {
            case 'BULLISH': return { bg: 'bg-green-500/20', text: 'text-green-500', border: 'border-green-500/30' };
            case 'BEARISH': return { bg: 'bg-red-500/20', text: 'text-red-500', border: 'border-red-500/30' };
            default: return { bg: 'bg-gray-500/20', text: 'text-gray-500', border: 'border-gray-500/30' };
        }
    };

    const colors = getSignalColor(pcrData.signal);

    // Format large numbers
    const formatLakhs = (num) => {
        if (!num) return '0';
        const lakhs = num / 100000;
        if (lakhs >= 100) return `${(lakhs / 100).toFixed(1)}Cr`;
        return `${lakhs.toFixed(1)}L`;
    };

    if (!pcrData.pcrOI) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'} shadow-lg`}
            >
                <div className="flex items-center gap-2 mb-3">
                    <ScaleIcon className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={`text-sm font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PCR</span>
                </div>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Load Option Chain to view PCR
                </p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-2xl border ${colors.bg} ${colors.border} shadow-lg`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ScaleIcon className={`w-5 h-5 ${colors.text}`} />
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Put-Call Ratio
                    </span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
                    {pcrData.signal}
                </span>
            </div>

            {/* Main PCR Value */}
            <div className="flex items-baseline gap-2 mb-4">
                <span className={`text-4xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {pcrData.pcrOI}
                </span>
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>OI</span>
                {pcrData.signal === 'BULLISH' ? (
                    <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
                ) : pcrData.signal === 'BEARISH' ? (
                    <ArrowTrendingDownIcon className="w-5 h-5 text-red-500" />
                ) : null}
            </div>

            {/* OI Breakdown */}
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-white/50'}`}>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>CE OI</div>
                    <div className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                        {formatLakhs(pcrData.totalCE)}
                    </div>
                </div>
                <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-white/50'}`}>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>PE OI</div>
                    <div className={`text-sm font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                        {formatLakhs(pcrData.totalPE)}
                    </div>
                </div>
            </div>

            {/* PCR Bar */}
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                    className={`h-full transition-all ${pcrData.signal === 'BULLISH' ? 'bg-green-500' :
                            pcrData.signal === 'BEARISH' ? 'bg-red-500' : 'bg-gray-500'
                        }`}
                    style={{ width: `${Math.min(100, (parseFloat(pcrData.pcrOI) / 2) * 100)}%` }}
                />
            </div>
            <div className="flex justify-between text-[10px] mt-1">
                <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>0</span>
                <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>1.0</span>
                <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>2.0</span>
            </div>

            {/* Insight */}
            <p className={`text-xs mt-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {pcrData.signal === 'BULLISH'
                    ? '🟢 More puts written → Supports bullish view'
                    : pcrData.signal === 'BEARISH'
                        ? '🔴 More calls written → Bearish pressure'
                        : '⚪ Neutral PCR → No clear direction'}
            </p>
        </motion.div>
    );
};

export default PCRSummaryWidget;

/**
 * Max Pain Widget
 * Calculates and displays the maximum pain strike
 * Where option writers have maximum profit / buyers have max loss
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice } from '../../context/selectors';
import {
    FireIcon,
    ArrowUpIcon,
    ArrowDownIcon,
} from '@heroicons/react/24/outline';

const MaxPainWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);

    // Calculate Max Pain from option chain
    const maxPainData = useMemo(() => {
        if (!optionChain || Object.keys(optionChain).length === 0) {
            return null;
        }

        const strikes = Object.keys(optionChain)
            .map(s => parseFloat(s))
            .sort((a, b) => a - b);

        // Calculate pain at each strike
        let minPain = Infinity;
        let maxPainStrike = strikes[0];
        const painValues = {};

        strikes.forEach(targetStrike => {
            let totalPain = 0;

            strikes.forEach(strike => {
                const strikeData = optionChain[strike] || optionChain[String(strike)];
                const ceOI = strikeData?.ce?.oi || strikeData?.ce?.OI || 0;
                const peOI = strikeData?.pe?.oi || strikeData?.pe?.OI || 0;

                // CE pain: If spot expires above strike, CE buyers profit
                if (targetStrike > strike) {
                    totalPain += ceOI * (targetStrike - strike);
                }

                // PE pain: If spot expires below strike, PE buyers profit
                if (targetStrike < strike) {
                    totalPain += peOI * (strike - targetStrike);
                }
            });

            painValues[targetStrike] = totalPain;

            if (totalPain < minPain) {
                minPain = totalPain;
                maxPainStrike = targetStrike;
            }
        });

        // Distance from spot
        const distanceFromSpot = spotPrice ? maxPainStrike - spotPrice : 0;
        const distancePercent = spotPrice ? ((distanceFromSpot / spotPrice) * 100) : 0;

        // Find nearby strikes with their pain values for visualization
        const maxPainIndex = strikes.indexOf(maxPainStrike);
        const nearbyStrikes = strikes.slice(
            Math.max(0, maxPainIndex - 2),
            Math.min(strikes.length, maxPainIndex + 3)
        );

        const maxPainValue = Math.max(...Object.values(painValues));
        const nearbyPain = nearbyStrikes.map(s => ({
            strike: s,
            pain: painValues[s],
            normalized: painValues[s] / maxPainValue,
            isMaxPain: s === maxPainStrike,
        }));

        return {
            maxPainStrike,
            distanceFromSpot,
            distancePercent: distancePercent.toFixed(2),
            isAboveSpot: distanceFromSpot > 0,
            nearbyPain,
        };
    }, [optionChain, spotPrice]);

    if (!maxPainData) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'} shadow-lg`}
            >
                <div className="flex items-center gap-2 mb-3">
                    <FireIcon className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={`text-sm font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Max Pain</span>
                </div>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Load Option Chain to calculate Max Pain
                </p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-2xl border ${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'} shadow-lg`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <FireIcon className="w-5 h-5 text-purple-500" />
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Max Pain Strike
                    </span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${maxPainData.isAboveSpot
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                    {maxPainData.isAboveSpot ? (
                        <ArrowUpIcon className="w-3 h-3" />
                    ) : (
                        <ArrowDownIcon className="w-3 h-3" />
                    )}
                    {Math.abs(parseFloat(maxPainData.distancePercent))}%
                </div>
            </div>

            {/* Main Value */}
            <div className="flex items-baseline gap-3 mb-4">
                <span className={`text-4xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {maxPainData.maxPainStrike.toLocaleString('en-IN')}
                </span>
                {spotPrice && (
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Spot: {spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                )}
            </div>

            {/* Pain Distribution Mini Chart */}
            <div className="flex items-end gap-1 h-12 mb-3">
                {maxPainData.nearbyPain.map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                            className={`w-full rounded-t transition-all ${item.isMaxPain
                                    ? 'bg-purple-500'
                                    : isDark ? 'bg-gray-700' : 'bg-gray-300'
                                }`}
                            style={{ height: `${Math.max(10, (1 - item.normalized) * 100)}%` }}
                        />
                        <span className={`text-[9px] ${item.isMaxPain
                                ? 'text-purple-500 font-bold'
                                : isDark ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                            {(item.strike / 1000).toFixed(1)}k
                        </span>
                    </div>
                ))}
            </div>

            {/* Distance Info */}
            <div className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-white/50'}`}>
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Distance from Spot
                </span>
                <span className={`text-sm font-bold ${maxPainData.isAboveSpot ? 'text-green-500' : 'text-red-500'
                    }`}>
                    {maxPainData.isAboveSpot ? '+' : ''}
                    {maxPainData.distanceFromSpot.toFixed(0)} pts
                </span>
            </div>

            {/* Insight */}
            <p className={`text-xs mt-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                🎯 Price tends to gravitate towards max pain at expiry
            </p>
        </motion.div>
    );
};

export default MaxPainWidget;

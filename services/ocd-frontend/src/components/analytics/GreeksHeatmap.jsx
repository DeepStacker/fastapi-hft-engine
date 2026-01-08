/**
 * Greeks Heatmap Component
 * Visual heatmap of Delta, Gamma, Theta, Vega across strikes
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    BeakerIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import Card from '../common/Card';

// Greek descriptions for tooltips
const GREEK_INFO = {
    delta: { name: 'Delta', desc: 'Price sensitivity ($1 move)', range: [-1, 1] },
    gamma: { name: 'Gamma', desc: 'Delta change rate', range: [0, 0.1] },
    theta: { name: 'Theta', desc: 'Time decay per day', range: [-50, 0] },
    vega: { name: 'Vega', desc: 'IV sensitivity (1% move)', range: [0, 50] },
};

/**
 * Heatmap cell color based on value
 */
const getHeatmapColor = (value, min, max, type, isDark) => {
    if (value === null || value === undefined || isNaN(value)) {
        return isDark ? 'bg-gray-800' : 'bg-gray-100';
    }

    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));

    // Different color schemes for different greeks
    if (type === 'delta') {
        // Blue to Red (negative to positive)
        if (value < 0) {
            const intensity = Math.abs(normalized - 0.5) * 2;
            return `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`;
        } else {
            const intensity = normalized;
            return `rgba(34, 197, 94, ${0.2 + intensity * 0.6})`;
        }
    } else if (type === 'gamma') {
        // Purple scale (higher = more intense)
        return `rgba(168, 85, 247, ${0.1 + normalized * 0.7})`;
    } else if (type === 'theta') {
        // Red scale (more negative = more intense)
        const intensity = 1 - normalized; // Flip because theta is negative
        return `rgba(239, 68, 68, ${0.1 + intensity * 0.6})`;
    } else if (type === 'vega') {
        // Blue scale (higher = more intense)
        return `rgba(59, 130, 246, ${0.1 + normalized * 0.7})`;
    }

    return isDark ? 'bg-gray-700' : 'bg-gray-200';
};

const GreeksHeatmap = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);

    const [selectedGreek, setSelectedGreek] = useState('delta');
    const [showCE, setShowCE] = useState(true);

    // Process option chain data for heatmap
    const heatmapData = useMemo(() => {
        if (!optionChain || Object.keys(optionChain).length === 0) return null;

        const strikes = Object.keys(optionChain)
            .map(s => parseFloat(s))
            .sort((a, b) => a - b);

        // Get range around ATM
        const atmIndex = strikes.findIndex(s => s >= (atmStrike || spotPrice));
        const startIdx = Math.max(0, atmIndex - 10);
        const endIdx = Math.min(strikes.length, atmIndex + 11);
        const displayStrikes = strikes.slice(startIdx, endIdx);

        const data = displayStrikes.map(strike => {
            const strikeData = optionChain[strike] || optionChain[String(strike)];
            const ce = strikeData?.ce || {};
            const pe = strikeData?.pe || {};

            return {
                strike,
                isATM: strike === atmStrike,
                ce: {
                    delta: ce.delta || ce.Delta,
                    gamma: ce.gamma || ce.Gamma,
                    theta: ce.theta || ce.Theta,
                    vega: ce.vega || ce.Vega,
                },
                pe: {
                    delta: pe.delta || pe.Delta,
                    gamma: pe.gamma || pe.Gamma,
                    theta: pe.theta || pe.Theta,
                    vega: pe.vega || pe.Vega,
                },
            };
        });

        // Calculate min/max for color scaling
        const allValues = data.flatMap(d => [
            showCE ? d.ce[selectedGreek] : d.pe[selectedGreek]
        ]).filter(v => v !== null && v !== undefined);

        return {
            data,
            min: Math.min(...allValues),
            max: Math.max(...allValues),
        };
    }, [optionChain, spotPrice, atmStrike, selectedGreek, showCE]);

    // Empty state
    if (!optionChain || Object.keys(optionChain).length === 0) {
        return (
            <Card variant="glass" className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                        <BeakerIcon className="w-5 h-5 text-purple-500" />
                    </div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Greeks Heatmap
                    </h3>
                </div>
                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <BeakerIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Load Option Chain to view Greeks heatmap</p>
                </div>
            </Card>
        );
    }

    const greekInfo = GREEK_INFO[selectedGreek];

    return (
        <Card variant="glass" className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                        <BeakerIcon className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Greeks Heatmap
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {greekInfo.desc}
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    {/* CE/PE Toggle */}
                    <div className={`flex rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                        <button
                            onClick={() => setShowCE(true)}
                            className={`px-3 py-1.5 text-xs font-bold transition-colors ${showCE
                                    ? 'bg-green-500 text-white'
                                    : isDark ? 'text-gray-400' : 'text-gray-600'
                                }`}
                        >
                            CE
                        </button>
                        <button
                            onClick={() => setShowCE(false)}
                            className={`px-3 py-1.5 text-xs font-bold transition-colors ${!showCE
                                    ? 'bg-red-500 text-white'
                                    : isDark ? 'text-gray-400' : 'text-gray-600'
                                }`}
                        >
                            PE
                        </button>
                    </div>
                </div>
            </div>

            {/* Greek Selector Tabs */}
            <div className="flex gap-1 mb-4">
                {Object.keys(GREEK_INFO).map((greek) => (
                    <button
                        key={greek}
                        onClick={() => setSelectedGreek(greek)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${selectedGreek === greek
                                ? isDark ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'
                                : isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {GREEK_INFO[greek].name}
                    </button>
                ))}
            </div>

            {/* Heatmap Grid */}
            {heatmapData && (
                <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                    <div className="grid gap-1 p-2">
                        {heatmapData.data.map((row, i) => {
                            const value = showCE ? row.ce[selectedGreek] : row.pe[selectedGreek];
                            const bgColor = getHeatmapColor(value, heatmapData.min, heatmapData.max, selectedGreek, isDark);

                            return (
                                <motion.div
                                    key={row.strike}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.02 }}
                                    className={`flex items-center rounded-lg overflow-hidden ${row.isATM ? 'ring-2 ring-yellow-500' : ''
                                        }`}
                                >
                                    {/* Strike Label */}
                                    <div className={`w-16 px-2 py-2 text-xs font-bold text-center ${row.isATM
                                            ? 'bg-yellow-500 text-white'
                                            : isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700'
                                        }`}>
                                        {row.strike}
                                    </div>

                                    {/* Value Bar */}
                                    <div
                                        className="flex-1 px-3 py-2 text-xs font-medium text-center transition-colors"
                                        style={{ backgroundColor: bgColor }}
                                    >
                                        <span className={isDark ? 'text-white' : 'text-gray-900'}>
                                            {value !== null && value !== undefined
                                                ? (selectedGreek === 'delta'
                                                    ? value.toFixed(3)
                                                    : value.toFixed(2))
                                                : '--'
                                            }
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-between mt-4 text-xs">
                <div className="flex items-center gap-2">
                    <div className={`w-4 h-3 rounded ${selectedGreek === 'delta' ? 'bg-gradient-to-r from-red-500 to-green-500' :
                            selectedGreek === 'gamma' ? 'bg-gradient-to-r from-purple-200 to-purple-600' :
                                selectedGreek === 'theta' ? 'bg-gradient-to-r from-red-200 to-red-600' :
                                    'bg-gradient-to-r from-blue-200 to-blue-600'
                        }`} />
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                        Low → High
                    </span>
                </div>
                <div className={`flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <div className="w-3 h-3 rounded bg-yellow-500" />
                    <span>ATM Strike</span>
                </div>
            </div>
        </Card>
    );
};

export default GreeksHeatmap;

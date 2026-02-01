/**
 * Enhanced PCR Trend Chart Component
 * 
 * NIFTY 50 Calibrated PCR Analysis:
 * - Historical PCR context for NIFTY (typical range 0.8-1.5)
 * - Zone-based interpretation with confidence levels
 * - Trend momentum analysis
 * - Divergence detection (PCR vs Price)
 */
import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceArea,
    Area,
    ReferenceLine
} from 'recharts';
import { selectSelectedSymbol, selectOptionChain, selectSpotPrice } from '../../context/selectors';
import {
    ScaleIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import Card from '../common/Card';

// ============ NIFTY 50 PCR CONTEXT ============
const NIFTY_PCR_ZONES = {
    // NIFTY typically ranges from 0.7 to 1.8
    extremeBullish: 1.5,    // Very high PCR = extreme bullish (contrarian bearish)
    bullish: 1.2,           // High PCR = bullish
    neutral: { low: 0.9, high: 1.1 },  // Normal range
    bearish: 0.8,           // Low PCR = bearish
    extremeBearish: 0.6,    // Very low PCR = extreme bearish (contrarian bullish)
};

// Get detailed zone analysis
const getPCRZone = (pcr) => {
    if (!pcr) return { zone: 'WAITING', color: 'gray', interpretation: '', confidence: 0 };

    if (pcr >= NIFTY_PCR_ZONES.extremeBullish) {
        return {
            zone: 'EXTREME BULLISH',
            signal: 'Bullish',
            color: 'green',
            confidence: 90,
            emoji: '🟢',
            interpretation: 'Very high put writing. Writers confident market won\'t fall.',
            contrarian: 'Caution: Could indicate complacency. Watch for reversal.',
        };
    }
    if (pcr >= NIFTY_PCR_ZONES.bullish) {
        return {
            zone: 'BULLISH',
            signal: 'Bullish',
            color: 'emerald',
            confidence: 75,
            emoji: '📈',
            interpretation: 'Put OI dominates. Writers expect support to hold.',
            contrarian: null,
        };
    }
    if (pcr <= NIFTY_PCR_ZONES.extremeBearish) {
        return {
            zone: 'EXTREME BEARISH',
            signal: 'Bearish',
            color: 'red',
            confidence: 90,
            emoji: '🔴',
            interpretation: 'Very high call writing. Writers confident market won\'t rise.',
            contrarian: 'Caution: Could indicate oversold. Watch for bounce.',
        };
    }
    if (pcr <= NIFTY_PCR_ZONES.bearish) {
        return {
            zone: 'BEARISH',
            signal: 'Bearish',
            color: 'rose',
            confidence: 75,
            emoji: '📉',
            interpretation: 'Call OI dominates. Writers expect resistance to hold.',
            contrarian: null,
        };
    }

    return {
        zone: 'NEUTRAL',
        signal: 'Neutral',
        color: 'amber',
        confidence: 50,
        emoji: '⚖️',
        interpretation: 'Balanced positioning. No clear directional bias.',
        contrarian: null,
    };
};

// Detect trend in PCR history
const analyzeTrend = (history) => {
    if (history.length < 5) return { trend: 'insufficient', momentum: 0 };

    const recent = history.slice(-5);
    const oldest = recent[0].pcr;
    const newest = recent[recent.length - 1].pcr;
    const change = newest - oldest;
    const changePct = (change / oldest) * 100;

    let trend = 'stable';
    if (changePct > 5) trend = 'rising';
    else if (changePct < -5) trend = 'falling';

    return { trend, momentum: changePct, change };
};

// Detect divergence (PCR vs Price)
const detectDivergence = (history) => {
    if (history.length < 5) return null;

    const recent = history.slice(-5);
    const pcrChange = recent[recent.length - 1].pcr - recent[0].pcr;
    const priceChange = recent[recent.length - 1].price - recent[0].price;

    // Bullish divergence: PCR rising (bullish) but price falling
    if (pcrChange > 0.05 && priceChange < 0) {
        return { type: 'bullish', message: 'PCR rising while price falling - potential reversal UP', strength: Math.abs(pcrChange * 100) };
    }

    // Bearish divergence: PCR falling (bearish) but price rising
    if (pcrChange < -0.05 && priceChange > 0) {
        return { type: 'bearish', message: 'PCR falling while price rising - potential reversal DOWN', strength: Math.abs(pcrChange * 100) };
    }

    return null;
};

// Custom Tooltip
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const pcr = payload.find(p => p.dataKey === 'pcr')?.value;
        const price = payload.find(p => p.dataKey === 'price')?.value;
        const zone = getPCRZone(pcr);

        return (
            <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <p className="text-xs text-gray-500 mb-2 font-medium">{label}</p>
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-blue-500 text-sm">PCR:</span>
                        <span className="font-bold">{pcr?.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-purple-500 text-sm">Price:</span>
                        <span className="font-bold">{price?.toFixed(2)}</span>
                    </div>
                    <div className={`text-xs font-bold pt-2 border-t border-gray-100 dark:border-gray-700 text-${zone.color}-600`}>
                        {zone.emoji} {zone.zone}
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

// ============ MAIN COMPONENT ============
const PCRTrendChart = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const _symbol = useSelector(selectSelectedSymbol);

    const [history, setHistory] = useState([]);

    // Calculate current PCR
    const currentPCR = useMemo(() => {
        if (!optionChain || Object.keys(optionChain).length === 0) return null;

        let totalCEOI = 0, totalPEOI = 0;
        let totalCEVol = 0, totalPEVol = 0;

        Object.values(optionChain).forEach(strike => {
            totalCEOI += strike.ce?.oi || strike.ce?.OI || 0;
            totalPEOI += strike.pe?.oi || strike.pe?.OI || 0;
            totalCEVol += strike.ce?.vol || strike.ce?.volume || 0;
            totalPEVol += strike.pe?.vol || strike.pe?.volume || 0;
        });

        return {
            oi: totalCEOI > 0 ? totalPEOI / totalCEOI : 0,
            volume: totalCEVol > 0 ? totalPEVol / totalCEVol : 0,
        };
    }, [optionChain]);

    // Track history
    useEffect(() => {
        if (currentPCR !== null && spotPrice !== null) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

            setHistory(prev => {
                if (prev.length > 0 && prev[prev.length - 1].time === timeStr) return prev;

                const newPoint = {
                    time: timeStr,
                    pcr: currentPCR.oi,
                    pcrVol: currentPCR.volume,
                    price: spotPrice,
                    timestamp: now.getTime()
                };

                const newHistory = [...prev, newPoint];
                if (newHistory.length > 50) return newHistory.slice(-50);
                return newHistory;
            });
        }
    }, [currentPCR, spotPrice]);

    // Analysis
    const zone = getPCRZone(currentPCR?.oi);
    const trend = analyzeTrend(history);
    const divergence = detectDivergence(history);

    // Domain calculations
    const minPCR = history.length > 0 ? Math.min(...history.map(d => d.pcr), 0.5) * 0.95 : 0.5;
    const maxPCR = history.length > 0 ? Math.max(...history.map(d => d.pcr), 1.5) * 1.05 : 2.0;
    const minPrice = history.length > 0 ? Math.min(...history.map(d => d.price)) * 0.998 : spotPrice * 0.99;
    const maxPrice = history.length > 0 ? Math.max(...history.map(d => d.price)) * 1.002 : spotPrice * 1.01;

    if (!optionChain || Object.keys(optionChain).length === 0) {
        return (
            <Card variant="glass" className="p-6 h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                    <ScaleIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Load data to view PCR Trend</p>
                </div>
            </Card>
        );
    }

    const getZoneColorClass = (color) => {
        const classes = {
            green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
            amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            gray: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
        };
        return classes[color] || classes.gray;
    };

    return (
        <Card variant="glass" className="p-0 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                            <ScaleIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-gray-100">PCR Analysis</h3>
                            <p className="text-xs text-gray-500">NIFTY 50 Calibrated</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <motion.div
                            className={`px-3 py-1.5 rounded-lg text-center ${getZoneColorClass(zone.color)}`}
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                        >
                            <div className="text-xl font-black">{currentPCR?.oi?.toFixed(2)}</div>
                            <div className="text-[10px] font-medium">{zone.zone}</div>
                        </motion.div>
                    </div>
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="text-gray-500">Vol PCR</div>
                        <div className={`font-bold ${currentPCR?.volume > 1 ? 'text-green-600' : 'text-red-600'}`}>
                            {currentPCR?.volume?.toFixed(2)}
                        </div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="text-gray-500">Confidence</div>
                        <div className="font-bold text-indigo-600">{zone.confidence}%</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="text-gray-500">Trend</div>
                        <div className={`font-bold flex items-center justify-center gap-1 ${trend.trend === 'rising' ? 'text-green-600' :
                            trend.trend === 'falling' ? 'text-red-600' : 'text-gray-600'
                            }`}>
                            {trend.trend === 'rising' && <ArrowTrendingUpIcon className="w-3 h-3" />}
                            {trend.trend === 'falling' && <ArrowTrendingDownIcon className="w-3 h-3" />}
                            {trend.trend === 'rising' ? 'Up' : trend.trend === 'falling' ? 'Down' : 'Flat'}
                        </div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="text-gray-500">Momentum</div>
                        <div className={`font-bold ${trend.momentum > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {trend.momentum > 0 ? '+' : ''}{trend.momentum.toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* Divergence Alert */}
                {divergence && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-3 p-2 rounded-lg flex items-center gap-2 text-xs ${divergence.type === 'bullish'
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700'
                            }`}
                    >
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        <span className="font-medium">Divergence Detected: {divergence.message}</span>
                    </motion.div>
                )}
            </div>

            {/* Chart Area */}
            <div className="flex-1 min-h-[220px] w-full p-2">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="pcrGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#e5e7eb'} opacity={0.5} />

                        <XAxis
                            dataKey="time"
                            tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                        />

                        <YAxis
                            yAxisId="left"
                            domain={[minPCR, maxPCR]}
                            tick={{ fontSize: 10, fill: '#3b82f6' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => v.toFixed(2)}
                        />

                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[minPrice, maxPrice]}
                            tick={{ fontSize: 10, fill: '#a855f7' }}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                        />

                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />

                        {/* NIFTY PCR Zones */}
                        <ReferenceArea
                            yAxisId="left"
                            y1={NIFTY_PCR_ZONES.bullish}
                            y2={maxPCR}
                            fill={isDark ? "#22c55e" : "#86efac"}
                            fillOpacity={0.08}
                        />
                        <ReferenceArea
                            yAxisId="left"
                            y1={minPCR}
                            y2={NIFTY_PCR_ZONES.bearish}
                            fill={isDark ? "#ef4444" : "#fca5a5"}
                            fillOpacity={0.08}
                        />

                        {/* Reference Lines for key levels */}
                        <ReferenceLine yAxisId="left" y={1.0} stroke="#6B7280" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <ReferenceLine yAxisId="left" y={NIFTY_PCR_ZONES.bullish} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.3} />
                        <ReferenceLine yAxisId="left" y={NIFTY_PCR_ZONES.bearish} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.3} />

                        {/* Price Line */}
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="price"
                            name="Spot"
                            stroke="#a855f7"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="4 4"
                            animationDuration={300}
                        />

                        {/* PCR Area */}
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="pcr"
                            name="PCR"
                            stroke="#3b82f6"
                            fill="url(#pcrGradient)"
                            strokeWidth={2}
                            dot={{ r: 2, fill: '#3b82f6' }}
                            animationDuration={300}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Interpretation */}
            <div className="px-4 pb-4 space-y-2">
                <div className={`p-2 rounded-lg text-xs ${getZoneColorClass(zone.color)}`}>
                    <div className="font-semibold">{zone.emoji} {zone.interpretation}</div>
                </div>

                {zone.contrarian && (
                    <div className="p-2 rounded-lg text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        <span>{zone.contrarian}</span>
                    </div>
                )}

                <div className="text-[10px] text-gray-500 text-center">
                    <span className="font-medium text-indigo-600">NIFTY 50</span> |
                    Bullish: &gt;{NIFTY_PCR_ZONES.bullish} |
                    Bearish: &lt;{NIFTY_PCR_ZONES.bearish} |
                    Normal: {NIFTY_PCR_ZONES.neutral.low}-{NIFTY_PCR_ZONES.neutral.high}
                </div>
            </div>
        </Card>
    );
};

export default PCRTrendChart;

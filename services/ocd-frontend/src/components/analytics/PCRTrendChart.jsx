/**
 * PCR Trend Chart Component
 * Professional Dual-Axis visualization of Put-Call Ratio vs Spot Price
 * Features:
 * - Dual Y-Axis (Left: PCR, Right: Spot Price) to show correlation
 * - Signal Zones (Bullish/Bearish background areas)
 * - Interactive Tooltips with Sentiment Analysis
 * - Real-time updates
 */
import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
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
    Area
} from 'recharts';
import { selectSelectedSymbol, selectOptionChain, selectSpotPrice } from '../../context/selectors';
import {
    ScaleIcon,
    InformationCircleIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import Card from '../common/Card';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const pcr = payload.find(p => p.dataKey === 'pcr')?.value;
        const price = payload.find(p => p.dataKey === 'price')?.value;

        let sentiment = 'Neutral';
        let sentimentColor = 'text-gray-500';
        if (pcr > 1.2) {
            sentiment = 'Bullish';
            sentimentColor = 'text-green-500';
        } else if (pcr < 0.7) {
            sentiment = 'Bearish';
            sentimentColor = 'text-red-500';
        }

        return (
            <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <div className="space-y-1">
                    <p className="text-sm font-semibold flex items-center justify-between gap-4">
                        <span className="text-blue-500">PCR:</span>
                        <span>{pcr?.toFixed(2)}</span>
                    </p>
                    <p className="text-sm font-semibold flex items-center justify-between gap-4">
                        <span className="text-purple-500">Price:</span>
                        <span>{price?.toFixed(2)}</span>
                    </p>
                    <div className={`text-xs font-bold pt-1 border-t border-gray-100 dark:border-gray-700 mt-1 ${sentimentColor}`}>
                        {sentiment} Sentiment
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const PCRTrendChart = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const symbol = useSelector(selectSelectedSymbol);
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);

    const [history, setHistory] = useState([]);

    // Calculate current PCR
    const currentPCR = useMemo(() => {
        if (!optionChain || Object.keys(optionChain).length === 0) return null;

        let totalCEOI = 0, totalPEOI = 0;
        Object.values(optionChain).forEach(strike => {
            totalCEOI += strike.ce?.oi || strike.ce?.OI || 0;
            totalPEOI += strike.pe?.oi || strike.pe?.OI || 0;
        });

        return totalCEOI > 0 ? totalPEOI / totalCEOI : 0;
    }, [optionChain]);

    // Track history (PCR + Price)
    useEffect(() => {
        if (currentPCR !== null && spotPrice !== null) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

            setHistory(prev => {
                // Ensure we don't add duplicate time points (throttle simple)
                if (prev.length > 0 && prev[prev.length - 1].time === timeStr) return prev;

                const newPoint = {
                    time: timeStr,
                    pcr: currentPCR,
                    price: spotPrice,
                    timestamp: now.getTime()
                };

                // Keep last 30 points for better trend visibility
                const newHistory = [...prev, newPoint];
                if (newHistory.length > 30) return newHistory.slice(-30);
                return newHistory;
            });
        }
    }, [currentPCR, spotPrice]);

    const getSignal = (pcr) => {
        if (!pcr) return { text: 'WAITING', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' };
        if (pcr > 1.2) return { text: 'BULLISH', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' };
        if (pcr < 0.7) return { text: 'BEARISH', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' };
        return { text: 'NEUTRAL', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' };
    };

    const signal = getSignal(currentPCR);

    // Domain calculations for nice charts
    const minPCR = Math.min(...history.map(d => d.pcr), 0.5) * 0.9;
    const maxPCR = Math.max(...history.map(d => d.pcr), 1.5) * 1.1;

    const minPrice = Math.min(...history.map(d => d.price), spotPrice * 0.99) * 0.999;
    const maxPrice = Math.max(...history.map(d => d.price), spotPrice * 1.01) * 1.001;

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

    return (
        <Card variant="glass" className="p-0 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600`}>
                        <ScaleIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">PCR Trend</h3>
                        <p className="text-xs text-gray-500">Put/Call Ratio vs Spot Price</p>
                    </div>
                </div>

                <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border border-transparent ${signal.bg}`}>
                    <div className="text-right">
                        <div className={`text-xs font-bold ${signal.color}`}>{signal.text}</div>
                        <div className="text-[10px] text-gray-500 opacity-80">Signal</div>
                    </div>
                    <div className={`text-2xl font-black ${signal.color}`}>
                        {currentPCR?.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 min-h-[250px] w-full p-2">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="pcrGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
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

                        {/* Left Y Axis: PCR */}
                        <YAxis
                            yAxisId="left"
                            domain={[minPCR, maxPCR]}
                            tick={{ fontSize: 10, fill: '#3b82f6' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => v.toFixed(2)}
                        />

                        {/* Right Y Axis: Price */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[minPrice, maxPrice]}
                            tick={{ fontSize: 10, fill: '#a855f7' }}
                            axisLine={false}
                            tickLine={false}
                            hide={false}
                            width={40}
                        />

                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                        {/* Bullish Zone Reference Area */}
                        <ReferenceArea
                            yAxisId="left"
                            y1={1.2}
                            y2={maxPCR}
                            fill={isDark ? "#22c55e" : "#86efac"}
                            fillOpacity={0.05}
                        />

                        {/* Bearish Zone Reference Area */}
                        <ReferenceArea
                            yAxisId="left"
                            y1={minPCR}
                            y2={0.7}
                            fill={isDark ? "#ef4444" : "#fca5a5"}
                            fillOpacity={0.05}
                        />

                        {/* Price Line (Correlated asset) */}
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="price"
                            name="Spot Price"
                            stroke="#a855f7"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="4 4"
                            animationDuration={500}
                        />

                        {/* PCR Line (Main indicator) */}
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="pcr"
                            name="PCR"
                            stroke="#3b82f6"
                            fill="url(#pcrGradient)"
                            strokeWidth={2}
                            dot={{ r: 2, fill: '#3b82f6' }}
                            animationDuration={500}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Footer Interpretation */}
            <div className="px-5 pb-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                    <InformationCircleIcon className="w-4 h-4 flex-shrink-0" />
                    <span>Difference between PCR trend and Price trend indicates divergence (reversal signal).</span>
                </div>
            </div>
        </Card>
    );
};

export default PCRTrendChart;

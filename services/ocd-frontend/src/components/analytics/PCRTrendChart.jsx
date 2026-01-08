/**
 * PCR Trend Chart Component
 * Shows historical Put-Call Ratio trend over time
 * Uses stored option chain snapshots to calculate PCR history
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectSelectedSymbol, selectSelectedExpiry, selectOptionChain } from '../../context/selectors';
import {
    ScaleIcon,
    ArrowPathIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import Card from '../common/Card';

/**
 * Simple line chart renderer (SVG-based)
 */
const SimpleTrendLine = ({ data, width = 300, height = 120, color = '#3b82f6' }) => {
    if (!data || data.length < 2) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Insufficient data for trend
            </div>
        );
    }

    const padding = { top: 10, right: 10, bottom: 20, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate scales
    const values = data.map(d => d.value);
    const minY = Math.min(...values) * 0.95;
    const maxY = Math.max(...values) * 1.05;
    const rangeY = maxY - minY || 1;

    const xScale = (i) => padding.left + (i / (data.length - 1)) * chartWidth;
    const yScale = (v) => padding.top + chartHeight - ((v - minY) / rangeY) * chartHeight;

    // Generate line path
    const linePath = data
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.value)}`)
        .join(' ');

    // Generate area path
    const areaPath = `${linePath} L ${xScale(data.length - 1)} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

    // Reference lines
    const bullishLine = 1.2;
    const bearishLine = 0.7;

    return (
        <svg width={width} height={height} className="overflow-visible">
            {/* Grid lines */}
            <line
                x1={padding.left}
                y1={yScale(1)}
                x2={width - padding.right}
                y2={yScale(1)}
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeDasharray="4,4"
            />
            {bullishLine <= maxY && bullishLine >= minY && (
                <line
                    x1={padding.left}
                    y1={yScale(bullishLine)}
                    x2={width - padding.right}
                    y2={yScale(bullishLine)}
                    stroke="#22c55e"
                    strokeOpacity={0.4}
                    strokeDasharray="4,4"
                />
            )}
            {bearishLine <= maxY && bearishLine >= minY && (
                <line
                    x1={padding.left}
                    y1={yScale(bearishLine)}
                    x2={width - padding.right}
                    y2={yScale(bearishLine)}
                    stroke="#ef4444"
                    strokeOpacity={0.4}
                    strokeDasharray="4,4"
                />
            )}

            {/* Area under line */}
            <path d={areaPath} fill={color} fillOpacity={0.1} />

            {/* Main line */}
            <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Current value dot */}
            <circle
                cx={xScale(data.length - 1)}
                cy={yScale(data[data.length - 1].value)}
                r={4}
                fill={color}
            />

            {/* Y-axis labels */}
            <text x={padding.left - 5} y={padding.top + 5} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.5}>
                {maxY.toFixed(2)}
            </text>
            <text x={padding.left - 5} y={height - padding.bottom} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.5}>
                {minY.toFixed(2)}
            </text>
            <text x={padding.left - 5} y={yScale(1)} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.5}>
                1.0
            </text>

            {/* X-axis labels */}
            {data.length > 0 && (
                <>
                    <text x={padding.left} y={height - 5} textAnchor="start" fontSize={9} fill="currentColor" opacity={0.5}>
                        {data[0].time}
                    </text>
                    <text x={width - padding.right} y={height - 5} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.5}>
                        {data[data.length - 1].time}
                    </text>
                </>
            )}
        </svg>
    );
};

/**
 * PCR Trend Chart Component
 */
const PCRTrendChart = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const symbol = useSelector(selectSelectedSymbol);
    const expiry = useSelector(selectSelectedExpiry);
    const optionChain = useSelector(selectOptionChain);

    const [pcrHistory, setPcrHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    // Calculate current PCR from option chain
    const currentPCR = useMemo(() => {
        if (!optionChain || Object.keys(optionChain).length === 0) return null;

        let totalCEOI = 0, totalPEOI = 0;
        Object.values(optionChain).forEach(strike => {
            totalCEOI += strike.ce?.oi || strike.ce?.OI || 0;
            totalPEOI += strike.pe?.oi || strike.pe?.OI || 0;
        });

        return totalCEOI > 0 ? totalPEOI / totalCEOI : 0;
    }, [optionChain]);

    // Add current PCR to history when it changes
    useEffect(() => {
        if (currentPCR !== null) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

            setPcrHistory(prev => {
                // Keep last 20 data points
                const newHistory = [...prev, { time: timeStr, value: currentPCR }];
                if (newHistory.length > 20) {
                    return newHistory.slice(-20);
                }
                return newHistory;
            });
        }
    }, [currentPCR]);

    const getPCRSignal = (pcr) => {
        if (!pcr) return { text: 'N/A', color: 'gray' };
        if (pcr > 1.2) return { text: 'BULLISH', color: 'green' };
        if (pcr < 0.7) return { text: 'BEARISH', color: 'red' };
        return { text: 'NEUTRAL', color: 'gray' };
    };

    const signal = getPCRSignal(currentPCR);

    // Empty state
    if (!optionChain || Object.keys(optionChain).length === 0) {
        return (
            <Card variant="glass" className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                        <ScaleIcon className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            PCR Trend
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Put-Call Ratio over time
                        </p>
                    </div>
                </div>
                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <ScaleIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Load Option Chain to view PCR trend</p>
                </div>
            </Card>
        );
    }

    return (
        <Card variant="glass" className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                        <ScaleIcon className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            PCR Trend
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {symbol} • Intraday
                        </p>
                    </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${signal.color === 'green' ? 'bg-green-500/20 text-green-500' :
                        signal.color === 'red' ? 'bg-red-500/20 text-red-500' :
                            isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-500'
                    }`}>
                    <span className="text-2xl font-black">{currentPCR?.toFixed(2) || '--'}</span>
                    <span className="text-xs font-bold">{signal.text}</span>
                </div>
            </div>

            {/* Chart */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                <SimpleTrendLine
                    data={pcrHistory}
                    width={400}
                    height={150}
                    color={signal.color === 'green' ? '#22c55e' : signal.color === 'red' ? '#ef4444' : '#3b82f6'}
                />
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-4 text-xs">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-green-500" />
                        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Bullish (&gt;1.2)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-red-500" />
                        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Bearish (&lt;0.7)</span>
                    </div>
                </div>
                <div className={`flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <InformationCircleIcon className="w-3 h-3" />
                    <span>{pcrHistory.length} data points</span>
                </div>
            </div>
        </Card>
    );
};

export default PCRTrendChart;

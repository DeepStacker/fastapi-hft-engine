/**
 * IV Skew Chart Component
 * Visualizes Implied Volatility across strikes (volatility smile/smirk)
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    ChartBarIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import Card from '../common/Card';

/**
 * Simple bar chart for IV visualization
 */
const IVSkewBars = ({ data, width = 400, height = 180, isDark }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No IV data available
            </div>
        );
    }

    const padding = { top: 20, right: 10, bottom: 30, left: 45 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxIV = Math.max(...data.map(d => Math.max(d.ceIV || 0, d.peIV || 0)));
    const minIV = Math.min(...data.filter(d => d.ceIV || d.peIV).map(d => Math.min(d.ceIV || Infinity, d.peIV || Infinity)));
    const ivRange = maxIV - minIV || 1;

    const barWidth = (chartWidth / data.length) * 0.35;
    const gapWidth = (chartWidth / data.length) * 0.3;

    const yScale = (v) => {
        if (!v || isNaN(v)) return chartHeight + padding.top;
        return padding.top + chartHeight - ((v - minIV) / ivRange) * chartHeight;
    };

    return (
        <svg width={width} height={height} className="overflow-visible">
            {/* Y-axis grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = padding.top + chartHeight * (1 - pct);
                const value = minIV + ivRange * pct;
                return (
                    <g key={pct}>
                        <line
                            x1={padding.left}
                            y1={y}
                            x2={width - padding.right}
                            y2={y}
                            stroke="currentColor"
                            strokeOpacity={0.1}
                        />
                        <text
                            x={padding.left - 5}
                            y={y + 3}
                            textAnchor="end"
                            fontSize={9}
                            fill="currentColor"
                            opacity={0.5}
                        >
                            {value.toFixed(0)}%
                        </text>
                    </g>
                );
            })}

            {/* Bars */}
            {data.map((d, i) => {
                const x = padding.left + (i / data.length) * chartWidth + gapWidth / 2;
                const ceHeight = d.ceIV ? chartHeight - ((d.ceIV - minIV) / ivRange) * chartHeight : 0;
                const peHeight = d.peIV ? chartHeight - ((d.peIV - minIV) / ivRange) * chartHeight : 0;

                return (
                    <g key={d.strike}>
                        {/* CE Bar */}
                        {d.ceIV && (
                            <rect
                                x={x}
                                y={yScale(d.ceIV)}
                                width={barWidth}
                                height={chartHeight + padding.top - yScale(d.ceIV)}
                                fill="#22c55e"
                                fillOpacity={d.isATM ? 0.9 : 0.6}
                                rx={2}
                            />
                        )}
                        {/* PE Bar */}
                        {d.peIV && (
                            <rect
                                x={x + barWidth + 2}
                                y={yScale(d.peIV)}
                                width={barWidth}
                                height={chartHeight + padding.top - yScale(d.peIV)}
                                fill="#ef4444"
                                fillOpacity={d.isATM ? 0.9 : 0.6}
                                rx={2}
                            />
                        )}

                        {/* ATM indicator */}
                        {d.isATM && (
                            <circle
                                cx={x + barWidth}
                                cy={padding.top - 8}
                                r={4}
                                fill="#eab308"
                            />
                        )}

                        {/* Strike label */}
                        <text
                            x={x + barWidth}
                            y={height - 8}
                            textAnchor="middle"
                            fontSize={8}
                            fill="currentColor"
                            opacity={d.isATM ? 1 : 0.5}
                            fontWeight={d.isATM ? 'bold' : 'normal'}
                        >
                            {(d.strike / 1000).toFixed(1)}k
                        </text>
                    </g>
                );
            })}

            {/* Legend */}
            <g transform={`translate(${width - 80}, 12)`}>
                <rect x={0} y={0} width={10} height={10} fill="#22c55e" rx={2} />
                <text x={14} y={8} fontSize={9} fill="currentColor" opacity={0.7}>CE</text>
                <rect x={35} y={0} width={10} height={10} fill="#ef4444" rx={2} />
                <text x={49} y={8} fontSize={9} fill="currentColor" opacity={0.7}>PE</text>
            </g>
        </svg>
    );
};

const IVSkewChart = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);

    // Process option chain data for IV skew
    const skewData = useMemo(() => {
        if (!optionChain || Object.keys(optionChain).length === 0) return null;

        const strikes = Object.keys(optionChain)
            .map(s => parseFloat(s))
            .sort((a, b) => a - b);

        // Get range around ATM
        const atmIndex = strikes.findIndex(s => s >= (atmStrike || spotPrice));
        const startIdx = Math.max(0, atmIndex - 8);
        const endIdx = Math.min(strikes.length, atmIndex + 9);
        const displayStrikes = strikes.slice(startIdx, endIdx);

        const data = displayStrikes.map(strike => {
            const strikeData = optionChain[strike] || optionChain[String(strike)];
            const ceIV = strikeData?.ce?.iv || strikeData?.ce?.IV;
            const peIV = strikeData?.pe?.iv || strikeData?.pe?.IV;

            return {
                strike,
                isATM: strike === atmStrike,
                ceIV: ceIV ? parseFloat(ceIV) : null,
                peIV: peIV ? parseFloat(peIV) : null,
            };
        });

        // Calculate ATM IV
        const atmData = data.find(d => d.isATM);
        const atmIV = atmData ? (atmData.ceIV + atmData.peIV) / 2 : null;

        // Determine skew type
        let skewType = 'NEUTRAL';
        if (data.length > 4) {
            const leftIV = (data[0].ceIV + data[0].peIV) / 2 || 0;
            const rightIV = (data[data.length - 1].ceIV + data[data.length - 1].peIV) / 2 || 0;
            const centerIV = atmIV || ((leftIV + rightIV) / 2);

            if (leftIV > centerIV * 1.1 && rightIV < centerIV) {
                skewType = 'PUT SKEW';
            } else if (rightIV > centerIV * 1.1 && leftIV < centerIV) {
                skewType = 'CALL SKEW';
            } else if (leftIV > centerIV && rightIV > centerIV) {
                skewType = 'SMILE';
            }
        }

        return {
            data,
            atmIV,
            skewType,
        };
    }, [optionChain, spotPrice, atmStrike]);

    // Empty state
    if (!optionChain || Object.keys(optionChain).length === 0) {
        return (
            <Card variant="glass" className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
                        <ChartBarIcon className="w-5 h-5 text-orange-500" />
                    </div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        IV Skew
                    </h3>
                </div>
                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <ChartBarIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Load Option Chain to view IV skew</p>
                </div>
            </Card>
        );
    }

    return (
        <Card variant="glass" className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
                        <ChartBarIcon className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            IV Skew
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Implied Volatility across strikes
                        </p>
                    </div>
                </div>

                {/* ATM IV and Skew Type */}
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ATM IV: </span>
                        <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {skewData?.atmIV?.toFixed(1)}%
                        </span>
                    </div>
                    <div className={`px-3 py-1.5 rounded-xl ${skewData?.skewType === 'PUT SKEW' ? 'bg-red-500/20 text-red-500' :
                            skewData?.skewType === 'CALL SKEW' ? 'bg-green-500/20 text-green-500' :
                                skewData?.skewType === 'SMILE' ? 'bg-purple-500/20 text-purple-500' :
                                    isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                        }`}>
                        <span className="text-xs font-bold">{skewData?.skewType}</span>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                <IVSkewBars data={skewData?.data} width={450} height={180} isDark={isDark} />
            </div>

            {/* Interpretation */}
            <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} text-xs`}>
                <div className="flex items-start gap-2">
                    <InformationCircleIcon className={`w-4 h-4 mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                        {skewData?.skewType === 'PUT SKEW' && (
                            <>Higher IV on puts (left side) indicates bearish hedging demand.</>
                        )}
                        {skewData?.skewType === 'CALL SKEW' && (
                            <>Higher IV on calls (right side) indicates bullish speculation.</>
                        )}
                        {skewData?.skewType === 'SMILE' && (
                            <>Symmetric IV pattern - equal hedging on both sides (typical before events).</>
                        )}
                        {skewData?.skewType === 'NEUTRAL' && (
                            <>Relatively flat IV curve - normal market conditions.</>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default IVSkewChart;

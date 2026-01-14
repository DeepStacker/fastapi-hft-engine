/**
 * Sensibull-Style Payoff Diagram Component
 * Matches Sensibull's exact design: two payoff lines, OI overlay, std dev markers, tabular payoff
 */
import { useMemo, useState, useCallback } from 'react';
import {
    ChartBarIcon, TableCellsIcon, Bars3BottomLeftIcon,
    AdjustmentsHorizontalIcon, EyeIcon, EyeSlashIcon
} from '@heroicons/react/24/outline';

const SensibullPayoffDiagram = ({
    legs,
    spotPrice,
    optionChain,
    lotSize = 1,
    breakevens = [],
    maxProfit,
    maxLoss,
    daysToExpiry = 7,
    avgIV = 0.15
}) => {
    const [viewMode, setViewMode] = useState('chart'); // 'chart' or 'table'
    const [showOI, setShowOI] = useState(true);
    const [targetDays, setTargetDays] = useState(0);
    const [showStdDev, setShowStdDev] = useState(true);
    const [hoveredX, setHoveredX] = useState(null);

    const width = 800;
    const chartHeight = 280;
    const oiHeight = 60;
    const totalHeight = chartHeight + (showOI ? oiHeight + 10 : 0);
    const padding = { top: 30, right: 20, bottom: 40, left: 65 };

    // Calculate standard deviation range (1σ)
    const stdDevRange = useMemo(() => {
        const timeToExpiry = Math.max(1, daysToExpiry - targetDays) / 365;
        const stdMove = avgIV * Math.sqrt(timeToExpiry);
        return {
            low: spotPrice * Math.exp(-stdMove),
            high: spotPrice * Math.exp(stdMove),
            move: stdMove * 100 // as percentage
        };
    }, [spotPrice, avgIV, daysToExpiry, targetDays]);

    // Calculate payoff data
    const payoffData = useMemo(() => {
        if (!legs.length || !spotPrice) return null;

        const range = spotPrice * 0.12;
        const minPrice = spotPrice - range;
        const maxPrice = spotPrice + range;
        const steps = 80;

        // Payoff at expiry
        const calcExpiryPayoff = (price) => {
            let total = 0;
            legs.forEach(leg => {
                const intrinsic = leg.type === 'CE'
                    ? Math.max(0, price - leg.strike)
                    : Math.max(0, leg.strike - price);
                const pnl = (intrinsic - leg.ltp) * leg.qty * lotSize;
                total += leg.action === 'BUY' ? pnl : -pnl;
            });
            return total;
        };

        // Payoff at target date (with time value)
        const calcTargetPayoff = (price, daysFwd) => {
            if (daysFwd >= daysToExpiry) return calcExpiryPayoff(price);

            let total = 0;
            const remainingDays = Math.max(1, daysToExpiry - daysFwd);
            const timeDecay = 1 - Math.sqrt(remainingDays / daysToExpiry);

            legs.forEach(leg => {
                const intrinsic = leg.type === 'CE'
                    ? Math.max(0, price - leg.strike)
                    : Math.max(0, leg.strike - price);
                const timeValue = Math.max(0, leg.ltp - intrinsic) * (1 - timeDecay);
                const currentValue = intrinsic + timeValue;
                const pnl = (currentValue - leg.ltp) * leg.qty * lotSize;
                total += leg.action === 'BUY' ? pnl : -pnl;
            });
            return total;
        };

        const points = [];
        for (let i = 0; i <= steps; i++) {
            const price = minPrice + (maxPrice - minPrice) * i / steps;
            points.push({
                price,
                expiry: calcExpiryPayoff(price),
                target: calcTargetPayoff(price, targetDays)
            });
        }

        const allPnL = points.flatMap(p => [p.expiry, p.target]);
        return {
            points,
            minPrice,
            maxPrice,
            minPnL: Math.min(...allPnL),
            maxPnL: Math.max(...allPnL)
        };
    }, [legs, spotPrice, lotSize, daysToExpiry, targetDays]);

    // OI data for strikes
    const oiData = useMemo(() => {
        if (!optionChain || !payoffData) return [];
        const { minPrice, maxPrice } = payoffData;
        return Object.keys(optionChain)
            .map(Number)
            .filter(s => s >= minPrice && s <= maxPrice)
            .map(strike => ({
                strike,
                callOI: optionChain[strike]?.ce?.oi || 0,
                putOI: optionChain[strike]?.pe?.oi || 0
            }))
            .sort((a, b) => a.strike - b.strike);
    }, [optionChain, payoffData]);

    const maxOI = useMemo(() => Math.max(1, ...oiData.flatMap(d => [d.callOI, d.putOI])), [oiData]);

    // Tabular payoff data (Sensibull-style targets)
    const tabularData = useMemo(() => {
        if (!legs.length || !spotPrice) return [];

        const targets = [-5, -3, -2, -1, 0, 1, 2, 3, 5];
        const timePoints = [0, Math.floor(daysToExpiry / 2), daysToExpiry];

        return targets.map(pct => {
            const price = spotPrice * (1 + pct / 100);
            const row = { pct, price };

            timePoints.forEach((days, idx) => {
                let total = 0;
                legs.forEach(leg => {
                    const intrinsic = leg.type === 'CE'
                        ? Math.max(0, price - leg.strike)
                        : Math.max(0, leg.strike - price);

                    if (days >= daysToExpiry) {
                        const pnl = (intrinsic - leg.ltp) * leg.qty * lotSize;
                        total += leg.action === 'BUY' ? pnl : -pnl;
                    } else {
                        const remainingDays = Math.max(1, daysToExpiry - days);
                        const timeDecay = 1 - Math.sqrt(remainingDays / daysToExpiry);
                        const timeValue = Math.max(0, leg.ltp - intrinsic) * (1 - timeDecay);
                        const pnl = (intrinsic + timeValue - leg.ltp) * leg.qty * lotSize;
                        total += leg.action === 'BUY' ? pnl : -pnl;
                    }
                });
                row[`t${idx}`] = total;
            });

            return row;
        });
    }, [legs, spotPrice, lotSize, daysToExpiry]);

    if (!payoffData) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400">
                Add strategy legs to view payoff
            </div>
        );
    }

    const { points, minPrice, maxPrice, minPnL, maxPnL } = payoffData;
    const pnlRange = maxPnL - minPnL || 1;
    const chartW = width - padding.left - padding.right;
    const chartH = chartHeight - padding.top - padding.bottom;

    const xScale = (price) => padding.left + ((price - minPrice) / (maxPrice - minPrice)) * chartW;
    const yScale = (pnl) => padding.top + ((maxPnL - pnl) / pnlRange) * chartH;
    const zeroY = yScale(0);

    const pathD = (key) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.price)},${yScale(p[key])}`).join(' ');

    // Hovered point
    const hoveredPoint = hoveredX ? points.find(p => Math.abs(xScale(p.price) - hoveredX) < 5) : null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header - Sensibull style */}
            <div className="px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ChartBarIcon className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold text-white">Payoff Analysis</span>

                    {/* View Toggle */}
                    <div className="flex bg-slate-700 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('chart')}
                            className={`px-2 py-0.5 text-[10px] rounded font-medium transition ${viewMode === 'chart' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <Bars3BottomLeftIcon className="w-3 h-3 inline mr-1" />
                            Chart
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-2 py-0.5 text-[10px] rounded font-medium transition ${viewMode === 'table' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <TableCellsIcon className="w-3 h-3 inline mr-1" />
                            Table
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Target Days Slider */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">Target:</span>
                        <input
                            type="range"
                            min={0}
                            max={daysToExpiry}
                            value={targetDays}
                            onChange={(e) => setTargetDays(parseInt(e.target.value))}
                            className="w-20 h-1 accent-blue-500"
                        />
                        <span className="text-[10px] text-blue-400 font-medium w-12">
                            {targetDays === 0 ? 'Today' : `+${targetDays}d`}
                        </span>
                    </div>

                    {/* Toggles */}
                    <button
                        onClick={() => setShowOI(!showOI)}
                        className={`px-2 py-0.5 text-[10px] rounded font-medium ${showOI ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500'
                            }`}
                    >
                        OI
                    </button>
                    <button
                        onClick={() => setShowStdDev(!showStdDev)}
                        className={`px-2 py-0.5 text-[10px] rounded font-medium ${showStdDev ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500'
                            }`}
                    >
                        1σ
                    </button>
                </div>
            </div>

            {viewMode === 'chart' ? (
                <div className="p-3">
                    <svg
                        width="100%"
                        height={totalHeight}
                        viewBox={`0 0 ${width} ${totalHeight}`}
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = (e.clientX - rect.left) * (width / rect.width);
                            setHoveredX(x >= padding.left && x <= width - padding.right ? x : null);
                        }}
                        onMouseLeave={() => setHoveredX(null)}
                        className="cursor-crosshair"
                    >
                        {/* Standard Deviation Zone */}
                        {showStdDev && (
                            <rect
                                x={xScale(stdDevRange.low)}
                                y={padding.top}
                                width={xScale(stdDevRange.high) - xScale(stdDevRange.low)}
                                height={chartH}
                                fill="rgba(147, 51, 234, 0.08)"
                                stroke="rgba(147, 51, 234, 0.3)"
                                strokeDasharray="4"
                            />
                        )}

                        {/* Grid */}
                        {[0.25, 0.5, 0.75].map(pct => (
                            <line key={pct} x1={padding.left} y1={padding.top + chartH * pct}
                                x2={width - padding.right} y2={padding.top + chartH * pct}
                                stroke="#374151" strokeDasharray="2" opacity="0.5" />
                        ))}

                        {/* Zero line */}
                        <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY}
                            stroke="#6B7280" strokeWidth="1.5" />

                        {/* Profit zone fill */}
                        <defs>
                            <clipPath id="profitClip">
                                <rect x={padding.left} y={padding.top} width={chartW} height={zeroY - padding.top} />
                            </clipPath>
                            <clipPath id="lossClip">
                                <rect x={padding.left} y={zeroY} width={chartW} height={chartH - (zeroY - padding.top)} />
                            </clipPath>
                        </defs>

                        {/* Expiry payoff fill */}
                        <path
                            d={`${pathD('expiry')} L${xScale(maxPrice)},${zeroY} L${xScale(minPrice)},${zeroY} Z`}
                            fill="rgba(16, 185, 129, 0.15)"
                            clipPath="url(#profitClip)"
                        />
                        <path
                            d={`${pathD('expiry')} L${xScale(maxPrice)},${zeroY} L${xScale(minPrice)},${zeroY} Z`}
                            fill="rgba(239, 68, 68, 0.15)"
                            clipPath="url(#lossClip)"
                        />

                        {/* Expiry curve - dark line */}
                        <path d={pathD('expiry')} fill="none" stroke="#1F2937" strokeWidth="2.5" />

                        {/* Target date curve - blue line (Sensibull signature) */}
                        <path d={pathD('target')} fill="none" stroke="#3B82F6" strokeWidth="2" />

                        {/* Spot price line */}
                        <line x1={xScale(spotPrice)} y1={padding.top} x2={xScale(spotPrice)} y2={chartHeight - padding.bottom}
                            stroke="#3B82F6" strokeWidth="2" strokeDasharray="6,4" />

                        {/* Breakeven markers */}
                        {breakevens.map((be, i) => (
                            <g key={i}>
                                <circle cx={xScale(be)} cy={zeroY} r="6" fill="#F59E0B" stroke="white" strokeWidth="2" />
                                <text x={xScale(be)} y={zeroY - 15} textAnchor="middle"
                                    className="fill-amber-600 text-[9px] font-bold">₹{Math.round(be)}</text>
                            </g>
                        ))}

                        {/* Strike markers */}
                        {legs.map((leg, i) => (
                            <line key={i} x1={xScale(leg.strike)} y1={chartHeight - padding.bottom - 8}
                                x2={xScale(leg.strike)} y2={chartHeight - padding.bottom + 8}
                                stroke={leg.type === 'CE' ? '#10B981' : '#EF4444'} strokeWidth="3" />
                        ))}

                        {/* Hover line */}
                        {hoveredX && (
                            <line x1={hoveredX} y1={padding.top} x2={hoveredX} y2={chartHeight - padding.bottom}
                                stroke="#9CA3AF" strokeWidth="1" strokeDasharray="3" />
                        )}

                        {/* Y-axis labels */}
                        <text x={padding.left - 8} y={padding.top + 5} textAnchor="end"
                            className="fill-emerald-600 text-[10px] font-medium">
                            +₹{(maxPnL / 1000).toFixed(0)}K
                        </text>
                        <text x={padding.left - 8} y={zeroY + 4} textAnchor="end"
                            className="fill-gray-500 text-[10px]">0</text>
                        <text x={padding.left - 8} y={chartHeight - padding.bottom} textAnchor="end"
                            className="fill-red-600 text-[10px] font-medium">
                            -₹{(Math.abs(minPnL) / 1000).toFixed(0)}K
                        </text>

                        {/* X-axis labels */}
                        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                            const price = minPrice + (maxPrice - minPrice) * pct;
                            return (
                                <text key={pct} x={xScale(price)} y={chartHeight - padding.bottom + 18} textAnchor="middle"
                                    className="fill-gray-500 text-[9px]">
                                    {Math.round(price)}
                                </text>
                            );
                        })}

                        {/* Std dev labels */}
                        {showStdDev && (
                            <>
                                <text x={xScale(stdDevRange.low)} y={padding.top - 5} textAnchor="middle"
                                    className="fill-purple-500 text-[8px]">-1σ</text>
                                <text x={xScale(stdDevRange.high)} y={padding.top - 5} textAnchor="middle"
                                    className="fill-purple-500 text-[8px]">+1σ</text>
                            </>
                        )}

                        {/* OI Bars */}
                        {showOI && (
                            <g transform={`translate(0, ${chartHeight})`}>
                                {oiData.map((d, i) => {
                                    const barW = Math.max(2, chartW / oiData.length * 0.35);
                                    const x = xScale(d.strike);
                                    const callH = (d.callOI / maxOI) * (oiHeight - 15);
                                    const putH = (d.putOI / maxOI) * (oiHeight - 15);

                                    return (
                                        <g key={i}>
                                            <rect x={x - barW - 1} y={oiHeight / 2 - callH} width={barW} height={callH}
                                                fill="rgba(16, 185, 129, 0.7)" rx="1" />
                                            <rect x={x + 1} y={oiHeight / 2} width={barW} height={putH}
                                                fill="rgba(239, 68, 68, 0.7)" rx="1" />
                                        </g>
                                    );
                                })}
                                <line x1={padding.left} y1={oiHeight / 2} x2={width - padding.right} y2={oiHeight / 2}
                                    stroke="#4B5563" strokeWidth="1" />
                                <text x={padding.left - 5} y={oiHeight / 2 - 8} textAnchor="end" className="fill-emerald-500 text-[7px]">CE</text>
                                <text x={padding.left - 5} y={oiHeight / 2 + 12} textAnchor="end" className="fill-red-500 text-[7px]">PE</text>
                            </g>
                        )}
                    </svg>

                    {/* Hover tooltip */}
                    {hoveredPoint && (
                        <div className="absolute bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 text-[10px] pointer-events-none z-10"
                            style={{ left: hoveredX + 15, top: 100 }}>
                            <div className="font-bold text-white mb-1">₹{Math.round(hoveredPoint.price)}</div>
                            <div className="flex justify-between gap-4">
                                <span className="text-gray-400">At Expiry:</span>
                                <span className={hoveredPoint.expiry >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {hoveredPoint.expiry >= 0 ? '+' : ''}₹{Math.round(hoveredPoint.expiry)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-blue-400">{targetDays === 0 ? 'Today' : `+${targetDays}d`}:</span>
                                <span className={hoveredPoint.target >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {hoveredPoint.target >= 0 ? '+' : ''}₹{Math.round(hoveredPoint.target)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 mt-2 text-[10px]">
                        <span className="flex items-center gap-1.5">
                            <span className="w-4 h-0.5 bg-gray-800 rounded"></span>
                            At Expiry
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-4 h-0.5 bg-blue-500 rounded"></span>
                            {targetDays === 0 ? 'Today' : `+${targetDays} Days`}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                            Breakeven
                        </span>
                        {showStdDev && (
                            <span className="flex items-center gap-1.5">
                                <span className="w-4 h-3 bg-purple-500/20 border border-purple-500/50 rounded"></span>
                                1σ Range ({stdDevRange.move.toFixed(1)}%)
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                /* Tabular View - Sensibull style */
                <div className="p-3">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>
                                <th className="py-2 px-3 text-left font-medium">Move %</th>
                                <th className="py-2 px-3 text-right font-medium">Target Price</th>
                                <th className="py-2 px-3 text-right font-medium">Today</th>
                                <th className="py-2 px-3 text-right font-medium">+{Math.floor(daysToExpiry / 2)}d</th>
                                <th className="py-2 px-3 text-right font-medium">Expiry</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {tabularData.map((row, i) => (
                                <tr key={i} className={row.pct === 0 ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                                    <td className={`py-2 px-3 font-medium ${row.pct > 0 ? 'text-green-600' : row.pct < 0 ? 'text-red-600' : 'text-blue-600'
                                        }`}>
                                        {row.pct > 0 ? '+' : ''}{row.pct}%
                                    </td>
                                    <td className="py-2 px-3 text-right">₹{Math.round(row.price)}</td>
                                    {['t0', 't1', 't2'].map(key => (
                                        <td key={key} className="py-2 px-3 text-right">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${row[key] > 0 ? 'bg-green-100 text-green-700' :
                                                    row[key] < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {row[key] >= 0 ? '+' : ''}₹{Math.round(row[key])}
                                            </span>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SensibullPayoffDiagram;

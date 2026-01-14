/**
 * Enhanced Payoff Diagram Component
 * Professional payoff chart with OI/OI Change bars, multi-time curves, and interactive features
 */
import { useMemo, useState } from 'react';
import {
    ChartBarIcon, CalendarDaysIcon, CursorArrowRaysIcon,
    ChevronDownIcon, EyeIcon, EyeSlashIcon
} from '@heroicons/react/24/outline';

const PayoffDiagramPro = ({
    legs,
    spotPrice,
    optionChain,
    lotSize = 1,
    breakevens = [],
    maxProfit,
    maxLoss
}) => {
    const [showOI, setShowOI] = useState(true);
    const [showOIChange, setShowOIChange] = useState(true);
    const [hoveredPrice, setHoveredPrice] = useState(null);
    const [selectedCurves, setSelectedCurves] = useState(['expiry', 'today']);

    const width = 800;
    const height = 400;
    const chartTop = 40;
    const chartBottom = height - 80;
    const chartLeft = 60;
    const chartRight = width - 20;
    const oiBarHeight = 40;
    const oiTop = chartBottom + 10;

    // Calculate payoff at different times
    const payoffData = useMemo(() => {
        if (!legs.length || !spotPrice) return null;

        const range = spotPrice * 0.15; // ±15%
        const minPrice = spotPrice - range;
        const maxPrice = spotPrice + range;
        const steps = 100;

        const calculatePayoffAtExpiry = (price) => {
            let total = 0;
            legs.forEach(leg => {
                let intrinsic = 0;
                if (leg.type === 'CE') {
                    intrinsic = Math.max(0, price - leg.strike);
                } else {
                    intrinsic = Math.max(0, leg.strike - price);
                }
                const legPnL = (intrinsic - leg.ltp) * leg.qty * lotSize;
                total += leg.action === 'BUY' ? legPnL : -legPnL;
            });
            return total;
        };

        // Calculate payoff with time value (approximate)
        const calculatePayoffWithTime = (price, timeDecayPct) => {
            let total = 0;
            legs.forEach(leg => {
                let intrinsic = 0;
                if (leg.type === 'CE') {
                    intrinsic = Math.max(0, price - leg.strike);
                } else {
                    intrinsic = Math.max(0, leg.strike - price);
                }
                // Add time value (simplified)
                const timeValue = (leg.ltp - intrinsic) * (1 - timeDecayPct);
                const currentValue = Math.max(intrinsic, intrinsic + timeValue);
                const legPnL = (currentValue - leg.ltp) * leg.qty * lotSize;
                total += leg.action === 'BUY' ? legPnL : -legPnL;
            });
            return total;
        };

        const points = [];
        for (let i = 0; i <= steps; i++) {
            const price = minPrice + (maxPrice - minPrice) * i / steps;
            points.push({
                price,
                expiry: calculatePayoffAtExpiry(price),
                today: calculatePayoffWithTime(price, 0),
                plus3d: calculatePayoffWithTime(price, 0.4),
                plus7d: calculatePayoffWithTime(price, 0.8)
            });
        }

        return {
            points,
            minPrice,
            maxPrice,
            minPayoff: Math.min(...points.map(p => Math.min(p.expiry, p.today, p.plus3d, p.plus7d))),
            maxPayoff: Math.max(...points.map(p => Math.max(p.expiry, p.today, p.plus3d, p.plus7d)))
        };
    }, [legs, spotPrice, lotSize]);

    // Get OI data for strikes
    const oiData = useMemo(() => {
        if (!optionChain || !payoffData) return [];

        const { minPrice, maxPrice } = payoffData;
        const strikes = Object.keys(optionChain).map(Number).filter(s => s >= minPrice && s <= maxPrice);

        return strikes.map(strike => {
            const data = optionChain[strike];
            return {
                strike,
                callOI: data?.ce?.oi || 0,
                putOI: data?.pe?.oi || 0,
                callOIChg: data?.ce?.oiChange || 0,
                putOIChg: data?.pe?.oiChange || 0
            };
        }).sort((a, b) => a.strike - b.strike);
    }, [optionChain, payoffData]);

    // Max OI for scaling
    const maxOI = useMemo(() => {
        if (!oiData.length) return 1;
        return Math.max(...oiData.flatMap(d => [d.callOI, d.putOI, Math.abs(d.callOIChg), Math.abs(d.putOIChg)]));
    }, [oiData]);

    if (!payoffData) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400">
                Add strategy legs to see payoff diagram
            </div>
        );
    }

    const { points, minPrice, maxPrice, minPayoff, maxPayoff } = payoffData;
    const payoffRange = maxPayoff - minPayoff || 1;
    const chartHeight = chartBottom - chartTop;

    // Scale functions
    const xScale = (price) => chartLeft + ((price - minPrice) / (maxPrice - minPrice)) * (chartRight - chartLeft);
    const yScale = (payoff) => chartTop + ((maxPayoff - payoff) / payoffRange) * chartHeight;
    const zeroY = yScale(0);

    // Generate path for a curve
    const generatePath = (key) => {
        return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.price)},${yScale(p[key])}`).join(' ');
    };

    // Curve colors
    const curveStyles = {
        expiry: { color: '#1F2937', label: 'At Expiry', dash: '' },
        today: { color: '#3B82F6', label: 'Today', dash: '' },
        plus3d: { color: '#10B981', label: '+3 Days', dash: '5,3' },
        plus7d: { color: '#F59E0B', label: '+7 Days', dash: '8,4' }
    };

    const toggleCurve = (key) => {
        setSelectedCurves(prev =>
            prev.includes(key)
                ? prev.filter(k => k !== key)
                : [...prev, key]
        );
    };

    // Get payoff at hovered price
    const hoveredPayoff = hoveredPrice
        ? points.find(p => Math.abs(p.price - hoveredPrice) < (maxPrice - minPrice) / 100)
        : null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <ChartBarIcon className="w-4 h-4 text-blue-500" />
                    Payoff Diagram
                </h3>

                {/* Controls */}
                <div className="flex items-center gap-3">
                    {/* Curve toggles */}
                    <div className="flex items-center gap-1">
                        {Object.entries(curveStyles).map(([key, style]) => (
                            <button
                                key={key}
                                onClick={() => toggleCurve(key)}
                                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all flex items-center gap-1 ${selectedCurves.includes(key)
                                        ? 'bg-gray-100 dark:bg-gray-700'
                                        : 'opacity-50'
                                    }`}
                            >
                                <span
                                    className="w-2.5 h-0.5 rounded"
                                    style={{
                                        backgroundColor: style.color,
                                        borderStyle: style.dash ? 'dashed' : 'solid',
                                        borderWidth: '1px',
                                        borderColor: style.color
                                    }}
                                />
                                {style.label}
                            </button>
                        ))}
                    </div>

                    {/* OI toggles */}
                    <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-600 pl-2">
                        <button
                            onClick={() => setShowOI(!showOI)}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded flex items-center gap-1 ${showOI ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700' : 'text-gray-400'
                                }`}
                        >
                            {showOI ? <EyeIcon className="w-3 h-3" /> : <EyeSlashIcon className="w-3 h-3" />}
                            OI
                        </button>
                        <button
                            onClick={() => setShowOIChange(!showOIChange)}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded flex items-center gap-1 ${showOIChange ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700' : 'text-gray-400'
                                }`}
                        >
                            {showOIChange ? <EyeIcon className="w-3 h-3" /> : <EyeSlashIcon className="w-3 h-3" />}
                            OI Δ
                        </button>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="p-4">
                <svg
                    width="100%"
                    height={height + (showOI || showOIChange ? 60 : 0)}
                    viewBox={`0 0 ${width} ${height + (showOI || showOIChange ? 60 : 0)}`}
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const chartWidth = chartRight - chartLeft;
                        const pct = (x * (width / rect.width) - chartLeft) / chartWidth;
                        if (pct >= 0 && pct <= 1) {
                            setHoveredPrice(minPrice + pct * (maxPrice - minPrice));
                        } else {
                            setHoveredPrice(null);
                        }
                    }}
                    onMouseLeave={() => setHoveredPrice(null)}
                >
                    <defs>
                        <linearGradient id="profitArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(16, 185, 129, 0.3)" />
                            <stop offset="100%" stopColor="rgba(16, 185, 129, 0.05)" />
                        </linearGradient>
                        <linearGradient id="lossArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(239, 68, 68, 0.05)" />
                            <stop offset="100%" stopColor="rgba(239, 68, 68, 0.3)" />
                        </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0.25, 0.5, 0.75].map(pct => (
                        <line
                            key={pct}
                            x1={chartLeft}
                            y1={chartTop + chartHeight * pct}
                            x2={chartRight}
                            y2={chartTop + chartHeight * pct}
                            stroke="#E5E7EB"
                            strokeDasharray="4"
                        />
                    ))}

                    {/* Zero line */}
                    <line
                        x1={chartLeft} y1={zeroY}
                        x2={chartRight} y2={zeroY}
                        stroke="#9CA3AF"
                        strokeWidth="2"
                    />

                    {/* Profit/Loss fill for expiry curve */}
                    {selectedCurves.includes('expiry') && (
                        <>
                            {/* Profit area */}
                            <path
                                d={`
                                    ${generatePath('expiry')}
                                    L${chartRight},${zeroY}
                                    L${chartLeft},${zeroY}
                                    Z
                                `}
                                fill="url(#profitArea)"
                                clipPath="url(#profitClip)"
                            />
                        </>
                    )}

                    {/* Payoff curves */}
                    {Object.entries(curveStyles).map(([key, style]) => (
                        selectedCurves.includes(key) && (
                            <path
                                key={key}
                                d={generatePath(key)}
                                fill="none"
                                stroke={style.color}
                                strokeWidth={key === 'expiry' ? 2.5 : 2}
                                strokeDasharray={style.dash}
                                strokeLinejoin="round"
                            />
                        )
                    ))}

                    {/* Spot price line */}
                    <line
                        x1={xScale(spotPrice)} y1={chartTop}
                        x2={xScale(spotPrice)} y2={chartBottom}
                        stroke="#3B82F6"
                        strokeWidth="2"
                        strokeDasharray="6,3"
                    />
                    <text
                        x={xScale(spotPrice)}
                        y={chartTop - 5}
                        textAnchor="middle"
                        className="fill-blue-600 text-[10px] font-bold"
                    >
                        Spot ₹{spotPrice.toLocaleString()}
                    </text>

                    {/* Breakeven markers */}
                    {breakevens.map((be, i) => (
                        <g key={i}>
                            <line
                                x1={xScale(be)} y1={chartTop}
                                x2={xScale(be)} y2={chartBottom}
                                stroke="#F59E0B"
                                strokeWidth="1.5"
                                strokeDasharray="4"
                            />
                            <circle cx={xScale(be)} cy={zeroY} r="5" fill="#F59E0B" />
                            <text
                                x={xScale(be)}
                                y={zeroY - 12}
                                textAnchor="middle"
                                className="fill-amber-600 text-[9px] font-bold"
                            >
                                BE ₹{be.toLocaleString()}
                            </text>
                        </g>
                    ))}

                    {/* Strike markers */}
                    {legs.map((leg, i) => (
                        <g key={i}>
                            <line
                                x1={xScale(leg.strike)} y1={chartBottom - 5}
                                x2={xScale(leg.strike)} y2={chartBottom + 5}
                                stroke={leg.type === 'CE' ? '#10B981' : '#EF4444'}
                                strokeWidth="3"
                            />
                        </g>
                    ))}

                    {/* OI Bars */}
                    {(showOI || showOIChange) && (
                        <g transform={`translate(0, ${chartBottom + 15})`}>
                            {/* Call OI bars (above center) */}
                            {showOI && oiData.map((d, i) => {
                                const barWidth = Math.max(3, (chartRight - chartLeft) / oiData.length * 0.4);
                                const x = xScale(d.strike) - barWidth / 2;
                                const callHeight = (d.callOI / maxOI) * oiBarHeight * 0.4;
                                const putHeight = (d.putOI / maxOI) * oiBarHeight * 0.4;

                                return (
                                    <g key={i}>
                                        {/* Call OI */}
                                        <rect
                                            x={x - barWidth / 2 - 1}
                                            y={oiBarHeight / 2 - callHeight}
                                            width={barWidth}
                                            height={callHeight}
                                            fill="rgba(16, 185, 129, 0.6)"
                                            rx="1"
                                        />
                                        {/* Put OI */}
                                        <rect
                                            x={x + barWidth / 2 + 1}
                                            y={oiBarHeight / 2}
                                            width={barWidth}
                                            height={putHeight}
                                            fill="rgba(239, 68, 68, 0.6)"
                                            rx="1"
                                        />
                                    </g>
                                );
                            })}

                            {/* OI Change markers */}
                            {showOIChange && oiData.map((d, i) => {
                                const x = xScale(d.strike);
                                const callChgHeight = Math.abs(d.callOIChg / maxOI) * oiBarHeight * 0.3;
                                const putChgHeight = Math.abs(d.putOIChg / maxOI) * oiBarHeight * 0.3;

                                return (
                                    <g key={`chg-${i}`}>
                                        {d.callOIChg !== 0 && (
                                            <circle
                                                cx={x - 4}
                                                cy={d.callOIChg > 0 ? oiBarHeight / 2 - 5 - callChgHeight : oiBarHeight / 2 + 5}
                                                r={Math.max(2, callChgHeight / 2)}
                                                fill={d.callOIChg > 0 ? '#10B981' : '#F59E0B'}
                                                opacity="0.8"
                                            />
                                        )}
                                        {d.putOIChg !== 0 && (
                                            <circle
                                                cx={x + 4}
                                                cy={d.putOIChg > 0 ? oiBarHeight / 2 + 5 + putChgHeight : oiBarHeight / 2 - 5}
                                                r={Math.max(2, putChgHeight / 2)}
                                                fill={d.putOIChg > 0 ? '#EF4444' : '#F59E0B'}
                                                opacity="0.8"
                                            />
                                        )}
                                    </g>
                                );
                            })}

                            {/* Center line */}
                            <line
                                x1={chartLeft} y1={oiBarHeight / 2}
                                x2={chartRight} y2={oiBarHeight / 2}
                                stroke="#D1D5DB"
                                strokeWidth="1"
                            />

                            {/* Labels */}
                            <text x={chartLeft - 5} y={oiBarHeight / 2 - 10} textAnchor="end" className="fill-emerald-600 text-[8px]">CE OI</text>
                            <text x={chartLeft - 5} y={oiBarHeight / 2 + 15} textAnchor="end" className="fill-red-600 text-[8px]">PE OI</text>
                        </g>
                    )}

                    {/* Hover line */}
                    {hoveredPrice && (
                        <g>
                            <line
                                x1={xScale(hoveredPrice)} y1={chartTop}
                                x2={xScale(hoveredPrice)} y2={chartBottom}
                                stroke="#6B7280"
                                strokeWidth="1"
                                strokeDasharray="2"
                            />
                        </g>
                    )}

                    {/* Y-axis labels */}
                    <text x={chartLeft - 5} y={chartTop + 5} textAnchor="end" className="fill-green-600 text-[10px] font-medium">
                        +₹{(maxPayoff / 1000).toFixed(0)}K
                    </text>
                    <text x={chartLeft - 5} y={zeroY + 4} textAnchor="end" className="fill-gray-500 text-[10px]">0</text>
                    <text x={chartLeft - 5} y={chartBottom} textAnchor="end" className="fill-red-600 text-[10px] font-medium">
                        -₹{(Math.abs(minPayoff) / 1000).toFixed(0)}K
                    </text>

                    {/* X-axis labels */}
                    {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                        const price = minPrice + (maxPrice - minPrice) * pct;
                        return (
                            <text
                                key={pct}
                                x={xScale(price)}
                                y={chartBottom + 15}
                                textAnchor="middle"
                                className="fill-gray-500 text-[9px]"
                            >
                                {price.toFixed(0)}
                            </text>
                        );
                    })}
                </svg>

                {/* Hover tooltip */}
                {hoveredPayoff && (
                    <div className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 text-[10px] pointer-events-none"
                        style={{
                            left: xScale(hoveredPrice) + 10,
                            top: 100
                        }}
                    >
                        <div className="font-bold mb-1">₹{hoveredPayoff.price.toFixed(0)}</div>
                        {selectedCurves.map(key => (
                            <div key={key} className="flex justify-between gap-3">
                                <span style={{ color: curveStyles[key].color }}>{curveStyles[key].label}:</span>
                                <span className={hoveredPayoff[key] >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {hoveredPayoff[key] >= 0 ? '+' : ''}₹{hoveredPayoff[key].toFixed(0)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex items-center justify-center gap-6 text-[10px] flex-wrap">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    Spot
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    Breakeven
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-emerald-500"></span>
                    CE Strike
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-red-500"></span>
                    PE Strike
                </span>
                {showOI && (
                    <>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-3 bg-emerald-500/60 rounded-sm"></span>
                            Call OI
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-3 bg-red-500/60 rounded-sm"></span>
                            Put OI
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

export default PayoffDiagramPro;

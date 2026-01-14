/**
 * Professional Greeks Analysis Component
 * Horizontal distribution bars, ring gauges, and advanced visualizations
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    BeakerIcon, ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    SparklesIcon, AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

const GreeksAnalysisPro = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const [selectedGreek, setSelectedGreek] = useState('delta');
    const [viewMode, setViewMode] = useState('distribution'); // 'distribution', 'heatmap', 'comparison'

    const greeksData = useMemo(() => {
        if (!optionChain) return [];

        return Object.entries(optionChain)
            .map(([strike, data]) => {
                const ce = data.ce?.optgeeks || data.ce?.greeks || {};
                const pe = data.pe?.optgeeks || data.pe?.greeks || {};
                return {
                    strike: parseFloat(strike),
                    ce_delta: ce.delta || 0,
                    pe_delta: pe.delta || 0,
                    ce_gamma: ce.gamma || 0,
                    pe_gamma: pe.gamma || 0,
                    ce_theta: ce.theta || 0,
                    pe_theta: pe.theta || 0,
                    ce_vega: ce.vega || 0,
                    pe_vega: pe.vega || 0,
                    ce_iv: data.ce?.iv || 0,
                    pe_iv: data.pe?.iv || 0,
                    ce_oi: data.ce?.oi || 0,
                    pe_oi: data.pe?.oi || 0,
                };
            })
            .filter(d => d.ce_delta !== 0 || d.pe_delta !== 0)
            .sort((a, b) => a.strike - b.strike);
    }, [optionChain]);

    // Aggregate net Greeks weighted by OI
    const netGreeks = useMemo(() => {
        const totalOI = greeksData.reduce((sum, d) => sum + d.ce_oi + d.pe_oi, 0) || 1;
        return {
            delta: greeksData.reduce((sum, d) => sum + (d.ce_delta * d.ce_oi + d.pe_delta * d.pe_oi) / totalOI, 0),
            gamma: greeksData.reduce((sum, d) => sum + (d.ce_gamma * d.ce_oi + d.pe_gamma * d.pe_oi) / totalOI, 0),
            theta: greeksData.reduce((sum, d) => sum + (d.ce_theta * d.ce_oi + d.pe_theta * d.pe_oi) / totalOI, 0),
            vega: greeksData.reduce((sum, d) => sum + (d.ce_vega * d.ce_oi + d.pe_vega * d.pe_oi) / totalOI, 0),
        };
    }, [greeksData]);

    // Get max values for scaling
    const maxValues = useMemo(() => ({
        delta: Math.max(...greeksData.flatMap(d => [Math.abs(d.ce_delta), Math.abs(d.pe_delta)])) || 1,
        gamma: Math.max(...greeksData.flatMap(d => [d.ce_gamma, d.pe_gamma])) || 0.01,
        theta: Math.max(...greeksData.flatMap(d => [Math.abs(d.ce_theta), Math.abs(d.pe_theta)])) || 50,
        vega: Math.max(...greeksData.flatMap(d => [d.ce_vega, d.pe_vega])) || 100,
    }), [greeksData]);

    const greekInfo = {
        delta: {
            color: 'emerald',
            gradient: 'from-emerald-500 to-teal-500',
            desc: 'Direction Sensitivity',
            range: [-1, 1],
            format: v => v.toFixed(3)
        },
        gamma: {
            color: 'violet',
            gradient: 'from-violet-500 to-purple-500',
            desc: 'Delta Acceleration',
            range: [0, maxValues.gamma],
            format: v => v.toFixed(4)
        },
        theta: {
            color: 'cyan',
            gradient: 'from-cyan-500 to-blue-500',
            desc: 'Time Decay/Day',
            range: [-maxValues.theta, 0],
            format: v => `₹${v.toFixed(1)}`
        },
        vega: {
            color: 'blue',
            gradient: 'from-blue-500 to-indigo-500',
            desc: 'IV Sensitivity',
            range: [0, maxValues.vega],
            format: v => v.toFixed(1)
        },
    };

    if (!optionChain || greeksData.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400">
                <BeakerIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No Greeks data available. Load Option Chain first.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Premium Net Greeks Summary - Horizontal Cards with Ring Gauges */}
            <div className="grid grid-cols-4 gap-3">
                {['delta', 'gamma', 'theta', 'vega'].map(greek => {
                    const info = greekInfo[greek];
                    const value = netGreeks[greek];
                    const isSelected = selectedGreek === greek;

                    // Calculate gauge percentage
                    const normalizedValue = greek === 'delta'
                        ? (value + 1) / 2 // -1 to 1 → 0 to 1
                        : greek === 'theta'
                            ? 1 - Math.abs(value) / maxValues.theta
                            : value / maxValues[greek];
                    const gaugePct = Math.max(0, Math.min(1, normalizedValue));

                    return (
                        <button
                            key={greek}
                            onClick={() => setSelectedGreek(greek)}
                            className={`relative overflow-hidden rounded-xl p-4 transition-all duration-300 ${isSelected
                                    ? `bg-gradient-to-br ${info.gradient} text-white shadow-lg scale-[1.02]`
                                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {/* Background decoration */}
                            {isSelected && (
                                <div className="absolute -right-6 -top-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
                            )}

                            <div className="relative flex items-center gap-3">
                                {/* Ring Gauge */}
                                <div className="relative w-14 h-14 flex-shrink-0">
                                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                        <circle cx="18" cy="18" r="15.5" fill="none"
                                            stroke={isSelected ? 'rgba(255,255,255,0.3)' : '#E5E7EB'}
                                            strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15.5" fill="none"
                                            stroke={isSelected ? 'white' : `var(--${info.color}-500, #10B981)`}
                                            strokeWidth="3"
                                            strokeDasharray={`${gaugePct * 97.5} 97.5`}
                                            strokeLinecap="round" />
                                    </svg>
                                    <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${isSelected ? 'text-white/90' : 'text-gray-600'
                                        }`}>
                                        {(gaugePct * 100).toFixed(0)}%
                                    </div>
                                </div>

                                {/* Values */}
                                <div className="flex-1 text-left">
                                    <div className={`text-[10px] font-medium uppercase tracking-wide ${isSelected ? 'text-white/80' : 'text-gray-400'
                                        }`}>
                                        {greek}
                                    </div>
                                    <div className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                        {info.format(value)}
                                    </div>
                                    <div className={`text-[9px] ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                                        {info.desc}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    {[
                        { id: 'distribution', label: 'Distribution', icon: ChartBarIcon },
                        { id: 'heatmap', label: 'Heatmap', icon: AdjustmentsHorizontalIcon },
                        { id: 'comparison', label: 'CE vs PE', icon: SparklesIcon }
                    ].map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => setViewMode(mode.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${viewMode === mode.id
                                    ? `bg-gradient-to-r ${greekInfo[selectedGreek].gradient} text-white shadow-md`
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-white dark:hover:bg-gray-700'
                                }`}
                        >
                            <mode.icon className="w-3.5 h-3.5" />
                            {mode.label}
                        </button>
                    ))}
                </div>

                <div className="text-xs text-gray-500">
                    ATM: <span className="font-bold text-blue-600">{atmStrike}</span> •
                    Spot: <span className="font-bold">₹{spotPrice?.toFixed(2)}</span>
                </div>
            </div>

            {/* Main Visualization */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className={`px-4 py-2.5 bg-gradient-to-r ${greekInfo[selectedGreek].gradient} text-white`}>
                    <h3 className="font-semibold text-sm flex items-center gap-2 capitalize">
                        <BeakerIcon className="w-4 h-4" />
                        {selectedGreek} {viewMode === 'distribution' ? 'Distribution by Strike' : viewMode === 'heatmap' ? 'Heatmap' : 'CE vs PE Comparison'}
                    </h3>
                </div>

                <div className="p-4">
                    {viewMode === 'distribution' && (
                        <HorizontalDistribution
                            data={greeksData}
                            greek={selectedGreek}
                            maxValue={maxValues[selectedGreek]}
                            atmStrike={atmStrike}
                            info={greekInfo[selectedGreek]}
                        />
                    )}
                    {viewMode === 'heatmap' && (
                        <HorizontalHeatmap
                            data={greeksData}
                            greek={selectedGreek}
                            maxValue={maxValues[selectedGreek]}
                            atmStrike={atmStrike}
                        />
                    )}
                    {viewMode === 'comparison' && (
                        <CEPEComparison
                            data={greeksData}
                            greek={selectedGreek}
                            maxValue={maxValues[selectedGreek]}
                            atmStrike={atmStrike}
                            info={greekInfo[selectedGreek]}
                        />
                    )}
                </div>
            </div>

            {/* IV Smile Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <ArrowTrendingUpIcon className="w-4 h-4" />
                        IV Smile / Skew
                    </h3>
                </div>
                <div className="p-4">
                    <IVSmileChart data={greeksData} atmStrike={atmStrike} spotPrice={spotPrice} />
                </div>
            </div>
        </div>
    );
};

// Horizontal Distribution Bars
const HorizontalDistribution = ({ data, greek, maxValue, atmStrike, info }) => {
    // Filter to show ~15 strikes centered around ATM
    const atmIdx = data.findIndex(d => d.strike >= atmStrike);
    const start = Math.max(0, atmIdx - 7);
    const end = Math.min(data.length, atmIdx + 8);
    const visibleData = data.slice(start, end);

    return (
        <div className="space-y-1">
            {/* Header */}
            <div className="flex items-center text-[10px] text-gray-400 font-medium mb-2">
                <div className="w-16"></div>
                <div className="flex-1 text-center">← CE {greek}</div>
                <div className="w-px h-3 bg-gray-300 mx-2"></div>
                <div className="flex-1 text-center">PE {greek} →</div>
            </div>

            {visibleData.map((row, i) => {
                const ceValue = row[`ce_${greek}`];
                const peValue = Math.abs(row[`pe_${greek}`]);
                const ceWidth = (Math.abs(ceValue) / maxValue) * 100;
                const peWidth = (peValue / maxValue) * 100;
                const isATM = row.strike === atmStrike;

                return (
                    <div key={i} className={`flex items-center gap-2 py-1 px-2 rounded ${isATM ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}>
                        {/* Strike */}
                        <div className={`w-16 text-right text-xs font-bold ${isATM ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}>
                            {row.strike}
                            {isATM && <span className="ml-1 text-[8px] text-blue-400">ATM</span>}
                        </div>

                        {/* CE Bar (right to left) */}
                        <div className="flex-1 flex justify-end">
                            <div className="w-full h-5 bg-gray-100 dark:bg-gray-700 rounded-l-full overflow-hidden flex justify-end">
                                <div
                                    className={`h-full bg-gradient-to-l from-emerald-500 to-emerald-400 rounded-l-full flex items-center justify-start pl-1 transition-all duration-300`}
                                    style={{ width: `${Math.min(100, ceWidth)}%` }}
                                >
                                    {ceWidth > 20 && (
                                        <span className="text-[9px] text-white font-bold">{info.format(ceValue)}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Center divider */}
                        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600"></div>

                        {/* PE Bar (left to right) */}
                        <div className="flex-1">
                            <div className="w-full h-5 bg-gray-100 dark:bg-gray-700 rounded-r-full overflow-hidden">
                                <div
                                    className={`h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-r-full flex items-center justify-end pr-1 transition-all duration-300`}
                                    style={{ width: `${Math.min(100, peWidth)}%` }}
                                >
                                    {peWidth > 20 && (
                                        <span className="text-[9px] text-white font-bold">{info.format(row[`pe_${greek}`])}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-3 text-[10px]">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-gradient-to-r from-emerald-400 to-emerald-500"></span>
                    Call {greek}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-gradient-to-r from-rose-400 to-rose-500"></span>
                    Put {greek}
                </span>
            </div>
        </div>
    );
};

// Horizontal Heatmap
const HorizontalHeatmap = ({ data, greek, maxValue, atmStrike }) => {
    const getColor = (value, type) => {
        const intensity = Math.min(Math.abs(value) / maxValue, 1);
        if (type === 'ce') {
            return `rgba(16, 185, 129, ${0.2 + intensity * 0.7})`;
        } else {
            return `rgba(239, 68, 68, ${0.2 + intensity * 0.7})`;
        }
    };

    // Show all strikes horizontally
    const atmIdx = data.findIndex(d => d.strike >= atmStrike);
    const start = Math.max(0, atmIdx - 10);
    const end = Math.min(data.length, atmIdx + 11);
    const visibleData = data.slice(start, end);

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[600px]">
                {/* CE Row */}
                <div className="flex items-center gap-0.5 mb-1">
                    <div className="w-12 text-[10px] text-emerald-600 font-bold">CE</div>
                    {visibleData.map((d, i) => {
                        const value = d[`ce_${greek}`];
                        return (
                            <div
                                key={i}
                                className="flex-1 h-12 rounded flex items-center justify-center text-[9px] font-bold transition-all hover:scale-105 cursor-default"
                                style={{ backgroundColor: getColor(value, 'ce') }}
                                title={`CE ${greek}: ${value.toFixed(4)}`}
                            >
                                {greek === 'gamma' ? value.toFixed(3) : value.toFixed(2)}
                            </div>
                        );
                    })}
                </div>

                {/* Strike labels */}
                <div className="flex items-center gap-0.5 mb-1">
                    <div className="w-12"></div>
                    {visibleData.map((d, i) => {
                        const isATM = d.strike === atmStrike;
                        return (
                            <div
                                key={i}
                                className={`flex-1 py-1 text-center text-[9px] font-bold rounded ${isATM ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                    }`}
                            >
                                {d.strike}
                            </div>
                        );
                    })}
                </div>

                {/* PE Row */}
                <div className="flex items-center gap-0.5">
                    <div className="w-12 text-[10px] text-rose-600 font-bold">PE</div>
                    {visibleData.map((d, i) => {
                        const value = d[`pe_${greek}`];
                        return (
                            <div
                                key={i}
                                className="flex-1 h-12 rounded flex items-center justify-center text-[9px] font-bold transition-all hover:scale-105 cursor-default"
                                style={{ backgroundColor: getColor(value, 'pe') }}
                                title={`PE ${greek}: ${value.toFixed(4)}`}
                            >
                                {greek === 'gamma' ? Math.abs(value).toFixed(3) : Math.abs(value).toFixed(2)}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// CE vs PE Comparison (Butterfly chart)
const CEPEComparison = ({ data, greek, maxValue, atmStrike, info }) => {
    const width = 700;
    const height = 250;
    const padding = { left: 60, right: 30, top: 30, bottom: 40 };

    const atmIdx = data.findIndex(d => d.strike >= atmStrike);
    const start = Math.max(0, atmIdx - 12);
    const end = Math.min(data.length, atmIdx + 13);
    const visibleData = data.slice(start, end);

    const xScale = (i) => padding.left + (i / (visibleData.length - 1)) * (width - padding.left - padding.right);
    const yScale = (v) => padding.top + ((maxValue - v) / (maxValue * 2)) * (height - padding.top - padding.bottom);
    const zeroY = yScale(0);

    // Build area paths
    const ceAreaPath = `M${xScale(0)},${zeroY} ` +
        visibleData.map((d, i) => `L${xScale(i)},${yScale(d[`ce_${greek}`])}`).join(' ') +
        ` L${xScale(visibleData.length - 1)},${zeroY} Z`;

    const peAreaPath = `M${xScale(0)},${zeroY} ` +
        visibleData.map((d, i) => `L${xScale(i)},${yScale(-Math.abs(d[`pe_${greek}`]))}`).join(' ') +
        ` L${xScale(visibleData.length - 1)},${zeroY} Z`;

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            <defs>
                <linearGradient id="ceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(16, 185, 129, 0.6)" />
                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0.1)" />
                </linearGradient>
                <linearGradient id="peGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="rgba(239, 68, 68, 0.6)" />
                    <stop offset="100%" stopColor="rgba(239, 68, 68, 0.1)" />
                </linearGradient>
            </defs>

            {/* Zero line */}
            <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY}
                stroke="#9CA3AF" strokeWidth="1.5" />

            {/* CE area */}
            <path d={ceAreaPath} fill="url(#ceGrad)" />

            {/* PE area */}
            <path d={peAreaPath} fill="url(#peGrad)" />

            {/* CE line */}
            <polyline
                points={visibleData.map((d, i) => `${xScale(i)},${yScale(d[`ce_${greek}`])}`).join(' ')}
                fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"
            />

            {/* PE line */}
            <polyline
                points={visibleData.map((d, i) => `${xScale(i)},${yScale(-Math.abs(d[`pe_${greek}`]))}`).join(' ')}
                fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"
            />

            {/* ATM marker */}
            {visibleData.findIndex(d => d.strike === atmStrike) >= 0 && (
                <line
                    x1={xScale(visibleData.findIndex(d => d.strike === atmStrike))}
                    y1={padding.top}
                    x2={xScale(visibleData.findIndex(d => d.strike === atmStrike))}
                    y2={height - padding.bottom}
                    stroke="#3B82F6" strokeWidth="2" strokeDasharray="5,3"
                />
            )}

            {/* X-axis labels */}
            {visibleData.filter((_, i) => i % 3 === 0).map((d, i) => (
                <text key={i}
                    x={xScale(i * 3)}
                    y={height - padding.bottom + 15}
                    textAnchor="middle"
                    className={`text-[9px] ${d.strike === atmStrike ? 'fill-blue-600 font-bold' : 'fill-gray-500'}`}
                >
                    {d.strike}
                </text>
            ))}

            {/* Y-axis labels */}
            <text x={padding.left - 8} y={padding.top + 5} textAnchor="end" className="fill-emerald-600 text-[10px] font-medium">
                +{info.format(maxValue)}
            </text>
            <text x={padding.left - 8} y={zeroY + 4} textAnchor="end" className="fill-gray-500 text-[10px]">0</text>
            <text x={padding.left - 8} y={height - padding.bottom - 5} textAnchor="end" className="fill-red-600 text-[10px] font-medium">
                {info.format(-maxValue)}
            </text>

            {/* Legend */}
            <g transform={`translate(${width - 120}, 15)`}>
                <rect x="0" y="0" width="10" height="10" fill="#10B981" rx="2" />
                <text x="15" y="9" className="fill-gray-600 text-[10px]">CE {greek}</text>
                <rect x="60" y="0" width="10" height="10" fill="#EF4444" rx="2" />
                <text x="75" y="9" className="fill-gray-600 text-[10px]">PE {greek}</text>
            </g>
        </svg>
    );
};

// IV Smile Chart
const IVSmileChart = ({ data, atmStrike, spotPrice }) => {
    const width = 700;
    const height = 180;
    const padding = { left: 60, right: 30, top: 20, bottom: 35 };

    const ivData = data.filter(d => d.ce_iv > 0 || d.pe_iv > 0);
    const maxIV = Math.max(...ivData.flatMap(d => [d.ce_iv, d.pe_iv])) * 100;
    const minIV = Math.min(...ivData.flatMap(d => [d.ce_iv, d.pe_iv]).filter(v => v > 0)) * 100;

    const xScale = (i) => padding.left + (i / (ivData.length - 1)) * (width - padding.left - padding.right);
    const yScale = (iv) => padding.top + ((maxIV - iv) / (maxIV - minIV + 5)) * (height - padding.top - padding.bottom);

    // Calculate skew
    const atmIV = ivData.find(d => d.strike === atmStrike);
    const atmIVAvg = atmIV ? ((atmIV.ce_iv + atmIV.pe_iv) / 2 * 100) : 0;

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Grid */}
            {[0.25, 0.5, 0.75].map((t, i) => {
                const y = padding.top + (height - padding.top - padding.bottom) * t;
                return (
                    <line key={i} x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                        stroke="#E5E7EB" strokeDasharray="3" />
                );
            })}

            {/* ATM marker */}
            {ivData.findIndex(d => d.strike === atmStrike) >= 0 && (
                <>
                    <line
                        x1={xScale(ivData.findIndex(d => d.strike === atmStrike))}
                        y1={padding.top}
                        x2={xScale(ivData.findIndex(d => d.strike === atmStrike))}
                        y2={height - padding.bottom}
                        stroke="#3B82F6" strokeWidth="2" strokeDasharray="5,3"
                    />
                    <text
                        x={xScale(ivData.findIndex(d => d.strike === atmStrike))}
                        y={height - 5}
                        textAnchor="middle"
                        className="fill-blue-600 text-[9px] font-bold"
                    >
                        ATM ({atmIVAvg.toFixed(1)}%)
                    </text>
                </>
            )}

            {/* Area fill */}
            <defs>
                <linearGradient id="ivGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(251, 191, 36, 0.4)" />
                    <stop offset="100%" stopColor="rgba(251, 191, 36, 0.05)" />
                </linearGradient>
            </defs>
            <path
                d={`M${xScale(0)},${yScale(ivData[0].ce_iv * 100)} ` +
                    ivData.map((d, i) => `L${xScale(i)},${yScale((d.ce_iv + d.pe_iv) / 2 * 100)}`).join(' ') +
                    ` L${xScale(ivData.length - 1)},${height - padding.bottom} L${xScale(0)},${height - padding.bottom} Z`}
                fill="url(#ivGrad)"
            />

            {/* CE IV line */}
            <polyline
                points={ivData.map((d, i) => `${xScale(i)},${yScale(d.ce_iv * 100)}`).join(' ')}
                fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round"
            />

            {/* PE IV line */}
            <polyline
                points={ivData.map((d, i) => `${xScale(i)},${yScale(d.pe_iv * 100)}`).join(' ')}
                fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"
            />

            {/* Y-axis */}
            <text x={padding.left - 8} y={padding.top + 5} textAnchor="end" className="fill-amber-600 text-[10px] font-medium">
                {maxIV.toFixed(0)}%
            </text>
            <text x={padding.left - 8} y={height - padding.bottom - 5} textAnchor="end" className="fill-gray-400 text-[10px]">
                {minIV.toFixed(0)}%
            </text>

            {/* Legend */}
            <g transform={`translate(${width - 140}, 10)`}>
                <line x1="0" y1="6" x2="12" y2="6" stroke="#10B981" strokeWidth="2.5" />
                <text x="17" y="9" className="fill-gray-600 text-[9px]">CE IV</text>
                <line x1="55" y1="6" x2="67" y2="6" stroke="#EF4444" strokeWidth="2.5" />
                <text x="72" y="9" className="fill-gray-600 text-[9px]">PE IV</text>
            </g>
        </svg>
    );
};

export default GreeksAnalysisPro;

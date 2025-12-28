/**
 * Greeks Analysis Component
 * Heatmap and charts for Delta, Gamma, Theta, Vega
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import { BeakerIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const GreeksAnalysis = () => {
    const optionChain = useSelector(selectOptionChain);
    const _spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const [selectedGreek, setSelectedGreek] = useState('delta');

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
                };
            })
            .filter(d => d.ce_delta !== 0 || d.pe_delta !== 0)
            .sort((a, b) => a.strike - b.strike);
    }, [optionChain]);

    // Net Greeks (simplified calculation)
    const netGreeks = useMemo(() => {
        return {
            delta: greeksData.reduce((sum, d) => sum + d.ce_delta + d.pe_delta, 0),
            gamma: greeksData.reduce((sum, d) => sum + d.ce_gamma + d.pe_gamma, 0),
            theta: greeksData.reduce((sum, d) => sum + d.ce_theta + d.pe_theta, 0),
            vega: greeksData.reduce((sum, d) => sum + d.ce_vega + d.pe_vega, 0),
        };
    }, [greeksData]);

    const greekColors = {
        delta: { ce: '#10B981', pe: '#EF4444' },
        gamma: { ce: '#8B5CF6', pe: '#F59E0B' },
        theta: { ce: '#06B6D4', pe: '#EC4899' },
        vega: { ce: '#3B82F6', pe: '#84CC16' },
    };

    const getHeatmapColor = (value, greek, type) => {
        const absValue = Math.abs(value);
        const maxValues = { delta: 1, gamma: 0.01, theta: 50, vega: 100 };
        const intensity = Math.min(absValue / (maxValues[greek] || 1), 1);
        
        if (type === 'ce') {
            return `rgba(16, 185, 129, ${intensity})`;
        } else {
            return `rgba(239, 68, 68, ${intensity})`;
        }
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
        <div className="space-y-6">
            {/* Premium Net Greeks Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/25">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    <div className="relative">
                        <div className="text-xs opacity-80 mb-1 font-medium">Net Delta</div>
                        <div className="text-3xl font-bold">{netGreeks.delta.toFixed(2)}</div>
                        <div className="text-xs opacity-70 mt-1">Direction exposure</div>
                    </div>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/25">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    <div className="relative">
                        <div className="text-xs opacity-80 mb-1 font-medium">Net Gamma</div>
                        <div className="text-3xl font-bold">{netGreeks.gamma.toFixed(4)}</div>
                        <div className="text-xs opacity-70 mt-1">Acceleration</div>
                    </div>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-cyan-500/25">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    <div className="relative">
                        <div className="text-xs opacity-80 mb-1 font-medium">Net Theta</div>
                        <div className="text-3xl font-bold">{netGreeks.theta.toFixed(2)}</div>
                        <div className="text-xs opacity-70 mt-1">Time decay</div>
                    </div>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/25">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    <div className="relative">
                        <div className="text-xs opacity-80 mb-1 font-medium">Net Vega</div>
                        <div className="text-3xl font-bold">{netGreeks.vega.toFixed(2)}</div>
                        <div className="text-xs opacity-70 mt-1">Volatility</div>
                    </div>
                </div>
            </div>

            {/* Premium Greek Selector */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                {['delta', 'gamma', 'theta', 'vega'].map(greek => (
                    <button
                        key={greek}
                        onClick={() => setSelectedGreek(greek)}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold capitalize transition-all ${
                            selectedGreek === greek 
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' 
                                : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
                        }`}
                    >
                        {greek}
                    </button>
                ))}
            </div>

            {/* Greeks Heatmap */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold flex items-center gap-2 capitalize">
                        <BeakerIcon className="w-5 h-5 text-purple-500" />
                        {selectedGreek} Heatmap by Strike
                    </h3>
                </div>
                <div className="p-4 overflow-x-auto">
                    <div className="min-w-[600px]">
                        {/* Header */}
                        <div className="flex items-center gap-1 mb-2 text-xs text-gray-500">
                            <div className="flex-1 text-right">CE {selectedGreek}</div>
                            <div className="w-14 text-center font-bold">Strike</div>
                            <div className="flex-1 text-left">PE {selectedGreek}</div>
                        </div>

                        {/* Rows */}
                        {greeksData.map((row, i) => {
                            const ceValue = row[`ce_${selectedGreek}`];
                            const peValue = row[`pe_${selectedGreek}`];
                            const isATM = row.strike === atmStrike;

                            return (
                                <div key={i} className={`flex items-center gap-1 py-0.5 ${isATM ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                    {/* CE Value Cell */}
                                    <div className="flex-1 flex justify-end">
                                        <div 
                                            className="px-2 py-1 rounded text-xs font-medium text-right min-w-16"
                                            style={{ backgroundColor: getHeatmapColor(ceValue, selectedGreek, 'ce') }}
                                        >
                                            {ceValue.toFixed(selectedGreek === 'gamma' ? 4 : 2)}
                                        </div>
                                    </div>

                                    {/* Strike */}
                                    <div className={`w-14 text-center text-xs font-bold py-1 rounded ${isATM ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                        {row.strike}
                                    </div>

                                    {/* PE Value Cell */}
                                    <div className="flex-1">
                                        <div 
                                            className="px-2 py-1 rounded text-xs font-medium min-w-16"
                                            style={{ backgroundColor: getHeatmapColor(peValue, selectedGreek, 'pe') }}
                                        >
                                            {peValue.toFixed(selectedGreek === 'gamma' ? 4 : 2)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Greeks Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold flex items-center gap-2 capitalize">
                        <ChartBarIcon className="w-5 h-5 text-blue-500" />
                        {selectedGreek} Distribution
                    </h3>
                </div>
                <div className="p-4">
                    <GreeksChart data={greeksData} greek={selectedGreek} atmStrike={atmStrike} colors={greekColors[selectedGreek]} />
                </div>
            </div>

            {/* IV Comparison */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold">IV Skew Analysis</h3>
                </div>
                <div className="p-4">
                    <IVSkewChart data={greeksData} atmStrike={atmStrike} />
                </div>
            </div>
        </div>
    );
};

// Greeks Line Chart Component
const GreeksChart = ({ data, greek, atmStrike, colors }) => {
    if (!data || data.length === 0) return null;

    const width = 700;
    const height = 200;
    const padding = { left: 50, right: 30, top: 20, bottom: 30 };

    const ceValues = data.map(d => d[`ce_${greek}`]);
    const peValues = data.map(d => d[`pe_${greek}`]);
    const allValues = [...ceValues, ...peValues];
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 1;

    const xScale = (i) => padding.left + (i / (data.length - 1)) * (width - padding.left - padding.right);
    const yScale = (v) => padding.top + ((maxVal - v) / range) * (height - padding.top - padding.bottom);

    const cePoints = data.map((d, i) => `${xScale(i)},${yScale(d[`ce_${greek}`])}`).join(' ');
    const pePoints = data.map((d, i) => `${xScale(i)},${yScale(d[`pe_${greek}`])}`).join(' ');

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Zero line */}
            {minVal < 0 && maxVal > 0 && (
                <line x1={padding.left} y1={yScale(0)} x2={width - padding.right} y2={yScale(0)} stroke="#E5E7EB" strokeDasharray="4" />
            )}

            {/* ATM marker */}
            {atmStrike && data.findIndex(d => d.strike === atmStrike) >= 0 && (
                <line 
                    x1={xScale(data.findIndex(d => d.strike === atmStrike))} 
                    y1={padding.top} 
                    x2={xScale(data.findIndex(d => d.strike === atmStrike))} 
                    y2={height - padding.bottom}
                    stroke="#3B82F6" strokeWidth="2" strokeDasharray="4"
                />
            )}

            {/* Lines */}
            <polyline points={cePoints} fill="none" stroke={colors.ce} strokeWidth="3" strokeLinecap="round" />
            <polyline points={pePoints} fill="none" stroke={colors.pe} strokeWidth="3" strokeLinecap="round" />

            {/* Dots */}
            {data.map((d, i) => (
                <g key={i}>
                    <circle cx={xScale(i)} cy={yScale(d[`ce_${greek}`])} r="3" fill={colors.ce} />
                    <circle cx={xScale(i)} cy={yScale(d[`pe_${greek}`])} r="3" fill={colors.pe} />
                </g>
            ))}

            {/* Labels */}
            <text x={padding.left - 5} y={padding.top + 5} textAnchor="end" className="fill-gray-400 text-[10px]">{maxVal.toFixed(2)}</text>
            <text x={padding.left - 5} y={height - padding.bottom} textAnchor="end" className="fill-gray-400 text-[10px]">{minVal.toFixed(2)}</text>

            {/* Legend */}
            <g transform={`translate(${width - 100}, 10)`}>
                <line x1="0" y1="6" x2="15" y2="6" stroke={colors.ce} strokeWidth="3" />
                <text x="20" y="10" className="fill-gray-600 text-[10px]">CE</text>
                <line x1="45" y1="6" x2="60" y2="6" stroke={colors.pe} strokeWidth="3" />
                <text x="65" y="10" className="fill-gray-600 text-[10px]">PE</text>
            </g>
        </svg>
    );
};

// IV Skew Chart
const IVSkewChart = ({ data, atmStrike }) => {
    if (!data || data.length === 0) return null;

    const width = 700;
    const height = 180;
    const padding = { left: 50, right: 30, top: 20, bottom: 30 };

    const ivData = data.filter(d => d.ce_iv > 0 || d.pe_iv > 0);
    const maxIV = Math.max(...ivData.flatMap(d => [d.ce_iv, d.pe_iv]));

    const xScale = (i) => padding.left + (i / (ivData.length - 1)) * (width - padding.left - padding.right);
    const yScale = (iv) => padding.top + ((maxIV - iv) / maxIV) * (height - padding.top - padding.bottom);

    const cePoints = ivData.map((d, i) => `${xScale(i)},${yScale(d.ce_iv)}`).join(' ');
    const pePoints = ivData.map((d, i) => `${xScale(i)},${yScale(d.pe_iv)}`).join(' ');

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Grid */}
            {[0.25, 0.5, 0.75].map((t, i) => (
                <line key={i} x1={padding.left} y1={yScale(maxIV * t)} x2={width - padding.right} y2={yScale(maxIV * t)} stroke="#E5E7EB" strokeDasharray="2" />
            ))}

            {/* ATM marker */}
            {atmStrike && ivData.findIndex(d => d.strike === atmStrike) >= 0 && (
                <>
                    <line 
                        x1={xScale(ivData.findIndex(d => d.strike === atmStrike))} 
                        y1={padding.top} 
                        x2={xScale(ivData.findIndex(d => d.strike === atmStrike))} 
                        y2={height - padding.bottom}
                        stroke="#3B82F6" strokeWidth="2" strokeDasharray="4"
                    />
                    <text x={xScale(ivData.findIndex(d => d.strike === atmStrike))} y={height - 5} textAnchor="middle" className="fill-blue-600 text-[10px] font-bold">ATM</text>
                </>
            )}

            {/* IV curves */}
            <polyline points={cePoints} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
            <polyline points={pePoints} fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />

            {/* Y axis */}
            <text x={padding.left - 5} y={padding.top + 5} textAnchor="end" className="fill-gray-400 text-[10px]">{maxIV.toFixed(0)}%</text>
            <text x={padding.left - 5} y={height - padding.bottom} textAnchor="end" className="fill-gray-400 text-[10px]">0%</text>

            {/* Legend */}
            <g transform={`translate(${width - 100}, 10)`}>
                <line x1="0" y1="6" x2="15" y2="6" stroke="#10B981" strokeWidth="3" />
                <text x="20" y="10" className="fill-gray-600 text-[10px]">CE IV</text>
                <line x1="55" y1="6" x2="70" y2="6" stroke="#EF4444" strokeWidth="3" />
                <text x="75" y="10" className="fill-gray-600 text-[10px]">PE IV</text>
            </g>
        </svg>
    );
};

export default GreeksAnalysis;

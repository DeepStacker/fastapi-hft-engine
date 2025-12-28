/**
 * Multi-Strike Analysis Component
 * Compare multiple strikes side by side
 */
import { useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import { ChartBarIcon, XMarkIcon, EyeIcon } from '@heroicons/react/24/outline';

const MultiStrikeAnalysis = () => {
    const optionChain = useSelector(selectOptionChain);
    const _spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    
    const [selectedStrikes, setSelectedStrikes] = useState([]);
    const [compareField, setCompareField] = useState('oi');

    const strikes = useMemo(() => {
        if (!optionChain) return [];
        return Object.keys(optionChain).map(Number).sort((a, b) => a - b);
    }, [optionChain]);

    const addStrike = useCallback((strike) => {
        if (!selectedStrikes.includes(strike) && selectedStrikes.length < 8) {
            setSelectedStrikes(prev => [...prev, strike].sort((a, b) => a - b));
        }
    }, [selectedStrikes]);

    const removeStrike = useCallback((strike) => {
        setSelectedStrikes(prev => prev.filter(s => s !== strike));
    }, []);

    const addATMRange = useCallback(() => {
        if (!atmStrike) return;
        const rangeStrikes = strikes.filter(s => Math.abs(s - atmStrike) <= 300);
        setSelectedStrikes(rangeStrikes.slice(0, 8));
    }, [atmStrike, strikes]);

    // Get data for selected strikes
    const comparisonData = useMemo(() => {
        if (!optionChain || selectedStrikes.length === 0) return [];
        
        return selectedStrikes.map(strike => {
            const data = optionChain[strike];
            const ce = data?.ce || {};
            const pe = data?.pe || {};
            
            return {
                strike,
                ce_oi: ce.OI || ce.oi || 0,
                pe_oi: pe.OI || pe.oi || 0,
                ce_volume: ce.volume || ce.vol || 0,
                pe_volume: pe.volume || pe.vol || 0,
                ce_iv: ce.iv || 0,
                pe_iv: pe.iv || 0,
                ce_ltp: ce.ltp || 0,
                pe_ltp: pe.ltp || 0,
                ce_delta: ce.optgeeks?.delta || 0,
                pe_delta: pe.optgeeks?.delta || 0,
                ce_theta: ce.optgeeks?.theta || 0,
                pe_theta: pe.optgeeks?.theta || 0,
                ce_gamma: ce.optgeeks?.gamma || 0,
                pe_gamma: pe.optgeeks?.gamma || 0,
            };
        });
    }, [optionChain, selectedStrikes]);

    const fields = [
        { key: 'oi', label: 'Open Interest', ceKey: 'ce_oi', peKey: 'pe_oi' },
        { key: 'volume', label: 'Volume', ceKey: 'ce_volume', peKey: 'pe_volume' },
        { key: 'iv', label: 'IV %', ceKey: 'ce_iv', peKey: 'pe_iv' },
        { key: 'ltp', label: 'LTP', ceKey: 'ce_ltp', peKey: 'pe_ltp' },
        { key: 'delta', label: 'Delta', ceKey: 'ce_delta', peKey: 'pe_delta' },
        { key: 'theta', label: 'Theta', ceKey: 'ce_theta', peKey: 'pe_theta' },
    ];

    const currentField = fields.find(f => f.key === compareField) || fields[0];

    const formatNumber = (num) => {
        if (num >= 100000) return (num / 100000).toFixed(2) + 'L';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num?.toFixed(2) || '0';
    };

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'];

    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Strike Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <EyeIcon className="w-5 h-5 text-blue-500" />
                        Select Strikes to Compare (max 8)
                    </h3>
                    <button
                        onClick={addATMRange}
                        className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-200"
                    >
                        Add ATM ±300
                    </button>
                </div>

                {/* Selected Strikes */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {selectedStrikes.map((strike, i) => (
                        <div 
                            key={strike} 
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: colors[i % colors.length] }}
                        >
                            {strike} {strike === atmStrike && '(ATM)'}
                            <button onClick={() => removeStrike(strike)} className="ml-1 hover:bg-white/20 rounded p-0.5">
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {selectedStrikes.length === 0 && (
                        <span className="text-gray-400 text-sm">Click strikes below to add...</span>
                    )}
                </div>

                {/* Strike Grid */}
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                    {strikes.map(strike => {
                        const isSelected = selectedStrikes.includes(strike);
                        const isATM = strike === atmStrike;
                        return (
                            <button
                                key={strike}
                                onClick={() => isSelected ? removeStrike(strike) : addStrike(strike)}
                                disabled={!isSelected && selectedStrikes.length >= 8}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                    isSelected 
                                        ? 'bg-blue-500 text-white' 
                                        : isATM 
                                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200'
                                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                } ${selectedStrikes.length >= 8 && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {strike}
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedStrikes.length > 0 && (
                <>
                    {/* Field Selector */}
                    <div className="flex gap-2 flex-wrap">
                        {fields.map(field => (
                            <button
                                key={field.key}
                                onClick={() => setCompareField(field.key)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    compareField === field.key
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                {field.label}
                            </button>
                        ))}
                    </div>

                    {/* Comparison Chart */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="font-semibold flex items-center gap-2">
                                <ChartBarIcon className="w-5 h-5 text-blue-500" />
                                {currentField.label} Comparison
                            </h3>
                        </div>
                        <div className="p-4">
                            <ComparisonChart 
                                data={comparisonData} 
                                ceKey={currentField.ceKey}
                                peKey={currentField.peKey}
                                label={currentField.label}
                                colors={colors}
                                atmStrike={atmStrike}
                            />
                        </div>
                    </div>

                    {/* Detailed Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="font-semibold">Detailed Comparison</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="p-2 text-left">Metric</th>
                                        {comparisonData.map((d, i) => (
                                            <th key={d.strike} className="p-2 text-center" style={{ color: colors[i % colors.length] }}>
                                                {d.strike} {d.strike === atmStrike && '⭐'}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    <tr>
                                        <td className="p-2 font-medium text-red-600">CE OI</td>
                                        {comparisonData.map(d => <td key={d.strike} className="p-2 text-center">{formatNumber(d.ce_oi)}</td>)}
                                    </tr>
                                    <tr>
                                        <td className="p-2 font-medium text-green-600">PE OI</td>
                                        {comparisonData.map(d => <td key={d.strike} className="p-2 text-center">{formatNumber(d.pe_oi)}</td>)}
                                    </tr>
                                    <tr>
                                        <td className="p-2 font-medium text-red-600">CE LTP</td>
                                        {comparisonData.map(d => <td key={d.strike} className="p-2 text-center">₹{d.ce_ltp.toFixed(2)}</td>)}
                                    </tr>
                                    <tr>
                                        <td className="p-2 font-medium text-green-600">PE LTP</td>
                                        {comparisonData.map(d => <td key={d.strike} className="p-2 text-center">₹{d.pe_ltp.toFixed(2)}</td>)}
                                    </tr>
                                    <tr>
                                        <td className="p-2 font-medium text-red-600">CE IV</td>
                                        {comparisonData.map(d => <td key={d.strike} className="p-2 text-center">{d.ce_iv.toFixed(1)}%</td>)}
                                    </tr>
                                    <tr>
                                        <td className="p-2 font-medium text-green-600">PE IV</td>
                                        {comparisonData.map(d => <td key={d.strike} className="p-2 text-center">{d.pe_iv.toFixed(1)}%</td>)}
                                    </tr>
                                    <tr>
                                        <td className="p-2 font-medium text-red-600">CE Delta</td>
                                        {comparisonData.map(d => <td key={d.strike} className="p-2 text-center">{d.ce_delta.toFixed(3)}</td>)}
                                    </tr>
                                    <tr>
                                        <td className="p-2 font-medium text-green-600">PE Delta</td>
                                        {comparisonData.map(d => <td key={d.strike} className="p-2 text-center">{d.pe_delta.toFixed(3)}</td>)}
                                    </tr>
                                    <tr className="bg-purple-50 dark:bg-purple-900/20">
                                        <td className="p-2 font-medium">Straddle</td>
                                        {comparisonData.map(d => <td key={d.strike} className="p-2 text-center font-bold">₹{(d.ce_ltp + d.pe_ltp).toFixed(2)}</td>)}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// Grouped Bar Chart for Comparison
const ComparisonChart = ({ data, ceKey, peKey, label: _label, colors: _colors, atmStrike }) => {
    if (!data || data.length === 0) return null;

    const maxValue = Math.max(...data.flatMap(d => [d[ceKey], d[peKey]]));
    const barWidth = Math.min(40, 300 / data.length);
    const width = data.length * (barWidth * 2 + 20) + 60;
    const height = 200;
    const chartHeight = 150;

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((t, i) => (
                <line key={i} x1="40" y1={chartHeight - t * chartHeight + 20} x2={width - 20} y2={chartHeight - t * chartHeight + 20} stroke="#E5E7EB" strokeDasharray="2" />
            ))}

            {/* Bars */}
            {data.map((d, i) => {
                const x = 50 + i * (barWidth * 2 + 20);
                const ceHeight = (d[ceKey] / maxValue) * chartHeight;
                const peHeight = (d[peKey] / maxValue) * chartHeight;
                const isATM = d.strike === atmStrike;

                return (
                    <g key={d.strike}>
                        {/* ATM highlight */}
                        {isATM && (
                            <rect x={x - 5} y={15} width={barWidth * 2 + 10} height={chartHeight + 10} fill="#3B82F620" rx="4" />
                        )}
                        
                        {/* CE Bar */}
                        <rect
                            x={x}
                            y={20 + chartHeight - ceHeight}
                            width={barWidth}
                            height={ceHeight}
                            fill="#EF4444"
                            rx="2"
                        />
                        
                        {/* PE Bar */}
                        <rect
                            x={x + barWidth}
                            y={20 + chartHeight - peHeight}
                            width={barWidth}
                            height={peHeight}
                            fill="#10B981"
                            rx="2"
                        />

                        {/* Strike label */}
                        <text x={x + barWidth} y={height - 5} textAnchor="middle" className={`text-[10px] ${isATM ? 'fill-blue-600 font-bold' : 'fill-gray-500'}`}>
                            {d.strike}
                        </text>
                    </g>
                );
            })}

            {/* Legend */}
            <g transform="translate(50, 5)">
                <rect x="0" y="0" width="12" height="12" fill="#EF4444" rx="2" />
                <text x="16" y="10" className="fill-gray-600 text-[10px]">CE</text>
                <rect x="40" y="0" width="12" height="12" fill="#10B981" rx="2" />
                <text x="56" y="10" className="fill-gray-600 text-[10px]">PE</text>
            </g>
        </svg>
    );
};

export default MultiStrikeAnalysis;

import { memo, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon, ChartBarIcon, ArrowTrendingUpIcon, ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { analyticsService } from '../../../services/analyticsService';
import { useSelector } from 'react-redux';
import { selectSelectedSymbol, selectSelectedExpiry } from '../../../context/selectors';

/**
 * Professional Line Chart Component - LOC Calculator Style
 * Features: Time axis labels, grid lines, glow effects, gradient fill
 */
const MiniLineChart = memo(({ data, width = 620, height = 220, field = 'Value' }) => {
    if (!data || data.length === 0) return null;

    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const padding = { top: 20, right: 20, bottom: 35, left: 55 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Generate path points
    const points = data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = padding.top + ((maxVal - d.value) / range) * chartHeight;
        return { x, y, data: d };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaD = `M${padding.left},${height - padding.bottom} ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${width - padding.right},${height - padding.bottom} Z`;

    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changePercent = firstValue !== 0 ? ((lastValue - firstValue) / firstValue * 100).toFixed(2) : 0;
    const isPositive = lastValue >= firstValue;

    const color = isPositive ? '#10B981' : '#EF4444';
    const gradientId = `chartGrad-${Math.random().toString(36).substr(2, 9)}`;

    // Time labels (show start, middle, end)
    const getTimeLabel = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    // Y-axis ticks
    const yTicks = 5;
    const yStep = range / (yTicks - 1);

    return (
        <div className="relative">
            {/* Header Stats */}
            <div className="flex items-center justify-between mb-2 px-2">
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{field}</span>
                    <span className={`text-lg font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                        {lastValue?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                    {isPositive ? '▲' : '▼'} {Math.abs(changePercent)}%
                </div>
            </div>

            <svg width={width} height={height} className="mx-auto">
                <defs>
                    {/* Gradient Fill */}
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                    {/* Glow Effect */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Grid Lines */}
                {[...Array(yTicks)].map((_, i) => {
                    const y = padding.top + (i / (yTicks - 1)) * chartHeight;
                    const value = maxVal - (i * yStep);
                    return (
                        <g key={i}>
                            <line
                                x1={padding.left}
                                y1={y}
                                x2={width - padding.right}
                                y2={y}
                                stroke="currentColor"
                                strokeOpacity="0.1"
                                strokeDasharray="4,2"
                            />
                            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
                                {value >= 100000 ? `${(value / 100000).toFixed(1)}L` : value.toFixed(0)}
                            </text>
                        </g>
                    );
                })}

                {/* Area Fill */}
                <path d={areaD} fill={`url(#${gradientId})`} />

                {/* Main Line with Glow */}
                <path
                    d={pathD}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                />

                {/* Data Points (show every 10th) */}
                {points.filter((_, i) => i % 10 === 0 || i === points.length - 1).map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} opacity="0.7" />
                ))}

                {/* End Point (larger) */}
                <circle
                    cx={points[points.length - 1].x}
                    cy={points[points.length - 1].y}
                    r="5"
                    fill={color}
                    className="animate-pulse"
                />

                {/* X-Axis Time Labels */}
                {data[0]?.timestamp && (
                    <>
                        <text x={padding.left} y={height - 8} textAnchor="start" className="fill-gray-400 text-[10px]">
                            {getTimeLabel(data[0].timestamp)}
                        </text>
                        <text x={width / 2} y={height - 8} textAnchor="middle" className="fill-gray-400 text-[10px]">
                            {getTimeLabel(data[Math.floor(data.length / 2)]?.timestamp)}
                        </text>
                        <text x={width - padding.right} y={height - 8} textAnchor="end" className="fill-gray-400 text-[10px]">
                            {getTimeLabel(data[data.length - 1].timestamp)}
                        </text>
                    </>
                )}
            </svg>
        </div>
    );
});

MiniLineChart.displayName = 'MiniLineChart';

/**
 * Comparison Line Chart for CE vs PE
 */
const ComparisonLineChart = memo(({ ceData, peData, dataField = 'value', width = 600, height = 300 }) => {
    if (!ceData || !peData || ceData.length === 0) return null;

    const padding = { top: 20, right: 30, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Helper to get value based on field (value or change)
    const getValue = (item) => item[dataField] || 0;

    // Combine data for scaling
    const allValues = [
        ...ceData.map(getValue),
        ...peData.map(getValue)
    ];

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;

    const getX = (index) => padding.left + (index / (ceData.length - 1)) * chartWidth;
    const getY = (val) => padding.top + chartHeight - ((val - min) / range) * chartHeight;

    // Generate paths
    const generatePath = (data) => {
        return data.map((d, i) =>
            `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(getValue(d))}`
        ).join(' ');
    };

    const cePath = generatePath(ceData);
    const pePath = generatePath(peData);

    // Initial Gradient definitions


    return (
        <svg width={width} height={height} className="overflow-visible">
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = padding.top + chartHeight * t;
                return (
                    <g key={t}>
                        <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#334155" strokeOpacity="0.2" strokeDasharray="3 3" />
                        <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
                            {(max - (max - min) * t).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </text>
                    </g>
                );
            })}

            {/* CE Line (Green) */}
            <path
                d={cePath}
                fill="none"
                stroke="#22C55E"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* PE Line (Red) */}
            <path
                d={pePath}
                fill="none"
                stroke="#EF4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Legend */}
            <g transform={`translate(${width - 100}, 10)`}>
                <rect width="10" height="10" fill="#22C55E" rx="2" />
                <text x="15" y="9" className="text-[10px] fill-gray-500 font-medium">CE</text>

                <rect x="40" width="10" height="10" fill="#EF4444" rx="2" />
                <text x="55" y="9" className="text-[10px] fill-gray-500 font-medium">PE</text>
            </g>

            {/* X-Axis Time Labels */}
            {ceData[0]?.timestamp && (
                <>
                    <text x={padding.left} y={height - 5} textAnchor="start" className="fill-gray-400 text-[10px]">
                        {new Date(ceData[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </text>
                    <text x={width / 2} y={height - 5} textAnchor="middle" className="fill-gray-400 text-[10px]">
                        {new Date(ceData[Math.floor(ceData.length / 2)].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </text>
                    <text x={width - padding.right} y={height - 5} textAnchor="end" className="fill-gray-400 text-[10px]">
                        {new Date(ceData[ceData.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </text>
                </>
            )}
        </svg>
    );
});

ComparisonLineChart.displayName = 'ComparisonLineChart';

/**
 * Horizontal Bar Chart for aggregate COI/OI visualization - LOC Calculator Style
 * CE bars extend LEFT, PE bars extend RIGHT, Strike labels in center
 */
const AggregateBarChart = memo(({ data, viewType, width = 620, height = 400 }) => {
    if (!data || data.length === 0) return null;

    const sortedData = [...data].sort((a, b) => a.strike - b.strike);
    const atmIndex = sortedData.findIndex(d => d.is_atm);

    // Take strikes around ATM for display
    const displayData = sortedData.slice(
        Math.max(0, atmIndex - 12),
        Math.min(sortedData.length, atmIndex + 13)
    );

    if (displayData.length === 0) return null;

    const barHeight = Math.min(14, (height - 50) / displayData.length);
    const maxCE = Math.max(...displayData.map(d => Math.abs(d.ce_coi || d.ce_oi || 0)), 1);
    const maxPE = Math.max(...displayData.map(d => Math.abs(d.pe_coi || d.pe_oi || 0)), 1);
    const maxVal = Math.max(maxCE, maxPE);

    const centerX = width / 2;
    const barAreaWidth = (width - 80) / 2;

    return (
        <svg width={width} height={height} className="mx-auto">
            {/* Header */}
            <text x={centerX - barAreaWidth / 2} y={18} textAnchor="middle" className="fill-green-500 text-xs font-bold">
                CALL {viewType === 'coi' ? 'COI' : 'OI'}
            </text>
            <text x={centerX + barAreaWidth / 2} y={18} textAnchor="middle" className="fill-red-500 text-xs font-bold">
                PUT {viewType === 'coi' ? 'COI' : 'OI'}
            </text>

            {displayData.map((item, i) => {
                const y = 30 + i * (barHeight + 3);
                const ceValue = viewType === 'coi' ? (item.ce_coi || 0) : (item.ce_oi || 0);
                const peValue = viewType === 'coi' ? (item.pe_coi || 0) : (item.pe_oi || 0);
                const ceWidth = Math.abs(ceValue / maxVal) * barAreaWidth;
                const peWidth = Math.abs(peValue / maxVal) * barAreaWidth;

                return (
                    <g key={item.strike}>
                        {/* CE Bar (left side) */}
                        <rect
                            x={centerX - 25 - ceWidth}
                            y={y}
                            width={ceWidth}
                            height={barHeight}
                            fill={ceValue > 0 ? '#22C55E' : '#166534'}
                            rx="2"
                            opacity="0.85"
                        />

                        {/* Strike label */}
                        <text
                            x={centerX}
                            y={y + barHeight / 2 + 4}
                            textAnchor="middle"
                            className={`text-[10px] font-bold ${item.is_atm ? 'fill-yellow-400' : 'fill-gray-400'}`}
                        >
                            {item.strike}
                        </text>

                        {/* PE Bar (right side) */}
                        <rect
                            x={centerX + 25}
                            y={y}
                            width={peWidth}
                            height={barHeight}
                            fill={peValue > 0 ? '#EF4444' : '#991B1B'}
                            rx="2"
                            opacity="0.85"
                        />

                        {/* ATM highlight */}
                        {item.is_atm && (
                            <rect
                                x={centerX - 20}
                                y={y - 2}
                                width={40}
                                height={barHeight + 4}
                                fill="none"
                                stroke="#FBBF24"
                                strokeWidth="1.5"
                                rx="4"
                            />
                        )}
                    </g>
                );
            })}
        </svg>
    );
});

AggregateBarChart.displayName = 'AggregateBarChart';

/**
 * PCR Line Chart Component
 */
const PCRChart = memo(({ data, width = 600, height = 200 }) => {
    if (!data || data.length === 0) return null;

    const sortedData = [...data].sort((a, b) => a.strike - b.strike);
    const atmIndex = sortedData.findIndex(d => d.is_atm);
    const displayData = sortedData.slice(
        Math.max(0, atmIndex - 15),
        Math.min(sortedData.length, atmIndex + 16)
    );

    if (displayData.length === 0) return null;

    const values = displayData.map(d => d.pcr_oi || 0);
    const minVal = Math.min(...values, 0.5);
    const maxVal = Math.max(...values, 2);
    const range = maxVal - minVal || 1;

    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate y position for PCR = 1 line (neutral)
    const neutralY = padding.top + ((maxVal - 1) / range) * chartHeight;

    return (
        <svg width={width} height={height} className="mx-auto">
            {/* Background zones */}
            <rect
                x={padding.left}
                y={padding.top}
                width={chartWidth}
                height={neutralY - padding.top}
                fill="#22C55E"
                fillOpacity="0.1"
            />
            <rect
                x={padding.left}
                y={neutralY}
                width={chartWidth}
                height={chartHeight - (neutralY - padding.top)}
                fill="#EF4444"
                fillOpacity="0.1"
            />

            {/* Neutral line (PCR = 1) */}
            <line
                x1={padding.left}
                y1={neutralY}
                x2={width - padding.right}
                y2={neutralY}
                stroke="#6B7280"
                strokeDasharray="4 4"
            />
            <text x={padding.left - 5} y={neutralY + 4} textAnchor="end" className="fill-gray-400 text-[10px]">1.0</text>

            {/* PCR line and dots */}
            {displayData.map((item, i) => {
                const x = padding.left + (i / (displayData.length - 1)) * chartWidth;
                const y = padding.top + ((maxVal - (item.pcr_oi || 1)) / range) * chartHeight;
                const isBullish = (item.pcr_oi || 1) > 1;

                return (
                    <g key={item.strike}>
                        <circle
                            cx={x}
                            cy={y}
                            r={item.is_atm ? 6 : 4}
                            fill={isBullish ? '#22C55E' : '#EF4444'}
                        />
                        {item.is_atm && (
                            <text x={x} y={height - 10} textAnchor="middle" className="fill-yellow-500 text-[9px] font-bold">
                                ATM
                            </text>
                        )}
                    </g>
                );
            })}

            {/* Legend */}
            <text x={width - padding.right} y={padding.top / 2} textAnchor="end" className="fill-green-500 text-[10px]">
                {'>'} 1.0 = Bullish
            </text>
            <text x={width - padding.right} y={padding.top / 2 + 12} textAnchor="end" className="fill-red-500 text-[10px]">
                {'<'} 1.0 = Bearish
            </text>
        </svg>
    );
});

PCRChart.displayName = 'PCRChart';

/**
 * View selector tabs - LOC Calculator-style
 */
const VIEW_TABS = [
    { id: 'strike', label: 'Strike', icon: ChartBarIcon, description: 'Time-series for selected strike' },
    { id: 'coi', label: 'COi', icon: ArrowTrendingUpIcon, description: 'Change in OI across strikes' },
    { id: 'oi', label: 'Oi', icon: ChartBarIcon, description: 'Total OI across strikes' },
    { id: 'overall', label: 'Overall', icon: ChartBarIcon, description: 'Cumulative OI/COI view' },
    { id: 'pcr', label: 'PCR', icon: ArrowTrendingUpIcon, description: 'Put-Call Ratio across strikes' },
    { id: 'percentage', label: '%', icon: ArrowTrendingUpIcon, description: 'Percentage changes' },
];

/**
 * Enhanced Modal for displaying time-series and aggregate data
 * Inspired by LOC Calculator's chart modal with multiple view options
 */
const CellDetailModal = memo(({ isOpen, onClose, cellData }) => {
    const [activeView, setActiveView] = useState('strike');
    const [selectedField, setSelectedField] = useState('oi');
    const [timeSeriesData, setTimeSeriesData] = useState(null);
    const [aggregateData, setAggregateData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Use correct Redux selectors for symbol and expiry
    const symbol = useSelector(selectSelectedSymbol);
    const expiry = useSelector(selectSelectedExpiry);

    const { strike, side, field, value: _value, fullData } = cellData || {};

    // Fetch time-series data for strike view
    const fetchStrikeData = useCallback(async () => {
        console.log('[CellDetailModal] fetchStrikeData called with:', { symbol, strike, side, selectedField });

        if (!symbol || !strike || !side) {
            console.warn('[CellDetailModal] Missing required params:', { symbol, strike, side });
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('[CellDetailModal] Calling analyticsService.getStrikeTimeSeries...');
            const data = await analyticsService.getStrikeTimeSeries({
                symbol,
                strike: parseFloat(strike), // Ensure strike is a number
                optionType: side.toUpperCase(),
                field: selectedField,
                interval: '5m',
                limit: 50,
            });
            console.log('[CellDetailModal] API response:', data);
            setTimeSeriesData(data);
        } catch (err) {
            console.error('[CellDetailModal] Failed to fetch time-series:', err);
            setError(err.message || 'Failed to load data');
            setLoading(false);
        }
    }, [symbol, strike, side, selectedField]);

    // Fetch aggregate data for COi, Oi, Overall, PCR, Percentage views
    const fetchAggregateData = useCallback(async (viewType) => {
        if (!symbol || !expiry) return;

        setLoading(true);
        setError(null);

        try {
            let data;
            switch (viewType) {
                case 'coi':
                case 'overall':
                    data = await analyticsService.getAggregateCOI({ symbol, expiry });
                    break;
                case 'oi':
                    data = await analyticsService.getAggregateOI({ symbol, expiry });
                    break;
                case 'pcr':
                    data = await analyticsService.getAggregatePCR({ symbol, expiry });
                    break;
                case 'percentage':
                    data = await analyticsService.getAggregatePercentage({ symbol, expiry });
                    break;
                default:
                    return;
            }
            // Handle response format (may be array directly or object with data property)
            setAggregateData(Array.isArray(data) ? { data, summary: {} } : data);
        } catch (err) {
            console.error(`[CellDetailModal] Failed to fetch ${viewType} data:`, err);
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [symbol, expiry]);

    // Fetch on mount and view change
    useEffect(() => {
        if (isOpen && cellData) {
            if (activeView === 'strike') {
                if (field && ['OI', 'oi', 'oichng', 'ltp', 'iv', 'volume'].includes(field)) {
                    setSelectedField(field === 'OI' ? 'oi' : field === 'oichng' ? 'oi' : field);
                }
                fetchStrikeData();
            } else {
                fetchAggregateData(activeView);
            }
        }
    }, [isOpen, cellData, activeView, fetchStrikeData, fetchAggregateData, field]);

    if (!isOpen || !cellData) return null;

    const sideLabel = side === 'ce' ? 'Call' : 'Put';
    const _sideColor = side === 'ce' ? 'text-green-600' : 'text-red-600';
    const _sideBg = side === 'ce' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30';

    const fieldLabels = {
        oi: 'Open Interest',
        ltp: 'Last Traded Price',
        iv: 'Implied Volatility',
        volume: 'Volume',
        delta: 'Delta',
        theta: 'Theta',
    };

    const ce = fullData?.ce || {};
    const pe = fullData?.pe || {};
    const optData = side === 'ce' ? ce : pe;

    // Render content based on active view
    const renderContent = () => {
        if (loading) {
            return (
                <div className="h-64 flex items-center justify-center">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            );
        }

        if (error) {
            return (
                <div className="h-64 flex items-center justify-center text-red-500">
                    <div className="text-center">
                        <p>{error}</p>
                        <button
                            onClick={() => activeView === 'strike' ? fetchStrikeData() : fetchAggregateData(activeView)}
                            className="mt-2 text-sm text-blue-500 hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            );
        }

        switch (activeView) {
            case 'strike':
                return (
                    <div className="space-y-4">
                        {/* Field Selector */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {Object.entries(fieldLabels).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setSelectedField(key);
                                        fetchStrikeData();
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedField === key
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                            <button
                                onClick={fetchStrikeData}
                                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Refresh"
                            >
                                <ArrowPathIcon className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Chart Area */}
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            {/* Handle both array response and object with data property */}
                            {(() => {
                                // Extract data array from response - handle both formats
                                const chartData = Array.isArray(timeSeriesData)
                                    ? timeSeriesData
                                    : (timeSeriesData?.data || []);

                                console.log('[CellDetailModal] chartData for rendering:', chartData?.length, 'items');

                                if (chartData && chartData.length > 0) {
                                    return <MiniLineChart data={chartData} width={600} height={200} />;
                                }
                                return (
                                    <div className="h-52 flex items-center justify-center text-gray-400">
                                        No data available
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Summary Stats */}
                        {timeSeriesData?.summary && (
                            <div className="grid grid-cols-5 gap-2">
                                {['min', 'max', 'avg', 'current', 'change_from_start'].map((key) => (
                                    <div key={key} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                                        <div className="text-[10px] text-gray-500 uppercase">
                                            {key === 'change_from_start' ? 'Change' : key}
                                        </div>
                                        <div className={`text-sm font-semibold ${key === 'change_from_start'
                                            ? (timeSeriesData.summary[key] >= 0 ? 'text-green-600' : 'text-red-600')
                                            : ''
                                            }`}>
                                            {key === 'change_from_start' && timeSeriesData.summary[key] >= 0 ? '+' : ''}
                                            {timeSeriesData.summary[key]?.toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'coi':
            case 'oi': {
                const chartData = aggregateData?.data || [];
                const summary = aggregateData?.summary || {};

                return (
                    <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
                            <AggregateBarChart
                                data={chartData}
                                viewType={activeView}
                                width={620}
                                height={400}
                            />
                        </div>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                                <div className="text-[10px] text-green-600 uppercase">Total CE</div>
                                <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                                    {((summary.total_ce_coi || summary.total_ce_oi || 0) / 100000).toFixed(2)}L
                                </div>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                                <div className="text-[10px] text-red-600 uppercase">Total PE</div>
                                <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                                    {((summary.total_pe_coi || summary.total_pe_oi || 0) / 100000).toFixed(2)}L
                                </div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                                <div className="text-[10px] text-blue-600 uppercase">Net</div>
                                <div className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                                    {((summary.net_coi || summary.net_oi || 0) / 100000).toFixed(2)}L
                                </div>
                            </div>
                            <div className={`rounded-lg p-2 ${summary.signal === 'BULLISH' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                <div className="text-[10px] text-gray-600 uppercase">Signal</div>
                                <div className={`text-sm font-bold ${summary.signal === 'BULLISH' ? 'text-green-700' : 'text-red-700'}`}>
                                    {summary.signal || 'NEUTRAL'}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            case 'overall': {
                // Same as COI but showing cumulative data
                const chartData = aggregateData?.data || [];

                return (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <InformationCircleIcon className="w-4 h-4" />
                            Showing cumulative OI changes from lowest to highest strike
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
                            <AggregateBarChart
                                data={chartData}
                                viewType="coi"
                                width={620}
                                height={400}
                            />
                        </div>
                    </div>
                );
            }

            case 'pcr': {
                const chartData = aggregateData?.data || [];
                const summary = aggregateData?.summary || {};

                return (
                    <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <PCRChart data={chartData} width={620} height={220} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                                <div className="text-xs text-gray-500">Overall PCR (OI)</div>
                                <div className={`text-xl font-bold ${(summary.overall_pcr_oi || 1) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                    {summary.overall_pcr_oi?.toFixed(3) || 'N/A'}
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                                <div className="text-xs text-gray-500">Overall PCR (Vol)</div>
                                <div className={`text-xl font-bold ${(summary.overall_pcr_vol || 1) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                    {summary.overall_pcr_vol?.toFixed(3) || 'N/A'}
                                </div>
                            </div>
                            <div className={`rounded-lg p-3 text-center ${summary.market_sentiment === 'BULLISH' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                <div className="text-xs text-gray-500">Market Sentiment</div>
                                <div className={`text-lg font-bold ${summary.market_sentiment === 'BULLISH' ? 'text-green-700' : 'text-red-700'}`}>
                                    {summary.market_sentiment || 'NEUTRAL'}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            case 'percentage': {
                const chartData = aggregateData?.data?.slice(0, 20) || [];

                return (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-100 dark:bg-gray-800">
                                    <tr>
                                        <th className="p-2 text-left">Strike</th>
                                        <th className="p-2 text-right text-green-600">CE OI %</th>
                                        <th className="p-2 text-right text-red-600">PE OI %</th>
                                        <th className="p-2 text-right text-green-600">CE LTP %</th>
                                        <th className="p-2 text-right text-red-600">PE LTP %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chartData.map((item) => (
                                        <tr
                                            key={item.strike}
                                            className={`border-b border-gray-100 dark:border-gray-800 ${item.is_atm ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                                        >
                                            <td className={`p-2 font-medium ${item.is_atm ? 'text-yellow-600' : ''}`}>
                                                {item.strike}
                                            </td>
                                            <td className={`p-2 text-right ${(item.ce_oi_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {(item.ce_oi_pct || 0) >= 0 ? '+' : ''}{(item.ce_oi_pct || 0).toFixed(1)}%
                                            </td>
                                            <td className={`p-2 text-right ${(item.pe_oi_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {(item.pe_oi_pct || 0) >= 0 ? '+' : ''}{(item.pe_oi_pct || 0).toFixed(1)}%
                                            </td>
                                            <td className={`p-2 text-right ${(item.ce_ltp_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {(item.ce_ltp_pct || 0) >= 0 ? '+' : ''}{(item.ce_ltp_pct || 0).toFixed(1)}%
                                            </td>
                                            <td className={`p-2 text-right ${(item.pe_ltp_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {(item.pe_ltp_pct || 0) >= 0 ? '+' : ''}{(item.pe_ltp_pct || 0).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all overflow-hidden">
                    {/* Professional Header - LOC Calculator Style */}
                    <div className="relative overflow-hidden">
                        {/* Gradient Background */}
                        <div className={`absolute inset-0 ${side === 'ce'
                            ? 'bg-gradient-to-r from-green-600/20 to-emerald-500/10'
                            : 'bg-gradient-to-r from-red-600/20 to-rose-500/10'
                            }`} />

                        <div className="relative flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-700/50">
                            <div className="flex items-center gap-4">
                                {/* Pulse Icon with Glow */}
                                <div className={`relative p-2.5 rounded-xl ${side === 'ce'
                                    ? 'bg-green-500/20 text-green-500'
                                    : 'bg-red-500/20 text-red-500'
                                    }`}>
                                    <ChartBarIcon className="w-5 h-5" />
                                    <div className={`absolute inset-0 rounded-xl ${side === 'ce' ? 'bg-green-400' : 'bg-red-400'
                                        } blur-md opacity-30`} />
                                </div>

                                {/* Title */}
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <span className={side === 'ce' ? 'text-green-600' : 'text-red-600'}>
                                            {fieldLabels[selectedField] || 'Data'} Pulse
                                        </span>
                                        <span className="text-gray-400">—</span>
                                        <span>{symbol} {strike} {sideLabel.toUpperCase()}</span>
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        5-minute time-series • Real-time updates
                                    </p>
                                </div>
                            </div>

                            {/* Quick Stats Badge */}
                            {optData.ltp && (
                                <div className="flex items-center gap-3 mr-8">
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500">LTP</div>
                                        <div className={`text-sm font-bold ${(optData.change || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                            ₹{optData.ltp?.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold ${(optData.change || 0) >= 0
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                        {(optData.change || 0) >= 0 ? '+' : ''}{optData.change?.toFixed(2) || '0.00'}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* View Tabs - LOC Calculator style */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 px-2 overflow-x-auto">
                        {VIEW_TABS.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveView(tab.id)}
                                    className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${activeView === tab.id
                                        ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                    title={tab.description}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        {renderContent()}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <span className="text-xs text-gray-400">
                            {VIEW_TABS.find(t => t.id === activeView)?.description}
                        </span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

CellDetailModal.displayName = 'CellDetailModal';

CellDetailModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    cellData: PropTypes.shape({
        strike: PropTypes.number,
        side: PropTypes.string,
        field: PropTypes.string,
        value: PropTypes.any,
        symbol: PropTypes.string,
        sid: PropTypes.number,
        fullData: PropTypes.object,
    }),
};

export default CellDetailModal;

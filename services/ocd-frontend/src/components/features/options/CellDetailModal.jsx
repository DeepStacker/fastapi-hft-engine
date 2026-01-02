import { createPortal } from 'react-dom';
import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
 * Interactive Multi-Series Line Chart - TradingView-like
 * Features: Zoom, Pan, Crosshair, Tooltip, Smooth curves
 */
const MultiSeriesChart = memo(({ views, enabledViews, width = 900, height = 500, field = 'Value', strike = '' }) => {
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panOffset, setPanOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(0);
    const [mousePos, setMousePos] = useState(null);
    const svgRef = useRef(null);

    const viewConfig = {
        ce: { label: 'Call', color: '#22c55e', shortLabel: 'CE' },
        pe: { label: 'Put', color: '#ef4444', shortLabel: 'PE' },
        ce_minus_pe: { label: 'CE−PE', color: '#3b82f6', shortLabel: 'CE-PE' },
        pe_minus_ce: { label: 'PE−CE', color: '#06b6d4', shortLabel: 'PE-CE' },
        ce_div_pe: { label: 'CE÷PE', color: '#f97316', shortLabel: 'CE÷PE' },
        pe_div_ce: { label: 'PE÷CE', color: '#ec4899', shortLabel: 'PE÷CE' },
    };

    const activeSeries = Object.entries(enabledViews)
        .filter(([_, enabled]) => enabled)
        .map(([key]) => key)
        .filter(key => views[key] && views[key].length > 0);

    // Calculate visible data range based on zoom/pan
    const allTimestamps = useMemo(() => {
        const ts = new Set();
        activeSeries.forEach(key => {
            (views[key] || []).forEach(p => ts.add(p.timestamp));
        });
        return [...ts].sort();
    }, [views, activeSeries]);

    const totalPoints = allTimestamps.length;
    const visiblePoints = Math.max(3, Math.floor(totalPoints / zoomLevel));
    const maxPan = Math.max(0, totalPoints - visiblePoints);
    const startIdx = Math.min(Math.max(0, Math.round(panOffset)), maxPan);
    const endIdx = Math.min(totalPoints, startIdx + visiblePoints);
    const visibleTimestamps = allTimestamps.slice(startIdx, endIdx);

    // Filter views to only show visible data
    const visibleViews = useMemo(() => {
        const result = {};
        activeSeries.forEach(key => {
            result[key] = (views[key] || []).filter(p =>
                visibleTimestamps.includes(p.timestamp)
            );
        });
        return result;
    }, [views, activeSeries, visibleTimestamps]);

    // Mouse handlers
    const handleWheel = useCallback((e) => {
        // Note: Cannot preventDefault on passive wheel events in modern browsers
        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        setZoomLevel(prev => Math.max(1, Math.min(10, prev + delta)));
    }, []);

    const handleMouseDown = useCallback((e) => {
        setIsDragging(true);
        setDragStart(e.clientX);
    }, []);

    const handleMouseMove = useCallback((e) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
        if (isDragging) {
            const dx = e.clientX - dragStart;
            const sensitivity = totalPoints / (width * zoomLevel) * 2;
            setPanOffset(prev => Math.max(0, Math.min(maxPan, prev - dx * sensitivity)));
            setDragStart(e.clientX);
        }
    }, [isDragging, dragStart, totalPoints, width, zoomLevel, maxPan]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsDragging(false);
        setMousePos(null);
    }, []);

    const handleDoubleClick = useCallback(() => {
        setZoomLevel(1);
        setPanOffset(0);
    }, []);

    if (activeSeries.length === 0) {
        return (
            <div className="h-[500px] flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl border border-slate-700/50">
                <div className="text-center">
                    <span className="text-5xl mb-3 block opacity-50">📊</span>
                    <p className="text-slate-400 text-sm">Enable at least one view to see the chart</p>
                </div>
            </div>
        );
    }

    const padding = { top: 50, right: 30, bottom: 50, left: 70 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate Y scale from visible data
    const allVisibleValues = [];
    activeSeries.forEach(key => {
        (visibleViews[key] || []).forEach(p => allVisibleValues.push(p.value));
    });

    if (allVisibleValues.length === 0) {
        return (
            <div className="h-[500px] flex items-center justify-center bg-slate-900 rounded-xl">
                <p className="text-slate-400">No data available</p>
            </div>
        );
    }

    const minVal = Math.min(...allVisibleValues);
    const maxVal = Math.max(...allVisibleValues);
    const valueRange = maxVal - minVal || 1;
    const paddedMin = minVal - valueRange * 0.08;
    const paddedMax = maxVal + valueRange * 0.08;
    const range = paddedMax - paddedMin;

    const timestampToX = (ts) => {
        const idx = visibleTimestamps.indexOf(ts);
        if (idx === -1) return null;
        return padding.left + (idx / Math.max(visibleTimestamps.length - 1, 1)) * chartWidth;
    };

    const valueToY = (val) => padding.top + ((paddedMax - val) / range) * chartHeight;

    const generateSmoothPath = (data) => {
        const filteredData = data.filter(p => visibleTimestamps.includes(p.timestamp));
        if (!filteredData || filteredData.length < 2) {
            if (filteredData && filteredData.length === 1) {
                const x = timestampToX(filteredData[0].timestamp);
                const y = valueToY(filteredData[0].value);
                return x !== null ? `M${x},${y}` : '';
            }
            return '';
        }
        const points = filteredData.map(p => ({ x: timestampToX(p.timestamp), y: valueToY(p.value) })).filter(p => p.x !== null);
        if (points.length < 2) return '';
        let path = `M${points[0].x},${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
        }
        return path;
    };

    const yTicks = 6;
    const yStep = range / (yTicks - 1);

    const formatValue = (val) => {
        if (Math.abs(val) >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
        if (Math.abs(val) >= 100000) return `${(val / 100000).toFixed(1)}L`;
        if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}K`;
        return val.toFixed(val % 1 === 0 ? 0 : 2);
    };

    const getTimeLabel = (ts) => {
        if (!ts) return '';
        const date = new Date(ts);
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
    };

    // Find closest data point for crosshair
    const getCrosshairData = () => {
        if (!mousePos || mousePos.x < padding.left || mousePos.x > width - padding.right) return null;
        const xRatio = (mousePos.x - padding.left) / chartWidth;
        const idx = Math.round(xRatio * (visibleTimestamps.length - 1));
        const ts = visibleTimestamps[idx];
        if (!ts) return null;
        const values = {};
        activeSeries.forEach(key => {
            const point = (visibleViews[key] || []).find(p => p.timestamp === ts);
            if (point) values[key] = point.value;
        });
        return { timestamp: ts, x: timestampToX(ts), values };
    };

    const crosshair = getCrosshairData();

    return (
        <div className="relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-xl border border-slate-700/50 overflow-hidden select-none">
            {/* Compact Legend */}
            <div className="flex flex-wrap items-center justify-between px-4 py-2 border-b border-slate-700/50">
                <div className="flex items-center gap-4">
                    {activeSeries.map(key => {
                        const cfg = viewConfig[key];
                        const data = visibleViews[key] || [];
                        const currentVal = data[data.length - 1]?.value;
                        return (
                            <div key={key} className="flex items-center gap-1.5">
                                <div className="w-3 h-[2px] rounded-full" style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
                                <span className="text-slate-400 text-xs">{cfg.label}</span>
                                {currentVal !== undefined && (
                                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                                        {formatValue(currentVal)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>Zoom: {zoomLevel.toFixed(1)}x</span>
                    <span className="text-slate-600">|</span>
                    <span>Scroll to zoom • Drag to pan • Double-click to reset</span>
                </div>
            </div>

            <svg
                ref={svgRef}
                width={width}
                height={height}
                className="block cursor-crosshair"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onDoubleClick={handleDoubleClick}
            >
                <defs>
                    {activeSeries.map(key => (
                        <filter key={`glow-${key}`} id={`glow-${key}`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feFlood floodColor={viewConfig[key].color} floodOpacity="0.5" />
                            <feComposite in2="blur" operator="in" />
                            <feMerge>
                                <feMergeNode />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    ))}
                </defs>

                {/* Grid */}
                <g>
                    {[...Array(yTicks)].map((_, i) => {
                        const y = padding.top + (i / (yTicks - 1)) * chartHeight;
                        return (
                            <line key={i} x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                                stroke="#334155" strokeOpacity="0.3" strokeDasharray="2,4" />
                        );
                    })}
                </g>

                {/* Y-Axis Labels */}
                {[...Array(yTicks)].map((_, i) => {
                    const y = padding.top + (i / (yTicks - 1)) * chartHeight;
                    const value = paddedMax - (i * yStep);
                    return (
                        <text key={i} x={padding.left - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-500">
                            {formatValue(value)}
                        </text>
                    );
                })}

                {/* Zero line */}
                {paddedMin < 0 && paddedMax > 0 && (
                    <line x1={padding.left} y1={valueToY(0)} x2={width - padding.right} y2={valueToY(0)}
                        stroke="#64748b" strokeWidth="1" strokeDasharray="4,4" strokeOpacity="0.6" />
                )}

                {/* Watermark */}
                {strike && (
                    <text x={width / 2} y={height / 2 + 10} textAnchor="middle"
                        className="text-[50px] font-bold fill-slate-700/20 select-none pointer-events-none"
                        style={{ fontFamily: 'system-ui' }}>
                        NIFTY | {strike}
                    </text>
                )}

                {/* Lines */}
                {activeSeries.map(key => {
                    const path = generateSmoothPath(views[key] || []);
                    const data = visibleViews[key] || [];
                    const lastPoint = data[data.length - 1];
                    return (
                        <g key={key}>
                            <path d={path} fill="none" stroke={viewConfig[key].color} strokeWidth="2.5"
                                strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow-${key})`} />
                            {lastPoint && timestampToX(lastPoint.timestamp) !== null && (
                                <>
                                    <circle cx={timestampToX(lastPoint.timestamp)} cy={valueToY(lastPoint.value)}
                                        r="5" fill={viewConfig[key].color} filter={`url(#glow-${key})`} />
                                    <circle cx={timestampToX(lastPoint.timestamp)} cy={valueToY(lastPoint.value)}
                                        r="2" fill="#fff" />
                                </>
                            )}
                        </g>
                    );
                })}

                {/* Crosshair */}
                {crosshair && (
                    <g>
                        <line x1={crosshair.x} y1={padding.top} x2={crosshair.x} y2={height - padding.bottom}
                            stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
                        {Object.entries(crosshair.values).map(([key, val]) => (
                            <circle key={key} cx={crosshair.x} cy={valueToY(val)} r="4" fill={viewConfig[key].color} />
                        ))}
                    </g>
                )}

                {/* X-Axis */}
                {visibleTimestamps.length > 0 && (
                    <g className="text-[10px] fill-slate-500">
                        <text x={padding.left} y={height - 15} textAnchor="start">{getTimeLabel(visibleTimestamps[0])}</text>
                        {visibleTimestamps.length > 2 && (
                            <text x={width / 2} y={height - 15} textAnchor="middle">
                                {getTimeLabel(visibleTimestamps[Math.floor(visibleTimestamps.length / 2)])}
                            </text>
                        )}
                        <text x={width - padding.right} y={height - 15} textAnchor="end">
                            {getTimeLabel(visibleTimestamps[visibleTimestamps.length - 1])}
                        </text>
                    </g>
                )}
            </svg>

            {/* Tooltip */}
            {crosshair && (
                <div className="absolute bg-slate-800/95 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none"
                    style={{ left: Math.min(crosshair.x + 10, width - 150), top: 60 }}>
                    <div className="text-slate-300 font-medium mb-1">{getTimeLabel(crosshair.timestamp)}</div>
                    {Object.entries(crosshair.values).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between gap-4">
                            <span style={{ color: viewConfig[key].color }}>{viewConfig[key].label}:</span>
                            <span className="font-semibold text-white">{formatValue(val)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

MultiSeriesChart.displayName = 'MultiSeriesChart';


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
    const { strike, side, field: propField, fullData } = cellData || {};

    // Normalize field name
    const getNormalizedField = (f) => {
        const fieldMap = { 'OI': 'oi', 'oichng': 'oi_change' };
        // Supported fields for chart
        const supported = ['oi', 'oi_change', 'ltp', 'iv', 'volume', 'delta', 'theta', 'gamma', 'vega'];
        const mapped = fieldMap[f] || f || 'oi';
        // If mapped is supported, use it, else default to 'oi'
        return supported.includes(mapped) ? mapped : 'oi';
    };

    const [activeView, setActiveView] = useState('strike');
    const [selectedField, setSelectedField] = useState(() => getNormalizedField(propField));
    const [timeSeriesData, setTimeSeriesData] = useState(null);
    const [aggregateData, setAggregateData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const DEFAULT_VIEWS = useMemo(() => ({
        ce: false,
        pe: false,
        ce_minus_pe: false,
        pe_minus_ce: true,
        ce_div_pe: false,
        pe_div_ce: false,
    }), []);

    const [enabledViews, setEnabledViews] = useState(DEFAULT_VIEWS);

    // Reset views when modal opens (fresh start every time)
    useEffect(() => {
        if (isOpen) {
            setEnabledViews(DEFAULT_VIEWS);
        }
    }, [isOpen, DEFAULT_VIEWS]);

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // Responsive chart sizing
    const contentRef = useRef(null);
    const [chartDimensions, setChartDimensions] = useState({ width: 900, height: 500 });

    useEffect(() => {
        if (!contentRef.current) return;

        const updateDimensions = () => {
            if (contentRef.current) {
                const { clientWidth, clientHeight } = contentRef.current;
                // Subtract padding
                setChartDimensions({
                    width: clientWidth - 16, // p-2 padding (8px * 2)
                    height: clientHeight - 16
                });
            }
        };

        // Initial measurement
        updateDimensions();

        const observer = new ResizeObserver(updateDimensions);
        observer.observe(contentRef.current);

        return () => observer.disconnect();
    }, [activeView, loading, error]);



    // Toggle a view on/off
    const toggleView = (viewName) => {
        setEnabledViews(prev => ({ ...prev, [viewName]: !prev[viewName] }));
    };

    // Use correct Redux selectors for symbol and expiry
    const symbol = useSelector(selectSelectedSymbol);
    const expiry = useSelector(selectSelectedExpiry);

    // Sync selectedField when propField changes (e.g. clicking different cell)
    useEffect(() => {
        if (open && propField) {
            const norm = getNormalizedField(propField);
            if (norm !== selectedField) setSelectedField(norm);
        }
    }, [propField, isOpen]);

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (activeView !== 'strike') return;

            const fields = ['oi', 'oi_change', 'volume', 'iv', 'ltp', 'delta', 'theta', 'gamma', 'vega'];
            const currentIndex = fields.indexOf(selectedField);

            if (e.key === 'ArrowRight') {
                const nextIndex = (currentIndex + 1) % fields.length;
                setSelectedField(fields[nextIndex]);
            } else if (e.key === 'ArrowLeft') {
                const prevIndex = (currentIndex - 1 + fields.length) % fields.length;
                setSelectedField(fields[prevIndex]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, activeView, selectedField]);

    // Fetch multi-view time-series data for strike view
    const fetchStrikeData = useCallback(async () => {
        console.log('[CellDetailModal] fetchStrikeData (multi-view) called with:', { symbol, strike, side, selectedField });

        if (!symbol || !strike) {
            console.warn('[CellDetailModal] Missing required params:', { symbol, strike });
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('[CellDetailModal] Calling analyticsService.getMultiViewTimeSeries...');
            const data = await analyticsService.getMultiViewTimeSeries({
                symbol,
                strike: parseFloat(strike),
                expiry,
                field: selectedField,
                interval: '5m',
            });
            console.log('[CellDetailModal] Multi-view API response:', data);
            setTimeSeriesData(data);
            setLoading(false);
        } catch (err) {
            console.error('[CellDetailModal] Failed to fetch multi-view time-series:', err);
            setError(err.message || 'Failed to load data');
            setLoading(false);
        }
    }, [symbol, strike, selectedField, expiry]);

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

    // Fetch logic - Purely Declarative
    // Trigger fetch whenever dependencies change (Symbol, Strike, Expiry, Field, View)
    useEffect(() => {
        if (!isOpen || !cellData) return;

        let pollInterval;

        const performFetch = () => {
            if (activeView === 'strike') {
                // Only fetch if required params exist
                if (symbol && strike) fetchStrikeData();
            } else {
                fetchAggregateData(activeView);
            }
        };

        // Fetch immediately
        performFetch();

        // Poll every 60s
        pollInterval = setInterval(performFetch, 60000);

        return () => clearInterval(pollInterval);

    }, [isOpen, activeView, symbol, strike, expiry, selectedField, fetchStrikeData, fetchAggregateData]); // cellData removed to avoid deep obj trigger, specific props used

    // Keep fetch functions in ref or dependency array? 
    // fetchStrikeData and fetchAggregateData are memoized via useCallback with dependencies.
    // To safe, we include them in the effect dependencies if we were defining effect strictly.
    // However, including them might cause re-triggers if they change. 
    // Since they depend on state that might change (symbol, strike), it's correct to re-setup interval if those change.

    if (!isOpen || !cellData) return null;

    const sideLabel = side === 'ce' ? 'Call' : 'Put';
    const _sideColor = side === 'ce' ? 'text-green-600' : 'text-red-600';
    const _sideBg = side === 'ce' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30';

    const fieldLabels = {
        oi: 'Open Interest',
        oi_change: 'OI Change',
        ltp: 'Last Traded Price',
        iv: 'Implied Volatility',
        volume: 'Volume',
        delta: 'Delta',
        theta: 'Theta',
        gamma: 'Gamma',
        vega: 'Vega',
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
                    <div className="h-full flex flex-col gap-4">
                        {/* View Toggles - Clean, modern toggle row */}
                        <div className="flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                {[
                                    { key: 'ce', label: 'CE', color: 'bg-green-500', hoverColor: 'hover:bg-green-600' },
                                    { key: 'pe', label: 'PE', color: 'bg-red-500', hoverColor: 'hover:bg-red-600' },
                                    { key: 'ce_minus_pe', label: 'CE−PE', color: 'bg-blue-500', hoverColor: 'hover:bg-blue-600' },
                                    { key: 'pe_minus_ce', label: 'PE−CE', color: 'bg-purple-500', hoverColor: 'hover:bg-purple-600' },
                                    { key: 'ce_div_pe', label: 'CE÷PE', color: 'bg-orange-500', hoverColor: 'hover:bg-orange-600' },
                                    { key: 'pe_div_ce', label: 'PE÷CE', color: 'bg-pink-500', hoverColor: 'hover:bg-pink-600' },
                                ].map(({ key, label, color, hoverColor }) => (
                                    <button
                                        key={key}
                                        onClick={() => toggleView(key)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${enabledViews[key]
                                            ? `${color} text-white shadow-md transform scale-105`
                                            : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={fetchStrikeData}
                                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                title="Refresh Data"
                            >
                                <ArrowPathIcon className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Professional Multi-Series Chart - Responsive Wrapper */}
                        <div className="flex-1 min-h-0 relative" ref={contentRef}>
                            <MultiSeriesChart
                                views={timeSeriesData?.views || {}}
                                enabledViews={enabledViews}
                                width={chartDimensions.width}
                                height={chartDimensions.height}
                                field={fieldLabels[selectedField] || selectedField}
                                strike={strike}
                            />
                        </div>
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



    return createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal - Fixed Center, Full Viewport Max */}
            <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
                <div className="relative w-[90vw] h-[85vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all overflow-hidden flex flex-col pointer-events-auto border border-gray-200 dark:border-gray-700">
                    {/* Header with Tabs and Close Button */}
                    <div className="flex flex-col border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        {/* Status Bar / Identifiers */}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900/50">
                            <div className="flex items-center gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-700 dark:text-gray-200">{symbol}</span>
                                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{new Date(expiry * 1000).toLocaleDateString()}</span>
                                </div>
                                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-blue-600 dark:text-blue-400">{strike}</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${side === 'ce' ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : 'text-red-600 bg-red-100 dark:bg-red-900/30'}`}>
                                        {side?.toUpperCase()}
                                    </span>
                                </div>
                                {activeView === 'strike' && (
                                    <>
                                        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 dark:text-gray-400">Field:</span>
                                            <span className="font-semibold text-gray-800 dark:text-gray-100">{fieldLabels[selectedField]}</span>
                                            <span className="text-[10px] text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1 ml-1">Use Left/Right keys</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5 text-gray-500 hover:text-red-500 transition-colors" />
                            </button>
                        </div>

                        {/* View Selector Tabs */}
                        <div className="flex items-center justify-between px-2">
                            <div className="flex overflow-x-auto">
                                {VIEW_TABS.map((tab) => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveView(tab.id)}
                                            className={`px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeView === tab.id
                                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                                }`}
                                            title={tab.description}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Content - Flex container for responsive chart */}
                    <div className="flex-1 min-h-0 flex flex-col p-4 relative">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>,
        document.body
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

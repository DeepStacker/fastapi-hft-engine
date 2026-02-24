import { memo, useState, useRef, useCallback, useMemo } from 'react';

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

export default MultiSeriesChart;

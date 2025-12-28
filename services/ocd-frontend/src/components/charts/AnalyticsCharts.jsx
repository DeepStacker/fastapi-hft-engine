/**
 * Premium Chart Components for Analytics
 * SVG-based visualizations with animations and interactions
 */
import { memo, useState } from 'react';
import PropTypes from 'prop-types';

// ============== Color Palettes ==============
const colors = {
    ce: { primary: '#10B981', light: '#D1FAE5', dark: '#065F46' },
    pe: { primary: '#EF4444', light: '#FEE2E2', dark: '#991B1B' },
    blue: { primary: '#3B82F6', light: '#DBEAFE', dark: '#1E40AF' },
    purple: { primary: '#8B5CF6', light: '#EDE9FE', dark: '#5B21B6' },
    amber: { primary: '#F59E0B', light: '#FEF3C7', dark: '#B45309' },
    gray: { primary: '#6B7280', light: '#F3F4F6', dark: '#374151' },
};

// ============== OI Distribution Bar Chart ==============
export const OIBarChart = memo(({ data, height = 400 }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    
    if (!data || data.length === 0) return null;

    const maxOI = Math.max(...data.map(d => Math.max(d.ce_oi || 0, d.pe_oi || 0)));
    const barHeight = Math.min(20, (height - 60) / data.length);
    const chartWidth = 600;
    const midPoint = chartWidth / 2;

    return (
        <div className="relative">
            <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`} className="select-none">
                {/* Background gradient */}
                <defs>
                    <linearGradient id="ceGradient" x1="100%" y1="0%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor={colors.ce.primary} stopOpacity="1" />
                        <stop offset="100%" stopColor={colors.ce.primary} stopOpacity="0.3" />
                    </linearGradient>
                    <linearGradient id="peGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={colors.pe.primary} stopOpacity="1" />
                        <stop offset="100%" stopColor={colors.pe.primary} stopOpacity="0.3" />
                    </linearGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Center line */}
                <line x1={midPoint} y1="30" x2={midPoint} y2={height - 30} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />

                {/* Headers */}
                <text x={midPoint - 100} y="20" className="fill-green-600 text-xs font-bold">CALLS (CE)</text>
                <text x={midPoint + 40} y="20" className="fill-red-600 text-xs font-bold">PUTS (PE)</text>

                {/* Bars */}
                {data.map((item, i) => {
                    const y = 40 + i * (barHeight + 4);
                    const ceWidth = maxOI ? (item.ce_oi / maxOI) * (midPoint - 60) : 0;
                    const peWidth = maxOI ? (item.pe_oi / maxOI) * (midPoint - 60) : 0;
                    const isHovered = hoveredIndex === i;

                    return (
                        <g 
                            key={i} 
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* CE Bar */}
                            <rect
                                x={midPoint - ceWidth - 30}
                                y={y}
                                width={ceWidth}
                                height={barHeight}
                                fill="url(#ceGradient)"
                                rx="3"
                                className={`transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-80'}`}
                                filter={isHovered ? 'url(#glow)' : ''}
                            />

                            {/* Strike Label */}
                            <rect
                                x={midPoint - 28}
                                y={y}
                                width="56"
                                height={barHeight}
                                fill={isHovered ? '#3B82F6' : '#F3F4F6'}
                                rx="3"
                                className="transition-colors duration-200"
                            />
                            <text
                                x={midPoint}
                                y={y + barHeight / 2 + 4}
                                textAnchor="middle"
                                className={`text-[10px] font-bold ${isHovered ? 'fill-white' : 'fill-gray-700'}`}
                            >
                                {item.strike}
                            </text>

                            {/* PE Bar */}
                            <rect
                                x={midPoint + 30}
                                y={y}
                                width={peWidth}
                                height={barHeight}
                                fill="url(#peGradient)"
                                rx="3"
                                className={`transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-80'}`}
                                filter={isHovered ? 'url(#glow)' : ''}
                            />

                            {/* OI Labels on hover */}
                            {isHovered && (
                                <>
                                    <text x={midPoint - ceWidth - 35} y={y + barHeight / 2 + 4} textAnchor="end" className="fill-green-700 text-[9px] font-medium">
                                        {(item.ce_oi / 1000).toFixed(0)}K
                                    </text>
                                    <text x={midPoint + peWidth + 35} y={y + barHeight / 2 + 4} textAnchor="start" className="fill-red-700 text-[9px] font-medium">
                                        {(item.pe_oi / 1000).toFixed(0)}K
                                    </text>
                                </>
                            )}
                        </g>
                    );
                })}

                {/* Legend */}
                <g transform={`translate(${chartWidth / 2 - 80}, ${height - 20})`}>
                    <rect x="0" y="0" width="12" height="12" fill={colors.ce.primary} rx="2" />
                    <text x="16" y="10" className="fill-gray-600 text-[10px]">CE OI</text>
                    <rect x="80" y="0" width="12" height="12" fill={colors.pe.primary} rx="2" />
                    <text x="96" y="10" className="fill-gray-600 text-[10px]">PE OI</text>
                </g>
            </svg>

            {/* Tooltip */}
            {hoveredIndex !== null && data[hoveredIndex] && (
                <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs z-10">
                    <div className="font-bold text-gray-900 dark:text-white mb-1">Strike {data[hoveredIndex].strike}</div>
                    <div className="text-green-600">CE: {data[hoveredIndex].ce_oi?.toLocaleString()}</div>
                    <div className="text-red-600">PE: {data[hoveredIndex].pe_oi?.toLocaleString()}</div>
                    <div className="text-blue-600 mt-1">PCR: {data[hoveredIndex].pcr?.toFixed(2)}</div>
                </div>
            )}
        </div>
    );
});

OIBarChart.displayName = 'OIBarChart';
OIBarChart.propTypes = { data: PropTypes.array, height: PropTypes.number };

// ============== IV Smile/Skew Curve ==============
export const IVCurveChart = memo(({ data, atmStrike, height = 250 }) => {
    const [hoveredPoint, setHoveredPoint] = useState(null);

    if (!data || data.length === 0) return null;

    const width = 600;
    const padding = { top: 30, right: 40, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const strikes = data.map(d => d.strike);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);
    const ivs = data.flatMap(d => [d.ce_iv, d.pe_iv]).filter(Boolean);
    const minIV = Math.min(...ivs) * 0.9;
    const maxIV = Math.max(...ivs) * 1.1;

    const xScale = (strike) => padding.left + ((strike - minStrike) / (maxStrike - minStrike)) * chartWidth;
    const yScale = (iv) => padding.top + ((maxIV - iv) / (maxIV - minIV)) * chartHeight;

    const cePoints = data.filter(d => d.ce_iv).map(d => `${xScale(d.strike)},${yScale(d.ce_iv)}`).join(' ');
    const pePoints = data.filter(d => d.pe_iv).map(d => `${xScale(d.strike)},${yScale(d.pe_iv)}`).join(' ');

    return (
        <div className="relative">
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="select-none">
                <defs>
                    <linearGradient id="ceLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={colors.ce.primary} />
                        <stop offset="100%" stopColor={colors.ce.dark} />
                    </linearGradient>
                    <linearGradient id="peLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={colors.pe.primary} />
                        <stop offset="100%" stopColor={colors.pe.dark} />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                    <line
                        key={i}
                        x1={padding.left}
                        y1={padding.top + t * chartHeight}
                        x2={width - padding.right}
                        y2={padding.top + t * chartHeight}
                        stroke="#E5E7EB"
                        strokeDasharray="2"
                    />
                ))}

                {/* ATM vertical line */}
                {atmStrike && (
                    <>
                        <line
                            x1={xScale(atmStrike)}
                            y1={padding.top}
                            x2={xScale(atmStrike)}
                            y2={height - padding.bottom}
                            stroke="#3B82F6"
                            strokeWidth="2"
                            strokeDasharray="4"
                        />
                        <text x={xScale(atmStrike)} y={height - 10} textAnchor="middle" className="fill-blue-600 text-[10px] font-bold">
                            ATM
                        </text>
                    </>
                )}

                {/* CE IV Curve */}
                <polyline
                    points={cePoints}
                    fill="none"
                    stroke="url(#ceLineGrad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* PE IV Curve */}
                <polyline
                    points={pePoints}
                    fill="none"
                    stroke="url(#peLineGrad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data points */}
                {data.map((d, i) => (
                    <g key={i} onMouseEnter={() => setHoveredPoint(d)} onMouseLeave={() => setHoveredPoint(null)}>
                        {d.ce_iv && (
                            <circle
                                cx={xScale(d.strike)}
                                cy={yScale(d.ce_iv)}
                                r={hoveredPoint?.strike === d.strike ? 6 : 4}
                                fill={colors.ce.primary}
                                stroke="white"
                                strokeWidth="2"
                                className="cursor-pointer transition-all"
                            />
                        )}
                        {d.pe_iv && (
                            <circle
                                cx={xScale(d.strike)}
                                cy={yScale(d.pe_iv)}
                                r={hoveredPoint?.strike === d.strike ? 6 : 4}
                                fill={colors.pe.primary}
                                stroke="white"
                                strokeWidth="2"
                                className="cursor-pointer transition-all"
                            />
                        )}
                    </g>
                ))}

                {/* Y Axis labels */}
                <text x={padding.left - 5} y={padding.top + 5} textAnchor="end" className="fill-gray-500 text-[10px]">{maxIV.toFixed(0)}%</text>
                <text x={padding.left - 5} y={height - padding.bottom} textAnchor="end" className="fill-gray-500 text-[10px]">{minIV.toFixed(0)}%</text>

                {/* Axis labels */}
                <text x={width / 2} y={height - 5} textAnchor="middle" className="fill-gray-500 text-[11px]">Strike Price</text>
                <text x="10" y={height / 2} textAnchor="middle" transform={`rotate(-90, 10, ${height / 2})`} className="fill-gray-500 text-[11px]">IV %</text>

                {/* Legend */}
                <g transform={`translate(${width - 120}, 10)`}>
                    <line x1="0" y1="6" x2="20" y2="6" stroke={colors.ce.primary} strokeWidth="3" />
                    <text x="25" y="10" className="fill-gray-600 text-[10px]">CE IV</text>
                    <line x1="60" y1="6" x2="80" y2="6" stroke={colors.pe.primary} strokeWidth="3" />
                    <text x="85" y="10" className="fill-gray-600 text-[10px]">PE IV</text>
                </g>
            </svg>

            {/* Tooltip */}
            {hoveredPoint && (
                <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 shadow-xl rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs z-10">
                    <div className="font-bold text-gray-900 dark:text-white mb-1">Strike {hoveredPoint.strike}</div>
                    <div className="text-green-600">CE IV: {hoveredPoint.ce_iv?.toFixed(2)}%</div>
                    <div className="text-red-600">PE IV: {hoveredPoint.pe_iv?.toFixed(2)}%</div>
                </div>
            )}
        </div>
    );
});

IVCurveChart.displayName = 'IVCurveChart';
IVCurveChart.propTypes = { data: PropTypes.array, atmStrike: PropTypes.number, height: PropTypes.number };

// ============== Gauge Component ==============
export const GaugeChart = memo(({ value, min = 0, max = 100, label, color = 'blue', size = 150 }) => {
    const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const angle = percentage * 180 - 90; // -90 to 90 degrees
    const radius = size / 2 - 15;

    const needleX = size / 2 + radius * 0.7 * Math.cos((angle * Math.PI) / 180);
    const needleY = size / 2 + radius * 0.7 * Math.sin((angle * Math.PI) / 180);

    const arcPath = (startAngle, endAngle, r) => {
        const start = {
            x: size / 2 + r * Math.cos((startAngle * Math.PI) / 180),
            y: size / 2 + r * Math.sin((startAngle * Math.PI) / 180),
        };
        const end = {
            x: size / 2 + r * Math.cos((endAngle * Math.PI) / 180),
            y: size / 2 + r * Math.sin((endAngle * Math.PI) / 180),
        };
        const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
        return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
    };

    const colorMap = {
        blue: colors.blue,
        green: colors.ce,
        red: colors.pe,
        purple: colors.purple,
        amber: colors.amber,
    };
    const c = colorMap[color] || colorMap.blue;

    return (
        <div className="flex flex-col items-center">
            <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
                {/* Background arc */}
                <path
                    d={arcPath(-180, 0, radius)}
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="12"
                    strokeLinecap="round"
                />
                
                {/* Value arc */}
                <path
                    d={arcPath(-180, -180 + percentage * 180, radius)}
                    fill="none"
                    stroke={c.primary}
                    strokeWidth="12"
                    strokeLinecap="round"
                    className="transition-all duration-500"
                />

                {/* Needle */}
                <line
                    x1={size / 2}
                    y1={size / 2}
                    x2={needleX}
                    y2={needleY}
                    stroke={c.dark}
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="transition-all duration-300"
                />
                <circle cx={size / 2} cy={size / 2} r="6" fill={c.dark} />

                {/* Min/Max labels */}
                <text x="15" y={size / 2 + 15} className="fill-gray-400 text-[10px]">{min}</text>
                <text x={size - 20} y={size / 2 + 15} className="fill-gray-400 text-[10px]">{max}</text>
            </svg>
            <div className="text-center -mt-2">
                <div className={`text-2xl font-bold`} style={{ color: c.primary }}>{value?.toFixed(2)}</div>
                <div className="text-xs text-gray-500">{label}</div>
            </div>
        </div>
    );
});

GaugeChart.displayName = 'GaugeChart';
GaugeChart.propTypes = { value: PropTypes.number, min: PropTypes.number, max: PropTypes.number, label: PropTypes.string, color: PropTypes.string, size: PropTypes.number };

// ============== Stat Card ==============
export const StatCard = memo(({ title, value, change, icon, color = 'blue', size = 'md' }) => {
    const isPositive = change >= 0;
    const sizes = {
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5',
    };
    const colorMap = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-green-500 to-green-600',
        red: 'from-red-500 to-red-600',
        purple: 'from-purple-500 to-purple-600',
        amber: 'from-amber-500 to-amber-600',
    };

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colorMap[color]} text-white ${sizes[size]} shadow-lg`}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                    {icon && <span className="text-white/80">{icon}</span>}
                    <span className="text-xs font-medium text-white/80 uppercase tracking-wide">{title}</span>
                </div>
                <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
                {change !== undefined && (
                    <div className={`text-xs mt-1 ${isPositive ? 'text-green-200' : 'text-red-200'}`}>
                        {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                    </div>
                )}
            </div>
        </div>
    );
});

StatCard.displayName = 'StatCard';
StatCard.propTypes = { title: PropTypes.string, value: PropTypes.any, change: PropTypes.number, icon: PropTypes.node, color: PropTypes.string, size: PropTypes.string };

// ============== Mini Sparkline ==============
export const Sparkline = memo(({ data, width = 100, height = 30, color = 'blue' }) => {
    if (!data || data.length < 2) return null;

    const values = data.map(d => typeof d === 'number' ? d : d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    const isPositive = values[values.length - 1] >= values[0];
    const colorMap = { blue: '#3B82F6', green: '#10B981', red: '#EF4444' };
    const lineColor = color === 'auto' ? (isPositive ? colorMap.green : colorMap.red) : colorMap[color] || colorMap.blue;

    return (
        <svg width={width} height={height}>
            <polyline
                points={points}
                fill="none"
                stroke={lineColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle
                cx={width}
                cy={height - ((values[values.length - 1] - min) / range) * (height - 4) - 2}
                r="3"
                fill={lineColor}
            />
        </svg>
    );
});

Sparkline.displayName = 'Sparkline';
Sparkline.propTypes = { data: PropTypes.array, width: PropTypes.number, height: PropTypes.number, color: PropTypes.string };

// ============== Loading Skeleton ==============
export const ChartSkeleton = memo(({ height = 200 }) => (
    <div className="animate-pulse" style={{ height }}>
        <div className="h-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-xl" />
    </div>
));

ChartSkeleton.displayName = 'ChartSkeleton';
ChartSkeleton.propTypes = { height: PropTypes.number };

// ============== Greeks Heatmap ==============
export const GreeksHeatmap = memo(({ data, height = 300 }) => {
    if (!data || data.length === 0) return null;

    const greeksList = ['delta', 'gamma', 'theta', 'vega'];
    const cellSize = 40;
    const labelWidth = 70;
    const width = labelWidth + data.length * cellSize;

    const getColorIntensity = (value, greek) => {
        if (value === null || value === undefined) return '#F3F4F6';
        
        const absVal = Math.abs(value);
        let intensity = 0;
        
        // Normalize based on typical ranges
        const ranges = { delta: 1, gamma: 0.01, theta: 50, vega: 100 };
        intensity = Math.min(absVal / (ranges[greek] || 1), 1);
        
        if (greek === 'theta') {
            // Theta is usually negative - red for decay
            return `rgba(239, 68, 68, ${intensity})`;
        } else if (value >= 0) {
            return `rgba(16, 185, 129, ${intensity})`;
        } else {
            return `rgba(239, 68, 68, ${intensity})`;
        }
    };

    return (
        <div className="overflow-x-auto">
            <svg width={width} height={height} className="select-none">
                {/* Headers - Strikes */}
                {data.map((d, i) => (
                    <text
                        key={`header-${i}`}
                        x={labelWidth + i * cellSize + cellSize / 2}
                        y={25}
                        textAnchor="middle"
                        className="fill-gray-600 dark:fill-gray-400 text-[9px] font-medium"
                        transform={`rotate(-45, ${labelWidth + i * cellSize + cellSize / 2}, 25)`}
                    >
                        {d.strike}
                    </text>
                ))}

                {/* Rows */}
                {greeksList.map((greek, rowIdx) => (
                    <g key={greek}>
                        {/* Row label */}
                        <text
                            x={labelWidth - 8}
                            y={50 + rowIdx * cellSize + cellSize / 2 + 4}
                            textAnchor="end"
                            className="fill-gray-700 dark:fill-gray-300 text-xs font-semibold capitalize"
                        >
                            {greek}
                        </text>

                        {/* Cells */}
                        {data.map((d, colIdx) => {
                            const ceValue = d.ce?.[greek];
                            const peValue = d.pe?.[greek];
                            const avgValue = ceValue !== undefined && peValue !== undefined 
                                ? (ceValue + peValue) / 2 
                                : ceValue || peValue;

                            return (
                                <g key={`cell-${rowIdx}-${colIdx}`}>
                                    <rect
                                        x={labelWidth + colIdx * cellSize + 2}
                                        y={50 + rowIdx * cellSize + 2}
                                        width={cellSize - 4}
                                        height={cellSize - 4}
                                        rx="4"
                                        fill={getColorIntensity(avgValue, greek)}
                                        className="transition-colors duration-300"
                                    />
                                    <text
                                        x={labelWidth + colIdx * cellSize + cellSize / 2}
                                        y={50 + rowIdx * cellSize + cellSize / 2 + 4}
                                        textAnchor="middle"
                                        className="fill-gray-800 dark:fill-gray-200 text-[8px]"
                                    >
                                        {avgValue?.toFixed(3) || '—'}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                ))}

                {/* Legend */}
                <g transform={`translate(${labelWidth}, ${50 + greeksList.length * cellSize + 20})`}>
                    <text x="0" y="0" className="fill-gray-500 text-[10px]">Low</text>
                    <rect x="25" y="-10" width="20" height="12" fill="rgba(16, 185, 129, 0.2)" rx="2" />
                    <rect x="50" y="-10" width="20" height="12" fill="rgba(16, 185, 129, 0.5)" rx="2" />
                    <rect x="75" y="-10" width="20" height="12" fill="rgba(16, 185, 129, 0.8)" rx="2" />
                    <text x="105" y="0" className="fill-gray-500 text-[10px]">High</text>
                </g>
            </svg>
        </div>
    );
});

GreeksHeatmap.displayName = 'GreeksHeatmap';
GreeksHeatmap.propTypes = { data: PropTypes.array, height: PropTypes.number };

// ============== Volume Profile Chart ==============
export const VolumeProfile = memo(({ data, height = 200 }) => {
    if (!data || data.length === 0) return null;

    const maxVolume = Math.max(...data.map(d => (d.ce_volume || 0) + (d.pe_volume || 0)));
    const width = 400;
    const barHeight = Math.min(16, (height - 40) / data.length);

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="select-none">
            <defs>
                <linearGradient id="volGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="1" />
                </linearGradient>
            </defs>

            {data.map((d, i) => {
                const y = 20 + i * (barHeight + 2);
                const totalVol = (d.ce_volume || 0) + (d.pe_volume || 0);
                const barWidth = maxVolume ? (totalVol / maxVolume) * (width - 80) : 0;

                return (
                    <g key={i}>
                        <text x="5" y={y + barHeight / 2 + 3} className="fill-gray-500 text-[9px]">
                            {d.strike}
                        </text>
                        <rect
                            x="45"
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill="url(#volGradient)"
                            rx="2"
                            className="hover:opacity-80 transition-opacity"
                        />
                        <text
                            x={50 + barWidth}
                            y={y + barHeight / 2 + 3}
                            className="fill-gray-600 dark:fill-gray-400 text-[8px]"
                        >
                            {(totalVol / 1000).toFixed(0)}K
                        </text>
                    </g>
                );
            })}
        </svg>
    );
});

VolumeProfile.displayName = 'VolumeProfile';
VolumeProfile.propTypes = { data: PropTypes.array, height: PropTypes.number };

// ============== Futures Spread Chart ==============
export const FuturesSpreadChart = memo(({ contracts, spotPrice, height = 180 }) => {
    if (!contracts || contracts.length === 0) return null;

    const width = 400;
    const padding = { left: 50, right: 30, top: 20, bottom: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const prices = contracts.map(c => c.ltp);
    const minPrice = Math.min(spotPrice, ...prices) * 0.998;
    const maxPrice = Math.max(spotPrice, ...prices) * 1.002;
    const range = maxPrice - minPrice;

    const yScale = (price) => padding.top + ((maxPrice - price) / range) * chartHeight;

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="select-none">
            {/* Spot price line */}
            <line
                x1={padding.left}
                y1={yScale(spotPrice)}
                x2={width - padding.right}
                y2={yScale(spotPrice)}
                stroke="#3B82F6"
                strokeWidth="2"
                strokeDasharray="4"
            />
            <text x={padding.left - 5} y={yScale(spotPrice) + 4} textAnchor="end" className="fill-blue-600 text-[9px] font-bold">
                Spot
            </text>

            {/* Futures prices */}
            {contracts.map((c, i) => {
                const x = padding.left + ((i + 1) / (contracts.length + 1)) * chartWidth;
                const y = yScale(c.ltp);
                const premium = c.ltp - spotPrice;
                const isPremium = premium >= 0;

                return (
                    <g key={i}>
                        {/* Vertical line from spot to future */}
                        <line
                            x1={x}
                            y1={yScale(spotPrice)}
                            x2={x}
                            y2={y}
                            stroke={isPremium ? '#10B981' : '#EF4444'}
                            strokeWidth="2"
                        />
                        
                        {/* Future price dot */}
                        <circle
                            cx={x}
                            cy={y}
                            r="6"
                            fill={isPremium ? '#10B981' : '#EF4444'}
                            stroke="white"
                            strokeWidth="2"
                        />

                        {/* Labels */}
                        <text x={x} y={height - 10} textAnchor="middle" className="fill-gray-600 text-[9px]">
                            {c.days_to_expiry}d
                        </text>
                        <text x={x} y={y - 12} textAnchor="middle" className={`text-[9px] font-bold ${isPremium ? 'fill-green-600' : 'fill-red-600'}`}>
                            {isPremium ? '+' : ''}{premium.toFixed(1)}
                        </text>
                    </g>
                );
            })}

            {/* Y axis labels */}
            <text x={padding.left - 5} y={padding.top + 5} textAnchor="end" className="fill-gray-400 text-[8px]">
                {maxPrice.toFixed(0)}
            </text>
            <text x={padding.left - 5} y={height - padding.bottom} textAnchor="end" className="fill-gray-400 text-[8px]">
                {minPrice.toFixed(0)}
            </text>
        </svg>
    );
});

FuturesSpreadChart.displayName = 'FuturesSpreadChart';
FuturesSpreadChart.propTypes = { contracts: PropTypes.array, spotPrice: PropTypes.number, height: PropTypes.number };

// ============== Real-time Pulse Indicator ==============
export const PulseIndicator = memo(({ isLive = true, lastUpdate }) => {
    const timeAgo = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : null;
    
    return (
        <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
                {isLive && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isLive ? 'bg-green-500' : 'bg-gray-400'}`} />
            </span>
            <span className={`text-xs ${isLive ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                {isLive ? 'Live' : 'Offline'}
                {timeAgo !== null && ` • ${timeAgo}s ago`}
            </span>
        </div>
    );
});

PulseIndicator.displayName = 'PulseIndicator';
PulseIndicator.propTypes = { isLive: PropTypes.bool, lastUpdate: PropTypes.instanceOf(Date) };

// ============== Trend Badge ==============
export const TrendBadge = memo(({ value, threshold = 0 }) => {
    const isPositive = value > threshold;
    const isNeutral = Math.abs(value - threshold) < 0.01;

    if (isNeutral) {
        return (
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium">
                Neutral
            </span>
        );
    }

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
            isPositive 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        }`}>
            {isPositive ? '▲' : '▼'}
            {Math.abs(value).toFixed(2)}
        </span>
    );
});

TrendBadge.displayName = 'TrendBadge';
TrendBadge.propTypes = { value: PropTypes.number, threshold: PropTypes.number };

// ============== Mini Donut Chart ==============
export const MiniDonut = memo(({ value, max = 100, size = 60, color = 'blue', label }) => {
    const percentage = Math.min(Math.max(value / max, 0), 1);
    const radius = (size - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - percentage);

    const colorMap = {
        blue: '#3B82F6',
        green: '#10B981',
        red: '#EF4444',
        purple: '#8B5CF6',
        amber: '#F59E0B',
    };

    return (
        <div className="flex flex-col items-center">
            <svg width={size} height={size} className="-rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="6"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={colorMap[color] || colorMap.blue}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500"
                />
            </svg>
            <div className="text-center -mt-9">
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    {(percentage * 100).toFixed(0)}%
                </div>
            </div>
            {label && <div className="text-[10px] text-gray-500 mt-1">{label}</div>}
        </div>
    );
});

MiniDonut.displayName = 'MiniDonut';
MiniDonut.propTypes = { value: PropTypes.number, max: PropTypes.number, size: PropTypes.number, color: PropTypes.string, label: PropTypes.string };

export default { 
    OIBarChart, 
    IVCurveChart, 
    GaugeChart, 
    StatCard, 
    Sparkline, 
    ChartSkeleton,
    GreeksHeatmap,
    VolumeProfile,
    FuturesSpreadChart,
    PulseIndicator,
    TrendBadge,
    MiniDonut
};

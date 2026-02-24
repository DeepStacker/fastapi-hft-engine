import { memo } from 'react';

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

export default MiniLineChart;

import { memo } from 'react';

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
        </svg>
    );
});

PCRChart.displayName = 'PCRChart';

export default PCRChart;

import { memo } from 'react';

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

export default AggregateBarChart;

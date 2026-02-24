import { memo } from 'react';

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

export default ComparisonLineChart;

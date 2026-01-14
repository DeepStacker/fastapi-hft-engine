/**
 * Payoff Surface Component
 * Interactive heat map visualization of P&L across time × price
 */
import { useMemo, useState } from 'react';

const PayoffSurface = ({
    surfaceData,
    spotPrice,
    isLoading = false
}) => {
    const [hoveredCell, setHoveredCell] = useState(null);
    const [viewMode, setViewMode] = useState('heatmap'); // 'heatmap' or 'contour'

    // Calculate color scale
    const colorScale = useMemo(() => {
        if (!surfaceData?.payoff_matrix) return { min: 0, max: 0 };

        const allValues = surfaceData.payoff_matrix.flat();
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);

        return { min, max, range: max - min || 1 };
    }, [surfaceData]);

    // Get color for P&L value
    const getColor = (value) => {
        if (value >= 0) {
            // Profit: green gradient
            const intensity = Math.min(1, value / (colorScale.max || 1));
            return `rgba(16, 185, 129, ${0.2 + intensity * 0.8})`;
        } else {
            // Loss: red gradient
            const intensity = Math.min(1, Math.abs(value) / Math.abs(colorScale.min || 1));
            return `rgba(239, 68, 68, ${0.2 + intensity * 0.8})`;
        }
    };

    // Find breakeven contours
    const breakevenCells = useMemo(() => {
        if (!surfaceData?.payoff_matrix) return [];

        const cells = [];
        const matrix = surfaceData.payoff_matrix;

        for (let i = 0; i < matrix.length; i++) {
            for (let j = 1; j < matrix[i].length; j++) {
                if ((matrix[i][j - 1] < 0 && matrix[i][j] >= 0) ||
                    (matrix[i][j - 1] >= 0 && matrix[i][j] < 0)) {
                    cells.push({ row: i, col: j });
                }
            }
        }

        return cells;
    }, [surfaceData]);

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
                <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-500">Generating payoff surface...</span>
                </div>
            </div>
        );
    }

    if (!surfaceData || !surfaceData.payoff_matrix) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400">
                Add legs and run simulation to see payoff surface
            </div>
        );
    }

    const { prices, days, payoff_matrix } = surfaceData;
    const cellWidth = 100 / prices.length;
    const cellHeight = 100 / days.length;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-sm">Payoff Surface</h3>
                    <p className="text-xs text-gray-500">P&L across time × price</p>
                </div>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                    <button
                        onClick={() => setViewMode('heatmap')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'heatmap'
                                ? 'bg-white dark:bg-gray-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Heat Map
                    </button>
                    <button
                        onClick={() => setViewMode('contour')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'contour'
                                ? 'bg-white dark:bg-gray-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Contour
                    </button>
                </div>
            </div>

            <div className="p-4">
                <div className="relative" style={{ paddingLeft: '60px', paddingBottom: '40px' }}>
                    {/* Y-axis label */}
                    <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-center text-xs font-medium text-gray-500"
                        style={{ width: '200px', marginLeft: '-85px' }}
                    >
                        Days Forward →
                    </div>

                    {/* Y-axis values */}
                    <div className="absolute left-8 top-0 bottom-10 flex flex-col justify-between text-[10px] text-gray-400">
                        {days.map((day, i) => (
                            <span key={i}>{day.toFixed(0)}d</span>
                        ))}
                    </div>

                    {/* Heat map grid */}
                    <div
                        className="relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                        style={{ height: '250px' }}
                        onMouseLeave={() => setHoveredCell(null)}
                    >
                        {payoff_matrix.map((row, rowIdx) => (
                            <div
                                key={rowIdx}
                                className="flex"
                                style={{ height: `${cellHeight}%` }}
                            >
                                {row.map((value, colIdx) => {
                                    const isBreakeven = breakevenCells.some(c => c.row === rowIdx && c.col === colIdx);
                                    const isSpotColumn = Math.abs(prices[colIdx] - spotPrice) ===
                                        Math.min(...prices.map(p => Math.abs(p - spotPrice)));

                                    return (
                                        <div
                                            key={colIdx}
                                            className={`relative transition-all duration-75 ${hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx
                                                    ? 'ring-2 ring-white ring-inset z-10'
                                                    : ''
                                                } ${isSpotColumn ? 'border-l border-r border-blue-400/50' : ''}`}
                                            style={{
                                                width: `${cellWidth}%`,
                                                backgroundColor: getColor(value)
                                            }}
                                            onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx, value })}
                                        >
                                            {viewMode === 'contour' && isBreakeven && (
                                                <div className="absolute inset-0 border-2 border-amber-400 rounded-sm" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        {/* Hover tooltip */}
                        {hoveredCell && (
                            <div
                                className="absolute bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-20"
                                style={{
                                    left: `${(hoveredCell.col / prices.length) * 100}%`,
                                    top: `${(hoveredCell.row / days.length) * 100}%`,
                                    transform: 'translate(-50%, -120%)'
                                }}
                            >
                                <div className="font-medium">
                                    ₹{hoveredCell.value >= 0 ? '+' : ''}{hoveredCell.value.toLocaleString()}
                                </div>
                                <div className="text-gray-400 text-[10px]">
                                    {days[hoveredCell.row]?.toFixed(1)}d @ ₹{prices[hoveredCell.col]?.toFixed(0)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* X-axis values */}
                    <div className="flex justify-between mt-2 text-[10px] text-gray-400 px-1">
                        {prices.filter((_, i) => i % Math.floor(prices.length / 5) === 0).map((price, i) => (
                            <span key={i}>₹{price.toFixed(0)}</span>
                        ))}
                    </div>

                    {/* X-axis label */}
                    <div className="text-center text-xs font-medium text-gray-500 mt-2">
                        Spot Price →
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-gradient-to-r from-red-500 to-red-300" />
                        <span className="text-xs text-gray-500">Loss: ₹{Math.abs(colorScale.min).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-600" />
                        <span className="text-xs text-gray-500">Breakeven</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-gradient-to-r from-green-300 to-green-500" />
                        <span className="text-xs text-gray-500">Profit: ₹{colorScale.max.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayoffSurface;

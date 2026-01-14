/**
 * Scenario Matrix Component
 * 2D grid showing P&L for spot × IV combinations
 */
import { useMemo } from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';

const ScenarioMatrix = ({
    matrixData,
    currentSpot,
    isLoading = false
}) => {
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    <div className="grid grid-cols-6 gap-1">
                        {Array(30).fill(0).map((_, i) => (
                            <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!matrixData?.matrix) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center text-gray-400 text-sm">
                Scenario matrix will appear here
            </div>
        );
    }

    const { matrix, spot_changes_pct, iv_changes_pct } = matrixData;

    // Find min/max P&L for color scaling
    const allPnL = matrix.flat().map(cell => cell.pnl);
    const minPnL = Math.min(...allPnL);
    const maxPnL = Math.max(...allPnL);
    const range = Math.max(Math.abs(minPnL), Math.abs(maxPnL));

    const getCellStyle = (pnl) => {
        if (pnl === 0) return 'bg-gray-200 dark:bg-gray-600';

        const intensity = Math.min(1, Math.abs(pnl) / range);

        if (pnl > 0) {
            // Green gradient
            const alpha = 0.2 + intensity * 0.6;
            return `bg-green-500/${Math.round(alpha * 100)}`;
        } else {
            // Red gradient
            const alpha = 0.2 + intensity * 0.6;
            return `bg-red-500/${Math.round(alpha * 100)}`;
        }
    };

    const getCellBgColor = (pnl) => {
        if (pnl === 0) return 'rgba(156, 163, 175, 0.3)';

        const intensity = Math.min(1, Math.abs(pnl) / (range || 1));

        if (pnl > 0) {
            return `rgba(34, 197, 94, ${0.2 + intensity * 0.5})`;
        } else {
            return `rgba(239, 68, 68, ${0.2 + intensity * 0.5})`;
        }
    };

    const formatPnL = (pnl) => {
        const abs = Math.abs(pnl);
        if (abs >= 100000) return `${pnl > 0 ? '+' : '-'}₹${(abs / 100000).toFixed(1)}L`;
        if (abs >= 1000) return `${pnl > 0 ? '+' : '-'}₹${(abs / 1000).toFixed(0)}K`;
        return `${pnl > 0 ? '+' : '-'}₹${abs.toFixed(0)}`;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Squares2X2Icon className="w-4 h-4 text-cyan-500" />
                    What-If Scenario Matrix
                </h3>
                <span className="text-[10px] text-gray-500">
                    Spot × IV Change
                </span>
            </div>

            {/* Matrix Grid */}
            <div className="p-4 overflow-x-auto">
                <div className="inline-block min-w-full">
                    {/* Header Row */}
                    <div className="flex">
                        <div className="w-16 flex-shrink-0"></div>
                        <div className="flex flex-1 border-b border-gray-200 dark:border-gray-600 pb-2 mb-2">
                            <div className="text-[10px] text-gray-500 font-medium text-center flex-1 mb-1">
                                ← Spot Price Change →
                            </div>
                        </div>
                    </div>

                    {/* Column Headers */}
                    <div className="flex">
                        <div className="w-16 flex-shrink-0"></div>
                        {spot_changes_pct.map((spotChg, i) => (
                            <div
                                key={i}
                                className={`flex-1 min-w-[60px] text-center text-[10px] font-medium py-1 ${spotChg === 0 ? 'text-blue-600' : spotChg > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}
                            >
                                {spotChg > 0 ? '+' : ''}{spotChg}%
                            </div>
                        ))}
                    </div>

                    {/* Matrix Rows */}
                    <div className="flex flex-col">
                        {matrix.map((row, rowIdx) => (
                            <div key={rowIdx} className="flex">
                                {/* IV Label */}
                                <div className={`w-16 flex-shrink-0 flex items-center justify-end pr-2 text-[10px] font-medium ${iv_changes_pct[rowIdx] === 0 ? 'text-blue-600' :
                                        iv_changes_pct[rowIdx] > 0 ? 'text-purple-600' : 'text-orange-600'
                                    }`}>
                                    IV {iv_changes_pct[rowIdx] > 0 ? '+' : ''}{iv_changes_pct[rowIdx]}%
                                </div>

                                {/* Cells */}
                                {row.map((cell, colIdx) => {
                                    const isCenter = spot_changes_pct[colIdx] === 0 && iv_changes_pct[rowIdx] === 0;
                                    return (
                                        <div
                                            key={colIdx}
                                            className={`flex-1 min-w-[60px] min-h-[36px] flex items-center justify-center text-[10px] font-medium border border-white/20 dark:border-black/20 cursor-default transition-transform hover:scale-105 hover:z-10 ${isCenter ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                                                }`}
                                            style={{ backgroundColor: getCellBgColor(cell.pnl) }}
                                            title={`Spot: ${spot_changes_pct[colIdx]}%, IV: ${iv_changes_pct[rowIdx]}%, P&L: ₹${cell.pnl.toLocaleString()}, Δ: ${cell.delta.toFixed(3)}`}
                                        >
                                            <span className={cell.pnl >= 0 ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}>
                                                {formatPnL(cell.pnl)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Y-axis label */}
                    <div className="flex mt-2">
                        <div className="w-16 flex-shrink-0 text-[10px] text-gray-500 text-right pr-2">
                            ↑ IV ↓
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex items-center justify-center gap-6 text-[10px]">
                <span className="flex items-center gap-1">
                    <span className="w-4 h-3 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.7)' }}></span>
                    High Loss
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-4 h-3 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.3)' }}></span>
                    Low Loss
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-4 h-3 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.3)' }}></span>
                    Low Profit
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-4 h-3 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.7)' }}></span>
                    High Profit
                </span>
            </div>
        </div>
    );
};

export default ScenarioMatrix;

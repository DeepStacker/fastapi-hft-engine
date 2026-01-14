/**
 * Price Slices Table Component
 * Shows P&L at specific price changes across different time horizons
 */
import { useMemo } from 'react';
import { TableCellsIcon } from '@heroicons/react/24/outline';

const PriceSlicesTable = ({
    slicesData,
    currentSpot,
    isLoading = false
}) => {
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!slicesData?.slices) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center text-gray-400 text-sm">
                Price slices will appear here
            </div>
        );
    }

    const { slices, time_columns, days_to_expiry } = slicesData;

    const getCellColor = (pnl) => {
        if (pnl > 0) return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
        if (pnl < 0) return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    };

    const formatPnL = (pnl) => {
        if (pnl >= 0) return `+₹${pnl.toLocaleString()}`;
        return `-₹${Math.abs(pnl).toLocaleString()}`;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <TableCellsIcon className="w-4 h-4 text-purple-500" />
                    Price Slices
                </h3>
                <span className="text-[10px] text-gray-500">
                    DTE: {days_to_expiry?.toFixed(0)} days
                </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="py-2 px-3 text-left font-medium text-gray-500">Spot Δ</th>
                            <th className="py-2 px-3 text-right font-medium text-gray-500">Price</th>
                            {time_columns?.map(col => (
                                <th key={col} className="py-2 px-3 text-right font-medium text-gray-500 min-w-[80px]">
                                    {col === 'today' ? 'Today' : col === 'expiry' ? 'Expiry' : col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {slices.map((slice, index) => {
                            const isCurrentPrice = slice.price_change_pct === 0;

                            return (
                                <tr
                                    key={index}
                                    className={`${isCurrentPrice ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                                >
                                    <td className={`py-2 px-3 font-medium ${slice.price_change_pct > 0 ? 'text-green-600' :
                                            slice.price_change_pct < 0 ? 'text-red-600' : 'text-blue-600'
                                        }`}>
                                        {slice.price_change_pct > 0 ? '+' : ''}{slice.price_change_pct}%
                                        {isCurrentPrice && <span className="ml-1 text-[9px] text-blue-400">(current)</span>}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium">
                                        ₹{slice.spot_price.toLocaleString()}
                                    </td>
                                    {time_columns?.map(col => {
                                        const pnl = slice.pnl_by_time[col];
                                        return (
                                            <td key={col} className="py-2 px-3 text-right">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getCellColor(pnl)}`}>
                                                    {formatPnL(pnl)}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex items-center justify-center gap-4 text-[10px]">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-green-500"></span>
                    Profit
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-red-500"></span>
                    Loss
                </span>
            </div>
        </div>
    );
};

export default PriceSlicesTable;

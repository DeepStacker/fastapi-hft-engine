import { useState, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import {
    ChartBarIcon,
    ArrowPathIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import Card from '../../common/Card';
import { analyticsService } from '../../../services/analyticsService';

/**
 * Chart Panel Component - Individual chart in the grid
 */
const ChartPanel = memo(({
    id,
    symbol,
    expiry,
    chartType,
    onChangeType,
    onRemove,
    isFullScreen = false
}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const chartTypes = [
        { id: 'trading_chart', label: 'Trading Chart', color: 'orange' },
        { id: 'coi', label: 'Change in OI', color: 'blue' },
        { id: 'oi', label: 'Open Interest', color: 'green' },
        { id: 'pcr', label: 'PCR', color: 'purple' },
        { id: 'distribution', label: 'OI Distribution', color: 'orange' },
    ];

    const fetchData = useCallback(async () => {
        if (!symbol || !expiry) return;

        setLoading(true);
        setError(null);

        try {
            let response;
            switch (chartType) {
                case 'coi':
                    response = await analyticsService.getAggregateCOI({ symbol, expiry });
                    break;
                case 'oi':
                    response = await analyticsService.getAggregateOI({ symbol, expiry });
                    break;
                case 'pcr':
                    response = await analyticsService.getAggregatePCR({ symbol, expiry });
                    break;
                case 'distribution':
                    response = await analyticsService.getOIDistribution({ symbol, expiry });
                    break;
                default:
                    response = await analyticsService.getAggregateCOI({ symbol, expiry });
            }
            setData(response);
        } catch (err) {
            console.error(`Failed to fetch ${chartType} data:`, err);
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [symbol, expiry, chartType]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Simple bar chart renderer
    const renderChart = () => {
        if (!data?.data || data.data.length === 0) {
            return (
                <div className="flex items-center justify-center h-full text-gray-400">
                    No data available
                </div>
            );
        }

        const displayData = data.data.slice(0, 15);
        const maxVal = Math.max(
            ...displayData.map(d => Math.abs(d.ce_coi || d.ce_oi || d.pcr_oi || 0)),
            ...displayData.map(d => Math.abs(d.pe_coi || d.pe_oi || 0)),
            1
        );

        return (
            <div className="flex flex-col h-full">
                {/* Mini bars */}
                <div className="flex-1 flex flex-col justify-center gap-1 px-2">
                    {displayData.map((item, i) => {
                        const ceVal = item.ce_coi || item.ce_oi || 0;
                        const peVal = item.pe_coi || item.pe_oi || 0;
                        const ceWidth = Math.min(90, Math.abs(ceVal / maxVal) * 90);
                        const peWidth = Math.min(90, Math.abs(peVal / maxVal) * 90);

                        return (
                            <div key={i} className="flex items-center gap-1 h-4">
                                {/* CE bar (left) */}
                                <div className="flex-1 flex justify-end">
                                    <div
                                        className="h-3 bg-green-500 rounded-l"
                                        style={{ width: `${ceWidth}%` }}
                                    />
                                </div>
                                {/* Strike label */}
                                <div className={`w-12 text-center text-[9px] font-medium ${item.is_atm ? 'text-yellow-500' : 'text-gray-400'
                                    }`}>
                                    {item.strike}
                                </div>
                                {/* PE bar (right) */}
                                <div className="flex-1">
                                    <div
                                        className="h-3 bg-red-500 rounded-r"
                                        style={{ width: `${peWidth}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Summary footer */}
                {data.summary && (
                    <div className="flex justify-between text-[10px] px-2 py-1 border-t border-gray-700">
                        <span className="text-green-500">
                            CE: {((data.summary.total_ce_coi || data.summary.total_ce_oi || 0) / 100000).toFixed(1)}L
                        </span>
                        <span className={data.summary.signal === 'BULLISH' ? 'text-green-500' : 'text-red-500'}>
                            {data.summary.signal || (data.summary.pcr > 1 ? 'BULLISH' : 'BEARISH')}
                        </span>
                        <span className="text-red-500">
                            PE: {((data.summary.total_pe_coi || data.summary.total_pe_oi || 0) / 100000).toFixed(1)}L
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Card variant="glass" className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="card-header-drag flex items-center justify-between px-3 py-2 border-b border-gray-700 cursor-move">
                <div className="flex items-center gap-2">
                    <ChartBarIcon className="w-4 h-4 text-gray-400" />
                    <select
                        value={chartType}
                        onChange={(e) => onChangeType(id, e.target.value)}
                        className="bg-transparent text-xs font-medium text-gray-300 border-0 focus:ring-0 cursor-pointer"
                    >
                        {chartTypes.map((type) => (
                            <option key={type.id} value={type.id} className="bg-gray-800">
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-1 rounded hover:bg-gray-700 transition-colors"
                    >
                        <ArrowPathIcon className={`w-3.5 h-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => onRemove(id)}
                        className="p-1 rounded hover:bg-gray-700 transition-colors"
                    >
                        <XMarkIcon className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Chart Content */}
            <div className="flex-1 min-h-0">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                ) : error ? (
                    <div className="h-full flex items-center justify-center text-red-500 text-sm">
                        {error}
                    </div>
                ) : (
                    renderChart()
                )}
            </div>
        </Card>
    );
});

ChartPanel.displayName = 'ChartPanel';

ChartPanel.propTypes = {
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    symbol: PropTypes.string,
    expiry: PropTypes.string,
    chartType: PropTypes.string.isRequired,
    onChangeType: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    isFullScreen: PropTypes.bool
};

export default ChartPanel;

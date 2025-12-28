import { useState, useEffect, useCallback, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Squares2X2Icon,
    TableCellsIcon,
    ChartBarIcon,
    ArrowPathIcon,
    PlusIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { selectIsAuthenticated } from '../context/selectors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { analyticsService } from '../services/analyticsService';

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
    isFullScreen: _isFullScreen = false
}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const chartTypes = [
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
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
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

/**
 * Mini Option Chain Table Component
 */
const MiniOptionChain = memo(({ data }) => {
    if (!data || Object.keys(data).length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Loading option chain...
            </div>
        );
    }

    const strikes = Object.entries(data)
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
        .slice(0, 20);

    return (
        <div className="overflow-auto h-full">
            <table className="w-full text-[10px]">
                <thead className="bg-gray-800 sticky top-0">
                    <tr>
                        <th className="py-1 px-1 text-green-500">OI</th>
                        <th className="py-1 px-1 text-green-500">LTP</th>
                        <th className="py-1 px-1 text-yellow-500">Strike</th>
                        <th className="py-1 px-1 text-red-500">LTP</th>
                        <th className="py-1 px-1 text-red-500">OI</th>
                    </tr>
                </thead>
                <tbody>
                    {strikes.map(([strike, data]) => (
                        <tr key={strike} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="py-0.5 px-1 text-center text-green-400">
                                {((data.ce?.OI || data.ce?.oi || 0) / 1000).toFixed(0)}K
                            </td>
                            <td className="py-0.5 px-1 text-center">
                                {data.ce?.ltp?.toFixed(1) || '-'}
                            </td>
                            <td className="py-0.5 px-1 text-center font-medium text-gray-300">
                                {parseFloat(strike).toFixed(0)}
                            </td>
                            <td className="py-0.5 px-1 text-center">
                                {data.pe?.ltp?.toFixed(1) || '-'}
                            </td>
                            <td className="py-0.5 px-1 text-center text-red-400">
                                {((data.pe?.OI || data.pe?.oi || 0) / 1000).toFixed(0)}K
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});

MiniOptionChain.displayName = 'MiniOptionChain';

/**
 * Split View Page - LOC Calculator-style split layout
 * Shows option chain table alongside multiple chart panels
 */
const SplitView = () => {
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const navigate = useNavigate();
    const selectedSymbol = useSelector((state) => state.optionChain.selectedSymbol) || 'NIFTY';
    const selectedExpiry = useSelector((state) => state.optionChain.selectedExpiry);
    const optionChainData = useSelector((state) => state.optionChain.data);

    // Chart panels state
    const [panels, setPanels] = useState([
        { id: 1, chartType: 'coi' },
        { id: 2, chartType: 'oi' },
        { id: 3, chartType: 'pcr' },
        { id: 4, chartType: 'distribution' },
    ]);

    const [layout, setLayout] = useState('2x2'); // '2x2', '1x2', '3x1'
    const [showTable, setShowTable] = useState(true);

    const handleChangeChartType = (panelId, newType) => {
        setPanels(prev => prev.map(p =>
            p.id === panelId ? { ...p, chartType: newType } : p
        ));
    };

    const handleRemovePanel = (panelId) => {
        setPanels(prev => prev.filter(p => p.id !== panelId));
    };

    const handleAddPanel = () => {
        const newId = Math.max(...panels.map(p => p.id), 0) + 1;
        setPanels(prev => [...prev, { id: newId, chartType: 'coi' }]);
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Authentication Required</h2>
                <p className="text-gray-600 dark:text-gray-400">Please log in to use Split View.</p>
                <Button onClick={() => navigate('/login')}>Login Now</Button>
            </div>
        );
    }

    const gridClass = {
        '2x2': 'grid-cols-2 grid-rows-2',
        '1x2': 'grid-cols-1 grid-rows-2',
        '3x1': 'grid-cols-3 grid-rows-1',
    }[layout] || 'grid-cols-2 grid-rows-2';

    return (
        <>
            <Helmet>
                <title>Split View | Stockify</title>
                <meta name="description" content="Split view with option chain and multiple charts" />
            </Helmet>

            <div className="w-full h-[calc(100vh-64px)] flex flex-col p-2 gap-2">
                {/* Header Controls */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Squares2X2Icon className="w-5 h-5" />
                            Split View
                        </h1>
                        <span className="text-sm text-gray-500">
                            {selectedSymbol} • {selectedExpiry}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Layout Toggle */}
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                            {['2x2', '1x2', '3x1'].map((l) => (
                                <button
                                    key={l}
                                    onClick={() => setLayout(l)}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${layout === l
                                        ? 'bg-blue-500 text-white'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                        }`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>

                        {/* Toggle Table */}
                        <button
                            onClick={() => setShowTable(!showTable)}
                            className={`p-2 rounded-lg transition-colors ${showTable
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                                }`}
                            title="Toggle Option Chain Table"
                        >
                            <TableCellsIcon className="w-4 h-4" />
                        </button>

                        {/* Add Panel */}
                        <button
                            onClick={handleAddPanel}
                            className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                            title="Add Chart Panel"
                        >
                            <PlusIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex gap-2 min-h-0">
                    {/* Option Chain Table (Left Panel) */}
                    {showTable && (
                        <Card variant="glass" className="w-64 flex-shrink-0 flex flex-col">
                            <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
                                <TableCellsIcon className="w-4 h-4 text-gray-400" />
                                <span className="text-xs font-medium text-gray-300">Option Chain</span>
                            </div>
                            <div className="flex-1 min-h-0">
                                <MiniOptionChain data={optionChainData?.oc} />
                            </div>
                        </Card>
                    )}

                    {/* Charts Grid (Right Panel) */}
                    <div className={`flex-1 grid ${gridClass} gap-2 min-h-0`}>
                        {panels.slice(0, layout === '3x1' ? 3 : 4).map((panel) => (
                            <ChartPanel
                                key={panel.id}
                                id={panel.id}
                                symbol={selectedSymbol}
                                expiry={selectedExpiry}
                                chartType={panel.chartType}
                                onChangeType={handleChangeChartType}
                                onRemove={handleRemovePanel}
                            />
                        ))}

                        {/* Empty state if no panels */}
                        {panels.length === 0 && (
                            <div className="col-span-full flex items-center justify-center">
                                <button
                                    onClick={handleAddPanel}
                                    className="flex flex-col items-center gap-2 p-8 rounded-xl border-2 border-dashed border-gray-600 hover:border-gray-500 transition-colors"
                                >
                                    <PlusIcon className="w-8 h-8 text-gray-500" />
                                    <span className="text-sm text-gray-500">Add Chart Panel</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default SplitView;

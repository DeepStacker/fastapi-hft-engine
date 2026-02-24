import { createPortal } from 'react-dom';
import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon, ChartBarIcon, ArrowTrendingUpIcon, BoltIcon, TableCellsIcon, ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { analyticsService } from '../../../services/analyticsService';
import { useSelector } from 'react-redux';
import { selectSelectedSymbol, selectSelectedExpiry } from '../../../context/selectors';

// Import extracted charts
import MiniLineChart from './charts/MiniLineChart';
import ComparisonLineChart from './charts/ComparisonLineChart';
import MultiSeriesChart from './charts/MultiSeriesChart';
import AggregateBarChart from './charts/AggregateBarChart';
import PCRChart from './charts/PCRChart';

/**
 * View selector tabs - LOC Calculator-style
 */
const VIEW_TABS = [
    { id: 'strike', label: 'Strike', icon: ChartBarIcon, description: 'Time-series for selected strike' },
    { id: 'coi', label: 'COi', icon: ArrowTrendingUpIcon, description: 'Change in OI across strikes' },
    { id: 'oi', label: 'Oi', icon: ChartBarIcon, description: 'Total OI across strikes' },
    { id: 'overall', label: 'Overall', icon: ChartBarIcon, description: 'Cumulative OI/COI view' },
    { id: 'pcr', label: 'PCR', icon: ArrowTrendingUpIcon, description: 'Put-Call Ratio across strikes' },
    { id: 'percentage', label: '%', icon: ArrowTrendingUpIcon, description: 'Percentage changes' },
];

/**
 * Enhanced Modal for displaying time-series and aggregate data
 * Inspired by LOC Calculator's chart modal with multiple view options
 */
const CellDetailModal = memo(({ isOpen, onClose, cellData, symbol: propSymbol, expiry: propExpiry, date }) => {
    const { strike, side, field: propField, fullData } = cellData || {};

    // Normalize field name
    const getNormalizedField = (f) => {
        const fieldMap = { 'OI': 'oi', 'oichng': 'oi_change' };
        // Supported fields for chart
        const supported = ['oi', 'oi_change', 'ltp', 'iv', 'volume', 'delta', 'theta', 'gamma', 'vega'];
        const mapped = fieldMap[f] || f || 'oi';
        // If mapped is supported, use it, else default to 'oi'
        return supported.includes(mapped) ? mapped : 'oi';
    };

    const [activeView, setActiveView] = useState('strike');
    const [selectedField, setSelectedField] = useState(() => getNormalizedField(propField));
    const [timeSeriesData, setTimeSeriesData] = useState(null);
    const [aggregateData, setAggregateData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const DEFAULT_VIEWS = useMemo(() => ({
        ce: false,
        pe: false,
        ce_minus_pe: false,
        pe_minus_ce: true,
        ce_div_pe: false,
        pe_div_ce: false,
    }), []);

    const [enabledViews, setEnabledViews] = useState(DEFAULT_VIEWS);

    // Reset views when modal opens (fresh start every time)
    useEffect(() => {
        if (isOpen) {
            setEnabledViews(DEFAULT_VIEWS);
        }
    }, [isOpen, DEFAULT_VIEWS]);

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // Responsive chart sizing
    const contentRef = useRef(null);
    const [chartDimensions, setChartDimensions] = useState({ width: 900, height: 500 });

    useEffect(() => {
        if (!contentRef.current) return;

        const updateDimensions = () => {
            if (contentRef.current) {
                const { clientWidth, clientHeight } = contentRef.current;
                // Subtract padding
                setChartDimensions({
                    width: clientWidth - 16, // p-2 padding (8px * 2)
                    height: clientHeight - 16
                });
            }
        };

        // Initial measurement
        updateDimensions();

        const observer = new ResizeObserver(updateDimensions);
        observer.observe(contentRef.current);

        return () => observer.disconnect();
    }, [activeView, loading, error]);



    // Toggle a view on/off
    const toggleView = (viewName) => {
        setEnabledViews(prev => ({ ...prev, [viewName]: !prev[viewName] }));
    };

    // Use correct Redux selectors for symbol and expiry
    const reduxSymbol = useSelector(selectSelectedSymbol);
    const reduxExpiry = useSelector(selectSelectedExpiry);

    const symbol = propSymbol || reduxSymbol;
    const expiry = propExpiry || reduxExpiry;

    // Sync selectedField when propField changes (e.g. clicking different cell)
    useEffect(() => {
        if (isOpen && propField) {
            const norm = getNormalizedField(propField);
            if (norm !== selectedField) {
                setSelectedField(norm);
                // Reset timeSeriesData to prevent stale chart rendering
                setTimeSeriesData(null);
            }
        }
    }, [propField, isOpen]);

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (activeView !== 'strike') return;

            const fields = ['oi', 'oi_change', 'volume', 'iv', 'ltp', 'delta', 'theta', 'gamma', 'vega'];
            const currentIndex = fields.indexOf(selectedField);

            if (e.key === 'ArrowRight') {
                const nextIndex = (currentIndex + 1) % fields.length;
                setSelectedField(fields[nextIndex]);
            } else if (e.key === 'ArrowLeft') {
                const prevIndex = (currentIndex - 1 + fields.length) % fields.length;
                setSelectedField(fields[prevIndex]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, activeView, selectedField]);

    // Fetch multi-view time-series data for strike view
    const fetchStrikeData = useCallback(async () => {
        console.log('[CellDetailModal] fetchStrikeData (multi-view) called with:', { symbol, strike, side, selectedField, expiry, date });

        if (!symbol || !strike || !expiry) {
            console.warn('[CellDetailModal] Missing required params:', { symbol, strike, expiry });
            return;
        }

        setLoading(true);
        setError(null);

        // Use provided date or current date for live mode
        const queryDate = date || new Date().toISOString().split('T')[0];

        try {
            console.log('[CellDetailModal] Calling analyticsService.getMultiViewTimeSeries with date:', queryDate);
            const data = await analyticsService.getMultiViewTimeSeries({
                symbol,
                strike: parseFloat(strike),
                expiry, // This is the crucial expiry parameter
                field: selectedField,
                // Let the service use its default 'auto' interval for maximum granularity
                date: queryDate, // Always pass a date (today for live, selected for historical)
            });
            console.log('[CellDetailModal] Multi-view API response:', data);
            setTimeSeriesData(data);
            setLoading(false);
        } catch (err) {
            console.error('[CellDetailModal] Failed to fetch multi-view time-series:', err);
            setError(err.message || 'Failed to load data');
            setLoading(false);
        }
    }, [symbol, strike, selectedField, expiry, date]);

    // Fetch aggregate data for COi, Oi, Overall, PCR, Percentage views
    const fetchAggregateData = useCallback(async (viewType) => {
        if (!symbol || !expiry) return;

        setLoading(true);
        setError(null);

        try {
            let data;
            switch (viewType) {
                case 'coi':
                case 'overall':
                    data = await analyticsService.getAggregateCOI({ symbol, expiry });
                    break;
                case 'oi':
                    data = await analyticsService.getAggregateOI({ symbol, expiry });
                    break;
                case 'pcr':
                    data = await analyticsService.getAggregatePCR({ symbol, expiry });
                    break;
                case 'percentage':
                    data = await analyticsService.getAggregatePercentage({ symbol, expiry });
                    break;
                default:
                    return;
            }
            // Handle response format (may be array directly or object with data property)
            setAggregateData(Array.isArray(data) ? { data, summary: {} } : data);
        } catch (err) {
            console.error(`[CellDetailModal] Failed to fetch ${viewType} data:`, err);
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [symbol, expiry]);

    // Fetch logic - Purely Declarative
    // Trigger fetch whenever dependencies change (Symbol, Strike, Expiry, Field, View)
    useEffect(() => {
        if (!isOpen || !cellData) return;

        let pollInterval;

        const performFetch = () => {
            if (activeView === 'strike') {
                // Only fetch if required params exist
                if (symbol && strike) fetchStrikeData();
            } else {
                fetchAggregateData(activeView);
            }
        };

        // Fetch immediately
        performFetch();

        // Poll every 60s
        pollInterval = setInterval(performFetch, 60000);

        return () => clearInterval(pollInterval);

    }, [isOpen, activeView, symbol, strike, expiry, selectedField, fetchStrikeData, fetchAggregateData]); // cellData removed to avoid deep obj trigger, specific props used

    // Keep fetch functions in ref or dependency array? 
    // fetchStrikeData and fetchAggregateData are memoized via useCallback with dependencies.
    // To safe, we include them in the effect dependencies if we were defining effect strictly.
    // However, including them might cause re-triggers if they change. 
    // Since they depend on state that might change (symbol, strike), it's correct to re-setup interval if those change.

    if (!isOpen || !cellData) return null;

    const sideLabel = side === 'ce' ? 'Call' : 'Put';
    const _sideColor = side === 'ce' ? 'text-green-600' : 'text-red-600';
    const _sideBg = side === 'ce' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30';

    const fieldLabels = {
        oi: 'Open Interest',
        oi_change: 'OI Change',
        ltp: 'Last Traded Price',
        iv: 'Implied Volatility',
        volume: 'Volume',
        delta: 'Delta',
        theta: 'Theta',
        gamma: 'Gamma',
        vega: 'Vega',
    };

    const ce = fullData?.ce || {};
    const pe = fullData?.pe || {};
    const optData = side === 'ce' ? ce : pe;

    // Render content based on active view
    const renderContent = () => {
        if (loading) {
            return (
                <div className="h-64 flex items-center justify-center">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            );
        }

        if (error) {
            return (
                <div className="h-64 flex items-center justify-center text-red-500">
                    <div className="text-center">
                        <p>{error}</p>
                        <button
                            onClick={() => activeView === 'strike' ? fetchStrikeData() : fetchAggregateData(activeView)}
                            className="mt-2 text-sm text-blue-500 hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            );
        }

        switch (activeView) {
            case 'strike':
                return (
                    <div className="h-full flex flex-col gap-4">
                        {/* View Toggles - Clean, modern toggle row */}
                        <div className="flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                {[
                                    { key: 'ce', label: 'CE', color: 'bg-green-500', hoverColor: 'hover:bg-green-600' },
                                    { key: 'pe', label: 'PE', color: 'bg-red-500', hoverColor: 'hover:bg-red-600' },
                                    { key: 'ce_minus_pe', label: 'CE−PE', color: 'bg-blue-500', hoverColor: 'hover:bg-blue-600' },
                                    { key: 'pe_minus_ce', label: 'PE−CE', color: 'bg-purple-500', hoverColor: 'hover:bg-purple-600' },
                                    { key: 'ce_div_pe', label: 'CE÷PE', color: 'bg-orange-500', hoverColor: 'hover:bg-orange-600' },
                                    { key: 'pe_div_ce', label: 'PE÷CE', color: 'bg-pink-500', hoverColor: 'hover:bg-pink-600' },
                                ].map(({ key, label, color, hoverColor }) => (
                                    <button
                                        key={key}
                                        onClick={() => toggleView(key)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${enabledViews[key]
                                            ? `${color} text-white shadow-md transform scale-105`
                                            : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={fetchStrikeData}
                                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                title="Refresh Data"
                            >
                                <ArrowPathIcon className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Professional Multi-Series Chart - Responsive Wrapper */}
                        <div className="flex-1 min-h-0 relative" ref={contentRef}>
                            <MultiSeriesChart
                                views={timeSeriesData?.views || {}}
                                enabledViews={enabledViews}
                                width={chartDimensions.width}
                                height={chartDimensions.height}
                                field={fieldLabels[selectedField] || selectedField}
                                strike={strike}
                            />
                        </div>
                    </div>
                );

            case 'coi':
            case 'oi': {
                const chartData = aggregateData?.data || [];
                const summary = aggregateData?.summary || {};

                return (
                    <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
                            <AggregateBarChart
                                data={chartData}
                                viewType={activeView}
                                width={620}
                                height={400}
                            />
                        </div>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                                <div className="text-[10px] text-green-600 uppercase">Total CE</div>
                                <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                                    {((summary.total_ce_coi || summary.total_ce_oi || 0) / 100000).toFixed(2)}L
                                </div>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                                <div className="text-[10px] text-red-600 uppercase">Total PE</div>
                                <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                                    {((summary.total_pe_coi || summary.total_pe_oi || 0) / 100000).toFixed(2)}L
                                </div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                                <div className="text-[10px] text-blue-600 uppercase">Net</div>
                                <div className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                                    {((summary.net_coi || summary.net_oi || 0) / 100000).toFixed(2)}L
                                </div>
                            </div>
                            <div className={`rounded-lg p-2 ${summary.signal === 'BULLISH' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                <div className="text-[10px] text-gray-600 uppercase">Signal</div>
                                <div className={`text-sm font-bold ${summary.signal === 'BULLISH' ? 'text-green-700' : 'text-red-700'}`}>
                                    {summary.signal || 'NEUTRAL'}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            case 'overall': {
                // Same as COI but showing cumulative data
                const chartData = aggregateData?.data || [];

                return (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <InformationCircleIcon className="w-4 h-4" />
                            Showing cumulative OI changes from lowest to highest strike
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
                            <AggregateBarChart
                                data={chartData}
                                viewType="coi"
                                width={620}
                                height={400}
                            />
                        </div>
                    </div>
                );
            }

            case 'pcr': {
                const chartData = aggregateData?.data || [];
                const summary = aggregateData?.summary || {};

                return (
                    <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <PCRChart data={chartData} width={620} height={220} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                                <div className="text-xs text-gray-500">Overall PCR (OI)</div>
                                <div className={`text-xl font-bold ${(summary.overall_pcr_oi || 1) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                    {summary.overall_pcr_oi?.toFixed(3) || 'N/A'}
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                                <div className="text-xs text-gray-500">Overall PCR (Vol)</div>
                                <div className={`text-xl font-bold ${(summary.overall_pcr_vol || 1) > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                    {summary.overall_pcr_vol?.toFixed(3) || 'N/A'}
                                </div>
                            </div>
                            <div className={`rounded-lg p-3 text-center ${summary.market_sentiment === 'BULLISH' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                <div className="text-xs text-gray-500">Market Sentiment</div>
                                <div className={`text-lg font-bold ${summary.market_sentiment === 'BULLISH' ? 'text-green-700' : 'text-red-700'}`}>
                                    {summary.market_sentiment || 'NEUTRAL'}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            case 'percentage': {
                const chartData = aggregateData?.data?.slice(0, 20) || [];

                return (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-100 dark:bg-gray-800">
                                    <tr>
                                        <th className="p-2 text-left">Strike</th>
                                        <th className="p-2 text-right text-green-600">CE OI %</th>
                                        <th className="p-2 text-right text-red-600">PE OI %</th>
                                        <th className="p-2 text-right text-green-600">CE LTP %</th>
                                        <th className="p-2 text-right text-red-600">PE LTP %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chartData.map((item) => (
                                        <tr
                                            key={item.strike}
                                            className={`border-b border-gray-100 dark:border-gray-800 ${item.is_atm ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                                        >
                                            <td className={`p-2 font-medium ${item.is_atm ? 'text-yellow-600' : ''}`}>
                                                {item.strike}
                                            </td>
                                            <td className={`p-2 text-right ${(item.ce_oi_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {(item.ce_oi_pct || 0) >= 0 ? '+' : ''}{(item.ce_oi_pct || 0).toFixed(1)}%
                                            </td>
                                            <td className={`p-2 text-right ${(item.pe_oi_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {(item.pe_oi_pct || 0) >= 0 ? '+' : ''}{(item.pe_oi_pct || 0).toFixed(1)}%
                                            </td>
                                            <td className={`p-2 text-right ${(item.ce_ltp_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {(item.ce_ltp_pct || 0) >= 0 ? '+' : ''}{(item.ce_ltp_pct || 0).toFixed(1)}%
                                            </td>
                                            <td className={`p-2 text-right ${(item.pe_ltp_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {(item.pe_ltp_pct || 0) >= 0 ? '+' : ''}{(item.pe_ltp_pct || 0).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };



    return createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal - Fixed Center, Full Viewport Max */}
            <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
                <div className="relative w-[90vw] h-[85vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all overflow-hidden flex flex-col pointer-events-auto border border-gray-200 dark:border-gray-700">
                    {/* Header with Tabs and Close Button */}
                    <div className="flex flex-col border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        {/* Status Bar / Identifiers */}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900/50">
                            <div className="flex items-center gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-700 dark:text-gray-200">{symbol}</span>
                                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                        {expiry ? (isNaN(expiry) ? expiry : new Date(expiry * 1000).toLocaleDateString()) : 'N/A'}
                                    </span>
                                </div>
                                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-blue-600 dark:text-blue-400">{strike}</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${side === 'ce' ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : 'text-red-600 bg-red-100 dark:bg-red-900/30'}`}>
                                        {side?.toUpperCase()}
                                    </span>
                                </div>
                                {activeView === 'strike' && (
                                    <>
                                        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 dark:text-gray-400">Field:</span>
                                            <span className="font-semibold text-gray-800 dark:text-gray-100">{fieldLabels[selectedField]}</span>
                                            <span className="text-[10px] text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1 ml-1">Use Left/Right keys</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5 text-gray-500 hover:text-red-500 transition-colors" />
                            </button>
                        </div>

                        {/* View Selector Tabs */}
                        <div className="flex items-center justify-between px-2">
                            <div className="flex overflow-x-auto">
                                {VIEW_TABS.map((tab) => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveView(tab.id)}
                                            className={`px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeView === tab.id
                                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                                }`}
                                            title={tab.description}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Content - Flex container for responsive chart */}
                    <div className="flex-1 min-h-0 flex flex-col p-4 relative">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
});

CellDetailModal.displayName = 'CellDetailModal';

CellDetailModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    cellData: PropTypes.shape({
        strike: PropTypes.number,
        side: PropTypes.string,
        field: PropTypes.string,
        value: PropTypes.any,
        symbol: PropTypes.string,
        sid: PropTypes.number,
        fullData: PropTypes.object,
    }),
};

export default CellDetailModal;

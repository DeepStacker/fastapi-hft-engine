import { memo, useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { XMarkIcon, ChartBarIcon, ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline';
import { selectStrikesAroundATM, selectOptionsData, selectATMStrike, selectSelectedSymbol, selectSelectedExpiry } from '../../../context/selectors';

/**
 * Enhanced Aggregate Chart Modal - LOC Calculator Style
 * Features tabbed views: COI | OI | Volume | PCR | %
 * Shows aggregate totals and distribution charts
 */
const AggregateChartModal = memo(({ isOpen, onClose, columnType, initialTab }) => {
    // Tabs matching LOC Calculator
    const TABS = [
        { id: 'coi', label: 'Total COi', icon: '📈' },
        { id: 'oi', label: 'Total Oi', icon: '📊' },
        { id: 'volume', label: 'Total Vol', icon: '📉' },
        { id: 'pcr', label: 'PCR', icon: '⚖️' },
        { id: 'percent', label: '%', icon: '📐' },
    ];

    // Map columnType to initial tab
    const getInitialTab = () => {
        if (initialTab) return initialTab;
        if (columnType === 'oi_chng') return 'coi';
        if (columnType === 'oi') return 'oi';
        if (columnType === 'volume') return 'volume';
        return 'coi';
    };

    const [activeTab, setActiveTab] = useState(getInitialTab());
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Get data from Redux
    const strikesSelector = useMemo(() => selectStrikesAroundATM(30), []);
    const strikes = useSelector(strikesSelector);
    const rawData = useSelector(selectOptionsData);
    const atmStrike = useSelector(selectATMStrike);
    const symbol = useSelector(selectSelectedSymbol);
    const expiry = useSelector(selectSelectedExpiry);

    // Update timestamp when data changes
    useEffect(() => {
        if (isOpen) setLastUpdated(new Date());
    }, [isOpen, rawData]);

    // Build chart data based on active tab
    const { chartData, totals, config } = useMemo(() => {
        if (!strikes || !rawData?.oc) {
            return { chartData: [], totals: {}, config: {} };
        }

        const tabConfigs = {
            coi: {
                label: 'Change in OI',
                ceKey: 'oichng',
                peKey: 'oichng',
                format: (v) => {
                    if (Math.abs(v) >= 10000000) return `${(v / 10000000).toFixed(2)}Cr`;
                    if (Math.abs(v) >= 100000) return `${(v / 100000).toFixed(2)}L`;
                    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
                    return v.toLocaleString('en-IN');
                },
                color: { ce: '#F97316', pe: '#22C55E' },
                showSign: true,
            },
            oi: {
                label: 'Open Interest',
                ceKey: 'OI',
                peKey: 'OI',
                format: (v) => {
                    if (v >= 10000000) return `${(v / 10000000).toFixed(2)}Cr`;
                    if (v >= 100000) return `${(v / 100000).toFixed(2)}L`;
                    return `${(v / 1000).toFixed(1)}K`;
                },
                color: { ce: '#EF4444', pe: '#10B981' },
            },
            volume: {
                label: 'Volume',
                ceKey: 'volume',
                peKey: 'volume',
                format: (v) => {
                    if (v >= 10000000) return `${(v / 10000000).toFixed(2)}Cr`;
                    if (v >= 100000) return `${(v / 100000).toFixed(2)}L`;
                    return `${(v / 1000).toFixed(1)}K`;
                },
                color: { ce: '#EC4899', pe: '#14B8A6' },
            },
            pcr: {
                label: 'Put-Call Ratio',
                ceKey: 'OI',
                peKey: 'OI',
                format: (v) => v?.toFixed(3) || '—',
                color: { ce: '#6366F1', pe: '#8B5CF6' },
            },
            percent: {
                label: 'OI Change %',
                ceKey: 'oichng',
                peKey: 'oichng',
                format: (v) => `${v?.toFixed(1)}%`,
                color: { ce: '#F59E0B', pe: '#84CC16' },
            },
        };

        const cfg = tabConfigs[activeTab] || tabConfigs.coi;
        let totalCE = 0;
        let totalPE = 0;

        const data = strikes.map(strike => {
            const strikeKey = strike.toString();
            const strikeData = rawData.oc[strikeKey] || rawData.oc[`${strike}.000000`] || {};
            const ce = strikeData.ce || {};
            const pe = strikeData.pe || {};

            let ceValue = ce[cfg.ceKey] || ce.oi || 0;
            let peValue = pe[cfg.peKey] || pe.oi || 0;

            // For percentage tab, calculate percentage
            if (activeTab === 'percent') {
                const ceOI = ce.OI || ce.oi || 1;
                const peOI = pe.OI || pe.oi || 1;
                const ceChg = ce.oichng || 0;
                const peChg = pe.oichng || 0;
                ceValue = ((ceChg / (ceOI - ceChg)) * 100) || 0;
                peValue = ((peChg / (peOI - peChg)) * 100) || 0;
            }

            totalCE += Math.abs(ceValue);
            totalPE += Math.abs(peValue);

            return {
                strike,
                ceValue: ceValue,
                peValue: peValue,
                ceOI: ce.OI || ce.oi || 0,
                peOI: pe.OI || pe.oi || 0,
                isATM: Math.abs(strike - atmStrike) < 0.01,
            };
        }).filter(d => d.ceValue !== 0 || d.peValue !== 0 || activeTab === 'pcr');

        return {
            chartData: data,
            totals: {
                ce: totalCE,
                pe: totalPE,
                net: totalPE - totalCE,
                pcr: totalCE > 0 ? (totalPE / totalCE) : 0,
            },
            config: cfg,
        };
    }, [strikes, rawData, atmStrike, activeTab]);

    const maxValue = useMemo(() => {
        if (activeTab === 'pcr') return 3; // Fixed scale for PCR
        return Math.max(...chartData.flatMap(d => [Math.abs(d.ceValue), Math.abs(d.peValue)]), 1);
    }, [chartData, activeTab]);

    // Reset tab when columnType changes
    useEffect(() => {
        setActiveTab(getInitialTab());
    }, [columnType]);

    if (!isOpen) return null;

    // Get signal interpretation
    const getSignal = () => {
        if (activeTab === 'pcr') {
            if (totals.pcr > 1.2) return { text: 'BULLISH', color: 'text-green-600 bg-green-100' };
            if (totals.pcr < 0.8) return { text: 'BEARISH', color: 'text-red-600 bg-red-100' };
            return { text: 'NEUTRAL', color: 'text-gray-600 bg-gray-100' };
        }
        if (totals.pe > totals.ce) return { text: 'BULLISH', color: 'text-green-600 bg-green-100' };
        return { text: 'BEARISH', color: 'text-red-600 bg-red-100' };
    };

    const signal = getSignal();

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-5xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-500/15 to-indigo-500/20" />
                        <div className="relative flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-700/50">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                                    <ChartBarIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {config.label || 'Aggregate Data'} — {symbol}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        <ClockIcon className="w-3 h-3" />
                                        <span>Updated: {lastUpdated.toLocaleTimeString('en-IN')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Signal Badge */}
                            <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${signal.color}`}>
                                {signal.text}
                            </div>

                            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <XMarkIcon className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Tabs - LOC Calculator Style */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${activeTab === tab.id
                                        ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <span className="mr-1.5">{tab.icon}</span>
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Summary Cards - LOC Calculator Style */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800/30">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Total CE</div>
                            <div className="text-2xl font-bold text-red-600">{config.format(totals.ce)}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Total PE</div>
                            <div className="text-2xl font-bold text-green-600">{config.format(totals.pe)}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Net</div>
                            <div className={`text-2xl font-bold ${totals.net > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {totals.net > 0 ? '+' : ''}{config.format(totals.net)}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">PCR</div>
                            <div className={`text-2xl font-bold ${totals.pcr > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                {totals.pcr.toFixed(3)}
                            </div>
                        </div>
                    </div>

                    {/* Chart Area */}
                    <div className="p-5 max-h-[50vh] overflow-y-auto">
                        {activeTab === 'pcr' ? (
                            // PCR View - Show PCR values per strike
                            <div className="space-y-1">
                                {chartData.map((item) => {
                                    const strikePCR = item.ceOI > 0 ? (item.peOI / item.ceOI) : 0;
                                    const pcrWidth = Math.min((strikePCR / 3) * 100, 100);
                                    const pcrColor = strikePCR > 1.2 ? '#22C55E' : strikePCR < 0.8 ? '#EF4444' : '#6B7280';

                                    return (
                                        <div
                                            key={item.strike}
                                            className={`flex items-center gap-3 py-1.5 px-2 rounded ${item.isATM ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-400' : ''
                                                }`}
                                        >
                                            <div className={`w-20 text-sm font-bold ${item.isATM ? 'text-yellow-600' : 'text-gray-700 dark:text-gray-300'
                                                }`}>
                                                {item.strike}
                                            </div>
                                            <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                                                    style={{ width: `${pcrWidth}%`, backgroundColor: pcrColor }}
                                                >
                                                    <span className="text-[10px] font-bold text-white">
                                                        {strikePCR.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`w-16 text-xs font-medium text-right ${strikePCR > 1.2 ? 'text-green-600' : strikePCR < 0.8 ? 'text-red-600' : 'text-gray-500'
                                                }`}>
                                                {strikePCR > 1.2 ? 'Bullish' : strikePCR < 0.8 ? 'Bearish' : 'Neutral'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            // Standard CE vs PE Bar Chart
                            <div className="space-y-1">
                                {chartData.map((item) => (
                                    <div
                                        key={item.strike}
                                        className={`flex items-center gap-2 py-1 rounded ${item.isATM ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-400' : ''
                                            }`}
                                    >
                                        {/* CE Bar (left side, right-aligned) */}
                                        <div className="flex-1 flex justify-end">
                                            <div className="relative w-full flex items-center justify-end">
                                                <div
                                                    className="h-5 rounded-l transition-all duration-300"
                                                    style={{
                                                        width: `${(Math.abs(item.ceValue) / maxValue) * 100}%`,
                                                        backgroundColor: config.color?.ce || '#EF4444',
                                                        minWidth: item.ceValue !== 0 ? '4px' : '0',
                                                    }}
                                                />
                                                {Math.abs(item.ceValue) > maxValue * 0.1 && (
                                                    <span className="absolute right-2 text-[10px] font-bold text-white">
                                                        {config.showSign && item.ceValue > 0 ? '+' : ''}{config.format(item.ceValue)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Strike Label */}
                                        <div className={`w-20 text-center text-sm font-bold ${item.isATM ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'
                                            }`}>
                                            {item.strike}
                                            {item.isATM && <span className="text-[8px] block">ATM</span>}
                                        </div>

                                        {/* PE Bar (right side, left-aligned) */}
                                        <div className="flex-1 flex justify-start">
                                            <div className="relative w-full flex items-center">
                                                <div
                                                    className="h-5 rounded-r transition-all duration-300"
                                                    style={{
                                                        width: `${(Math.abs(item.peValue) / maxValue) * 100}%`,
                                                        backgroundColor: config.color?.pe || '#10B981',
                                                        minWidth: item.peValue !== 0 ? '4px' : '0',
                                                    }}
                                                />
                                                {Math.abs(item.peValue) > maxValue * 0.1 && (
                                                    <span className="absolute left-2 text-[10px] font-bold text-white">
                                                        {config.showSign && item.peValue > 0 ? '+' : ''}{config.format(item.peValue)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Legend */}
                        {activeTab !== 'pcr' && (
                            <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded" style={{ backgroundColor: config.color?.ce || '#EF4444' }} />
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">CALL</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded" style={{ backgroundColor: config.color?.pe || '#10B981' }} />
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">PUT</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {chartData.length} strikes displayed
                            </span>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

AggregateChartModal.displayName = 'AggregateChartModal';

AggregateChartModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    columnType: PropTypes.oneOf(['oi', 'oi_chng', 'volume', 'ltp']),
    initialTab: PropTypes.oneOf(['coi', 'oi', 'volume', 'pcr', 'percent']),
};

export default AggregateChartModal;

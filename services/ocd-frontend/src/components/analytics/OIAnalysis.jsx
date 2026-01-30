/**
 * OI Analysis Component - Enhanced
 * Professional Open Interest distribution visualization
 * Features:
 * - Grouped Bar Chart (Call vs Put OI)
 * - Net OI Overlay (Line)
 * - Interactive Brush for zooming
 * - Clickable strikes for detailed analysis
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Brush,
    ReferenceLine
} from 'recharts';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectPCR, selectTotalOI, selectMaxPainStrike, selectDataSymbol } from '../../context/selectors';
import { ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, FireIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Card from '../common/Card';

const OIAnalysis = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const pcr = useSelector(selectPCR);
    const totalOI = useSelector(selectTotalOI);
    const maxPain = useSelector(selectMaxPainStrike);
    const dataSymbol = useSelector(selectDataSymbol);

    const [selectedStrike, setSelectedStrike] = useState(null);

    // Format number as K/M/B/T
    const formatNumber = (num) => {
        if (!num || num === 0) return '0';
        const absNum = Math.abs(num);
        const sign = num < 0 ? '-' : '';

        if (absNum >= 1e12) return sign + (absNum / 1e12).toFixed(2) + 'T';
        if (absNum >= 1e9) return sign + (absNum / 1e9).toFixed(2) + 'B';
        if (absNum >= 1e6) return sign + (absNum / 1e6).toFixed(2) + 'M';
        if (absNum >= 1e3) return sign + (absNum / 1e3).toFixed(1) + 'K';
        return sign + absNum.toFixed(0);
    };

    // Process OI data with PCR
    const oiData = useMemo(() => {
        if (!optionChain) return [];

        return Object.entries(optionChain)
            .map(([strike, data]) => {
                const ce = data.ce || {};
                const pe = data.pe || {};
                const ce_oi = ce.OI || ce.oi || 0;
                const pe_oi = pe.OI || pe.oi || 0;
                const ce_oi_chng = ce.oichng || ce.oi_change || 0;
                const pe_oi_chng = pe.oichng || pe.oi_change || 0;

                // Calculate strike-wise PCR
                const pcr_oi = ce_oi > 0 ? pe_oi / ce_oi : 0;

                // Reversal values for support/resistance
                const ce_reversal = ce.reversal || 0;
                const pe_reversal = pe.reversal || 0;

                return {
                    strike: parseFloat(strike),
                    ce_oi,
                    pe_oi,
                    net_oi: pe_oi - ce_oi, // Positive = Bullish support
                    ce_oi_chng,
                    pe_oi_chng,
                    pcr_oi,
                    ce_reversal,
                    pe_reversal,
                    ce_ltp: ce.ltp || 0,
                    pe_ltp: pe.ltp || 0,
                    ce_iv: ce.iv || 0,
                    pe_iv: pe.iv || 0,
                };
            })
            .filter(d => d.ce_oi > 0 || d.pe_oi > 0)
            .sort((a, b) => a.strike - b.strike);
    }, [optionChain]);

    // Top OI strikes
    const topCEStrikes = useMemo(() =>
        [...oiData].sort((a, b) => b.ce_oi - a.ce_oi).slice(0, 5),
        [oiData]);

    const topPEStrikes = useMemo(() =>
        [...oiData].sort((a, b) => b.pe_oi - a.pe_oi).slice(0, 5),
        [oiData]);

    const displayData = useMemo(() => {
        if (!oiData.length || !spotPrice) return [];
        // Show range around spot
        const atmIndex = oiData.findIndex(d => d.strike >= spotPrice);
        if (atmIndex === -1) return oiData;
        const start = Math.max(0, atmIndex - 12);
        const end = Math.min(oiData.length, atmIndex + 13);
        return oiData.slice(start, end);
    }, [oiData, spotPrice]);

    // Get selected strike data
    const selectedData = useMemo(() => {
        if (!selectedStrike) return null;
        return oiData.find(d => d.strike === selectedStrike);
    }, [selectedStrike, oiData]);

    const pcrColor = pcr > 1.2 ? 'text-green-600' : pcr > 0.8 ? 'text-amber-600' : 'text-red-600';
    const pcrLabel = pcr > 1.2 ? 'Bullish' : pcr > 0.8 ? 'Neutral' : 'Bearish';

    // PCR color helper
    const getPCRColor = (pcrValue) => {
        if (pcrValue > 1.5) return 'text-green-600 bg-green-50 dark:bg-green-900/30';
        if (pcrValue > 1.0) return 'text-green-500 bg-green-50/50 dark:bg-green-900/20';
        if (pcrValue > 0.7) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30';
        return 'text-red-600 bg-red-50 dark:bg-red-900/30';
    };

    const handleChartClick = (data) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const strike = data.activePayload[0].payload.strike;
            setSelectedStrike(strike);
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
                    <p className="font-bold mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">Strike {label}</p>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between gap-4 text-green-600">
                            <span>Call OI:</span>
                            <span className="font-mono font-bold">{formatNumber(data.ce_oi)}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-red-600">
                            <span>Put OI:</span>
                            <span className="font-mono font-bold">{formatNumber(data.pe_oi)}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-purple-600 pt-1 border-t border-dashed border-gray-200 dark:border-gray-700">
                            <span>Net OI (PE-CE):</span>
                            <span className="font-mono font-bold">{formatNumber(data.net_oi)}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-gray-500 mt-1">
                            <span>PCR:</span>
                            <span className="font-mono">{data.pcr_oi.toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 italic text-center">Click to view mechanics</div>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Symbol Display */}
            {dataSymbol && (
                <div className="text-center mb-2">
                    <span className="text-xs text-gray-500">Showing data for</span>
                    <span className="ml-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg font-bold">
                        {dataSymbol}
                    </span>
                </div>
            )}

            {/* Summary Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Total Call OI (Resistance)</div>
                    <div className="text-2xl font-bold">{formatNumber(totalOI.calls)}</div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Total Put OI (Support)</div>
                    <div className="text-2xl font-bold">{formatNumber(totalOI.puts)}</div>
                </div>
                <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700`}>
                    <div className="text-xs text-gray-500 mb-1">PCR Sentiment</div>
                    <div className={`text-2xl font-bold ${pcrColor}`}>{pcr?.toFixed(2)}</div>
                    <div className={`text-xs ${pcrColor}`}>{pcrLabel}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1 flex items-center gap-1"><FireIcon className="w-3 h-3" /> Max Pain</div>
                    <div className="text-2xl font-bold">{maxPain}</div>
                    <div className="text-xs opacity-80">{((maxPain - spotPrice) / spotPrice * 100).toFixed(2)}% from spot</div>
                </div>
            </div>

            {/* Main Charts Area */}
            <Card variant="glass" className="p-5">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <ChartBarIcon className="w-5 h-5 text-blue-600" />
                            Open Interest Distribution
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Call OI (Resistance) vs Put OI (Support) across strikes
                        </p>
                    </div>
                    {/* Zoom hint */}
                    <div className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        <span className="font-bold">Tip:</span> Use the slider below to zoom
                    </div>
                </div>

                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={displayData}
                            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                            onClick={handleChartClick}
                            barGap={2}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#e5e7eb'} opacity={0.5} />
                            <XAxis
                                dataKey="strike"
                                tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#6b7280' }}
                            />
                            <YAxis
                                yAxisId="oi"
                                tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#6b7280' }}
                                tickFormatter={formatNumber}
                            />
                            <YAxis
                                yAxisId="net"
                                orientation="right"
                                tick={{ fontSize: 10, fill: '#8b5cf6' }}
                                tickFormatter={formatNumber}
                                hide={false}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? '#374151' : '#f3f4f6', opacity: 0.2 }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                            {/* Spot Price Line */}
                            <ReferenceLine x={atmStrike} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'top', value: 'ATM', fill: '#f59e0b', fontSize: 10 }} />

                            {/* Call OI Bars - Red/Green based on role? Standard convention: Call=Green/Red? 
                                Convention: Call writing = Resistance = Red usually in some heatmaps, 
                                but standard OI charts often use Green for Call, Red for Put. 
                                Let's stick to standard: Calls (Green), Puts (Red) like the user's previous code, 
                                OR more intuitively: Calls = Resistance (Redish), Puts = Support (Greenish).
                                USER'S PREVIOUS CODE: Call OI = Green, Put OI = Red. I will RESPECT this color coding.
                            */}
                            <Bar yAxisId="oi" dataKey="ce_oi" name="Call OI" fill="#22c55e" radius={[4, 4, 0, 0]} animationDuration={1000} />
                            <Bar yAxisId="oi" dataKey="pe_oi" name="Put OI" fill="#ef4444" radius={[4, 4, 0, 0]} animationDuration={1000} />

                            {/* Net OI Line */}
                            <Line
                                yAxisId="net"
                                type="monotone"
                                dataKey="net_oi"
                                name="Net OI (PE-CE)"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                dot={false}
                                animationDuration={1000}
                            />

                            <Brush
                                dataKey="strike"
                                height={30}
                                stroke="#3b82f6"
                                fill={isDark ? "#1f2937" : "#eff6ff"}
                                tickFormatter={() => ''}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Selected Strike Modal */}
            {selectedStrike && selectedData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setSelectedStrike(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scaleIn" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">Strike {selectedStrike}</h3>
                            <button onClick={() => setSelectedStrike(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Strike PCR */}
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="text-xs text-gray-500 mb-1">Strike PCR (PE/CE OI)</div>
                            <div className={`text-2xl font-bold ${getPCRColor(selectedData.pcr_oi).split(' ')[0]}`}>
                                {selectedData.pcr_oi.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-400">
                                {selectedData.pcr_oi > 1 ? 'More Puts = Bullish Support' : 'More Calls = Bearish Resistance'}
                            </div>
                        </div>

                        {/* Support & Resistance from Reversal */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                                <div className="text-xs text-red-600 mb-1 flex items-center gap-1">
                                    <ArrowTrendingDownIcon className="w-3 h-3" /> Resistance (CE)
                                </div>
                                <div className="text-lg font-bold text-red-700 dark:text-red-400">
                                    {selectedData.ce_reversal ? selectedData.ce_reversal.toFixed(2) : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">CE OI: {formatNumber(selectedData.ce_oi)}</div>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                                <div className="text-xs text-green-600 mb-1 flex items-center gap-1">
                                    <ArrowTrendingUpIcon className="w-3 h-3" /> Support (PE)
                                </div>
                                <div className="text-lg font-bold text-green-700 dark:text-green-400">
                                    {selectedData.pe_reversal ? selectedData.pe_reversal.toFixed(2) : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">PE OI: {formatNumber(selectedData.pe_oi)}</div>
                            </div>
                        </div>

                        {/* OI Details */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">CE OI Change</span>
                                <span className={selectedData.ce_oi_chng >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {selectedData.ce_oi_chng >= 0 ? '+' : ''}{formatNumber(selectedData.ce_oi_chng)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">PE OI Change</span>
                                <span className={selectedData.pe_oi_chng >= 0 ? 'text-red-600' : 'text-green-600'}>
                                    {selectedData.pe_oi_chng >= 0 ? '+' : ''}{formatNumber(selectedData.pe_oi_chng)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">CE LTP</span>
                                <span className="font-medium">₹{selectedData.ce_ltp.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">PE LTP</span>
                                <span className="font-medium">₹{selectedData.pe_ltp.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Strikes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Call OI - Resistance */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
                        <h3 className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                            <ArrowTrendingUpIcon className="w-5 h-5" />
                            Top Resistance Levels (Max Call OI)
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {topCEStrikes.map((row, i) => (
                            <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" onClick={() => setSelectedStrike(row.strike)}>
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                        {i + 1}
                                    </span>
                                    <span className="font-bold">{row.strike}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPCRColor(row.pcr_oi)}`}>
                                        PCR {row.pcr_oi.toFixed(2)}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-green-600">{formatNumber(row.ce_oi)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Put OI - Support */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
                        <h3 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                            <ArrowTrendingDownIcon className="w-5 h-5" />
                            Top Support Levels (Max Put OI)
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {topPEStrikes.map((row, i) => (
                            <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" onClick={() => setSelectedStrike(row.strike)}>
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                        {i + 1}
                                    </span>
                                    <span className="font-bold">{row.strike}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPCRColor(row.pcr_oi)}`}>
                                        PCR {row.pcr_oi.toFixed(2)}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-red-600">{formatNumber(row.pe_oi)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OIAnalysis;

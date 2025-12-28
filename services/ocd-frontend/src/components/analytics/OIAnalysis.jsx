/**
 * OI Analysis Component - Enhanced
 * Focused analysis of Open Interest distribution with:
 * - K/M/B/T number formatting
 * - Strike-wise PCR (OI and OI Change)
 * - Clickable strikes with Support/Resistance info
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectPCR, selectTotalOI, selectMaxPainStrike, selectDataSymbol } from '../../context/selectors';
import { ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, FireIcon, XMarkIcon } from '@heroicons/react/24/outline';

const OIAnalysis = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const pcr = useSelector(selectPCR);
    const totalOI = useSelector(selectTotalOI);
    const maxPain = useSelector(selectMaxPainStrike);
    const dataSymbol = useSelector(selectDataSymbol);
    
    const [hoveredStrike, setHoveredStrike] = useState(null);
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
                const pcr_oi_chng = ce_oi_chng !== 0 ? Math.abs(pe_oi_chng / ce_oi_chng) : 0;
                
                // Reversal values for support/resistance
                const ce_reversal = ce.reversal || 0;
                const pe_reversal = pe.reversal || 0;
                
                return {
                    strike: parseFloat(strike),
                    ce_oi,
                    pe_oi,
                    ce_oi_chng,
                    pe_oi_chng,
                    pcr_oi,
                    pcr_oi_chng,
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

    const maxOI = useMemo(() => 
        Math.max(...oiData.flatMap(d => [d.ce_oi, d.pe_oi]), 1),
    [oiData]);

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
                    <div className="text-xs opacity-80 mb-1">Total Call OI</div>
                    <div className="text-2xl font-bold">{formatNumber(totalOI.calls)}</div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Total Put OI</div>
                    <div className="text-2xl font-bold">{formatNumber(totalOI.puts)}</div>
                </div>
                <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700`}>
                    <div className="text-xs text-gray-500 mb-1">PCR</div>
                    <div className={`text-2xl font-bold ${pcrColor}`}>{pcr?.toFixed(2)}</div>
                    <div className={`text-xs ${pcrColor}`}>{pcrLabel}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1 flex items-center gap-1"><FireIcon className="w-3 h-3" /> Max Pain</div>
                    <div className="text-2xl font-bold">{maxPain}</div>
                    <div className="text-xs opacity-80">{((maxPain - spotPrice) / spotPrice * 100).toFixed(2)}% from spot</div>
                </div>
            </div>

            {/* Selected Strike Modal */}
            {selectedStrike && selectedData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStrike(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
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
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">CE IV / PE IV</span>
                                <span className="font-medium">{selectedData.ce_iv.toFixed(1)}% / {selectedData.pe_iv.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main OI Chart with PCR */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-blue-500" />
                        OI Distribution by Strike
                    </h3>
                    <span className="text-xs text-gray-500">Click any strike for details</span>
                </div>
                <div className="p-4 overflow-x-auto">
                    <div className="min-w-[700px]">
                        {/* Header */}
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2 pb-2 border-b">
                            <div className="w-16 text-right">CE OI</div>
                            <div className="flex-1"></div>
                            <div className="w-12 text-center">Strike</div>
                            <div className="w-10 text-center">PCR</div>
                            <div className="flex-1"></div>
                            <div className="w-16 text-left">PE OI</div>
                        </div>

                        {/* Rows */}
                        {oiData.map((row, i) => {
                            const ceWidth = (row.ce_oi / maxOI) * 100;
                            const peWidth = (row.pe_oi / maxOI) * 100;
                            const isATM = row.strike === atmStrike;
                            const isHovered = hoveredStrike === row.strike;
                            const isNearSpot = Math.abs(row.strike - spotPrice) <= 100;

                            return (
                                <div 
                                    key={i} 
                                    className={`flex items-center gap-1 py-1.5 cursor-pointer rounded transition-all ${isATM ? 'bg-blue-100 dark:bg-blue-900/40' : ''} ${isHovered ? 'bg-gray-100 dark:bg-gray-700/50' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/30`}
                                    onMouseEnter={() => setHoveredStrike(row.strike)}
                                    onMouseLeave={() => setHoveredStrike(null)}
                                    onClick={() => setSelectedStrike(row.strike)}
                                >
                                    {/* CE OI Value */}
                                    <div className="w-16 text-right text-xs font-medium text-green-600">
                                        {formatNumber(row.ce_oi)}
                                    </div>

                                    {/* CE OI Bar */}
                                    <div className="flex-1 flex justify-end items-center">
                                        <div className="h-6 rounded-l relative overflow-hidden" style={{ width: `${ceWidth}%` }}>
                                            <div className={`absolute inset-0 ${row.ce_oi_chng > 0 ? 'bg-gradient-to-l from-green-500 to-green-400' : 'bg-gradient-to-l from-green-300 to-green-200'}`} />
                                            {row.ce_oi_chng !== 0 && (
                                                <div className={`absolute right-1 top-1 text-[8px] font-bold ${row.ce_oi_chng > 0 ? 'text-green-800' : 'text-red-600'}`}>
                                                    {row.ce_oi_chng > 0 ? '+' : ''}{formatNumber(row.ce_oi_chng)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Strike */}
                                    <div className={`w-12 text-center text-xs font-bold py-1 rounded ${isATM ? 'bg-blue-500 text-white' : isNearSpot ? 'bg-gray-200 dark:bg-gray-600' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                        {row.strike}
                                    </div>

                                    {/* Strike PCR Badge */}
                                    <div className={`w-10 text-center text-[9px] font-bold py-0.5 px-1 rounded ${getPCRColor(row.pcr_oi)}`}>
                                        {row.pcr_oi > 0 ? row.pcr_oi.toFixed(1) : '-'}
                                    </div>

                                    {/* PE OI Bar */}
                                    <div className="flex-1 flex items-center">
                                        <div className="h-6 rounded-r relative overflow-hidden" style={{ width: `${peWidth}%` }}>
                                            <div className={`absolute inset-0 ${row.pe_oi_chng > 0 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-red-300 to-red-200'}`} />
                                            {row.pe_oi_chng !== 0 && (
                                                <div className={`absolute left-1 top-1 text-[8px] font-bold ${row.pe_oi_chng > 0 ? 'text-red-800' : 'text-green-600'}`}>
                                                    {row.pe_oi_chng > 0 ? '+' : ''}{formatNumber(row.pe_oi_chng)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* PE OI Value */}
                                    <div className="w-16 text-left text-xs font-medium text-red-600">
                                        {formatNumber(row.pe_oi)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    {/* Legend */}
                    <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Call OI</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Put OI</span>
                        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-blue-500" /> ATM</span>
                        <span className="text-gray-400">PCR: PE/CE ratio</span>
                    </div>
                </div>
            </div>

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
                                    {row.ce_oi_chng !== 0 && (
                                        <div className={`text-xs ${row.ce_oi_chng > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {row.ce_oi_chng > 0 ? '+' : ''}{formatNumber(row.ce_oi_chng)}
                                        </div>
                                    )}
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
                                    {row.pe_oi_chng !== 0 && (
                                        <div className={`text-xs ${row.pe_oi_chng > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            {row.pe_oi_chng > 0 ? '+' : ''}{formatNumber(row.pe_oi_chng)}
                                        </div>
                                    )}
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

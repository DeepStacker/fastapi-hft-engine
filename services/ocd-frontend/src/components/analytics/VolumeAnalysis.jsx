/**
 * Volume Analysis Component
 * Focused analysis of trading volume patterns
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import { ChartBarIcon, BoltIcon } from '@heroicons/react/24/outline';

const VolumeAnalysis = () => {
    const optionChain = useSelector(selectOptionChain);
    const _spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const [hoveredStrike, setHoveredStrike] = useState(null);

    const volumeData = useMemo(() => {
        if (!optionChain) return [];
        
        return Object.entries(optionChain)
            .map(([strike, data]) => {
                const ce = data.ce || {};
                const pe = data.pe || {};
                return {
                    strike: parseFloat(strike),
                    ce_vol: ce.volume || ce.vol || 0,
                    pe_vol: pe.volume || pe.vol || 0,
                    ce_ltp: ce.ltp || 0,
                    pe_ltp: pe.ltp || 0,
                    ce_oi: ce.OI || ce.oi || 0,
                    pe_oi: pe.OI || pe.oi || 0,
                    ce_vol_oi_ratio: (ce.volume || ce.vol || 0) / (ce.OI || ce.oi || 1),
                    pe_vol_oi_ratio: (pe.volume || pe.vol || 0) / (pe.OI || pe.oi || 1),
                };
            })
            .filter(d => d.ce_vol > 0 || d.pe_vol > 0)
            .sort((a, b) => a.strike - b.strike);
    }, [optionChain]);

    // Volume totals
    const totals = useMemo(() => {
        const totalCE = volumeData.reduce((sum, d) => sum + d.ce_vol, 0);
        const totalPE = volumeData.reduce((sum, d) => sum + d.pe_vol, 0);
        return { ce: totalCE, pe: totalPE, ratio: totalCE / (totalPE || 1) };
    }, [volumeData]);

    // Top volume spikes (high vol/oi ratio)
    const volumeSpikes = useMemo(() => {
        const spikes = [];
        volumeData.forEach(d => {
            if (d.ce_vol_oi_ratio > 0.5) spikes.push({ strike: d.strike, type: 'CE', ratio: d.ce_vol_oi_ratio, vol: d.ce_vol });
            if (d.pe_vol_oi_ratio > 0.5) spikes.push({ strike: d.strike, type: 'PE', ratio: d.pe_vol_oi_ratio, vol: d.pe_vol });
        });
        return spikes.sort((a, b) => b.ratio - a.ratio).slice(0, 6);
    }, [volumeData]);

    const maxVol = useMemo(() => Math.max(...volumeData.flatMap(d => [d.ce_vol, d.pe_vol]), 1), [volumeData]);

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
            {/* Premium Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl p-5 text-white shadow-lg shadow-cyan-500/25">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    <div className="relative">
                        <div className="text-xs opacity-80 mb-1 font-medium">Total Call Volume</div>
                        <div className="text-3xl font-bold">{formatNumber(totals.ce)}</div>
                        <div className="text-xs opacity-70 mt-1">Contracts traded</div>
                    </div>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg shadow-pink-500/25">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    <div className="relative">
                        <div className="text-xs opacity-80 mb-1 font-medium">Total Put Volume</div>
                        <div className="text-3xl font-bold">{formatNumber(totals.pe)}</div>
                        <div className="text-xs opacity-70 mt-1">Contracts traded</div>
                    </div>
                </div>
                <div className="glass rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-500 mb-1 font-medium">Volume Ratio (CE/PE)</div>
                    <div className={`text-3xl font-bold ${totals.ratio > 1 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {totals.ratio.toFixed(2)}
                    </div>
                    <div className={`text-xs mt-1 ${totals.ratio > 1 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {totals.ratio > 1 ? '↑ More calls' : '↓ More puts'}
                    </div>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/25">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    <div className="relative">
                        <div className="text-xs opacity-80 mb-1 font-medium">Active Strikes</div>
                        <div className="text-3xl font-bold">{volumeData.length}</div>
                        <div className="text-xs opacity-70 mt-1">With volume</div>
                    </div>
                </div>
            </div>

            {/* Volume Spikes Alert */}
            {volumeSpikes.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4">
                    <h3 className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-3">
                        <BoltIcon className="w-5 h-5" />
                        Volume Spike Alerts (High Volume/OI Ratio)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {volumeSpikes.map((spike, i) => (
                            <div 
                                key={i} 
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${spike.type === 'CE' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}
                            >
                                {spike.strike} {spike.type} • {(spike.ratio * 100).toFixed(0)}% Vol/OI
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Volume Distribution Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-cyan-500" />
                        Volume Distribution by Strike
                    </h3>
                </div>
                <div className="p-4 overflow-x-auto">
                    <div className="min-w-[600px] space-y-1">
                        {volumeData.map((row, i) => {
                            const ceWidth = (row.ce_vol / maxVol) * 100;
                            const peWidth = (row.pe_vol / maxVol) * 100;
                            const isATM = row.strike === atmStrike;
                            const isHovered = hoveredStrike === row.strike;

                            return (
                                <div 
                                    key={i} 
                                    className={`flex items-center gap-1 py-1 cursor-pointer rounded ${isATM ? 'bg-blue-50 dark:bg-blue-900/30' : ''} ${isHovered ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}
                                    onMouseEnter={() => setHoveredStrike(row.strike)}
                                    onMouseLeave={() => setHoveredStrike(null)}
                                >
                                    {/* CE Volume Bar */}
                                    <div className="flex-1 flex justify-end items-center gap-1">
                                        {isHovered && <span className="text-[10px] text-cyan-600 font-medium">{formatNumber(row.ce_vol)}</span>}
                                        <div 
                                            className="h-4 rounded-l bg-gradient-to-l from-cyan-500 to-cyan-400"
                                            style={{ width: `${ceWidth}%` }}
                                        />
                                    </div>

                                    {/* Strike */}
                                    <div className={`w-14 text-center text-xs font-bold py-1 rounded ${isATM ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                        {row.strike}
                                    </div>

                                    {/* PE Volume Bar */}
                                    <div className="flex-1 flex items-center gap-1">
                                        <div 
                                            className="h-4 rounded-r bg-gradient-to-r from-pink-500 to-pink-400"
                                            style={{ width: `${peWidth}%` }}
                                        />
                                        {isHovered && <span className="text-[10px] text-pink-600 font-medium">{formatNumber(row.pe_vol)}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-500" /> Call Volume</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pink-500" /> Put Volume</span>
                    </div>
                </div>
            </div>

            {/* Volume Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold">Strike-wise Volume Details</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="p-2 text-center">Strike</th>
                                <th className="p-2 text-right text-cyan-600">CE Vol</th>
                                <th className="p-2 text-right text-cyan-600">CE LTP</th>
                                <th className="p-2 text-right text-cyan-600">Vol/OI %</th>
                                <th className="p-2 text-left text-pink-600">Vol/OI %</th>
                                <th className="p-2 text-left text-pink-600">PE LTP</th>
                                <th className="p-2 text-left text-pink-600">PE Vol</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {volumeData.slice(0, 20).map((row, i) => (
                                <tr key={i} className={row.strike === atmStrike ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                                    <td className="p-2 text-center font-bold">{row.strike}</td>
                                    <td className="p-2 text-right">{formatNumber(row.ce_vol)}</td>
                                    <td className="p-2 text-right">{row.ce_ltp.toFixed(2)}</td>
                                    <td className="p-2 text-right">
                                        <span className={`px-1 rounded ${row.ce_vol_oi_ratio > 0.5 ? 'bg-amber-100 text-amber-700' : ''}`}>
                                            {(row.ce_vol_oi_ratio * 100).toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="p-2 text-left">
                                        <span className={`px-1 rounded ${row.pe_vol_oi_ratio > 0.5 ? 'bg-amber-100 text-amber-700' : ''}`}>
                                            {(row.pe_vol_oi_ratio * 100).toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="p-2 text-left">{row.pe_ltp.toFixed(2)}</td>
                                    <td className="p-2 text-left">{formatNumber(row.pe_vol)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default VolumeAnalysis;

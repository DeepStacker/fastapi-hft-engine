/**
 * Volume Spike Detection Component
 * Flags contracts with unusual volume indicating potential breakouts
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    BoltIcon, ArrowUpIcon, ChartBarIcon, FunnelIcon
} from '@heroicons/react/24/outline';

const VolumeSpikeDetection = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);

    const [multiplier, setMultiplier] = useState(3); // Volume > 3x average

    const formatNumber = (num) => {
        if (!num) return '0';
        const abs = Math.abs(num);
        if (abs >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
        if (abs >= 1e5) return (num / 1e5).toFixed(2) + 'L';
        if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toFixed(0);
    };

    // Detect volume spikes
    const volumeData = useMemo(() => {
        if (!optionChain) return { spikes: [], avgVol: 0, maxVol: 0 };

        const allContracts = [];

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            ['ce', 'pe'].forEach(type => {
                const leg = data[type];
                if (!leg) return;

                const vol = leg.vol || leg.volume || 0;
                const oi = leg.oi || leg.OI || 0;
                const oiChg = leg.oichng || leg.oi_change || 0;
                const ltp = leg.ltp || 0;
                const pChg = leg.p_chng || 0;
                const pVol = leg.pVol || 0;

                if (vol === 0) return;

                allContracts.push({
                    strike,
                    type: type.toUpperCase(),
                    vol,
                    pVol,
                    volChange: pVol > 0 ? ((vol - pVol) / pVol * 100) : 0,
                    oi,
                    oiChg,
                    ltp,
                    pChg,
                    pChgPct: ltp > 0 ? (pChg / ltp * 100) : 0,
                    premium: vol * ltp,
                    volOIRatio: oi > 0 ? (vol / oi * 100) : 0
                });
            });
        });

        // Calculate average volume
        const avgVol = allContracts.length > 0
            ? allContracts.reduce((sum, c) => sum + c.vol, 0) / allContracts.length
            : 0;

        const maxVol = Math.max(...allContracts.map(c => c.vol), 1);

        // Find spikes (volume > multiplier × average)
        const spikes = allContracts
            .filter(c => c.vol > avgVol * multiplier)
            .map(c => ({
                ...c,
                spikeRatio: avgVol > 0 ? (c.vol / avgVol) : 0
            }))
            .sort((a, b) => b.spikeRatio - a.spikeRatio);

        return { spikes: spikes.slice(0, 15), avgVol, maxVol, total: allContracts.length };
    }, [optionChain, multiplier]);

    // Summary
    const summary = useMemo(() => {
        const calls = volumeData.spikes.filter(s => s.type === 'CE');
        const puts = volumeData.spikes.filter(s => s.type === 'PE');
        const bullish = volumeData.spikes.filter(s =>
            (s.type === 'CE' && s.pChgPct > 0) || (s.type === 'PE' && s.pChgPct < 0)
        );
        const bearish = volumeData.spikes.filter(s =>
            (s.type === 'CE' && s.pChgPct < 0) || (s.type === 'PE' && s.pChgPct > 0)
        );
        const totalPremium = volumeData.spikes.reduce((sum, s) => sum + s.premium, 0);

        return { calls: calls.length, puts: puts.length, bullish: bullish.length, bearish: bearish.length, totalPremium };
    }, [volumeData.spikes]);

    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-3">
                <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-1 text-xs opacity-80 mb-1">
                        <BoltIcon className="w-3 h-3" />
                        Volume Spikes
                    </div>
                    <div className="text-2xl font-bold">{volumeData.spikes.length}</div>
                    <div className="text-[10px] opacity-70">Above {multiplier}x avg</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-green-600 mb-1">Call Spikes</div>
                    <div className="text-xl font-bold text-green-600">{summary.calls}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-red-600 mb-1">Put Spikes</div>
                    <div className="text-xl font-bold text-red-600">{summary.puts}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1">Premium Traded</div>
                    <div className="text-xl font-bold">₹{formatNumber(summary.totalPremium)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1">Avg Volume</div>
                    <div className="text-xl font-bold">{formatNumber(volumeData.avgVol)}</div>
                </div>
            </div>

            {/* Multiplier Control */}
            <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                <FunnelIcon className="w-4 h-4 text-orange-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Spike Threshold:</span>
                <input
                    type="range"
                    min={2}
                    max={10}
                    step={0.5}
                    value={multiplier}
                    onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                    className="w-32 h-1.5 accent-orange-500"
                />
                <span className="text-sm font-bold text-orange-600 w-12">{multiplier}x</span>
                <span className="text-[10px] text-gray-400">above average</span>
            </div>

            {/* Spikes Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ArrowUpIcon className="w-4 h-4" />
                        <span className="font-semibold text-sm">High Volume Contracts</span>
                    </div>
                    <span className="text-xs opacity-80">Sorted by spike ratio</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="py-2 px-3 text-left font-medium text-gray-500">Spike</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-500">Strike</th>
                                <th className="py-2 px-3 text-center font-medium text-gray-500">Type</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">Volume</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">Vol/OI</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">OI Chg</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">LTP</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">Chg%</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">Premium</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {volumeData.spikes.length === 0 ? (
                                <tr><td colSpan={9} className="py-8 text-center text-gray-400">No volume spikes detected at {multiplier}x threshold</td></tr>
                            ) : (
                                volumeData.spikes.map((item, i) => (
                                    <tr key={i} className="hover:bg-orange-50 dark:hover:bg-orange-900/10">
                                        <td className="py-2 px-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-lg ${item.spikeRatio >= 5 ? 'text-red-600' : item.spikeRatio >= 3 ? 'text-orange-600' : 'text-amber-600'}`}>
                                                    {item.spikeRatio >= 5 ? '🔥' : item.spikeRatio >= 3 ? '⚡' : '📈'}
                                                </span>
                                                <span className="font-bold text-orange-600">{item.spikeRatio.toFixed(1)}x</span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3 font-bold">{item.strike}</td>
                                        <td className="py-2 px-3 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.type === 'CE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>{item.type}</span>
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-orange-600">{formatNumber(item.vol)}</td>
                                        <td className="py-2 px-3 text-right">
                                            <span className={item.volOIRatio > 100 ? 'text-red-600 font-bold' : ''}>
                                                {item.volOIRatio.toFixed(0)}%
                                            </span>
                                        </td>
                                        <td className={`py-2 px-3 text-right ${item.oiChg > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.oiChg > 0 ? '+' : ''}{formatNumber(item.oiChg)}
                                        </td>
                                        <td className="py-2 px-3 text-right">₹{item.ltp.toFixed(2)}</td>
                                        <td className={`py-2 px-3 text-right font-medium ${item.pChgPct > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.pChgPct > 0 ? '+' : ''}{item.pChgPct.toFixed(1)}%
                                        </td>
                                        <td className="py-2 px-3 text-right font-medium">₹{formatNumber(item.premium)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Interpretation */}
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-400">
                <strong>Interpretation:</strong>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                    <li>🔥 <strong>5x+ spike</strong> - Extremely unusual, possible large institutional order</li>
                    <li>⚡ <strong>3-5x spike</strong> - Significant activity, watch for breakout</li>
                    <li>📈 <strong>2-3x spike</strong> - Elevated interest, monitor for confirmation</li>
                    <li><strong>Vol/OI &gt; 100%</strong> - Day trading activity, positions being churned</li>
                </ul>
            </div>
        </div>
    );
};

export default VolumeSpikeDetection;

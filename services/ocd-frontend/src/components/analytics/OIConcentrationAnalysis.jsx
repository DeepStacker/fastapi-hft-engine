/**
 * OI Concentration Analysis
 * Shows % of total OI at each strike to identify "walls"
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectTotalOI } from '../../context/selectors';
import {
    ChartBarIcon, ShieldCheckIcon, ShieldExclamationIcon
} from '@heroicons/react/24/outline';

const OIConcentrationAnalysis = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const totalOI = useSelector(selectTotalOI);

    const [showType, setShowType] = useState('both'); // 'both', 'ce', 'pe'

    const formatNumber = (num) => {
        if (!num) return '0';
        const abs = Math.abs(num);
        if (abs >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
        if (abs >= 1e5) return (num / 1e5).toFixed(2) + 'L';
        if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toFixed(0);
    };

    // Calculate OI concentration
    const concentration = useMemo(() => {
        if (!optionChain || !totalOI) return null;

        const strikes = [];
        const totalCE = totalOI.calls || 1;
        const totalPE = totalOI.puts || 1;

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);
            const ceOI = data.ce?.oi || data.ce?.OI || 0;
            const peOI = data.pe?.oi || data.pe?.OI || 0;

            const cePct = (ceOI / totalCE) * 100;
            const pePct = (peOI / totalPE) * 100;

            strikes.push({
                strike,
                ceOI, peOI,
                cePct, pePct,
                totalPct: ((ceOI + peOI) / (totalCE + totalPE)) * 100
            });
        });

        strikes.sort((a, b) => a.strike - b.strike);

        // Find walls (>5% concentration)
        const ceWalls = strikes.filter(s => s.cePct >= 5).sort((a, b) => b.cePct - a.cePct);
        const peWalls = strikes.filter(s => s.pePct >= 5).sort((a, b) => b.pePct - a.pePct);

        // Max concentration
        const maxCEPct = Math.max(...strikes.map(s => s.cePct));
        const maxPEPct = Math.max(...strikes.map(s => s.pePct));

        return { strikes, ceWalls, peWalls, maxCEPct, maxPEPct };
    }, [optionChain, totalOI]);

    // Filter visible strikes around ATM
    const visibleStrikes = useMemo(() => {
        if (!concentration) return [];
        const atmIdx = concentration.strikes.findIndex(s => s.strike >= atmStrike);
        const start = Math.max(0, atmIdx - 10);
        const end = Math.min(concentration.strikes.length, atmIdx + 11);
        return concentration.strikes.slice(start, end);
    }, [concentration, atmStrike]);

    if (!optionChain || !concentration) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Wall Summary */}
            <div className="grid grid-cols-2 gap-4">
                {/* Resistance Walls (CE) */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center gap-2">
                        <ShieldExclamationIcon className="w-4 h-4" />
                        <span className="font-semibold text-sm">Resistance Walls (CE)</span>
                    </div>
                    <div className="p-3">
                        {concentration.ceWalls.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-xs">No major walls (&gt;5%)</div>
                        ) : (
                            <div className="space-y-2">
                                {concentration.ceWalls.slice(0, 5).map((wall, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                                                }`}>{i + 1}</span>
                                            <span className="font-bold">{wall.strike}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, wall.cePct * 5)}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold text-red-600">{wall.cePct.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Support Walls (PE) */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-2">
                        <ShieldCheckIcon className="w-4 h-4" />
                        <span className="font-semibold text-sm">Support Walls (PE)</span>
                    </div>
                    <div className="p-3">
                        {concentration.peWalls.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-xs">No major walls (&gt;5%)</div>
                        ) : (
                            <div className="space-y-2">
                                {concentration.peWalls.slice(0, 5).map((wall, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                                                }`}>{i + 1}</span>
                                            <span className="font-bold">{wall.strike}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, wall.pePct * 5)}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold text-green-600">{wall.pePct.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Toggle */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
                {['both', 'ce', 'pe'].map(type => (
                    <button
                        key={type}
                        onClick={() => setShowType(type)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${showType === type
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        {type === 'both' ? 'Both' : type.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* Concentration Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                    <h3 className="font-semibold text-sm">OI Concentration by Strike</h3>
                </div>
                <div className="p-4">
                    <div className="space-y-1">
                        {visibleStrikes.map((row, i) => {
                            const isATM = row.strike === atmStrike;
                            return (
                                <div key={i} className={`flex items-center gap-2 py-1 ${isATM ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg px-2' : ''}`}>
                                    <div className={`w-16 text-right font-bold text-xs ${isATM ? 'text-blue-600' : ''}`}>
                                        {row.strike}
                                    </div>

                                    {/* CE Bar (reversed) */}
                                    {(showType === 'both' || showType === 'ce') && (
                                        <div className="flex-1 flex justify-end">
                                            <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-l overflow-hidden flex justify-end">
                                                <div
                                                    className={`h-full ${row.cePct >= 5 ? 'bg-red-500' : 'bg-red-300'} flex items-center justify-start pl-1 transition-all`}
                                                    style={{ width: `${Math.min(100, row.cePct * 10)}%` }}
                                                >
                                                    {row.cePct >= 3 && <span className="text-[8px] text-white font-bold">{row.cePct.toFixed(1)}%</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {showType === 'both' && (
                                        <div className="w-6 text-center text-[10px] text-gray-400">|</div>
                                    )}

                                    {/* PE Bar */}
                                    {(showType === 'both' || showType === 'pe') && (
                                        <div className="flex-1">
                                            <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-r overflow-hidden">
                                                <div
                                                    className={`h-full ${row.pePct >= 5 ? 'bg-green-500' : 'bg-green-300'} flex items-center justify-end pr-1 transition-all`}
                                                    style={{ width: `${Math.min(100, row.pePct * 10)}%` }}
                                                >
                                                    {row.pePct >= 3 && <span className="text-[8px] text-white font-bold">{row.pePct.toFixed(1)}%</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 mt-4 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> CE Wall (&gt;5%)</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-300"></span> CE Normal</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500"></span> PE Wall (&gt;5%)</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-300"></span> PE Normal</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OIConcentrationAnalysis;

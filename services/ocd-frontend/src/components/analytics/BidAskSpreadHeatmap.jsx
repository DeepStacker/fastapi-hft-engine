/**
 * Bid-Ask Spread Heatmap
 * Shows liquidity across strikes - wider spreads = less liquidity
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    CurrencyDollarIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const BidAskSpreadHeatmap = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);

    const [viewMode, setViewMode] = useState('spread'); // 'spread', 'spreadPct', 'liquidity'

    // Calculate bid-ask spread data
    const spreadData = useMemo(() => {
        if (!optionChain) return { strikes: [], avgSpread: 0, maxSpread: 0 };

        const strikes = [];
        let totalSpreadPct = 0;
        let count = 0;

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            const ceBid = data.ce?.bid || 0;
            const ceAsk = data.ce?.ask || 0;
            const ceLtp = data.ce?.ltp || 0;
            const peBid = data.pe?.bid || 0;
            const peAsk = data.pe?.ask || 0;
            const peLtp = data.pe?.ltp || 0;

            const ceSpread = ceAsk - ceBid;
            const peSpread = peAsk - peBid;
            const ceSpreadPct = ceLtp > 0 ? (ceSpread / ceLtp) * 100 : 0;
            const peSpreadPct = peLtp > 0 ? (peSpread / peLtp) * 100 : 0;

            // Liquidity score (inverse of spread %)
            const ceLiquidity = ceSpreadPct > 0 ? Math.min(100, 100 / ceSpreadPct) : 100;
            const peLiquidity = peSpreadPct > 0 ? Math.min(100, 100 / peSpreadPct) : 100;

            if (ceSpread > 0 || peSpread > 0) {
                totalSpreadPct += (ceSpreadPct + peSpreadPct) / 2;
                count++;
            }

            strikes.push({
                strike,
                ceSpread, peSpread,
                ceSpreadPct, peSpreadPct,
                ceLiquidity, peLiquidity,
                ceBid, ceAsk, ceLtp,
                peBid, peAsk, peLtp
            });
        });

        strikes.sort((a, b) => a.strike - b.strike);

        const avgSpreadPct = count > 0 ? totalSpreadPct / count : 0;
        const maxSpread = Math.max(...strikes.flatMap(s => [s.ceSpread, s.peSpread]));
        const maxSpreadPct = Math.max(...strikes.flatMap(s => [s.ceSpreadPct, s.peSpreadPct]));

        return { strikes, avgSpreadPct, maxSpread, maxSpreadPct };
    }, [optionChain]);

    // Filter visible strikes around ATM
    const visibleStrikes = useMemo(() => {
        const atmIdx = spreadData.strikes.findIndex(s => s.strike >= atmStrike);
        const start = Math.max(0, atmIdx - 8);
        const end = Math.min(spreadData.strikes.length, atmIdx + 9);
        return spreadData.strikes.slice(start, end);
    }, [spreadData.strikes, atmStrike]);

    // Illiquid contracts (spread > 5%)
    const illiquidContracts = useMemo(() => {
        return spreadData.strikes.filter(s => s.ceSpreadPct > 5 || s.peSpreadPct > 5);
    }, [spreadData.strikes]);

    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <CurrencyDollarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    // Color based on spread %
    const getSpreadColor = (spreadPct) => {
        if (spreadPct <= 1) return 'bg-emerald-500';
        if (spreadPct <= 2) return 'bg-green-500';
        if (spreadPct <= 3) return 'bg-amber-500';
        if (spreadPct <= 5) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getSpreadOpacity = (spreadPct, maxPct) => {
        return 0.3 + (spreadPct / maxPct) * 0.7;
    };

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Avg Spread %</div>
                    <div className="text-2xl font-bold">{spreadData.avgSpreadPct.toFixed(2)}%</div>
                </div>
                <div className={`rounded-xl p-4 border ${spreadData.avgSpreadPct <= 2 ? 'bg-green-50 border-green-200 dark:bg-green-900/20' :
                        spreadData.avgSpreadPct <= 4 ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20' :
                            'bg-red-50 border-red-200 dark:bg-red-900/20'
                    }`}>
                    <div className="text-[10px] text-gray-500 mb-1">Liquidity</div>
                    <div className={`text-xl font-bold ${spreadData.avgSpreadPct <= 2 ? 'text-green-600' :
                            spreadData.avgSpreadPct <= 4 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                        {spreadData.avgSpreadPct <= 2 ? 'High' : spreadData.avgSpreadPct <= 4 ? 'Medium' : 'Low'}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-orange-600 mb-1 flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-3 h-3" />
                        Illiquid Contracts
                    </div>
                    <div className="text-xl font-bold text-orange-600">{illiquidContracts.length}</div>
                    <div className="text-[9px] text-gray-400">Spread &gt;5%</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1">Max Spread</div>
                    <div className="text-xl font-bold">₹{spreadData.maxSpread.toFixed(2)}</div>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
                {[
                    { id: 'spread', label: 'Spread ₹' },
                    { id: 'spreadPct', label: 'Spread %' },
                    { id: 'liquidity', label: 'Liquidity Score' }
                ].map(mode => (
                    <button
                        key={mode.id}
                        onClick={() => setViewMode(mode.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === mode.id
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        {mode.label}
                    </button>
                ))}
            </div>

            {/* Heatmap Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <CurrencyDollarIcon className="w-4 h-4" />
                        Bid-Ask Spread Heatmap
                    </h3>
                </div>

                <div className="overflow-x-auto p-4">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-gray-500">
                                <th className="py-2 px-2 text-left">Strike</th>
                                <th className="py-2 px-2 text-center" colSpan={3}>CALL</th>
                                <th className="py-2 px-2 text-center" colSpan={3}>PUT</th>
                            </tr>
                            <tr className="text-gray-400 text-[10px]">
                                <th></th>
                                <th className="py-1 px-2">Bid</th>
                                <th className="py-1 px-2">Ask</th>
                                <th className="py-1 px-2">Spread</th>
                                <th className="py-1 px-2">Bid</th>
                                <th className="py-1 px-2">Ask</th>
                                <th className="py-1 px-2">Spread</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {visibleStrikes.map((row, i) => {
                                const isATM = row.strike === atmStrike;
                                const getValue = (type, side) => {
                                    if (viewMode === 'spread') return side === 'ce' ? row.ceSpread.toFixed(2) : row.peSpread.toFixed(2);
                                    if (viewMode === 'spreadPct') return (side === 'ce' ? row.ceSpreadPct : row.peSpreadPct).toFixed(1) + '%';
                                    return (side === 'ce' ? row.ceLiquidity : row.peLiquidity).toFixed(0);
                                };

                                return (
                                    <tr key={i} className={isATM ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                                        <td className={`py-2 px-2 font-bold ${isATM ? 'text-blue-600' : ''}`}>
                                            {row.strike}
                                            {isATM && <span className="ml-1 text-[8px] text-blue-400">ATM</span>}
                                        </td>
                                        <td className="py-2 px-2 text-right text-green-600">₹{row.ceBid.toFixed(2)}</td>
                                        <td className="py-2 px-2 text-right text-red-600">₹{row.ceAsk.toFixed(2)}</td>
                                        <td className="py-2 px-2">
                                            <div
                                                className={`px-2 py-1 rounded text-center text-white font-bold ${getSpreadColor(row.ceSpreadPct)}`}
                                                style={{ opacity: viewMode === 'liquidity' ? row.ceLiquidity / 100 : 1 }}
                                            >
                                                {getValue('spread', 'ce')}
                                            </div>
                                        </td>
                                        <td className="py-2 px-2 text-right text-green-600">₹{row.peBid.toFixed(2)}</td>
                                        <td className="py-2 px-2 text-right text-red-600">₹{row.peAsk.toFixed(2)}</td>
                                        <td className="py-2 px-2">
                                            <div
                                                className={`px-2 py-1 rounded text-center text-white font-bold ${getSpreadColor(row.peSpreadPct)}`}
                                                style={{ opacity: viewMode === 'liquidity' ? row.peLiquidity / 100 : 1 }}
                                            >
                                                {getValue('spread', 'pe')}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Legend */}
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-t flex items-center justify-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> ≤1%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500"></span> 1-2%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> 2-3%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500"></span> 3-5%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> &gt;5%</span>
                </div>
            </div>
        </div>
    );
};

export default BidAskSpreadHeatmap;

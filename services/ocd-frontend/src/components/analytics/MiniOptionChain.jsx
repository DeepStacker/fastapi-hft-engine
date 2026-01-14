/**
 * Mini Option Chain Component
 * Inline option chain with one-click Buy/Sell buttons for quick leg building
 */
import { useMemo, useState } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

const MiniOptionChain = ({
    optionChain,
    spotPrice,
    atmStrike,
    expiry,
    onAddLeg,
    visibleStrikes = 7
}) => {
    const [expanded, setExpanded] = useState(false);
    const [viewMode, setViewMode] = useState('ltp'); // 'ltp', 'oi', 'greeks'

    // Get sorted strikes centered around ATM
    const strikes = useMemo(() => {
        if (!optionChain) return [];
        const all = Object.keys(optionChain).map(Number).sort((a, b) => a - b);

        // Find ATM index
        const atmIndex = all.findIndex(s => s >= atmStrike);
        const halfVisible = Math.floor(visibleStrikes / 2);

        if (expanded) {
            return all;
        }

        // Center around ATM
        const start = Math.max(0, atmIndex - halfVisible);
        const end = Math.min(all.length, start + visibleStrikes);
        return all.slice(start, end);
    }, [optionChain, atmStrike, visibleStrikes, expanded]);

    const handleAddLeg = (strike, type, action) => {
        const data = optionChain[strike];
        const optionData = type === 'CE' ? data?.ce : data?.pe;

        onAddLeg({
            strike,
            type,
            action,
            expiry,
            ltp: optionData?.ltp || 0,
            iv: optionData?.iv || 0.15,
            delta: optionData?.optgeeks?.delta || (type === 'CE' ? 0.5 : -0.5),
            theta: optionData?.optgeeks?.theta || 0,
            gamma: optionData?.optgeeks?.gamma || 0,
            vega: optionData?.optgeeks?.vega || 0
        });
    };

    const formatOI = (oi) => {
        if (!oi) return '-';
        if (oi >= 10000000) return `${(oi / 10000000).toFixed(1)}Cr`;
        if (oi >= 100000) return `${(oi / 100000).toFixed(1)}L`;
        if (oi >= 1000) return `${(oi / 1000).toFixed(1)}K`;
        return oi.toString();
    };

    const formatLTP = (ltp) => {
        if (!ltp) return '-';
        return ltp.toFixed(2);
    };

    if (!optionChain || !spotPrice) {
        return (
            <div className="text-center text-gray-400 py-4 text-sm">
                Load option chain to add legs
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">Option Chain</span>
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        Spot: ₹{spotPrice.toFixed(2)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
                        {['ltp', 'oi', 'greeks'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${viewMode === mode
                                        ? 'bg-white dark:bg-gray-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {mode.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                        {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Chain Table */}
            <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/80 backdrop-blur-sm">
                        <tr>
                            <th colSpan={3} className="py-1.5 px-2 text-center text-emerald-600 border-r border-gray-200 dark:border-gray-600">
                                CALLS
                            </th>
                            <th className="py-1.5 px-2 text-center font-bold">Strike</th>
                            <th colSpan={3} className="py-1.5 px-2 text-center text-rose-600 border-l border-gray-200 dark:border-gray-600">
                                PUTS
                            </th>
                        </tr>
                        <tr className="text-[10px] text-gray-400">
                            <th className="py-1 px-1">B/S</th>
                            <th className="py-1 px-1">
                                {viewMode === 'ltp' && 'LTP'}
                                {viewMode === 'oi' && 'OI'}
                                {viewMode === 'greeks' && 'Δ'}
                            </th>
                            <th className="py-1 px-1 border-r border-gray-200 dark:border-gray-600">
                                {viewMode === 'ltp' && 'IV%'}
                                {viewMode === 'oi' && 'Chg%'}
                                {viewMode === 'greeks' && 'Θ'}
                            </th>
                            <th className="py-1 px-1"></th>
                            <th className="py-1 px-1 border-l border-gray-200 dark:border-gray-600">
                                {viewMode === 'ltp' && 'IV%'}
                                {viewMode === 'oi' && 'Chg%'}
                                {viewMode === 'greeks' && 'Θ'}
                            </th>
                            <th className="py-1 px-1">
                                {viewMode === 'ltp' && 'LTP'}
                                {viewMode === 'oi' && 'OI'}
                                {viewMode === 'greeks' && 'Δ'}
                            </th>
                            <th className="py-1 px-1">B/S</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {strikes.map((strike) => {
                            const data = optionChain[strike];
                            const ce = data?.ce || {};
                            const pe = data?.pe || {};
                            const isATM = strike === atmStrike;
                            const isITM_CE = strike < spotPrice;
                            const isITM_PE = strike > spotPrice;

                            return (
                                <tr
                                    key={strike}
                                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isATM ? 'bg-amber-50 dark:bg-amber-900/20 font-medium' : ''
                                        }`}
                                >
                                    {/* CE Buy/Sell */}
                                    <td className="py-1 px-1">
                                        <div className="flex gap-0.5">
                                            <button
                                                onClick={() => handleAddLeg(strike, 'CE', 'BUY')}
                                                className="px-1.5 py-0.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 text-green-700 dark:text-green-400 rounded text-[9px] font-bold transition-colors"
                                            >
                                                B
                                            </button>
                                            <button
                                                onClick={() => handleAddLeg(strike, 'CE', 'SELL')}
                                                className="px-1.5 py-0.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400 rounded text-[9px] font-bold transition-colors"
                                            >
                                                S
                                            </button>
                                        </div>
                                    </td>
                                    {/* CE Data */}
                                    <td className={`py-1 px-1 text-right ${isITM_CE ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                                        {viewMode === 'ltp' && <span className="font-medium">{formatLTP(ce.ltp)}</span>}
                                        {viewMode === 'oi' && <span>{formatOI(ce.oi)}</span>}
                                        {viewMode === 'greeks' && <span>{(ce.optgeeks?.delta || 0).toFixed(2)}</span>}
                                    </td>
                                    <td className={`py-1 px-1 text-right border-r border-gray-200 dark:border-gray-600 ${isITM_CE ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                                        {viewMode === 'ltp' && <span className="text-gray-500">{((ce.iv || 0) * 100).toFixed(1)}</span>}
                                        {viewMode === 'oi' && <span className={ce.oiChg > 0 ? 'text-green-600' : 'text-red-600'}>{ce.oiChg?.toFixed(1) || '-'}%</span>}
                                        {viewMode === 'greeks' && <span className="text-gray-500">{(ce.optgeeks?.theta || 0).toFixed(1)}</span>}
                                    </td>
                                    {/* Strike */}
                                    <td className={`py-1 px-2 text-center font-bold ${isATM ? 'text-amber-600' : ''}`}>
                                        {strike}
                                        {isATM && <span className="ml-1 text-[8px] text-amber-500">ATM</span>}
                                    </td>
                                    {/* PE Data */}
                                    <td className={`py-1 px-1 text-left border-l border-gray-200 dark:border-gray-600 ${isITM_PE ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}`}>
                                        {viewMode === 'ltp' && <span className="text-gray-500">{((pe.iv || 0) * 100).toFixed(1)}</span>}
                                        {viewMode === 'oi' && <span className={pe.oiChg > 0 ? 'text-green-600' : 'text-red-600'}>{pe.oiChg?.toFixed(1) || '-'}%</span>}
                                        {viewMode === 'greeks' && <span className="text-gray-500">{(pe.optgeeks?.theta || 0).toFixed(1)}</span>}
                                    </td>
                                    <td className={`py-1 px-1 text-left ${isITM_PE ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}`}>
                                        {viewMode === 'ltp' && <span className="font-medium">{formatLTP(pe.ltp)}</span>}
                                        {viewMode === 'oi' && <span>{formatOI(pe.oi)}</span>}
                                        {viewMode === 'greeks' && <span>{(pe.optgeeks?.delta || 0).toFixed(2)}</span>}
                                    </td>
                                    {/* PE Buy/Sell */}
                                    <td className="py-1 px-1">
                                        <div className="flex gap-0.5">
                                            <button
                                                onClick={() => handleAddLeg(strike, 'PE', 'BUY')}
                                                className="px-1.5 py-0.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 text-green-700 dark:text-green-400 rounded text-[9px] font-bold transition-colors"
                                            >
                                                B
                                            </button>
                                            <button
                                                onClick={() => handleAddLeg(strike, 'PE', 'SELL')}
                                                className="px-1.5 py-0.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400 rounded text-[9px] font-bold transition-colors"
                                            >
                                                S
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 text-[10px] text-gray-500">
                Click <span className="text-green-600 font-bold">B</span> to Buy, <span className="text-red-600 font-bold">S</span> to Sell
            </div>
        </div>
    );
};

export default MiniOptionChain;

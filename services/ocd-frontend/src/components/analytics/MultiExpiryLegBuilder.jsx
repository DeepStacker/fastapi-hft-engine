/**
 * Multi-Expiry Leg Builder Component
 * Enhanced leg builder with per-leg expiry selection for calendar/diagonal spreads
 */
import { useState, useMemo, useEffect } from 'react';
import { PlusIcon, CalendarIcon } from '@heroicons/react/24/outline';

const MultiExpiryLegBuilder = ({
    availableExpiries = [],
    optionChainByExpiry = {},
    atmStrike,
    onAddLeg,
    disabled = false
}) => {
    const [selectedExpiry, setSelectedExpiry] = useState(availableExpiries[0] || '');
    const [strike, setStrike] = useState(atmStrike || 0);
    const [type, setType] = useState('CE');
    const [action, setAction] = useState('BUY');

    // Get strikes for selected expiry
    const strikes = useMemo(() => {
        if (!selectedExpiry || !optionChainByExpiry[selectedExpiry]) {
            return [];
        }
        return Object.keys(optionChainByExpiry[selectedExpiry])
            .map(Number)
            .filter(s => !isNaN(s))
            .sort((a, b) => a - b);
    }, [selectedExpiry, optionChainByExpiry]);

    // Update strike when strikes change
    useEffect(() => {
        if (strikes.length > 0 && (!strike || !strikes.includes(strike))) {
            // Find closest to ATM
            const closest = strikes.reduce((prev, curr) =>
                Math.abs(curr - atmStrike) < Math.abs(prev - atmStrike) ? curr : prev
            );
            setStrike(closest);
        }
    }, [strikes, atmStrike, strike]);

    // Update expiry when availableExpiries change
    useEffect(() => {
        if (availableExpiries.length > 0 && !selectedExpiry) {
            setSelectedExpiry(availableExpiries[0]);
        }
    }, [availableExpiries, selectedExpiry]);

    // Get option data for display
    const optionData = useMemo(() => {
        if (!selectedExpiry || !strike) return null;
        const chainData = optionChainByExpiry[selectedExpiry]?.[strike];
        if (!chainData) return null;

        return type === 'CE' ? chainData.ce : chainData.pe;
    }, [selectedExpiry, strike, type, optionChainByExpiry]);

    // Format expiry for display
    const formatExpiry = (expiry) => {
        try {
            const date = new Date(parseInt(expiry));
            return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
        } catch {
            return expiry;
        }
    };

    // Calculate days to expiry
    const daysToExpiry = useMemo(() => {
        if (!selectedExpiry) return null;
        try {
            const expDate = new Date(parseInt(selectedExpiry));
            const now = new Date();
            const diff = expDate.getTime() - now.getTime();
            return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        } catch {
            return null;
        }
    }, [selectedExpiry]);

    const handleAddLeg = () => {
        if (!selectedExpiry || !strike || !optionData) return;

        onAddLeg({
            strike,
            type,
            action,
            expiry: selectedExpiry,
            ltp: optionData.ltp || 0,
            iv: optionData.iv || 0.15,
            delta: optionData.optgeeks?.delta || 0,
            theta: optionData.optgeeks?.theta || 0,
            gamma: optionData.optgeeks?.gamma || 0,
            vega: optionData.optgeeks?.vega || 0,
        });
    };

    return (
        <div className="space-y-4">
            {/* Expiry Selector */}
            <div>
                <label className="text-xs text-gray-500 block mb-1.5 flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Expiry
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {availableExpiries.slice(0, 4).map((expiry, idx) => {
                        const isSelected = selectedExpiry === expiry;
                        const dte = (() => {
                            try {
                                const expDate = new Date(parseInt(expiry));
                                const now = new Date();
                                return Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                            } catch {
                                return '?';
                            }
                        })();

                        return (
                            <button
                                key={expiry}
                                onClick={() => setSelectedExpiry(expiry)}
                                disabled={disabled}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSelected
                                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    } disabled:opacity-50`}
                            >
                                {formatExpiry(expiry)}
                                <span className={`ml-1 ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>
                                    ({dte}d)
                                </span>
                                {idx === 0 && (
                                    <span className="ml-1 text-[9px] bg-amber-400/20 text-amber-600 px-1 rounded">
                                        Near
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Action & Type Row */}
            <div className="flex gap-4">
                <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Action</label>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setAction('BUY')}
                            disabled={disabled}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${action === 'BUY'
                                    ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
                                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                                } disabled:opacity-50`}
                        >
                            BUY
                        </button>
                        <button
                            onClick={() => setAction('SELL')}
                            disabled={disabled}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${action === 'SELL'
                                    ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                                } disabled:opacity-50`}
                        >
                            SELL
                        </button>
                    </div>
                </div>

                <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Type</label>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setType('CE')}
                            disabled={disabled}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${type === 'CE'
                                    ? 'bg-emerald-500 text-white shadow-md'
                                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                                } disabled:opacity-50`}
                        >
                            CE
                        </button>
                        <button
                            onClick={() => setType('PE')}
                            disabled={disabled}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${type === 'PE'
                                    ? 'bg-rose-500 text-white shadow-md'
                                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                                } disabled:opacity-50`}
                        >
                            PE
                        </button>
                    </div>
                </div>
            </div>

            {/* Strike Selector */}
            <div>
                <label className="text-xs text-gray-500 block mb-1.5">Strike</label>
                <div className="flex gap-2">
                    <select
                        value={strike}
                        onChange={(e) => setStrike(Number(e.target.value))}
                        disabled={disabled || strikes.length === 0}
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg 
                            bg-white dark:bg-gray-700 text-sm
                            focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                            disabled:opacity-50"
                    >
                        {strikes.map(s => (
                            <option key={s} value={s}>
                                {s} {s === atmStrike ? '(ATM)' : ''}
                            </option>
                        ))}
                    </select>

                    {optionData && (
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                            <div className="text-gray-500 text-[10px]">LTP</div>
                            <div className="font-medium">₹{optionData.ltp?.toFixed(2) || '—'}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Strike Buttons */}
            <div className="flex gap-1 flex-wrap">
                {[-300, -200, -100, 0, 100, 200, 300].map(offset => {
                    const targetStrike = atmStrike + offset;
                    const exists = strikes.includes(targetStrike);
                    if (!exists) return null;

                    return (
                        <button
                            key={offset}
                            onClick={() => setStrike(targetStrike)}
                            disabled={disabled}
                            className={`px-2 py-1 text-[10px] rounded transition-colors ${strike === targetStrike
                                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium'
                                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-500 hover:bg-gray-100'
                                } disabled:opacity-50`}
                        >
                            {offset === 0 ? 'ATM' : `${offset > 0 ? '+' : ''}${offset}`}
                        </button>
                    );
                })}
            </div>

            {/* Add Button */}
            <button
                onClick={handleAddLeg}
                disabled={disabled || !optionData}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white 
                    rounded-lg font-medium flex items-center justify-center gap-2
                    hover:from-indigo-600 hover:to-purple-600 transition-all
                    shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
                <PlusIcon className="w-4 h-4" />
                Add {action} {strike} {type} ({formatExpiry(selectedExpiry)})
            </button>

            {/* Option Details Preview */}
            {optionData && (
                <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-[10px]">
                    <div>
                        <span className="text-gray-400">IV</span>
                        <span className="ml-1 font-medium">{((optionData.iv || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                        <span className="text-gray-400">Δ</span>
                        <span className="ml-1 font-medium">{(optionData.optgeeks?.delta || 0).toFixed(3)}</span>
                    </div>
                    <div>
                        <span className="text-gray-400">Θ</span>
                        <span className="ml-1 font-medium">{(optionData.optgeeks?.theta || 0).toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="text-gray-400">Γ</span>
                        <span className="ml-1 font-medium">{(optionData.optgeeks?.gamma || 0).toFixed(4)}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiExpiryLegBuilder;

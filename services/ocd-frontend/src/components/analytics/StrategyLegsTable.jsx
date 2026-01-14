/**
 * Strategy Legs Table Component
 * Professional editable table for strategy legs with inline price editing
 */
import { useState, useCallback } from 'react';
import { TrashIcon, DocumentDuplicateIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const StrategyLegsTable = ({
    legs,
    onUpdateLeg,
    onRemoveLeg,
    onDuplicateLeg,
    lotSize = 1,
    formatExpiry
}) => {
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({});

    const startEditing = useCallback((leg) => {
        setEditingId(leg.id);
        setEditValues({
            qty: leg.qty,
            entryPrice: leg.ltp || leg.entryPrice,
            iv: (leg.iv * 100).toFixed(1)
        });
    }, []);

    const saveEditing = useCallback(() => {
        if (editingId) {
            onUpdateLeg(editingId, {
                qty: editValues.qty,
                ltp: parseFloat(editValues.entryPrice),
                entryPrice: parseFloat(editValues.entryPrice),
                iv: parseFloat(editValues.iv) / 100
            });
            setEditingId(null);
        }
    }, [editingId, editValues, onUpdateLeg]);

    const cancelEditing = useCallback(() => {
        setEditingId(null);
        setEditValues({});
    }, []);

    // Calculate totals
    const totals = legs.reduce((acc, leg) => {
        const value = leg.ltp * leg.qty * lotSize;
        const direction = leg.action === 'SELL' ? 1 : -1;
        acc.premium += value * direction;
        acc.delta += (leg.delta || 0) * leg.qty * (leg.action === 'BUY' ? 1 : -1);
        acc.gamma += (leg.gamma || 0) * leg.qty * (leg.action === 'BUY' ? 1 : -1);
        acc.theta += (leg.theta || 0) * leg.qty * (leg.action === 'BUY' ? 1 : -1);
        acc.vega += (leg.vega || 0) * leg.qty * (leg.action === 'BUY' ? 1 : -1);
        return acc;
    }, { premium: 0, delta: 0, gamma: 0, theta: 0, vega: 0 });

    if (legs.length === 0) {
        return (
            <div className="text-center text-gray-400 py-8 text-sm">
                Add legs from the option chain above
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr className="text-gray-500 dark:text-gray-400">
                            <th className="py-2 px-2 text-left font-medium">#</th>
                            <th className="py-2 px-2 text-left font-medium">Action</th>
                            <th className="py-2 px-2 text-center font-medium">Strike</th>
                            <th className="py-2 px-2 text-center font-medium">Type</th>
                            <th className="py-2 px-2 text-center font-medium">Expiry</th>
                            <th className="py-2 px-2 text-center font-medium">Qty</th>
                            <th className="py-2 px-2 text-right font-medium">Entry ₹</th>
                            <th className="py-2 px-2 text-right font-medium">IV%</th>
                            <th className="py-2 px-2 text-right font-medium">Delta</th>
                            <th className="py-2 px-2 text-right font-medium">Value</th>
                            <th className="py-2 px-2 text-center font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {legs.map((leg, index) => {
                            const isEditing = editingId === leg.id;
                            const value = leg.ltp * leg.qty * lotSize;
                            const valueDisplay = leg.action === 'SELL' ? `+₹${value.toFixed(0)}` : `-₹${value.toFixed(0)}`;

                            return (
                                <tr
                                    key={leg.id}
                                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                        }`}
                                >
                                    <td className="py-2 px-2 text-gray-400">{index + 1}</td>
                                    <td className="py-2 px-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${leg.action === 'BUY'
                                                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                                                : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                                            }`}>
                                            {leg.action}
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 text-center font-bold">{leg.strike}</td>
                                    <td className="py-2 px-2 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${leg.type === 'CE'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                            }`}>
                                            {leg.type}
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 text-center text-gray-500">
                                        {formatExpiry ? formatExpiry(leg.expiry) : leg.expiry}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                min="1"
                                                value={editValues.qty}
                                                onChange={(e) => setEditValues(prev => ({ ...prev, qty: parseInt(e.target.value) || 1 }))}
                                                className="w-12 text-center border border-blue-300 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-700"
                                            />
                                        ) : (
                                            <span className="font-medium">{leg.qty}</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.05"
                                                value={editValues.entryPrice}
                                                onChange={(e) => setEditValues(prev => ({ ...prev, entryPrice: e.target.value }))}
                                                className="w-16 text-right border border-blue-300 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-700"
                                            />
                                        ) : (
                                            <span>₹{leg.ltp?.toFixed(2)}</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={editValues.iv}
                                                onChange={(e) => setEditValues(prev => ({ ...prev, iv: e.target.value }))}
                                                className="w-14 text-right border border-blue-300 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-700"
                                            />
                                        ) : (
                                            <span className="text-gray-500">{((leg.iv || 0) * 100).toFixed(1)}</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                        <span className={leg.delta > 0 ? 'text-green-600' : 'text-red-600'}>
                                            {(leg.delta || 0).toFixed(3)}
                                        </span>
                                    </td>
                                    <td className={`py-2 px-2 text-right font-medium ${leg.action === 'SELL' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {valueDisplay}
                                    </td>
                                    <td className="py-2 px-2">
                                        <div className="flex items-center justify-center gap-0.5">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        onClick={saveEditing}
                                                        className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600"
                                                    >
                                                        <CheckIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={cancelEditing}
                                                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600"
                                                    >
                                                        <XMarkIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startEditing(leg)}
                                                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-600"
                                                        title="Edit"
                                                    >
                                                        <PencilIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => onDuplicateLeg && onDuplicateLeg(leg)}
                                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500"
                                                        title="Duplicate"
                                                    >
                                                        <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => onRemoveLeg(leg.id)}
                                                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                                                        title="Remove"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {/* Totals Row */}
                    <tfoot className="bg-gray-50 dark:bg-gray-700/50 font-medium">
                        <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                            <td colSpan={5} className="py-2 px-2 text-right">Net Totals:</td>
                            <td className="py-2 px-2 text-center">{legs.reduce((sum, l) => sum + l.qty, 0)}</td>
                            <td colSpan={2}></td>
                            <td className="py-2 px-2 text-right text-gray-500">{totals.delta.toFixed(3)}</td>
                            <td className={`py-2 px-2 text-right ${totals.premium >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {totals.premium >= 0 ? '+' : ''}₹{totals.premium.toFixed(0)}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default StrategyLegsTable;

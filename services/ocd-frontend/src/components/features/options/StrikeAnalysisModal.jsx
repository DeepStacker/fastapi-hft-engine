import { memo } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon, ChartBarIcon } from '@heroicons/react/24/outline';

/**
 * Strike Analysis Modal - Simplified View
 * Shows ONLY Support and Resistance levels (Reversals) for Daily, Weekly, and Futures.
 */
const StrikeAnalysisModal = memo(({ isOpen, onClose, strikeData, symbol }) => {
    if (!isOpen || !strikeData) return null;

    // Reversal Values (The levels themselves)
    const dailyReversal = strikeData.reversal || 0;
    const weeklyReversal = strikeData.wkly_reversal || 0;
    const futuresReversal = strikeData.fut_reversal || 0;

    const handleCopy = (label, value) => {
        if (value) {
            navigator.clipboard.writeText(value.toFixed(2));
            // Optional: You could show a toast here if you had a toast system
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <ChartBarIcon className="w-5 h-5 text-indigo-600" />
                            Reversal Levels: {strikeData.strike}
                        </h3>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            <XMarkIcon className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content: Reversal Levels Only */}
                    <div className="p-6 space-y-4">
                        {[
                            { label: 'Daily Reversal', value: dailyReversal, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800' },
                            { label: 'Weekly Reversal', value: weeklyReversal, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-100 dark:border-purple-800' },
                            { label: 'Futures Reversal', value: futuresReversal, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800' }
                        ].map((item) => (
                            <div
                                key={item.label}
                                onClick={() => handleCopy(item.label, item.value)}
                                className={`relative group cursor-pointer rounded-xl p-4 border ${item.bg} ${item.border} transition-all hover:scale-[1.02] hover:shadow-md`}
                                title="Click to copy"
                            >
                                <div className="flex justify-between items-center">
                                    <span className={`text-sm font-bold uppercase tracking-wider ${item.color}`}>
                                        {item.label}
                                    </span>
                                    <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">
                                        Click to Copy
                                    </span>
                                </div>
                                <div className="mt-1 text-3xl font-mono font-bold text-gray-900 dark:text-white">
                                    {item.value ? item.value.toFixed(2) : '—'}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 text-center text-[10px] text-gray-400">
                        Values are copyable on click
                    </div>
                </div>
            </div>
        </div>
    );
});

StrikeAnalysisModal.displayName = 'StrikeAnalysisModal';

StrikeAnalysisModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    strikeData: PropTypes.object,
    symbol: PropTypes.string,
};

export default StrikeAnalysisModal;

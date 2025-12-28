import { memo, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon, ClockIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

/**
 * QuickValueModal - LOC Calculator Style
 * Simple, clean modal showing value + update time
 * Designed for quick glance information without overwhelming charts
 */
const QuickValueModal = memo(({ isOpen, onClose, data, field, side, symbol }) => {
    const [lastUpdated, setLastUpdated] = useState(new Date());

    useEffect(() => {
        if (isOpen) {
            setLastUpdated(new Date());
        }
    }, [isOpen, data]);

    if (!isOpen) return null;

    // Field configurations
    const fieldConfig = {
        oi: { label: 'Open Interest', color: 'blue', icon: '📊' },
        oichng: { label: 'OI Change', color: 'purple', icon: '📈' },
        coi: { label: 'Change in OI', color: 'indigo', icon: '📈' },
        volume: { label: 'Volume', color: 'amber', icon: '📊' },
        ltp: { label: 'LTP', color: 'green', icon: '💰' },
        iv: { label: 'Implied Volatility', color: 'cyan', icon: '📉' },
        delta: { label: 'Delta', color: 'teal', icon: 'Δ' },
        gamma: { label: 'Gamma', color: 'emerald', icon: 'Γ' },
        theta: { label: 'Theta', color: 'red', icon: 'Θ' },
        vega: { label: 'Vega', color: 'violet', icon: 'ν' },
    };

    const config = fieldConfig[field] || { label: field?.toUpperCase() || 'Value', color: 'gray', icon: '📌' };
    const sideLabel = side === 'ce' ? 'Call' : 'Put';
    const sideColor = side === 'ce' ? 'rose' : 'emerald';

    // Format value based on field type
    const formatValue = (val) => {
        if (val === undefined || val === null) return '—';
        if (typeof val !== 'number') return String(val);

        if (field === 'iv') return `${val.toFixed(2)}%`;
        if (['delta', 'gamma', 'theta', 'vega'].includes(field)) return val.toFixed(4);
        if (field === 'ltp') return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

        // Format large numbers
        if (Math.abs(val) >= 10000000) return `${(val / 10000000).toFixed(2)}Cr`;
        if (Math.abs(val) >= 100000) return `${(val / 100000).toFixed(2)}L`;
        if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}K`;
        return val.toLocaleString('en-IN');
    };

    // Determine change direction for OI/COI fields
    const isChangeField = ['oichng', 'coi'].includes(field);
    const value = data?.value ?? data?.[field] ?? 0;
    const isPositive = value > 0;
    const isNegative = value < 0;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true">
            {/* Backdrop with blur */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal - Centered, compact */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden
                               w-full max-w-sm transform transition-all
                               border border-gray-200/50 dark:border-gray-700/50"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header Gradient */}
                    <div className={`bg-gradient-to-r from-${sideColor}-600/20 via-${config.color}-500/15 to-${sideColor}-500/20 p-4`}>
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 p-1.5 rounded-lg 
                                       hover:bg-white/20 dark:hover:bg-gray-800/50 
                                       transition-colors group"
                        >
                            <XMarkIcon className="w-5 h-5 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                        </button>

                        {/* Field Label */}
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{config.icon}</span>
                            <span className={`text-sm font-semibold text-${sideColor}-600 dark:text-${sideColor}-400 uppercase tracking-wide`}>
                                {sideLabel}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {config.label}
                        </h3>
                        {symbol && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {symbol}
                            </p>
                        )}
                    </div>

                    {/* Value Display */}
                    <div className="p-6 text-center">
                        <div className={`text-4xl font-bold mb-2 ${isChangeField
                                ? isPositive
                                    ? 'text-green-600 dark:text-green-400'
                                    : isNegative
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-gray-900 dark:text-white'
                                : 'text-gray-900 dark:text-white'
                            }`}>
                            {isChangeField && isPositive && '+'}
                            {formatValue(value)}
                        </div>

                        {/* Direction Indicator for change fields */}
                        {isChangeField && value !== 0 && (
                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${isPositive
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                }`}>
                                {isPositive ? (
                                    <>
                                        <ArrowTrendingUpIcon className="w-4 h-4" />
                                        <span>Buying / Long Buildup</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowTrendingDownIcon className="w-4 h-4" />
                                        <span>Selling / Short Covering</span>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Strike info if available */}
                        {data?.strike && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Strike: </span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {data.strike.toLocaleString('en-IN')}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Footer - Update Time */}
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <ClockIcon className="w-4 h-4" />
                            <span>
                                Last updated: {lastUpdated.toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

QuickValueModal.displayName = 'QuickValueModal';

QuickValueModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    data: PropTypes.object,
    field: PropTypes.string,
    side: PropTypes.oneOf(['ce', 'pe']),
    symbol: PropTypes.string,
};

export default QuickValueModal;

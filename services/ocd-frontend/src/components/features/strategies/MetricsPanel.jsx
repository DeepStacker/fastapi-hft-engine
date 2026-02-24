import { memo } from 'react';
import PropTypes from 'prop-types';
import { ChartBarIcon } from '@heroicons/react/24/outline';

const MetricsPanel = memo(({ metrics }) => {
    if (!metrics) return null;

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-indigo-500" />
                Structure Metrics
            </h4>

            {/* P&L Row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Max Profit</p>
                    <p className="text-lg font-bold text-green-600">
                        ₹{metrics.max_profit?.toLocaleString() || '∞'}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Max Loss</p>
                    <p className="text-lg font-bold text-red-600">
                        ₹{metrics.max_loss?.toLocaleString()}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Net Credit</p>
                    <p className={`text-lg font-bold ${metrics.net_credit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{Math.abs(metrics.net_credit)?.toLocaleString()}
                        <span className="text-xs ml-1">{metrics.net_credit >= 0 ? 'Cr' : 'Dr'}</span>
                    </p>
                </div>
            </div>

            {/* POP Bar */}
            <div>
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Probability of Profit</span>
                    <span className="font-bold text-indigo-600">{metrics.probability_of_profit?.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${metrics.probability_of_profit || 0}%` }}
                    />
                </div>
            </div>

            {/* Greeks Row */}
            <div className="grid grid-cols-4 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                    <p className="text-xs text-gray-500">Net Δ</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{metrics.net_delta?.toFixed(2)}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500">Net Γ</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{metrics.net_gamma?.toFixed(3)}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500">Net Θ</p>
                    <p className={`font-semibold ${metrics.net_theta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.net_theta?.toFixed(0)}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500">Net V</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{metrics.net_vega?.toFixed(1)}</p>
                </div>
            </div>

            {/* Breakevens */}
            {metrics.breakevens?.length > 0 && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 mb-2">Breakeven Points</p>
                    <div className="flex gap-2 flex-wrap">
                        {metrics.breakevens.map((be, i) => (
                            <span key={i} className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                {be.toFixed(0)}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

MetricsPanel.displayName = 'MetricsPanel';

MetricsPanel.propTypes = {
    metrics: PropTypes.shape({
        max_profit: PropTypes.number,
        max_loss: PropTypes.number,
        net_credit: PropTypes.number,
        probability_of_profit: PropTypes.number,
        net_delta: PropTypes.number,
        net_gamma: PropTypes.number,
        net_theta: PropTypes.number,
        net_vega: PropTypes.number,
        breakevens: PropTypes.arrayOf(PropTypes.number)
    })
};

export default MetricsPanel;

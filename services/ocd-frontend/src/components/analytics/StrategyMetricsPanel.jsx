/**
 * Strategy Metrics Panel Component
 * Professional metrics display with POP, max P/L, margin, and Greeks
 */
import { useMemo } from 'react';
import {
    ChartBarIcon, ScaleIcon, BanknotesIcon,
    ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const StrategyMetricsPanel = ({
    metrics,
    isLoading = false
}) => {
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center text-gray-400 text-sm">
                Build a strategy to see metrics
            </div>
        );
    }

    const formatValue = (value) => {
        if (value === 'Unlimited') return '∞';
        if (typeof value === 'number') return `₹${Math.abs(value).toLocaleString()}`;
        return value;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <ChartBarIcon className="w-4 h-4 text-blue-500" />
                    Strategy Metrics
                </h3>
            </div>

            <div className="p-4 space-y-4">
                {/* Row 1: Max P/L and POP */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Max Profit */}
                    <div className="p-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-100 dark:border-green-800/30">
                        <div className="flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400 font-medium mb-1">
                            <ArrowTrendingUpIcon className="w-3 h-3" />
                            MAX PROFIT
                        </div>
                        <div className="text-lg font-bold text-green-700 dark:text-green-400">
                            {metrics.profit_unlimited ? (
                                <span className="flex items-center gap-1">∞ <span className="text-xs font-normal">Unlimited</span></span>
                            ) : (
                                formatValue(metrics.max_profit)
                            )}
                        </div>
                        {metrics.max_profit_price && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                                @ ₹{metrics.max_profit_price?.toLocaleString()}
                            </div>
                        )}
                    </div>

                    {/* Max Loss */}
                    <div className="p-3 rounded-lg bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-100 dark:border-red-800/30">
                        <div className="flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400 font-medium mb-1">
                            <ArrowTrendingDownIcon className="w-3 h-3" />
                            MAX LOSS
                        </div>
                        <div className="text-lg font-bold text-red-700 dark:text-red-400">
                            {metrics.loss_unlimited ? (
                                <span className="flex items-center gap-1">
                                    <ExclamationTriangleIcon className="w-4 h-4" />
                                    <span className="text-xs font-normal">Unlimited</span>
                                </span>
                            ) : (
                                `-${formatValue(metrics.max_loss)}`
                            )}
                        </div>
                        {metrics.max_loss_price && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                                @ ₹{metrics.max_loss_price?.toLocaleString()}
                            </div>
                        )}
                    </div>

                    {/* POP */}
                    <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/30">
                        <div className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-medium mb-1">
                            <ScaleIcon className="w-3 h-3" />
                            PROB. OF PROFIT
                        </div>
                        <div className={`text-lg font-bold ${metrics.probability_of_profit >= 50 ? 'text-green-600' : 'text-amber-600'
                            }`}>
                            {metrics.probability_of_profit?.toFixed(1)}%
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mt-1.5">
                            <div
                                className={`h-full rounded-full transition-all ${metrics.probability_of_profit >= 50 ? 'bg-green-500' : 'bg-amber-500'
                                    }`}
                                style={{ width: `${Math.min(100, metrics.probability_of_profit || 0)}%` }}
                            />
                        </div>
                    </div>

                    {/* Risk Reward */}
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                        <div className="text-[10px] text-gray-500 font-medium mb-1">RISK:REWARD</div>
                        <div className="text-lg font-bold">
                            {metrics.risk_reward_ratio ? `1:${metrics.risk_reward_ratio.toFixed(2)}` : 'N/A'}
                        </div>
                    </div>
                </div>

                {/* Row 2: Breakevens and Margin */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Breakevens */}
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mb-1">
                            BREAKEVEN POINTS
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {metrics.breakevens?.length > 0 ? (
                                metrics.breakevens.map((be, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 rounded text-sm font-medium">
                                        ₹{be.toLocaleString()}
                                    </span>
                                ))
                            ) : (
                                <span className="text-gray-400 text-sm">None</span>
                            )}
                        </div>
                    </div>

                    {/* Margin */}
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30">
                        <div className="flex items-center gap-1.5 text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-1">
                            <BanknotesIcon className="w-3 h-3" />
                            EST. MARGIN REQUIRED
                        </div>
                        <div className="text-lg font-bold text-purple-700 dark:text-purple-400">
                            ₹{(metrics.estimated_margin || 0).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                            <span className="text-green-600">Credit: ₹{(metrics.premium_received || 0).toLocaleString()}</span>
                            <span className="text-red-600">Debit: ₹{(metrics.premium_paid || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Row 3: Net Greeks */}
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                    <div className="text-[10px] text-gray-500 font-medium mb-2">NET GREEKS</div>
                    <div className="grid grid-cols-5 gap-3">
                        <div>
                            <div className="text-[10px] text-gray-400">Δ Delta</div>
                            <div className={`text-sm font-bold ${(metrics.greeks?.net_delta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(metrics.greeks?.net_delta || 0).toFixed(3)}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400">Γ Gamma</div>
                            <div className="text-sm font-bold">
                                {(metrics.greeks?.net_gamma || 0).toFixed(4)}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400">Θ Theta</div>
                            <div className={`text-sm font-bold ${(metrics.greeks?.net_theta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₹{(metrics.greeks?.net_theta || 0).toFixed(0)}/day
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400">ν Vega</div>
                            <div className="text-sm font-bold">
                                ₹{(metrics.greeks?.net_vega || 0).toFixed(0)}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400">ρ Rho</div>
                            <div className="text-sm font-bold">
                                ₹{(metrics.greeks?.net_rho || 0).toFixed(0)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 1-Std Range */}
                {metrics.one_std_range && (
                    <div className="text-[10px] text-center text-gray-500">
                        1σ Expected Range: ₹{metrics.one_std_range[0]?.toLocaleString()} - ₹{metrics.one_std_range[1]?.toLocaleString()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StrategyMetricsPanel;

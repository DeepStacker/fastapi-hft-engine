/**
 * Chart of Accuracy 1.0 Component
 * Visual representation of the 9 COA scenarios with trading guidance
 */
import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import { useChartOfAccuracy } from '../../hooks/useChartOfAccuracy';
import COAHistoryChart from './COAHistoryChart';
import {
    ChartBarSquareIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    ShieldCheckIcon,
    ShieldExclamationIcon,
    FireIcon,
    RocketLaunchIcon,
    BellIcon
} from '@heroicons/react/24/outline';
import COAAlertSettings from './COAAlertSettings';
import Modal from '../common/Modal';

const ChartOfAccuracy = () => {
    const [showSettings, setShowSettings] = useState(false);
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);

    const coa = useChartOfAccuracy(optionChain, spotPrice, atmStrike);

    if (!optionChain || !coa) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ChartBarSquareIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const { scenario, support, resistance, levels, trading } = coa;

    // Normalize field names (API uses snake_case, local uses camelCase)
    const getOiPct100 = (obj) => obj?.oi_pct100 ?? obj?.pct100 ?? 0;
    const getOiPct2nd = (obj) => obj?.oi_pct2nd ?? obj?.pct2nd ?? 0;
    const getOiChng100 = (obj) => obj?.oichng100 ?? obj?.oiChng100 ?? 0;
    const getOiChng2nd = (obj) => obj?.oichng2nd ?? obj?.oiChng2nd ?? 0;
    const getTradeAtEOS = () => levels?.trade_at_eos ?? trading?.tradeAtEOS ?? false;
    const getTradeAtEOR = () => levels?.trade_at_eor ?? trading?.tradeAtEOR ?? false;

    // Get scenario visual styling
    const getScenarioStyle = () => {
        switch (scenario.bias) {
            case 'bullish':
                return {
                    bg: 'from-emerald-500 to-green-600',
                    icon: RocketLaunchIcon,
                    emoji: '🐂'
                };
            case 'bearish':
                return {
                    bg: 'from-red-500 to-rose-600',
                    icon: ArrowTrendingDownIcon,
                    emoji: '🐻'
                };
            case 'neutral':
                return {
                    bg: 'from-blue-500 to-indigo-600',
                    icon: CheckCircleIcon,
                    emoji: '⚖️'
                };
            default:
                return {
                    bg: 'from-gray-500 to-gray-600',
                    icon: ExclamationTriangleIcon,
                    emoji: '⚠️'
                };
        }
    };

    const style = getScenarioStyle();
    const ScenarioIcon = style.icon;

    // Get strength badge styling
    const getStrengthBadge = (strength) => {
        switch (strength) {
            case 'Strong':
                return { bg: 'bg-emerald-100 text-emerald-700', icon: ShieldCheckIcon, label: 'STRONG' };
            case 'WTT':
                return { bg: 'bg-green-100 text-green-700', icon: ArrowTrendingUpIcon, label: 'WTT ↑' };
            case 'WTB':
                return { bg: 'bg-red-100 text-red-700', icon: ArrowTrendingDownIcon, label: 'WTB ↓' };
            default:
                return { bg: 'bg-gray-100 text-gray-700', icon: InformationCircleIcon, label: strength };
        }
    };

    const supportBadge = getStrengthBadge(support.strength);
    const resistanceBadge = getStrengthBadge(resistance.strength);
    const SupportIcon = supportBadge.icon;
    const ResistanceIcon = resistanceBadge.icon;

    const formatNumber = (num) => num ? num.toFixed(0) : 'N/A';

    return (
        <div className="space-y-4">
            {/* Main Scenario Card */}
            <div className={`rounded-2xl p-6 bg-gradient-to-r ${style.bg} text-white shadow-lg relative`}>
                <button
                    onClick={() => setShowSettings(true)}
                    className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm"
                    title="Alert Settings"
                >
                    <BellIcon className="w-5 h-5 text-white" />
                </button>

                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                            <span className="text-4xl">{style.emoji}</span>
                        </div>
                        <div>
                            <div className="text-sm opacity-80">Chart of Accuracy</div>
                            <h2 className="text-3xl font-bold">{scenario.id}</h2>
                            <div className="text-lg font-medium">{scenario.name}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm opacity-80">Market Bias</div>
                        <div className="text-2xl font-bold uppercase">{scenario.bias}</div>
                    </div>
                </div>

                {/* Trading Recommendation */}
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
                    <div className="text-lg font-semibold">{trading.recommendation}</div>
                </div>
            </div>

            {/* Support & Resistance Strength */}
            <div className="grid grid-cols-2 gap-4">
                {/* Support (PE) */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-2">
                        <ShieldCheckIcon className="w-5 h-5" />
                        <span className="font-semibold">SUPPORT (PE)</span>
                    </div>
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5 ${supportBadge.bg}`}>
                                <SupportIcon className="w-4 h-4" />
                                {supportBadge.label}
                            </div>
                            <div className="text-xl font-bold text-green-600">{support.strike100}</div>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">OI at Strike</span>
                                <span className="font-medium">{(support.oi100 / 1000).toFixed(0)}K ({getOiPct100(support).toFixed(0)}%)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">OI Change</span>
                                <span className={`font-medium ${getOiChng100(support) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {getOiChng100(support) >= 0 ? '+' : ''}{(getOiChng100(support) / 1000).toFixed(1)}K
                                </span>
                            </div>
                            {support.strike2nd && (
                                <div className="flex justify-between text-gray-400">
                                    <span>2nd Strike</span>
                                    <span>{support.strike2nd} ({getOiPct2nd(support).toFixed(0)}%)</span>
                                </div>
                            )}
                        </div>

                        {/* Trade Indicator */}
                        <div className={`mt-3 py-2 px-3 rounded-lg text-sm font-bold text-center ${getTradeAtEOS()
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                            }`}>
                            {getTradeAtEOS() ? '✅ Trade at EOS' : '❌ No EOS Trade'}
                        </div>
                    </div>
                </div>

                {/* Resistance (CE) */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center gap-2">
                        <ShieldExclamationIcon className="w-5 h-5" />
                        <span className="font-semibold">RESISTANCE (CE)</span>
                    </div>
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5 ${resistanceBadge.bg}`}>
                                <ResistanceIcon className="w-4 h-4" />
                                {resistanceBadge.label}
                            </div>
                            <div className="text-xl font-bold text-red-600">{resistance.strike100}</div>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">OI at Strike</span>
                                <span className="font-medium">{(resistance.oi100 / 1000).toFixed(0)}K ({getOiPct100(resistance).toFixed(0)}%)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">OI Change</span>
                                <span className={`font-medium ${getOiChng100(resistance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {getOiChng100(resistance) >= 0 ? '+' : ''}{(getOiChng100(resistance) / 1000).toFixed(1)}K
                                </span>
                            </div>
                            {resistance.strike2nd && (
                                <div className="flex justify-between text-gray-400">
                                    <span>2nd Strike</span>
                                    <span>{resistance.strike2nd} ({getOiPct2nd(resistance).toFixed(0)}%)</span>
                                </div>
                            )}
                        </div>

                        {/* Trade Indicator */}
                        <div className={`mt-3 py-2 px-3 rounded-lg text-sm font-bold text-center ${getTradeAtEOR()
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                            }`}>
                            {getTradeAtEOR() ? '✅ Trade at EOR' : '❌ No EOR Trade'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Levels Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700/50 flex items-center justify-between">
                    <h3 className="font-semibold">Trading Levels</h3>
                    <span className="text-xs text-gray-500">Spot: ₹{spotPrice?.toFixed(2)}</span>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Top Level */}
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">MARKET TOP</div>
                            {trading.top ? (
                                <div className="text-2xl font-bold text-red-600">{formatNumber(trading.top)}</div>
                            ) : (
                                <div className="text-xl font-bold text-gray-400">N/A (No Top)</div>
                            )}
                            {levels && (
                                <div className="text-xs text-gray-400 mt-1">EOR: {formatNumber(levels.eor)}</div>
                            )}
                        </div>

                        {/* Bottom Level */}
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">MARKET BOTTOM</div>
                            {trading.bottom ? (
                                <div className="text-2xl font-bold text-green-600">{formatNumber(trading.bottom)}</div>
                            ) : (
                                <div className="text-xl font-bold text-gray-400">N/A (No Bottom)</div>
                            )}
                            {levels && (
                                <div className="text-xs text-gray-400 mt-1">EOS: {formatNumber(levels.eos)}</div>
                            )}
                        </div>
                    </div>

                    {/* Range Visual */}
                    {trading.top && trading.bottom && spotPrice && (
                        <div className="mt-4">
                            <div className="relative h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                                {/* Range bar */}
                                <div className="absolute inset-0 flex">
                                    <div className="flex-1 bg-green-100 dark:bg-green-900/30"></div>
                                    <div className="flex-1 bg-red-100 dark:bg-red-900/30"></div>
                                </div>
                                {/* Spot marker */}
                                <div
                                    className="absolute top-0 bottom-0 w-1 bg-blue-600"
                                    style={{
                                        left: `${Math.min(100, Math.max(0, ((spotPrice - trading.bottom) / (trading.top - trading.bottom)) * 100))}%`
                                    }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                <span>{formatNumber(trading.bottom)}</span>
                                <span className="text-blue-600 font-bold">Spot: {formatNumber(spotPrice)}</span>
                                <span>{formatNumber(trading.top)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 9 Scenarios Reference */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700/50">
                    <h3 className="font-semibold text-sm">Chart of Accuracy - All 9 Scenarios</h3>
                </div>
                <div className="p-3 overflow-x-auto">
                    <table className="w-full text-[10px]">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="py-1.5 px-2 text-left">COA</th>
                                <th className="py-1.5 px-2 text-center">Support</th>
                                <th className="py-1.5 px-2 text-center">Resistance</th>
                                <th className="py-1.5 px-2 text-center">Bias</th>
                                <th className="py-1.5 px-2 text-center">Top</th>
                                <th className="py-1.5 px-2 text-center">Bottom</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {[
                                { id: '1.0', s: 'Strong', r: 'Strong', bias: 'Neutral', top: 'EOR', bottom: 'EOS' },
                                { id: '1.1', s: 'Strong', r: 'WTB', bias: 'Bearish', top: 'EOR', bottom: 'EOS-1' },
                                { id: '1.2', s: 'Strong', r: 'WTT', bias: 'Bullish', top: 'WTT-1', bottom: 'EOS' },
                                { id: '1.3', s: 'WTB', r: 'Strong', bias: 'Bearish', top: 'EOR', bottom: 'WTB+1' },
                                { id: '1.4', s: 'WTT', r: 'Strong', bias: 'Bullish', top: 'EOR+1', bottom: 'EOS' },
                                { id: '1.5', s: 'WTB', r: 'WTB', bias: 'Blood Bath', top: 'EOR', bottom: 'N/A' },
                                { id: '1.6', s: 'WTT', r: 'WTT', bias: 'Bull Run', top: 'N/A', bottom: 'EOS' },
                                { id: '1.7', s: 'WTB', r: 'WTT', bias: 'Wait', top: '-', bottom: '-' },
                                { id: '1.8', s: 'WTT', r: 'WTB', bias: 'Wait', top: '-', bottom: '-' },
                            ].map(row => (
                                <tr
                                    key={row.id}
                                    className={scenario.id === row.id ? 'bg-blue-50 dark:bg-blue-900/30 font-bold' : ''}
                                >
                                    <td className="py-1.5 px-2">{row.id} {scenario.id === row.id && '←'}</td>
                                    <td className={`py-1.5 px-2 text-center ${row.s === 'Strong' ? 'text-emerald-600' :
                                        row.s === 'WTT' ? 'text-green-600' : 'text-red-600'
                                        }`}>{row.s}</td>
                                    <td className={`py-1.5 px-2 text-center ${row.r === 'Strong' ? 'text-emerald-600' :
                                        row.r === 'WTT' ? 'text-green-600' : 'text-red-600'
                                        }`}>{row.r}</td>
                                    <td className={`py-1.5 px-2 text-center font-medium ${row.bias.includes('Bull') ? 'text-green-600' :
                                        row.bias.includes('Bear') || row.bias.includes('Blood') ? 'text-red-600' :
                                            row.bias === 'Wait' ? 'text-amber-600' : ''
                                        }`}>{row.bias}</td>
                                    <td className="py-1.5 px-2 text-center text-red-500">{row.top}</td>
                                    <td className="py-1.5 px-2 text-center text-green-500">{row.bottom}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Educational Note */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm">
                <div className="flex items-start gap-2">
                    <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="font-semibold text-blue-800 dark:text-blue-300 mb-1">Understanding COA</div>
                        <p className="text-blue-700 dark:text-blue-400 text-xs">
                            <strong>Strong</strong> = 100% OI concentration with no competitor ≥75%<br />
                            <strong>WTT</strong> = Weak Towards Top (bullish pressure shifting OI higher)<br />
                            <strong>WTB</strong> = Weak Towards Bottom (bearish pressure shifting OI lower)<br />
                            <strong>EOS</strong> = Extension of Support (Strike - PE LTP)<br />
                            <strong>EOR</strong> = Extension of Resistance (Strike + CE LTP)
                        </p>
                    </div>
                </div>
            </div>

            {/* COA History Timeline */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700/50">
                    <h3 className="font-semibold text-sm">Support & Resistance History</h3>
                </div>
                <div className="p-4">
                    <COAHistoryChart />
                </div>
            </div>


            {/* Alert Settings Modal */}
            <Modal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                title="Scenario Alert Settings"
            >
                <COAAlertSettings />
            </Modal>
        </div>
    );
};

export default ChartOfAccuracy;

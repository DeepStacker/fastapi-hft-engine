/**
 * Options Flow Dashboard
 * Comprehensive view of all options flow data in one dashboard
 */
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
    selectOptionChain, selectSpotPrice, selectATMStrike,
    selectPCR, selectTotalOI, selectMaxPainStrike, selectDaysToExpiry
} from '../../context/selectors';
import {
    PresentationChartLineIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    FireIcon, BoltIcon, ChartBarIcon
} from '@heroicons/react/24/outline';

const OptionsFlowDashboard = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const pcr = useSelector(selectPCR);
    const totalOI = useSelector(selectTotalOI);
    const maxPain = useSelector(selectMaxPainStrike);
    const dte = useSelector(selectDaysToExpiry);

    const formatNumber = (num) => {
        if (!num) return '0';
        const abs = Math.abs(num);
        if (abs >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
        if (abs >= 1e5) return (num / 1e5).toFixed(2) + 'L';
        if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toFixed(0);
    };

    // Comprehensive flow analysis
    const flowData = useMemo(() => {
        if (!optionChain) return null;

        let totalCallVol = 0, totalPutVol = 0;
        let totalCallOIChg = 0, totalPutOIChg = 0;
        let totalCallPremium = 0, totalPutPremium = 0;
        let hotStrikes = [];
        let bullishContracts = 0, bearishContracts = 0;

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            const ceVol = data.ce?.vol || data.ce?.volume || 0;
            const peVol = data.pe?.vol || data.pe?.volume || 0;
            const ceOIChg = data.ce?.oichng || data.ce?.oi_change || 0;
            const peOIChg = data.pe?.oichng || data.pe?.oi_change || 0;
            const ceLtp = data.ce?.ltp || 0;
            const peLtp = data.pe?.ltp || 0;
            const cePChg = data.ce?.p_chng || 0;
            const pePChg = data.pe?.p_chng || 0;

            totalCallVol += ceVol;
            totalPutVol += peVol;
            totalCallOIChg += ceOIChg;
            totalPutOIChg += peOIChg;
            totalCallPremium += ceVol * ceLtp;
            totalPutPremium += peVol * peLtp;

            // Classify signals
            if (ceOIChg > 0 && cePChg > 0) bullishContracts++;
            if (ceOIChg > 0 && cePChg < 0) bearishContracts++;
            if (peOIChg > 0 && pePChg > 0) bearishContracts++;
            if (peOIChg > 0 && pePChg < 0) bullishContracts++;

            // Hot strikes (high activity)
            const activity = ceVol + peVol + Math.abs(ceOIChg) + Math.abs(peOIChg);
            if (activity > 0) {
                hotStrikes.push({
                    strike,
                    ceVol, peVol, ceOIChg, peOIChg, ceLtp, peLtp,
                    activity,
                    signal: (ceOIChg > 0 && cePChg > 0) || (peOIChg > 0 && pePChg < 0) ? 'bullish' :
                        (ceOIChg > 0 && cePChg < 0) || (peOIChg > 0 && pePChg > 0) ? 'bearish' : 'neutral'
                });
            }
        });

        hotStrikes.sort((a, b) => b.activity - a.activity);

        // Overall flow sentiment
        const flowSentiment = {
            volume: totalCallVol > totalPutVol * 1.2 ? 'bullish' : totalPutVol > totalCallVol * 1.2 ? 'bearish' : 'neutral',
            oi: totalCallOIChg > totalPutOIChg ? 'bearish' : totalPutOIChg > totalCallOIChg ? 'bullish' : 'neutral', // Inverse for OI
            premium: totalCallPremium > totalPutPremium * 1.2 ? 'bullish' : totalPutPremium > totalCallPremium * 1.2 ? 'bearish' : 'neutral',
            pcr: pcr > 1.2 ? 'bullish' : pcr < 0.8 ? 'bearish' : 'neutral',
            contracts: bullishContracts > bearishContracts * 1.2 ? 'bullish' : bearishContracts > bullishContracts * 1.2 ? 'bearish' : 'neutral'
        };

        const bullishScore = Object.values(flowSentiment).filter(v => v === 'bullish').length;
        const bearishScore = Object.values(flowSentiment).filter(v => v === 'bearish').length;
        const overallSentiment = bullishScore >= 3 ? 'bullish' : bearishScore >= 3 ? 'bearish' : 'neutral';

        return {
            totalCallVol, totalPutVol,
            totalCallOIChg, totalPutOIChg,
            totalCallPremium, totalPutPremium,
            hotStrikes: hotStrikes.slice(0, 8),
            flowSentiment,
            overallSentiment,
            bullishScore,
            bearishScore,
            bullishContracts,
            bearishContracts
        };
    }, [optionChain, pcr]);

    if (!optionChain || !flowData) {
        return (
            <div className="p-8 text-center text-gray-400">
                <PresentationChartLineIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const sentimentColor = flowData.overallSentiment === 'bullish' ? 'emerald' :
        flowData.overallSentiment === 'bearish' ? 'red' : 'amber';

    return (
        <div className="space-y-4">
            {/* Overall Sentiment Meter */}
            <div className={`rounded-2xl p-6 bg-gradient-to-r ${sentimentColor === 'emerald' ? 'from-emerald-500 to-green-600' :
                    sentimentColor === 'red' ? 'from-red-500 to-rose-600' :
                        'from-amber-500 to-orange-600'
                } text-white`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <PresentationChartLineIcon className="w-8 h-8" />
                        <div>
                            <h2 className="text-2xl font-bold">Options Flow Dashboard</h2>
                            <div className="text-sm opacity-80">{dte} DTE | Max Pain: {maxPain}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-bold">
                            {flowData.overallSentiment === 'bullish' ? '🐂' : flowData.overallSentiment === 'bearish' ? '🐻' : '⚖️'}
                        </div>
                        <div className="text-sm font-medium">{flowData.overallSentiment.toUpperCase()}</div>
                    </div>
                </div>

                {/* Sentiment Indicators */}
                <div className="grid grid-cols-5 gap-2">
                    {[
                        { label: 'Volume', value: flowData.flowSentiment.volume },
                        { label: 'OI Flow', value: flowData.flowSentiment.oi },
                        { label: 'Premium', value: flowData.flowSentiment.premium },
                        { label: 'PCR', value: flowData.flowSentiment.pcr },
                        { label: 'Contracts', value: flowData.flowSentiment.contracts }
                    ].map((item, i) => (
                        <div key={i} className="text-center p-2 bg-white/10 rounded-lg">
                            <div className="text-[10px] opacity-70">{item.label}</div>
                            <div className="text-lg">
                                {item.value === 'bullish' ? '🟢' : item.value === 'bearish' ? '🔴' : '⚪'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                        <ChartBarIcon className="w-3 h-3" /> Call Volume
                    </div>
                    <div className="text-xl font-bold text-green-600">{formatNumber(flowData.totalCallVol)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                        <ChartBarIcon className="w-3 h-3" /> Put Volume
                    </div>
                    <div className="text-xl font-bold text-red-600">{formatNumber(flowData.totalPutVol)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                        <BoltIcon className="w-3 h-3" /> Call OI Δ
                    </div>
                    <div className={`text-xl font-bold ${flowData.totalCallOIChg >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {flowData.totalCallOIChg >= 0 ? '+' : ''}{formatNumber(flowData.totalCallOIChg)}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                        <BoltIcon className="w-3 h-3" /> Put OI Δ
                    </div>
                    <div className={`text-xl font-bold ${flowData.totalPutOIChg >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {flowData.totalPutOIChg >= 0 ? '+' : ''}{formatNumber(flowData.totalPutOIChg)}
                    </div>
                </div>
            </div>

            {/* Premium Flow */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Call Premium Traded</div>
                    <div className="text-2xl font-bold">{formatNumber(flowData.totalCallPremium)}</div>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Put Premium Traded</div>
                    <div className="text-2xl font-bold">{formatNumber(flowData.totalPutPremium)}</div>
                </div>
            </div>

            {/* Hot Strikes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center gap-2">
                    <FireIcon className="w-4 h-4" />
                    <span className="font-semibold text-sm">Hot Strikes (Highest Activity)</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="py-2 px-3 text-left">Strike</th>
                                <th className="py-2 px-3 text-right">CE Vol</th>
                                <th className="py-2 px-3 text-right">PE Vol</th>
                                <th className="py-2 px-3 text-right">CE OI Δ</th>
                                <th className="py-2 px-3 text-right">PE OI Δ</th>
                                <th className="py-2 px-3 text-center">Signal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {flowData.hotStrikes.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="py-2 px-3 font-bold flex items-center gap-1">
                                        <span className="text-orange-500">🔥</span>
                                        {row.strike}
                                    </td>
                                    <td className="py-2 px-3 text-right text-green-600">{formatNumber(row.ceVol)}</td>
                                    <td className="py-2 px-3 text-right text-red-600">{formatNumber(row.peVol)}</td>
                                    <td className={`py-2 px-3 text-right ${row.ceOIChg >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {row.ceOIChg >= 0 ? '+' : ''}{formatNumber(row.ceOIChg)}
                                    </td>
                                    <td className={`py-2 px-3 text-right ${row.peOIChg >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {row.peOIChg >= 0 ? '+' : ''}{formatNumber(row.peOIChg)}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.signal === 'bullish' ? 'bg-green-100 text-green-700' :
                                                row.signal === 'bearish' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-gray-600'
                                            }`}>
                                            {row.signal === 'bullish' ? '🐂 BULL' : row.signal === 'bearish' ? '🐻 BEAR' : 'NEUT'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Contract Signals Summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-700">Bullish Signals</span>
                    </div>
                    <div className="text-3xl font-bold text-green-700">{flowData.bullishContracts}</div>
                    <div className="text-xs text-green-600 mt-1">Contracts with bullish pattern</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowTrendingDownIcon className="w-5 h-5 text-red-600" />
                        <span className="font-semibold text-red-700">Bearish Signals</span>
                    </div>
                    <div className="text-3xl font-bold text-red-700">{flowData.bearishContracts}</div>
                    <div className="text-xs text-red-600 mt-1">Contracts with bearish pattern</div>
                </div>
            </div>
        </div>
    );
};

export default OptionsFlowDashboard;

/**
 * Net Premium Flow Chart
 * Tracks premium inflow vs outflow to detect smart money direction
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    BanknotesIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

const NetPremiumFlowChart = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);

    const [viewMode, setViewMode] = useState('all'); // 'all', 'calls', 'puts'

    const formatCrores = (num) => {
        if (Math.abs(num) >= 1e7) return (num / 1e7).toFixed(2) + ' Cr';
        if (Math.abs(num) >= 1e5) return (num / 1e5).toFixed(2) + ' L';
        return (num / 1e3).toFixed(1) + ' K';
    };

    // Calculate premium flow data
    const premiumData = useMemo(() => {
        if (!optionChain) return null;

        let totalCallPremium = 0;
        let totalPutPremium = 0;
        let callBuyPremium = 0;
        let callSellPremium = 0;
        let putBuyPremium = 0;
        let putSellPremium = 0;

        const strikes = [];

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            const ceVol = data.ce?.vol || data.ce?.volume || 0;
            const peVol = data.pe?.vol || data.pe?.volume || 0;
            const ceLtp = data.ce?.ltp || 0;
            const peLtp = data.pe?.ltp || 0;
            const ceOiChg = data.ce?.oichng || data.ce?.oi_change || 0;
            const peOiChg = data.pe?.oichng || data.pe?.oi_change || 0;
            const cePChg = data.ce?.p_chng || 0;
            const pePChg = data.pe?.p_chng || 0;

            const cePremium = ceVol * ceLtp;
            const pePremium = peVol * peLtp;

            totalCallPremium += cePremium;
            totalPutPremium += pePremium;

            // Determine if buying or selling based on OI and price change
            // Buy: OI↑ + Price↑ OR OI↓ + Price↓ (long positions)
            // Sell: OI↑ + Price↓ OR OI↓ + Price↑ (short positions)
            const ceBuy = (ceOiChg > 0 && cePChg >= 0) || (ceOiChg < 0 && cePChg < 0);
            const peBuy = (peOiChg > 0 && pePChg >= 0) || (peOiChg < 0 && pePChg < 0);

            if (ceBuy) callBuyPremium += cePremium;
            else callSellPremium += cePremium;

            if (peBuy) putBuyPremium += pePremium;
            else putSellPremium += pePremium;

            if (cePremium > 0 || pePremium > 0) {
                strikes.push({
                    strike,
                    cePremium,
                    pePremium,
                    netPremium: cePremium - pePremium,
                    ceBuy,
                    peBuy
                });
            }
        });

        strikes.sort((a, b) => b.cePremium + b.pePremium - (a.cePremium + a.pePremium));

        const netFlow = (callBuyPremium + putSellPremium) - (callSellPremium + putBuyPremium);
        const bullishFlow = callBuyPremium + putSellPremium;
        const bearishFlow = callSellPremium + putBuyPremium;

        return {
            totalCallPremium,
            totalPutPremium,
            callBuyPremium,
            callSellPremium,
            putBuyPremium,
            putSellPremium,
            netFlow,
            bullishFlow,
            bearishFlow,
            topStrikes: strikes.slice(0, 10)
        };
    }, [optionChain]);

    if (!optionChain || !premiumData) {
        return (
            <div className="p-8 text-center text-gray-400">
                <BanknotesIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const flowDirection = premiumData.netFlow > 0 ? 'bullish' : premiumData.netFlow < 0 ? 'bearish' : 'neutral';
    const maxFlow = Math.max(premiumData.bullishFlow, premiumData.bearishFlow);
    const bullishPct = maxFlow > 0 ? (premiumData.bullishFlow / maxFlow) * 100 : 50;
    const bearishPct = maxFlow > 0 ? (premiumData.bearishFlow / maxFlow) * 100 : 50;

    return (
        <div className="space-y-4">
            {/* Main Flow Gauge */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <BanknotesIcon className="w-5 h-5 text-green-500" />
                        Net Premium Flow
                    </h3>
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 ${flowDirection === 'bullish' ? 'bg-green-100 text-green-700' :
                            flowDirection === 'bearish' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                        }`}>
                        {flowDirection === 'bullish' ? <ArrowTrendingUpIcon className="w-4 h-4" /> :
                            flowDirection === 'bearish' ? <ArrowTrendingDownIcon className="w-4 h-4" /> : null}
                        {flowDirection.charAt(0).toUpperCase() + flowDirection.slice(1)}
                    </div>
                </div>

                {/* Tug of War Bar */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-green-600 font-bold">BULLS</span>
                        <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 flex items-center justify-end pr-2 text-[9px] text-white font-bold"
                                style={{ width: `${bullishPct}%` }}
                            >
                                {formatCrores(premiumData.bullishFlow)}
                            </div>
                            <div
                                className="h-full bg-gradient-to-l from-red-500 to-rose-400 flex items-center justify-start pl-2 text-[9px] text-white font-bold"
                                style={{ width: `${bearishPct}%` }}
                            >
                                {formatCrores(premiumData.bearishFlow)}
                            </div>
                        </div>
                        <span className="text-xs text-red-600 font-bold">BEARS</span>
                    </div>
                    <div className="text-center text-xs text-gray-500">
                        Bullish = Call Buying + Put Selling | Bearish = Call Selling + Put Buying
                    </div>
                </div>

                {/* Net Flow Value */}
                <div className="text-center">
                    <div className={`text-4xl font-bold ${premiumData.netFlow > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {premiumData.netFlow > 0 ? '+' : ''}{formatCrores(premiumData.netFlow)}
                    </div>
                    <div className="text-sm text-gray-500">Net Premium Flow</div>
                </div>
            </div>

            {/* Premium Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="text-[10px] text-green-600 mb-1">Call Buy Premium</div>
                    <div className="text-lg font-bold text-green-700">{formatCrores(premiumData.callBuyPremium)}</div>
                    <div className="text-[9px] text-green-500">🐂 Bullish</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="text-[10px] text-red-600 mb-1">Call Sell Premium</div>
                    <div className="text-lg font-bold text-red-700">{formatCrores(premiumData.callSellPremium)}</div>
                    <div className="text-[9px] text-red-500">🐻 Bearish</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="text-[10px] text-green-600 mb-1">Put Sell Premium</div>
                    <div className="text-lg font-bold text-green-700">{formatCrores(premiumData.putSellPremium)}</div>
                    <div className="text-[9px] text-green-500">🐂 Bullish</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="text-[10px] text-red-600 mb-1">Put Buy Premium</div>
                    <div className="text-lg font-bold text-red-700">{formatCrores(premiumData.putBuyPremium)}</div>
                    <div className="text-[9px] text-red-500">🐻 Bearish</div>
                </div>
            </div>

            {/* Top Premium Strikes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Top Premium Strikes</h3>
                    <div className="flex gap-1">
                        {['all', 'calls', 'puts'].map(mode => (
                            <button key={mode} onClick={() => setViewMode(mode)}
                                className={`px-2 py-0.5 rounded text-[10px] ${viewMode === mode ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
                                    }`}>
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4">
                    <div className="space-y-2">
                        {premiumData.topStrikes
                            .filter(s => viewMode === 'all' ||
                                (viewMode === 'calls' && s.cePremium > s.pePremium) ||
                                (viewMode === 'puts' && s.pePremium > s.cePremium))
                            .slice(0, 8)
                            .map((s, i) => {
                                const maxPremium = Math.max(...premiumData.topStrikes.map(x => x.cePremium + x.pePremium));
                                const totalPremium = s.cePremium + s.pePremium;
                                const ceWidth = totalPremium > 0 ? (s.cePremium / totalPremium) * 100 : 50;

                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-16 text-right font-bold text-sm">{s.strike}</div>
                                        <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                                            <div
                                                className={`h-full ${s.ceBuy ? 'bg-green-500' : 'bg-green-300'} flex items-center justify-center text-[8px] text-white font-bold`}
                                                style={{ width: `${ceWidth}%` }}
                                            >
                                                {s.cePremium > 100000 && formatCrores(s.cePremium)}
                                            </div>
                                            <div
                                                className={`h-full ${s.peBuy ? 'bg-red-500' : 'bg-red-300'} flex items-center justify-center text-[8px] text-white font-bold`}
                                                style={{ width: `${100 - ceWidth}%` }}
                                            >
                                                {s.pePremium > 100000 && formatCrores(s.pePremium)}
                                            </div>
                                        </div>
                                        <div className="w-20 text-right text-xs font-medium">{formatCrores(totalPremium)}</div>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-t flex items-center justify-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500"></span> CE (Buy)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-300"></span> CE (Sell)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> PE (Buy)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-300"></span> PE (Sell)</span>
                </div>
            </div>
        </div>
    );
};

export default NetPremiumFlowChart;

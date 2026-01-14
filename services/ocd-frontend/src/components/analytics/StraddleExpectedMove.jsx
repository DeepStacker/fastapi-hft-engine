/**
 * Straddle & Expected Move Tracker
 * Shows ATM straddle premium and calculates expected move range
 */
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectDaysToExpiry } from '../../context/selectors';
import {
    ArrowsRightLeftIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

const StraddleExpectedMove = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const dte = useSelector(selectDaysToExpiry);

    // Calculate straddle and expected move
    const straddleData = useMemo(() => {
        if (!optionChain || !atmStrike || !spotPrice) return null;

        const atmData = optionChain[atmStrike] || optionChain[String(atmStrike)];
        if (!atmData) return null;

        const atmCELtp = atmData.ce?.ltp || 0;
        const atmPELtp = atmData.pe?.ltp || 0;
        const atmCEIV = (atmData.ce?.iv || 0) * 100;
        const atmPEIV = (atmData.pe?.iv || 0) * 100;
        const atmIV = (atmCEIV + atmPEIV) / 2;

        // Straddle premium
        const straddlePremium = atmCELtp + atmPELtp;
        const straddlePct = spotPrice > 0 ? (straddlePremium / spotPrice) * 100 : 0;

        // Expected move (1 standard deviation) = Spot × ATM IV × sqrt(DTE/365)
        const yearsToExpiry = (dte || 7) / 365;
        const expectedMove1SD = spotPrice * (atmIV / 100) * Math.sqrt(yearsToExpiry);
        const expectedMovePct = spotPrice > 0 ? (expectedMove1SD / spotPrice) * 100 : 0;

        // Breakevens
        const upperBreakeven = atmStrike + straddlePremium;
        const lowerBreakeven = atmStrike - straddlePremium;

        // Compare straddle premium to expected move
        // If straddle > expected move, options are "expensive"
        const straddle2EM = expectedMove1SD > 0 ? (straddlePremium / expectedMove1SD) * 100 : 100;

        // Nearby straddles for comparison
        const strikes = Object.keys(optionChain).map(Number).sort((a, b) => a - b);
        const atmIdx = strikes.indexOf(atmStrike) >= 0 ? strikes.indexOf(atmStrike) : strikes.findIndex(s => s >= atmStrike);

        const nearbyStraddles = [];
        for (let i = Math.max(0, atmIdx - 3); i < Math.min(strikes.length, atmIdx + 4); i++) {
            const strike = strikes[i];
            const data = optionChain[strike] || optionChain[String(strike)];
            if (!data) continue;

            const ceLtp = data.ce?.ltp || 0;
            const peLtp = data.pe?.ltp || 0;
            const premium = ceLtp + peLtp;

            nearbyStraddles.push({
                strike,
                ceLtp,
                peLtp,
                premium,
                premiumPct: spotPrice > 0 ? (premium / spotPrice) * 100 : 0,
                isATM: strike === atmStrike
            });
        }

        return {
            atmStrike,
            atmCELtp,
            atmPELtp,
            straddlePremium,
            straddlePct,
            atmIV,
            expectedMove1SD,
            expectedMovePct,
            upperBreakeven,
            lowerBreakeven,
            straddle2EM,
            dte: dte || 7,
            nearbyStraddles
        };
    }, [optionChain, spotPrice, atmStrike, dte]);

    if (!optionChain || !straddleData) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ArrowsRightLeftIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const isExpensive = straddleData.straddle2EM > 110;
    const isCheap = straddleData.straddle2EM < 90;

    return (
        <div className="space-y-4">
            {/* Main Straddle Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ArrowsRightLeftIcon className="w-6 h-6" />
                            <div>
                                <h3 className="font-bold text-lg">ATM Straddle @ {straddleData.atmStrike}</h3>
                                <div className="text-xs opacity-80">{straddleData.dte} days to expiry</div>
                            </div>
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${isExpensive ? 'bg-red-100 text-red-700' :
                                isCheap ? 'bg-green-100 text-green-700' :
                                    'bg-white/20'
                            }`}>
                            {isExpensive ? 'Expensive' : isCheap ? 'Cheap' : 'Fair Value'}
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {/* Straddle Premium */}
                    <div className="text-center mb-6">
                        <div className="text-5xl font-bold text-gray-900 dark:text-white">
                            ₹{straddleData.straddlePremium.toFixed(2)}
                        </div>
                        <div className="text-lg text-gray-500">
                            {straddleData.straddlePct.toFixed(2)}% of spot
                        </div>
                    </div>

                    {/* CE + PE Breakdown */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <div className="text-xs text-green-600 mb-1">Call Premium</div>
                            <div className="text-2xl font-bold text-green-700">₹{straddleData.atmCELtp.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                            <div className="text-xs text-red-600 mb-1">Put Premium</div>
                            <div className="text-2xl font-bold text-red-700">₹{straddleData.atmPELtp.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* Expected Move Range */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 text-center">
                            Expected Move (1σ) by Expiry
                        </div>

                        {/* Visual Range */}
                        <div className="relative h-12 mb-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div
                                    className="h-2 bg-gradient-to-r from-red-400 via-amber-400 to-green-400 rounded-full"
                                    style={{
                                        width: `${Math.min(80, straddleData.expectedMovePct * 10)}%`
                                    }}
                                ></div>
                            </div>
                            {/* Center marker (spot) */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow"></div>
                            </div>
                            {/* Lower bound */}
                            <div className="absolute left-4 inset-y-0 flex items-center">
                                <div className="text-xs font-bold text-red-600">
                                    {(spotPrice - straddleData.expectedMove1SD).toFixed(0)}
                                </div>
                            </div>
                            {/* Upper bound */}
                            <div className="absolute right-4 inset-y-0 flex items-center">
                                <div className="text-xs font-bold text-green-600">
                                    {(spotPrice + straddleData.expectedMove1SD).toFixed(0)}
                                </div>
                            </div>
                        </div>

                        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                            ±₹{straddleData.expectedMove1SD.toFixed(0)} ({straddleData.expectedMovePct.toFixed(1)}%) from spot
                        </div>
                    </div>

                    {/* Breakevens */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                            <ArrowTrendingDownIcon className="w-5 h-5 text-red-600" />
                            <div>
                                <div className="text-[10px] text-red-600">Lower Breakeven</div>
                                <div className="font-bold text-red-700">{straddleData.lowerBreakeven.toFixed(0)}</div>
                                <div className="text-[10px] text-gray-500">
                                    {((straddleData.lowerBreakeven - spotPrice) / spotPrice * 100).toFixed(1)}% from spot
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
                            <div>
                                <div className="text-[10px] text-green-600">Upper Breakeven</div>
                                <div className="font-bold text-green-700">{straddleData.upperBreakeven.toFixed(0)}</div>
                                <div className="text-[10px] text-gray-500">
                                    +{((straddleData.upperBreakeven - spotPrice) / spotPrice * 100).toFixed(1)}% from spot
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1">ATM IV</div>
                    <div className="text-xl font-bold text-purple-600">{straddleData.atmIV.toFixed(1)}%</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1">Straddle/EM Ratio</div>
                    <div className={`text-xl font-bold ${isExpensive ? 'text-red-600' : isCheap ? 'text-green-600' : 'text-gray-900 dark:text-white'
                        }`}>{straddleData.straddle2EM.toFixed(0)}%</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1">Spot Price</div>
                    <div className="text-xl font-bold text-blue-600">₹{spotPrice?.toFixed(2)}</div>
                </div>
            </div>

            {/* Nearby Straddles Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700/50">
                    <h3 className="font-semibold text-sm">Nearby Straddles</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-700/30">
                            <tr>
                                <th className="py-2 px-3 text-left">Strike</th>
                                <th className="py-2 px-3 text-right">CE</th>
                                <th className="py-2 px-3 text-right">PE</th>
                                <th className="py-2 px-3 text-right">Straddle</th>
                                <th className="py-2 px-3 text-right">% of Spot</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {straddleData.nearbyStraddles.map((row, i) => (
                                <tr key={i} className={row.isATM ? 'bg-blue-50 dark:bg-blue-900/20 font-bold' : ''}>
                                    <td className="py-2 px-3">
                                        {row.strike}
                                        {row.isATM && <span className="ml-1 text-[8px] text-blue-600">ATM</span>}
                                    </td>
                                    <td className="py-2 px-3 text-right text-green-600">₹{row.ceLtp.toFixed(2)}</td>
                                    <td className="py-2 px-3 text-right text-red-600">₹{row.peLtp.toFixed(2)}</td>
                                    <td className="py-2 px-3 text-right font-medium">₹{row.premium.toFixed(2)}</td>
                                    <td className="py-2 px-3 text-right">{row.premiumPct.toFixed(2)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Interpretation */}
            <div className={`rounded-xl p-4 ${isExpensive ? 'bg-red-50 dark:bg-red-900/20' :
                    isCheap ? 'bg-green-50 dark:bg-green-900/20' :
                        'bg-blue-50 dark:bg-blue-900/20'
                }`}>
                <div className="text-sm">
                    <strong>Trading Insight:</strong>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {isExpensive
                            ? '⚠️ Straddle is trading above expected move. Options are expensive. Consider selling straddles/strangles (hedged). Avoid buying naked options.'
                            : isCheap
                                ? '✅ Straddle is trading below expected move. Options are cheap. Good for buying straddles/strangles if you expect a big move.'
                                : 'Straddle is fairly priced relative to expected move. Evaluate based on your directional view.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StraddleExpectedMove;

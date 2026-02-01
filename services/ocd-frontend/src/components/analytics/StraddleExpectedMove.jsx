/**
 * Enhanced Straddle & Expected Move Tracker
 * 
 * NIFTY 50 Calibrated Analysis:
 * - Historical straddle premium context
 * - Probability zones for expected moves
 * - Strangle comparison for cheaper trades
 * - Weekly vs monthly premium decay analysis
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectDaysToExpiry } from '../../context/selectors';
import {
    ArrowsRightLeftIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    ChevronDownIcon, LightBulbIcon
} from '@heroicons/react/24/outline';

// ============ NIFTY 50 HISTORICAL CONTEXT ============
const NIFTY_STRADDLE_CONTEXT = {
    // Historical straddle premium ranges (% of spot)
    weekly: {
        low: 0.8,      // Weekly straddle < 0.8% = cheap
        normal: 1.2,   // Normal range
        high: 1.8,     // > 1.8% = expensive
    },
    monthly: {
        low: 2.0,      // Monthly straddle < 2% = cheap
        normal: 3.0,   // Normal range
        high: 4.5,     // > 4.5% = expensive
    },
    // Typical NIFTY daily range
    avgDailyMove: 0.8,  // ~0.8% average daily move
    avgWeeklyMove: 1.8, // ~1.8% average weekly move
};

// Get premium valuation
const getPremiumValuation = (straddlePct, dte) => {
    const isWeekly = dte <= 7;
    const context = isWeekly ? NIFTY_STRADDLE_CONTEXT.weekly : NIFTY_STRADDLE_CONTEXT.monthly;

    if (straddlePct < context.low) {
        return {
            label: 'Cheap',
            color: 'green',
            confidence: 80,
            emoji: '🟢',
            description: 'Below historical average. Good for buying.',
        };
    }
    if (straddlePct > context.high) {
        return {
            label: 'Expensive',
            color: 'red',
            confidence: 80,
            emoji: '🔴',
            description: 'Above historical average. Good for selling.',
        };
    }
    if (straddlePct > context.normal) {
        return {
            label: 'Slightly Expensive',
            color: 'orange',
            confidence: 60,
            emoji: '🟠',
            description: 'Above normal. Lean toward selling.',
        };
    }
    return {
        label: 'Fair Value',
        color: 'amber',
        confidence: 50,
        emoji: '⚪',
        description: 'Within normal range.',
    };
};

// Calculate probability of move
const calcMoveProbability = (movePct, iv, dte) => {
    // Standard normal CDF approximation
    const yearsToExpiry = dte / 365;
    const sigma = iv * Math.sqrt(yearsToExpiry);
    const zScore = movePct / (sigma * 100);

    // Probability of staying within range (simplified)
    // Using normal distribution approximation
    const prob = 1 - 2 * (1 / (1 + Math.exp(-1.7 * zScore)));
    return Math.max(0, Math.min(100, prob * 100));
};

// ============ MAIN COMPONENT ============
const StraddleExpectedMove = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const dte = useSelector(selectDaysToExpiry);
    const [showDetails, setShowDetails] = useState(false);

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
        const daysToExp = dte || 7;
        const yearsToExpiry = daysToExp / 365;
        const expectedMove1SD = spotPrice * (atmIV / 100) * Math.sqrt(yearsToExpiry);
        const expectedMovePct = spotPrice > 0 ? (expectedMove1SD / spotPrice) * 100 : 0;

        // 2SD move (95% probability range)
        const expectedMove2SD = expectedMove1SD * 2;
        const expectedMove2SDPct = expectedMovePct * 2;

        // Breakevens
        const upperBreakeven = atmStrike + straddlePremium;
        const lowerBreakeven = atmStrike - straddlePremium;
        const breakEvenPct = (straddlePremium / spotPrice) * 100;

        // Compare straddle premium to expected move
        const straddle2EM = expectedMove1SD > 0 ? (straddlePremium / expectedMove1SD) * 100 : 100;

        // Probability that spot stays within breakeven range
        const probWithinBE = calcMoveProbability(breakEvenPct, atmIV / 100, daysToExp);

        // Strangle comparison (5% OTM)
        const strikes = Object.keys(optionChain).map(Number).sort((a, b) => a - b);
        const strikeGap = strikes.length > 1 ? strikes[1] - strikes[0] : 50;
        const strangleDistance = Math.round((spotPrice * 0.02) / strikeGap) * strikeGap; // ~2% OTM
        const callStrike = atmStrike + strangleDistance;
        const putStrike = atmStrike - strangleDistance;

        const callData = optionChain[callStrike] || optionChain[String(callStrike)];
        const putData = optionChain[putStrike] || optionChain[String(putStrike)];

        const stranglePremium = (callData?.ce?.ltp || 0) + (putData?.pe?.ltp || 0);
        const stranglePct = spotPrice > 0 ? (stranglePremium / spotPrice) * 100 : 0;
        const strangleSaving = straddlePremium > 0 ? ((straddlePremium - stranglePremium) / straddlePremium) * 100 : 0;

        // Nearby straddles for comparison
        const atmIdx = strikes.findIndex(s => s >= atmStrike);
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

        // Daily/weekly move context
        const isWeekly = daysToExp <= 7;
        const expectedDailyMove = spotPrice * NIFTY_STRADDLE_CONTEXT.avgDailyMove / 100;
        const movesNeeded = expectedMove1SD / expectedDailyMove;

        return {
            atmStrike,
            atmCELtp,
            atmPELtp,
            straddlePremium,
            straddlePct,
            atmIV,
            atmCEIV,
            atmPEIV,
            expectedMove1SD,
            expectedMovePct,
            expectedMove2SD,
            expectedMove2SDPct,
            upperBreakeven,
            lowerBreakeven,
            breakEvenPct,
            straddle2EM,
            probWithinBE,
            dte: daysToExp,
            isWeekly,
            stranglePremium,
            stranglePct,
            strangleSaving,
            callStrike,
            putStrike,
            nearbyStraddles,
            movesNeeded,
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

    const valuation = getPremiumValuation(straddleData.straddlePct, straddleData.dte);
    const isExpensive = valuation.label.includes('Expensive');
    const isCheap = valuation.label === 'Cheap';

    const getColorClass = (color) => {
        const classes = {
            green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
            amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        };
        return classes[color] || classes.amber;
    };

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
                                <div className="text-xs opacity-80">
                                    {straddleData.dte} days to expiry | {straddleData.isWeekly ? 'Weekly' : 'Monthly'}
                                </div>
                            </div>
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${getColorClass(valuation.color)}`}>
                            {valuation.emoji} {valuation.label}
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {/* Straddle Premium */}
                    <div className="text-center mb-4">
                        <div className="text-5xl font-bold text-gray-900 dark:text-white">
                            ₹{straddleData.straddlePremium.toFixed(2)}
                        </div>
                        <div className="text-lg text-gray-500">
                            {straddleData.straddlePct.toFixed(2)}% of spot
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                            NIFTY {straddleData.isWeekly ? 'Weekly' : 'Monthly'} Avg: {
                                straddleData.isWeekly
                                    ? NIFTY_STRADDLE_CONTEXT.weekly.normal
                                    : NIFTY_STRADDLE_CONTEXT.monthly.normal
                            }%
                        </div>
                    </div>

                    {/* Probability Gauge */}
                    <div className="mb-6">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Probability spot stays within breakeven</span>
                            <span className={`font-bold ${straddleData.probWithinBE > 50 ? 'text-green-600' : 'text-red-600'}`}>
                                {straddleData.probWithinBE.toFixed(0)}%
                            </span>
                        </div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${straddleData.probWithinBE}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-full ${straddleData.probWithinBE > 50 ? 'bg-green-500' : 'bg-red-500'}`}
                            />
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 text-center">
                            {straddleData.probWithinBE > 50
                                ? 'Sellers have edge - high probability of premium decay'
                                : 'Buyers have edge - high probability of breakout'}
                        </div>
                    </div>

                    {/* CE + PE Breakdown */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <div className="text-xs text-green-600 mb-1">Call Premium</div>
                            <div className="text-xl font-bold text-green-700">₹{straddleData.atmCELtp.toFixed(2)}</div>
                            <div className="text-[10px] text-gray-500">IV: {straddleData.atmCEIV.toFixed(1)}%</div>
                        </div>
                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                            <div className="text-xs text-red-600 mb-1">Put Premium</div>
                            <div className="text-xl font-bold text-red-700">₹{straddleData.atmPELtp.toFixed(2)}</div>
                            <div className="text-[10px] text-gray-500">IV: {straddleData.atmPEIV.toFixed(1)}%</div>
                        </div>
                    </div>

                    {/* Expected Move Range */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center justify-between">
                            <span>Expected Move Range</span>
                            <span className="text-xs font-normal text-gray-500">Based on ATM IV</span>
                        </div>

                        {/* Visual Range */}
                        <div className="relative h-16 mb-2">
                            {/* Background bar */}
                            <div className="absolute inset-x-0 top-6 h-4 bg-gray-200 dark:bg-gray-600 rounded-full" />

                            {/* 2SD range */}
                            <div
                                className="absolute top-6 h-4 bg-amber-200 dark:bg-amber-800/50 rounded-full"
                                style={{
                                    left: '10%',
                                    right: '10%',
                                }}
                            />

                            {/* 1SD range */}
                            <div
                                className="absolute top-6 h-4 bg-gradient-to-r from-red-400 via-amber-400 to-green-400 rounded-full"
                                style={{
                                    left: '25%',
                                    right: '25%',
                                }}
                            />

                            {/* Spot marker */}
                            <div className="absolute left-1/2 top-4 -translate-x-1/2 z-10">
                                <div className="w-4 h-8 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                                <div className="text-[10px] text-center mt-1 font-bold text-blue-600">
                                    {spotPrice?.toFixed(0)}
                                </div>
                            </div>

                            {/* 1SD bounds */}
                            <div className="absolute left-[25%] top-0 text-xs font-bold text-red-600">
                                {(spotPrice - straddleData.expectedMove1SD).toFixed(0)}
                            </div>
                            <div className="absolute right-[25%] top-0 text-xs font-bold text-green-600">
                                {(spotPrice + straddleData.expectedMove1SD).toFixed(0)}
                            </div>

                            {/* 2SD bounds */}
                            <div className="absolute left-[10%] bottom-0 text-[10px] text-gray-500">
                                {(spotPrice - straddleData.expectedMove2SD).toFixed(0)}
                            </div>
                            <div className="absolute right-[10%] bottom-0 text-[10px] text-gray-500">
                                {(spotPrice + straddleData.expectedMove2SD).toFixed(0)}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs mt-4">
                            <div className="text-center">
                                <span className="text-gray-500">1σ Move (68%):</span>
                                <span className="font-bold ml-1">±{straddleData.expectedMovePct.toFixed(1)}%</span>
                            </div>
                            <div className="text-center">
                                <span className="text-gray-500">2σ Move (95%):</span>
                                <span className="font-bold ml-1">±{straddleData.expectedMove2SDPct.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Breakevens + Strangle Comparison */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                            <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                            <div>
                                <div className="text-[10px] text-red-600">Lower BE</div>
                                <div className="font-bold text-red-700">{straddleData.lowerBreakeven.toFixed(0)}</div>
                                <div className="text-[10px] text-gray-500">
                                    {((straddleData.lowerBreakeven - spotPrice) / spotPrice * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                            <div>
                                <div className="text-[10px] text-green-600">Upper BE</div>
                                <div className="font-bold text-green-700">{straddleData.upperBreakeven.toFixed(0)}</div>
                                <div className="text-[10px] text-gray-500">
                                    +{((straddleData.upperBreakeven - spotPrice) / spotPrice * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Strangle Comparison Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm">💡 Cheaper Alternative: Strangle</h4>
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded font-bold">
                        Save {straddleData.strangleSaving.toFixed(0)}%
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <div className="text-gray-500">CE @ {straddleData.callStrike}</div>
                        <div className="font-bold text-green-600">
                            ₹{(optionChain[straddleData.callStrike]?.ce?.ltp || 0).toFixed(2)}
                        </div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <div className="text-gray-500">PE @ {straddleData.putStrike}</div>
                        <div className="font-bold text-red-600">
                            ₹{(optionChain[straddleData.putStrike]?.pe?.ltp || 0).toFixed(2)}
                        </div>
                    </div>
                    <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded">
                        <div className="text-gray-500">Strangle</div>
                        <div className="font-bold text-indigo-600">
                            ₹{straddleData.stranglePremium.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expandable Details */}
            <div
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer"
                onClick={() => setShowDetails(!showDetails)}
            >
                <div className="px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50">
                    <span className="font-semibold text-sm">Nearby Straddles</span>
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                </div>

                <AnimatePresence>
                    {showDetails && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Trading Insight */}
            <div className={`rounded-xl p-4 ${getColorClass(valuation.color)}`}>
                <div className="flex items-start gap-2">
                    <LightBulbIcon className="w-5 h-5 flex-shrink-0" />
                    <div className="text-sm">
                        <strong>Trading Insight:</strong>
                        <p className="text-xs mt-1 opacity-80">
                            {isExpensive
                                ? `⚠️ Straddle at ${straddleData.straddle2EM.toFixed(0)}% of expected move - EXPENSIVE. Consider selling straddles/strangles (hedged). Sellers have ${straddleData.probWithinBE.toFixed(0)}% probability edge.`
                                : isCheap
                                    ? `✅ Straddle at ${straddleData.straddle2EM.toFixed(0)}% of expected move - CHEAP. Good for buying if expecting ${straddleData.movesNeeded.toFixed(1)}+ average daily moves.`
                                    : `Straddle is fairly priced at ${straddleData.straddle2EM.toFixed(0)}% of expected move. Evaluate based on directional view.`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer Context */}
            <div className="text-center text-[10px] text-gray-500">
                <span className="font-medium text-indigo-600">NIFTY 50</span> |
                Avg Daily Move: ±{NIFTY_STRADDLE_CONTEXT.avgDailyMove}% |
                Weekly Normal: {NIFTY_STRADDLE_CONTEXT.weekly.normal}% |
                Monthly Normal: {NIFTY_STRADDLE_CONTEXT.monthly.normal}%
            </div>
        </div>
    );
};

export default StraddleExpectedMove;

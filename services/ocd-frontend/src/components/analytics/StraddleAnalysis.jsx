/**
 * Straddle/Strangle Analysis Component
 * ATM Straddle pricing and visualization
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectDaysToExpiry, selectATMIV } from '../../context/selectors';
import { ScaleIcon, ChartBarIcon, ClockIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

const StraddleAnalysis = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const daysToExpiry = useSelector(selectDaysToExpiry);
    const _atmIV = useSelector(selectATMIV);
    
    const [selectedStrike, setSelectedStrike] = useState(null);
    const [strangleWidth, setStrangleWidth] = useState(100);

    // Get strikes around ATM
    const strikes = useMemo(() => {
        if (!optionChain) return [];
        return Object.keys(optionChain)
            .map(Number)
            .sort((a, b) => a - b);
    }, [optionChain]);

    // ATM Straddle data
    const straddleData = useMemo(() => {
        if (!optionChain || !atmStrike) return null;
        
        const strike = selectedStrike || atmStrike;
        const data = optionChain[strike];
        if (!data) return null;

        const ce = data.ce || {};
        const pe = data.pe || {};
        const ceLTP = ce.ltp || 0;
        const peLTP = pe.ltp || 0;
        const straddlePrice = ceLTP + peLTP;
        const upperBE = strike + straddlePrice;
        const lowerBE = strike - straddlePrice;

        return {
            strike,
            ceLTP,
            peLTP,
            straddlePrice,
            upperBE,
            lowerBE,
            ceIV: ce.iv || 0,
            peIV: pe.iv || 0,
            avgIV: ((ce.iv || 0) + (pe.iv || 0)) / 2,
            ceDelta: ce.optgeeks?.delta || 0,
            peDelta: pe.optgeeks?.delta || 0,
            ceTheta: ce.optgeeks?.theta || 0,
            peTheta: pe.optgeeks?.theta || 0,
            maxLoss: straddlePrice,
            expectedMove: straddlePrice / strike * 100,
        };
    }, [optionChain, atmStrike, selectedStrike]);

    // Strangle data
    const strangleData = useMemo(() => {
        if (!optionChain || !atmStrike) return null;
        
        const ceStrike = atmStrike + strangleWidth;
        const peStrike = atmStrike - strangleWidth;
        
        const ceData = optionChain[ceStrike]?.ce || {};
        const peData = optionChain[peStrike]?.pe || {};
        
        const ceLTP = ceData.ltp || 0;
        const peLTP = peData.ltp || 0;
        const stranglePrice = ceLTP + peLTP;

        return {
            ceStrike,
            peStrike,
            ceLTP,
            peLTP,
            stranglePrice,
            upperBE: ceStrike + stranglePrice,
            lowerBE: peStrike - stranglePrice,
            savings: straddleData ? straddleData.straddlePrice - stranglePrice : 0,
        };
    }, [optionChain, atmStrike, strangleWidth, straddleData]);

    // Payoff calculation
    const payoffData = useMemo(() => {
        if (!straddleData) return [];
        
        const { strike, straddlePrice: _straddlePrice } = straddleData;
        const points = [];
        
        for (let price = strike - 500; price <= strike + 500; price += 10) {
            const cePayoff = Math.max(0, price - strike) - straddleData.ceLTP;
            const pePayoff = Math.max(0, strike - price) - straddleData.peLTP;
            points.push({
                price,
                payoff: cePayoff + pePayoff,
            });
        }
        
        return points;
    }, [straddleData]);

    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ScaleIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Premium Strike Selector */}
            <div className="glass rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Strike:</label>
                        <select
                            value={selectedStrike || atmStrike}
                            onChange={(e) => setSelectedStrike(Number(e.target.value))}
                            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                        >
                            {strikes.map(s => (
                                <option key={s} value={s}>
                                    {s} {s === atmStrike ? '(ATM)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                        <ClockIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">{daysToExpiry} days to expiry</span>
                    </div>
                </div>
            </div>

            {/* Premium Straddle Summary */}
            {straddleData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/25">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                        <div className="relative">
                            <div className="text-xs opacity-80 mb-1 font-medium">Straddle Price</div>
                            <div className="text-3xl font-bold">₹{straddleData.straddlePrice.toFixed(2)}</div>
                            <div className="text-xs opacity-70 mt-1">CE + PE Premium</div>
                        </div>
                    </div>
                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/25">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                        <div className="relative">
                            <div className="text-xs opacity-80 mb-1 font-medium">Upper Breakeven</div>
                            <div className="text-3xl font-bold">{straddleData.upperBE.toFixed(0)}</div>
                            <div className="text-xs opacity-70 mt-1">+{(straddleData.upperBE - spotPrice).toFixed(0)} from spot</div>
                        </div>
                    </div>
                    <div className="relative overflow-hidden bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-500/25">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                        <div className="relative">
                            <div className="text-xs opacity-80 mb-1 font-medium">Lower Breakeven</div>
                            <div className="text-3xl font-bold">{straddleData.lowerBE.toFixed(0)}</div>
                            <div className="text-xs opacity-70 mt-1">{(straddleData.lowerBE - spotPrice).toFixed(0)} from spot</div>
                        </div>
                    </div>
                    <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/25">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                        <div className="relative">
                            <div className="text-xs opacity-80 mb-1 font-medium">Expected Move</div>
                            <div className="text-3xl font-bold">±{straddleData.expectedMove.toFixed(2)}%</div>
                            <div className="text-xs opacity-70 mt-1">{straddleData.straddlePrice.toFixed(0)} pts range</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Straddle Details */}
            {straddleData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Premium Breakdown */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="font-semibold flex items-center gap-2">
                                <ScaleIcon className="w-5 h-5 text-purple-500" />
                                Premium Breakdown
                            </h3>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Visual bar */}
                            <div className="flex h-8 rounded-lg overflow-hidden">
                                <div 
                                    className="bg-green-500 flex items-center justify-center text-white text-xs font-bold"
                                    style={{ width: `${(straddleData.ceLTP / straddleData.straddlePrice) * 100}%` }}
                                >
                                    CE ₹{straddleData.ceLTP.toFixed(0)}
                                </div>
                                <div 
                                    className="bg-red-500 flex items-center justify-center text-white text-xs font-bold"
                                    style={{ width: `${(straddleData.peLTP / straddleData.straddlePrice) * 100}%` }}
                                >
                                    PE ₹{straddleData.peLTP.toFixed(0)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-gray-500">CE Premium</div>
                                    <div className="font-bold text-green-600">₹{straddleData.ceLTP.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-gray-500">PE Premium</div>
                                    <div className="font-bold text-red-600">₹{straddleData.peLTP.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-gray-500">CE IV</div>
                                    <div className="font-bold">{straddleData.ceIV.toFixed(2)}%</div>
                                </div>
                                <div>
                                    <div className="text-gray-500">PE IV</div>
                                    <div className="font-bold">{straddleData.peIV.toFixed(2)}%</div>
                                </div>
                                <div>
                                    <div className="text-gray-500">Net Theta</div>
                                    <div className="font-bold text-amber-600">₹{(straddleData.ceTheta + straddleData.peTheta).toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-gray-500">Net Delta</div>
                                    <div className="font-bold">{(straddleData.ceDelta + straddleData.peDelta).toFixed(3)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payoff Chart */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="font-semibold flex items-center gap-2">
                                <ChartBarIcon className="w-5 h-5 text-blue-500" />
                                Payoff Diagram
                            </h3>
                        </div>
                        <div className="p-4">
                            <PayoffChart data={payoffData} spotPrice={spotPrice} strike={straddleData.strike} />
                        </div>
                    </div>
                </div>
            )}

            {/* Strangle Builder */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold flex items-center gap-2">
                        <ArrowsRightLeftIcon className="w-5 h-5 text-indigo-500" />
                        Strangle Builder
                    </h3>
                </div>
                <div className="p-4">
                    <div className="flex items-center gap-4 mb-4">
                        <label className="text-sm font-medium">Width from ATM:</label>
                        <input
                            type="range"
                            min="50"
                            max="500"
                            step="50"
                            value={strangleWidth}
                            onChange={(e) => setStrangleWidth(Number(e.target.value))}
                            className="flex-1"
                        />
                        <span className="font-bold text-indigo-600">{strangleWidth} pts</span>
                    </div>

                    {strangleData && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                                <div className="text-xs text-green-600">CE Strike</div>
                                <div className="font-bold text-lg">{strangleData.ceStrike}</div>
                                <div className="text-sm text-green-600">₹{strangleData.ceLTP.toFixed(2)}</div>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                                <div className="text-xs text-red-600">PE Strike</div>
                                <div className="font-bold text-lg">{strangleData.peStrike}</div>
                                <div className="text-sm text-red-600">₹{strangleData.peLTP.toFixed(2)}</div>
                            </div>
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
                                <div className="text-xs text-indigo-600">Strangle Price</div>
                                <div className="font-bold text-lg">₹{strangleData.stranglePrice.toFixed(2)}</div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                                <div className="text-xs text-amber-600">Savings vs Straddle</div>
                                <div className="font-bold text-lg text-green-600">₹{strangleData.savings.toFixed(2)}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                <div className="text-xs text-gray-600">Breakeven Range</div>
                                <div className="font-bold">{strangleData.lowerBE.toFixed(0)} - {strangleData.upperBE.toFixed(0)}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Payoff Chart Component
const PayoffChart = ({ data, spotPrice, strike }) => {
    if (!data || data.length === 0) return null;

    const width = 400;
    const height = 180;
    const padding = { left: 40, right: 20, top: 10, bottom: 30 };

    const prices = data.map(d => d.price);
    const payoffs = data.map(d => d.payoff);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minPayoff = Math.min(...payoffs);
    const maxPayoff = Math.max(...payoffs);
    const payoffRange = maxPayoff - minPayoff || 1;

    const xScale = (price) => padding.left + ((price - minPrice) / (maxPrice - minPrice)) * (width - padding.left - padding.right);
    const yScale = (payoff) => padding.top + ((maxPayoff - payoff) / payoffRange) * (height - padding.top - padding.bottom);

    const points = data.map(d => `${xScale(d.price)},${yScale(d.payoff)}`).join(' ');
    const zeroY = yScale(0);

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Zero line */}
            <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#E5E7EB" strokeWidth="1" />
            
            {/* Strike line */}
            <line x1={xScale(strike)} y1={padding.top} x2={xScale(strike)} y2={height - padding.bottom} stroke="#8B5CF6" strokeWidth="2" strokeDasharray="4" />
            
            {/* Spot line */}
            <line x1={xScale(spotPrice)} y1={padding.top} x2={xScale(spotPrice)} y2={height - padding.bottom} stroke="#3B82F6" strokeWidth="2" />

            {/* Payoff line */}
            <polyline 
                points={points} 
                fill="none" 
                stroke="#10B981" 
                strokeWidth="2.5" 
            />

            {/* Fill profit area */}
            <polygon
                points={`${points} ${xScale(maxPrice)},${zeroY} ${xScale(minPrice)},${zeroY}`}
                fill="url(#payoffGradient)"
            />
            <defs>
                <linearGradient id="payoffGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Labels */}
            <text x={xScale(strike)} y={height - 5} textAnchor="middle" className="fill-purple-600 text-[9px] font-bold">Strike</text>
            <text x={xScale(spotPrice)} y={height - 5} textAnchor="middle" className="fill-blue-600 text-[9px] font-bold">Spot</text>
        </svg>
    );
};

export default StraddleAnalysis;

/**
 * Strategy Builder Component
 * Custom option strategy payoff builder
 */
import { useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectLotSize } from '../../context/selectors';
import { CubeIcon, PlusIcon, TrashIcon, CalculatorIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const StrategyBuilder = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize);
    
    const [legs, setLegs] = useState([]);
    const [presetOpen, setPresetOpen] = useState(false);

    const strikes = useMemo(() => {
        if (!optionChain) return [];
        return Object.keys(optionChain).map(Number).sort((a, b) => a - b);
    }, [optionChain]);

    // Add a leg to the strategy
    const addLeg = useCallback((strike, type, action) => {
        const data = optionChain?.[strike];
        if (!data) return;
        
        const option = type === 'CE' ? data.ce : data.pe;
        if (!option) return;

        setLegs(prev => [...prev, {
            id: Date.now(),
            strike,
            type, // CE or PE
            action, // BUY or SELL
            qty: 1,
            ltp: option.ltp || 0,
            iv: option.iv || 0,
            delta: option.optgeeks?.delta || 0,
            theta: option.optgeeks?.theta || 0,
            gamma: option.optgeeks?.gamma || 0,
            vega: option.optgeeks?.vega || 0,
        }]);
    }, [optionChain]);

    const removeLeg = useCallback((id) => {
        setLegs(prev => prev.filter(l => l.id !== id));
    }, []);

    const updateLegQty = useCallback((id, qty) => {
        setLegs(prev => prev.map(l => l.id === id ? { ...l, qty: Math.max(1, qty) } : l));
    }, []);

    const clearAll = useCallback(() => setLegs([]), []);

    // Preset strategies
    const presets = [
        { name: 'Long Straddle', build: () => { addLeg(atmStrike, 'CE', 'BUY'); addLeg(atmStrike, 'PE', 'BUY'); }},
        { name: 'Short Straddle', build: () => { addLeg(atmStrike, 'CE', 'SELL'); addLeg(atmStrike, 'PE', 'SELL'); }},
        { name: 'Bull Call Spread', build: () => { addLeg(atmStrike, 'CE', 'BUY'); addLeg(atmStrike + 100, 'CE', 'SELL'); }},
        { name: 'Bear Put Spread', build: () => { addLeg(atmStrike, 'PE', 'BUY'); addLeg(atmStrike - 100, 'PE', 'SELL'); }},
        { name: 'Iron Condor', build: () => { 
            addLeg(atmStrike - 200, 'PE', 'BUY'); 
            addLeg(atmStrike - 100, 'PE', 'SELL'); 
            addLeg(atmStrike + 100, 'CE', 'SELL'); 
            addLeg(atmStrike + 200, 'CE', 'BUY'); 
        }},
        { name: 'Iron Butterfly', build: () => { 
            addLeg(atmStrike, 'CE', 'SELL'); 
            addLeg(atmStrike, 'PE', 'SELL'); 
            addLeg(atmStrike + 100, 'CE', 'BUY'); 
            addLeg(atmStrike - 100, 'PE', 'BUY'); 
        }},
        { name: 'Long Strangle', build: () => { addLeg(atmStrike + 100, 'CE', 'BUY'); addLeg(atmStrike - 100, 'PE', 'BUY'); }},
    ];

    // Calculate strategy metrics
    const strategyMetrics = useMemo(() => {
        if (legs.length === 0) return null;

        let totalPremium = 0;
        let netDelta = 0;
        let netGamma = 0;
        let netTheta = 0;
        let netVega = 0;

        legs.forEach(leg => {
            const multiplier = leg.action === 'BUY' ? -1 : 1; // Premium paid/received
            totalPremium += leg.ltp * leg.qty * multiplier;
            netDelta += leg.delta * leg.qty * (leg.action === 'BUY' ? 1 : -1);
            netGamma += leg.gamma * leg.qty * (leg.action === 'BUY' ? 1 : -1);
            netTheta += leg.theta * leg.qty * (leg.action === 'BUY' ? 1 : -1);
            netVega += leg.vega * leg.qty * (leg.action === 'BUY' ? 1 : -1);
        });

        return {
            totalPremium: totalPremium * lotSize,
            netDelta,
            netGamma,
            netTheta,
            netVega,
            maxProfit: totalPremium > 0 ? totalPremium * lotSize : 'Unlimited',
            maxLoss: totalPremium < 0 ? Math.abs(totalPremium) * lotSize : 'Limited',
        };
    }, [legs, lotSize]);

    // Calculate payoff at different spot prices
    const payoffData = useMemo(() => {
        if (legs.length === 0) return [];
        
        const points = [];
        const range = 1000;
        
        for (let price = spotPrice - range; price <= spotPrice + range; price += 10) {
            let payoff = 0;
            
            legs.forEach(leg => {
                let intrinsic = 0;
                if (leg.type === 'CE') {
                    intrinsic = Math.max(0, price - leg.strike);
                } else {
                    intrinsic = Math.max(0, leg.strike - price);
                }
                
                const legPayoff = (intrinsic - leg.ltp) * leg.qty;
                payoff += leg.action === 'BUY' ? legPayoff : -legPayoff;
            });
            
            points.push({ price, payoff: payoff * lotSize });
        }
        
        return points;
    }, [legs, spotPrice, lotSize]);

    // Find breakeven points
    const breakevens = useMemo(() => {
        if (payoffData.length < 2) return [];
        
        const be = [];
        for (let i = 1; i < payoffData.length; i++) {
            if ((payoffData[i-1].payoff < 0 && payoffData[i].payoff >= 0) ||
                (payoffData[i-1].payoff >= 0 && payoffData[i].payoff < 0)) {
                be.push(payoffData[i].price);
            }
        }
        return be;
    }, [payoffData]);

    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <CubeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Presets */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <h3 className="font-semibold flex items-center gap-2">
                            <CubeIcon className="w-5 h-5 text-purple-500" />
                            Strategy Builder
                        </h3>
                        <span className="text-sm text-gray-500">Lot Size: {lotSize}</span>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <button
                                onClick={() => setPresetOpen(!presetOpen)}
                                className="px-4 py-2 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-200"
                            >
                                Presets ▾
                            </button>
                            {presetOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-10">
                                    {presets.map((p, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { clearAll(); setTimeout(p.build, 50); setPresetOpen(false); }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={clearAll}
                            disabled={legs.length === 0}
                            className="px-4 py-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50"
                        >
                            Clear All
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Leg Builder */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold flex items-center gap-2">
                            <PlusIcon className="w-5 h-5 text-blue-500" />
                            Add Legs
                        </h3>
                    </div>
                    <div className="p-4">
                        <LegBuilder strikes={strikes} atmStrike={atmStrike} onAdd={addLeg} />
                    </div>
                </div>

                {/* Strategy Summary */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold flex items-center gap-2">
                            <CalculatorIcon className="w-5 h-5 text-green-500" />
                            Strategy Summary
                        </h3>
                    </div>
                    <div className="p-4">
                        {strategyMetrics ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className={`p-3 rounded-lg ${strategyMetrics.totalPremium >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                    <div className="text-xs text-gray-500">Net Premium</div>
                                    <div className={`text-lg font-bold ${strategyMetrics.totalPremium >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {strategyMetrics.totalPremium >= 0 ? '+' : ''}₹{strategyMetrics.totalPremium.toFixed(0)}
                                    </div>
                                    <div className="text-[10px] text-gray-400">{strategyMetrics.totalPremium >= 0 ? 'Credit' : 'Debit'}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                    <div className="text-xs text-gray-500">Net Delta</div>
                                    <div className="text-lg font-bold">{strategyMetrics.netDelta.toFixed(3)}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                    <div className="text-xs text-gray-500">Net Theta</div>
                                    <div className={`text-lg font-bold ${strategyMetrics.netTheta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        ₹{strategyMetrics.netTheta.toFixed(2)}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                    <div className="text-xs text-gray-500">Net Gamma</div>
                                    <div className="text-lg font-bold">{strategyMetrics.netGamma.toFixed(4)}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                    <div className="text-xs text-gray-500">Net Vega</div>
                                    <div className="text-lg font-bold">{strategyMetrics.netVega.toFixed(2)}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                    <div className="text-xs text-gray-500">Breakevens</div>
                                    <div className="text-sm font-bold text-blue-600">
                                        {breakevens.length > 0 ? breakevens.join(', ') : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 py-8">Add legs to see summary</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Legs Table */}
            {legs.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold">Strategy Legs ({legs.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="p-2 text-left">Action</th>
                                    <th className="p-2 text-center">Strike</th>
                                    <th className="p-2 text-center">Type</th>
                                    <th className="p-2 text-center">Qty</th>
                                    <th className="p-2 text-right">LTP</th>
                                    <th className="p-2 text-right">IV</th>
                                    <th className="p-2 text-right">Delta</th>
                                    <th className="p-2 text-right">Value</th>
                                    <th className="p-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {legs.map((leg) => (
                                    <tr key={leg.id}>
                                        <td className="p-2">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                leg.action === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {leg.action}
                                            </span>
                                        </td>
                                        <td className="p-2 text-center font-bold">{leg.strike}</td>
                                        <td className="p-2 text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                leg.type === 'CE' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                            }`}>
                                                {leg.type}
                                            </span>
                                        </td>
                                        <td className="p-2 text-center">
                                            <input
                                                type="number"
                                                min="1"
                                                value={leg.qty}
                                                onChange={(e) => updateLegQty(leg.id, parseInt(e.target.value) || 1)}
                                                className="w-12 text-center border rounded px-1 py-0.5"
                                            />
                                        </td>
                                        <td className="p-2 text-right">₹{leg.ltp.toFixed(2)}</td>
                                        <td className="p-2 text-right">{leg.iv.toFixed(1)}%</td>
                                        <td className="p-2 text-right">{leg.delta.toFixed(3)}</td>
                                        <td className={`p-2 text-right font-medium ${
                                            leg.action === 'SELL' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {leg.action === 'SELL' ? '+' : '-'}₹{(leg.ltp * leg.qty * lotSize).toFixed(0)}
                                        </td>
                                        <td className="p-2">
                                            <button onClick={() => removeLeg(leg.id)} className="p-1 hover:bg-red-100 rounded text-red-500">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Payoff Chart */}
            {payoffData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold flex items-center gap-2">
                            <ChartBarIcon className="w-5 h-5 text-blue-500" />
                            Payoff at Expiry
                        </h3>
                    </div>
                    <div className="p-4">
                        <PayoffChart data={payoffData} spotPrice={spotPrice} breakevens={breakevens} />
                    </div>
                </div>
            )}
        </div>
    );
};

// Leg Builder Component
const LegBuilder = ({ strikes, atmStrike, onAdd }) => {
    const [strike, setStrike] = useState(atmStrike || strikes[0] || 0);
    const [type, setType] = useState('CE');
    const [action, setAction] = useState('BUY');

    return (
        <div className="flex flex-wrap items-end gap-3">
            <div>
                <label className="text-xs text-gray-500 block mb-1">Action</label>
                <div className="flex gap-1">
                    <button
                        onClick={() => setAction('BUY')}
                        className={`px-3 py-1.5 rounded text-sm font-medium ${action === 'BUY' ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                    >
                        BUY
                    </button>
                    <button
                        onClick={() => setAction('SELL')}
                        className={`px-3 py-1.5 rounded text-sm font-medium ${action === 'SELL' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                    >
                        SELL
                    </button>
                </div>
            </div>
            <div>
                <label className="text-xs text-gray-500 block mb-1">Strike</label>
                <select
                    value={strike}
                    onChange={(e) => setStrike(Number(e.target.value))}
                    className="px-3 py-1.5 border rounded bg-white dark:bg-gray-700 text-sm"
                >
                    {strikes.map(s => (
                        <option key={s} value={s}>{s} {s === atmStrike ? '(ATM)' : ''}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="text-xs text-gray-500 block mb-1">Type</label>
                <div className="flex gap-1">
                    <button
                        onClick={() => setType('CE')}
                        className={`px-3 py-1.5 rounded text-sm font-medium ${type === 'CE' ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                    >
                        CE
                    </button>
                    <button
                        onClick={() => setType('PE')}
                        className={`px-3 py-1.5 rounded text-sm font-medium ${type === 'PE' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                    >
                        PE
                    </button>
                </div>
            </div>
            <button
                onClick={() => onAdd(strike, type, action)}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
            >
                <PlusIcon className="w-4 h-4" /> Add Leg
            </button>
        </div>
    );
};

// Payoff Chart
const PayoffChart = ({ data, spotPrice, breakevens }) => {
    if (!data || data.length === 0) return null;

    const width = 600;
    const height = 220;
    const padding = { left: 60, right: 20, top: 20, bottom: 30 };

    const prices = data.map(d => d.price);
    const payoffs = data.map(d => d.payoff);
    const minPayoff = Math.min(...payoffs, 0);
    const maxPayoff = Math.max(...payoffs, 0);
    const payoffRange = maxPayoff - minPayoff || 1;

    const xScale = (price) => padding.left + ((price - prices[0]) / (prices[prices.length-1] - prices[0])) * (width - padding.left - padding.right);
    const yScale = (payoff) => padding.top + ((maxPayoff - payoff) / payoffRange) * (height - padding.top - padding.bottom);
    const zeroY = yScale(0);

    const points = data.map(d => `${xScale(d.price)},${yScale(d.payoff)}`).join(' ');

    // Create profit/loss areas
    const profitPoints = data.filter(d => d.payoff >= 0);
    const lossPoints = data.filter(d => d.payoff < 0);

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Grid */}
            <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#9CA3AF" strokeWidth="1.5" />
            
            {/* Profit fill */}
            {profitPoints.length > 1 && (
                <polygon
                    points={`${xScale(profitPoints[0].price)},${zeroY} ${profitPoints.map(d => `${xScale(d.price)},${yScale(d.payoff)}`).join(' ')} ${xScale(profitPoints[profitPoints.length-1].price)},${zeroY}`}
                    fill="rgba(16, 185, 129, 0.3)"
                />
            )}

            {/* Loss fill */}
            {lossPoints.length > 1 && (
                <polygon
                    points={`${xScale(lossPoints[0].price)},${zeroY} ${lossPoints.map(d => `${xScale(d.price)},${yScale(d.payoff)}`).join(' ')} ${xScale(lossPoints[lossPoints.length-1].price)},${zeroY}`}
                    fill="rgba(239, 68, 68, 0.3)"
                />
            )}

            {/* Payoff line */}
            <polyline points={points} fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinejoin="round" />

            {/* Spot marker */}
            <line x1={xScale(spotPrice)} y1={padding.top} x2={xScale(spotPrice)} y2={height - padding.bottom} stroke="#3B82F6" strokeWidth="2" strokeDasharray="4" />
            <text x={xScale(spotPrice)} y={height - 5} textAnchor="middle" className="fill-blue-600 text-[10px] font-bold">Spot</text>

            {/* Breakeven markers */}
            {breakevens.map((be, i) => (
                <g key={i}>
                    <circle cx={xScale(be)} cy={zeroY} r="5" fill="#F59E0B" />
                    <text x={xScale(be)} y={zeroY - 10} textAnchor="middle" className="fill-amber-600 text-[9px] font-bold">BE</text>
                </g>
            ))}

            {/* Y axis labels */}
            <text x={padding.left - 5} y={padding.top + 5} textAnchor="end" className="fill-green-600 text-[10px] font-medium">+₹{(maxPayoff/1000).toFixed(0)}K</text>
            <text x={padding.left - 5} y={zeroY + 4} textAnchor="end" className="fill-gray-500 text-[10px]">0</text>
            <text x={padding.left - 5} y={height - padding.bottom} textAnchor="end" className="fill-red-600 text-[10px] font-medium">-₹{(Math.abs(minPayoff)/1000).toFixed(0)}K</text>
        </svg>
    );
};

export default StrategyBuilder;

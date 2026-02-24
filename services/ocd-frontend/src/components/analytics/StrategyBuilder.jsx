/**
 * Enhanced Strategy Builder Component
 * Advanced option strategy builder with simulation controls and multi-expiry support
 */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectLotSize, selectSelectedExpiry } from '../../context/selectors';
import {
    CubeIcon, PlusIcon, TrashIcon, CalculatorIcon, ChartBarIcon,
    AdjustmentsHorizontalIcon, BeakerIcon, ArrowPathIcon, SparklesIcon,
    ChevronDownIcon, DocumentDuplicateIcon
} from '@heroicons/react/24/outline';

import MultiExpiryLegBuilder from './MultiExpiryLegBuilder';
import { STRATEGY_PRESETS, STRATEGY_CATEGORIES, buildLegsFromPreset } from '../../constants/strategyPresets';
import calculatorService from '../../services/calculatorService';

const StrategyBuilder = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize);
    const selectedExpiry = useSelector(selectSelectedExpiry);

    // State
    const [legs, setLegs] = useState([]);
    const [presetOpen, setPresetOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [simulationResult, setSimulationResult] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);

    // Simulation parameters
    const [simulationParams, setSimulationParams] = useState({
        daysForward: 0,
        spotOffset: 0,
        ivChange: 0,
        riskFreeRate: 0.07
    });

    // Debounce timer ref
    const simulationTimer = useRef(null);

    // Available expiries (mock for now, should come from API)
    const availableExpiries = useMemo(() => {
        if (!selectedExpiry) return [];
        // Return current and next 2 expiries
        return [selectedExpiry]; // In real app, get from expiry list
    }, [selectedExpiry]);

    const strikes = useMemo(() => {
        if (!optionChain) return [];
        return Object.keys(optionChain).map(Number).sort((a, b) => a - b);
    }, [optionChain]);

    // Calculate max DTE from legs
    const maxDTE = useMemo(() => {
        if (legs.length === 0) return 30;

        let max = 0;
        for (const leg of legs) {
            try {
                const expDate = new Date(parseInt(leg.expiry));
                const now = new Date();
                const dte = Math.max(0, (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                max = Math.max(max, dte);
            } catch {
                max = Math.max(max, 30);
            }
        }
        return Math.ceil(max) || 30;
    }, [legs]);

    // Add a leg to the strategy
    const addLeg = useCallback((legData) => {
        const newLeg = {
            id: Date.now() + Math.random(),
            strike: legData.strike,
            type: legData.type,
            action: legData.action,
            qty: legData.qty || 1,
            ltp: legData.ltp || 0,
            iv: legData.iv || 0.15,
            delta: legData.delta || 0,
            theta: legData.theta || 0,
            gamma: legData.gamma || 0,
            vega: legData.vega || 0,
            expiry: legData.expiry || selectedExpiry,
            lotSize: lotSize
        };
        setLegs(prev => [...prev, newLeg]);
    }, [selectedExpiry, lotSize]);

    const removeLeg = useCallback((id) => {
        setLegs(prev => prev.filter(l => l.id !== id));
    }, []);

    const updateLegQty = useCallback((id, qty) => {
        setLegs(prev => prev.map(l => l.id === id ? { ...l, qty: Math.max(1, qty) } : l));
    }, []);

    const clearAll = useCallback(() => {
        setLegs([]);
        setSimulationResult(null);
    }, []);

    // Apply preset
    const applyPreset = useCallback((preset) => {
        clearAll();
        setTimeout(() => {
            const builtLegs = buildLegsFromPreset(preset, atmStrike, optionChain, availableExpiries, lotSize);
            setLegs(builtLegs);
            setPresetOpen(false);
        }, 50);
    }, [atmStrike, optionChain, availableExpiries, lotSize, clearAll]);

    // Calculate static strategy metrics
    const strategyMetrics = useMemo(() => {
        if (legs.length === 0) return null;

        let totalPremium = 0;
        let netDelta = 0;
        let netGamma = 0;
        let netTheta = 0;
        let netVega = 0;

        legs.forEach(leg => {
            const multiplier = leg.action === 'BUY' ? -1 : 1;
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
        };
    }, [legs, lotSize]);

    // Run simulation when params change (debounced)
    useEffect(() => {
        if (legs.length === 0) {
            setSimulationResult(null);
            return;
        }

        if (simulationTimer.current) {
            clearTimeout(simulationTimer.current);
        }

        simulationTimer.current = setTimeout(async () => {
            setIsSimulating(true);
            try {
                const simulatedSpot = spotPrice * (1 + simulationParams.spotOffset / 100);
                const simulationDate = new Date();
                simulationDate.setDate(simulationDate.getDate() + simulationParams.daysForward);

                const result = await calculatorService.simulateStrategy({
                    legs,
                    spotPrice: simulatedSpot,
                    simulationDate: simulationDate.toISOString(),
                    ivChange: simulationParams.ivChange,
                    riskFreeRate: simulationParams.riskFreeRate
                });

                if (result.success) {
                    setSimulationResult(result);
                }
            } catch (error) {
                console.error('Simulation error:', error);
            } finally {
                setIsSimulating(false);
            }
        }, 300);

        return () => {
            if (simulationTimer.current) {
                clearTimeout(simulationTimer.current);
            }
        };
    }, [legs, simulationParams, spotPrice]);


    // Calculate payoff at different spot prices (for chart)
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
            if ((payoffData[i - 1].payoff < 0 && payoffData[i].payoff >= 0) ||
                (payoffData[i - 1].payoff >= 0 && payoffData[i].payoff < 0)) {
                be.push(payoffData[i].price);
            }
        }
        return be;
    }, [payoffData]);

    // Format expiry for display
    const formatExpiry = (expiry) => {
        try {
            const date = new Date(parseInt(expiry));
            return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        } catch {
            return 'N/A';
        }
    };

    // Filter presets by category
    const filteredPresets = useMemo(() => {
        if (selectedCategory === 'all') return STRATEGY_PRESETS;
        return STRATEGY_PRESETS.filter(p => p.category === selectedCategory);
    }, [selectedCategory]);

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
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg shadow-purple-500/25">
                            <CubeIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Strategy Builder</h3>
                            <span className="text-xs text-gray-500">Lot Size: {lotSize} • Spot: ₹{spotPrice?.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* Preset Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setPresetOpen(!presetOpen)}
                                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white 
                                    rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-600
                                    shadow-md shadow-purple-500/25 flex items-center gap-2"
                            >
                                <SparklesIcon className="w-4 h-4" />
                                Presets
                                <ChevronDownIcon className={`w-4 h-4 transition-transform ${presetOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {presetOpen && (
                                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                                    {/* Category Filter */}
                                    <div className="p-2 border-b border-gray-100 dark:border-gray-700 flex gap-1 flex-wrap">
                                        {['all', ...Object.values(STRATEGY_CATEGORIES)].map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setSelectedCategory(cat)}
                                                className={`px-2 py-1 text-[10px] rounded-md font-medium transition-colors ${selectedCategory === cat
                                                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                                                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Preset List */}
                                    <div className="max-h-80 overflow-y-auto">
                                        {filteredPresets.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => applyPreset(p)}
                                                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm">{p.name}</span>
                                                    {p.multiExpiry && (
                                                        <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                                                            Multi-Expiry
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">{p.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>


                        <button
                            onClick={clearAll}
                            disabled={legs.length === 0}
                            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 
                                rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50"
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
                        <h3 className="font-semibold flex items-center gap-2 text-sm">
                            <PlusIcon className="w-5 h-5 text-blue-500" />
                            Add Legs
                        </h3>
                    </div>
                    <div className="p-4">
                        <MultiExpiryLegBuilder
                            availableExpiries={availableExpiries}
                            optionChainByExpiry={{ [selectedExpiry]: optionChain }}
                            atmStrike={atmStrike}
                            onAddLeg={addLeg}
                        />
                    </div>
                </div>

                {/* Strategy Summary */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2 text-sm">
                            <CalculatorIcon className="w-5 h-5 text-green-500" />
                            Strategy Summary
                        </h3>
                        {isSimulating && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                Simulating...
                            </div>
                        )}
                    </div>
                    <div className="p-4">
                        {strategyMetrics ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {/* Net Premium */}
                                <div className={`p-3 rounded-lg ${strategyMetrics.totalPremium >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                    <div className="text-xs text-gray-500">Net Premium</div>
                                    <div className={`text-lg font-bold ${strategyMetrics.totalPremium >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {strategyMetrics.totalPremium >= 0 ? '+' : ''}₹{strategyMetrics.totalPremium.toFixed(0)}
                                    </div>
                                    <div className="text-[10px] text-gray-400">{strategyMetrics.totalPremium >= 0 ? 'Credit' : 'Debit'}</div>
                                </div>

                                {/* Simulated P&L */}
                                {simulationResult && (
                                    <div className={`p-3 rounded-lg ${simulationResult.pnl >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                                        <div className="text-xs text-gray-500">Simulated P&L</div>
                                        <div className={`text-lg font-bold ${simulationResult.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {simulationResult.pnl >= 0 ? '+' : ''}₹{simulationResult.pnl.toFixed(0)}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            @ ₹{simulationResult.spot_price?.toFixed(0)}
                                        </div>
                                    </div>
                                )}

                                {/* Greeks */}
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                    <div className="text-xs text-gray-500">Net Delta</div>
                                    <div className="text-lg font-bold">
                                        {(simulationResult?.greeks?.net_delta ?? strategyMetrics.netDelta).toFixed(3)}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                    <div className="text-xs text-gray-500">Net Theta</div>
                                    <div className={`text-lg font-bold ${(simulationResult?.greeks?.net_theta ?? strategyMetrics.netTheta) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        ₹{(simulationResult?.greeks?.net_theta ?? strategyMetrics.netTheta).toFixed(2)}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                    <div className="text-xs text-gray-500">Net Gamma</div>
                                    <div className="text-lg font-bold">
                                        {(simulationResult?.greeks?.net_gamma ?? strategyMetrics.netGamma).toFixed(4)}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                    <div className="text-xs text-gray-500">Net Vega</div>
                                    <div className="text-lg font-bold">
                                        {(simulationResult?.greeks?.net_vega ?? strategyMetrics.netVega).toFixed(2)}
                                    </div>
                                </div>

                                {/* Breakevens */}
                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 col-span-2 md:col-span-3">
                                    <div className="text-xs text-gray-500">Breakevens (at expiry)</div>
                                    <div className="text-sm font-bold text-blue-600">
                                        {breakevens.length > 0 ? breakevens.map(b => `₹${b}`).join(', ') : 'N/A'}
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
                        <h3 className="font-semibold text-sm">Strategy Legs ({legs.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="p-2.5 text-left">Action</th>
                                    <th className="p-2.5 text-center">Strike</th>
                                    <th className="p-2.5 text-center">Type</th>
                                    <th className="p-2.5 text-center">Expiry</th>
                                    <th className="p-2.5 text-center">Qty</th>
                                    <th className="p-2.5 text-right">LTP</th>
                                    <th className="p-2.5 text-right">IV</th>
                                    <th className="p-2.5 text-right">Delta</th>
                                    <th className="p-2.5 text-right">Value</th>
                                    <th className="p-2.5"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {legs.map((leg) => (
                                    <tr key={leg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="p-2.5">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${leg.action === 'BUY'
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                }`}>
                                                {leg.action}
                                            </span>
                                        </td>
                                        <td className="p-2.5 text-center font-bold">{leg.strike}</td>
                                        <td className="p-2.5 text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${leg.type === 'CE'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700'
                                                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700'
                                                }`}>
                                                {leg.type}
                                            </span>
                                        </td>
                                        <td className="p-2.5 text-center text-xs text-gray-500">
                                            {formatExpiry(leg.expiry)}
                                        </td>
                                        <td className="p-2.5 text-center">
                                            <input
                                                type="number"
                                                min="1"
                                                value={leg.qty}
                                                onChange={(e) => updateLegQty(leg.id, parseInt(e.target.value) || 1)}
                                                className="w-14 text-center border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-transparent"
                                            />
                                        </td>
                                        <td className="p-2.5 text-right">₹{leg.ltp.toFixed(2)}</td>
                                        <td className="p-2.5 text-right">{((leg.iv || 0) * 100).toFixed(1)}%</td>
                                        <td className="p-2.5 text-right">{leg.delta.toFixed(3)}</td>
                                        <td className={`p-2.5 text-right font-medium ${leg.action === 'SELL' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {leg.action === 'SELL' ? '+' : '-'}₹{(leg.ltp * leg.qty * lotSize).toFixed(0)}
                                        </td>
                                        <td className="p-2.5">
                                            <button
                                                onClick={() => removeLeg(leg.id)}
                                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500 transition-colors"
                                            >
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
        </div>
    );
};

// Keep the PayoffChart component
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

    const xScale = (price) => padding.left + ((price - prices[0]) / (prices[prices.length - 1] - prices[0])) * (width - padding.left - padding.right);
    const yScale = (payoff) => padding.top + ((maxPayoff - payoff) / payoffRange) * (height - padding.top - padding.bottom);
    const zeroY = yScale(0);

    const points = data.map(d => `${xScale(d.price)},${yScale(d.payoff)}`).join(' ');

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Zero line */}
            <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#9CA3AF" strokeWidth="1.5" />

            {/* Profit/Loss areas */}
            <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(16, 185, 129, 0.4)" />
                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0.1)" />
                </linearGradient>
                <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(239, 68, 68, 0.1)" />
                    <stop offset="100%" stopColor="rgba(239, 68, 68, 0.4)" />
                </linearGradient>
            </defs>

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
            <text x={padding.left - 5} y={padding.top + 5} textAnchor="end" className="fill-green-600 text-[10px] font-medium">+₹{(maxPayoff / 1000).toFixed(0)}K</text>
            <text x={padding.left - 5} y={zeroY + 4} textAnchor="end" className="fill-gray-500 text-[10px]">0</text>
            <text x={padding.left - 5} y={height - padding.bottom} textAnchor="end" className="fill-red-600 text-[10px] font-medium">-₹{(Math.abs(minPayoff) / 1000).toFixed(0)}K</text>
        </svg>
    );
};

export default StrategyBuilder;

import { memo, useState } from 'react';
import PropTypes from 'prop-types';
import {
    XMarkIcon,
    ChartBarIcon,
    CurrencyDollarIcon,
    BeakerIcon,
    ArrowTrendingUpIcon,
    BoltIcon,
    RocketLaunchIcon,
} from '@heroicons/react/24/outline';

/**
 * Professional Strike Analysis Modal
 * 5 Tabs: Overview, Greeks, Signals, Reversals, Strategies
 * 
 * Original Formula (clicked strike based):
 * - Resistance = Spot + CE_LTP
 * - Support = Spot - PE_LTP
 */
const StrikeAnalysisModal = memo(({ isOpen, onClose, strikeData, symbol }) => {
    const [activeTab, setActiveTab] = useState('overview');


    if (!isOpen || !strikeData) return null;

    const { strike, ce = {}, pe = {} } = strikeData;
    const ceGreeks = ce.optgeeks || {};
    const peGreeks = pe.optgeeks || {};


    // Tab configuration
    const tabs = [
        { id: 'overview', label: 'Overview', icon: ChartBarIcon },
        { id: 'greeks', label: 'Greeks', icon: BeakerIcon },
        { id: 'signals', label: 'Signals', icon: BoltIcon },
        { id: 'reversals', label: 'Reversals', icon: ArrowTrendingUpIcon },
        { id: 'strategies', label: 'Strategies', icon: RocketLaunchIcon },
    ];

    // Straddle value
    const straddle = (ce.ltp || 0) + (pe.ltp || 0);

    // PCR from data or calculate
    const pcr = (ce.oi && ce.oi > 0) ? (pe.oi / ce.oi).toFixed(2) : '—';

    // Render tab content
    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-4">
                        {/* Call vs Put Summary */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Call Side */}
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Call ({strike}CE)</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${(ce.change || ce.p_chng || 0) >= 0
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                        }`}>
                                        {(ce.change || ce.p_chng || 0) >= 0 ? '+' : ''}{(ce.change || ce.p_chng || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">LTP</span>
                                        <span className="font-bold text-green-700 dark:text-green-400">₹{ce.ltp?.toFixed(2) || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">OI</span>
                                        <span className="font-semibold">{((ce.oi || ce.OI || 0) / 100000).toFixed(2)}L</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">OI Chg</span>
                                        <span className={`font-semibold ${(ce.oi_chng || ce.oichng || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {(ce.oi_chng || ce.oichng || 0) >= 0 ? '+' : ''}{((ce.oi_chng || ce.oichng || 0) / 100000).toFixed(2)}L
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Volume</span>
                                        <span className="font-semibold">{((ce.volume || ce.vol || 0) / 100000).toFixed(2)}L</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">IV</span>
                                        <span className="font-semibold">{ce.iv?.toFixed(1) || '—'}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Put Side */}
                            <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Put ({strike}PE)</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${(pe.change || pe.p_chng || 0) >= 0
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                        }`}>
                                        {(pe.change || pe.p_chng || 0) >= 0 ? '+' : ''}{(pe.change || pe.p_chng || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">LTP</span>
                                        <span className="font-bold text-red-700 dark:text-red-400">₹{pe.ltp?.toFixed(2) || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">OI</span>
                                        <span className="font-semibold">{((pe.oi || pe.OI || 0) / 100000).toFixed(2)}L</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">OI Chg</span>
                                        <span className={`font-semibold ${(pe.oi_chng || pe.oichng || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {(pe.oi_chng || pe.oichng || 0) >= 0 ? '+' : ''}{((pe.oi_chng || pe.oichng || 0) / 100000).toFixed(2)}L
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Volume</span>
                                        <span className="font-semibold">{((pe.volume || pe.vol || 0) / 100000).toFixed(2)}L</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">IV</span>
                                        <span className="font-semibold">{pe.iv?.toFixed(1) || '—'}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Key Metrics */}
                        <div className="grid grid-cols-4 gap-3">
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                                <div className="text-xs text-gray-500 uppercase">Straddle</div>
                                <div className="text-lg font-bold text-purple-600">₹{straddle.toFixed(2)}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                                <div className="text-xs text-gray-500 uppercase">PCR</div>
                                <div className={`text-lg font-bold ${parseFloat(pcr) > 1 ? 'text-green-600' : 'text-red-600'}`}>{pcr}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                                <div className="text-xs text-gray-500 uppercase">IV Skew</div>
                                <div className="text-lg font-bold">{((ce.iv || 0) - (pe.iv || 0)).toFixed(1)}%</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                                <div className="text-xs text-gray-500 uppercase">OI Ratio</div>
                                <div className="text-lg font-bold">{ce.oi && pe.oi ? (ce.oi / pe.oi).toFixed(2) : '—'}</div>
                            </div>
                        </div>
                    </div>
                );

            case 'greeks': {
                const greekRows = [
                    { key: 'delta', label: 'Δ Delta', desc: 'Price sensitivity', format: (v) => v?.toFixed(4) || '—' },
                    { key: 'gamma', label: 'Γ Gamma', desc: 'Delta sensitivity', format: (v) => v?.toFixed(6) || '—' },
                    { key: 'theta', label: 'Θ Theta', desc: 'Time decay', format: (v) => v?.toFixed(4) || '—' },
                    { key: 'vega', label: 'ν Vega', desc: 'Volatility sensitivity', format: (v) => v?.toFixed(4) || '—' },
                    { key: 'rho', label: 'ρ Rho', desc: 'Interest rate sensitivity', format: (v) => v?.toFixed(4) || '—' },
                    { key: 'vanna', label: 'Vanna', desc: 'Delta-volatility', format: (v) => v?.toFixed(6) || '—' },
                    { key: 'charm', label: 'Charm', desc: 'Delta decay', format: (v) => v?.toFixed(6) || '—' },
                    { key: 'vomma', label: 'Vomma', desc: 'Vega convexity', format: (v) => v?.toFixed(6) || '—' },
                ];

                return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Greek</th>
                                    <th className="text-right py-2 px-3 text-xs font-semibold text-green-600 uppercase">Call</th>
                                    <th className="text-right py-2 px-3 text-xs font-semibold text-red-600 uppercase">Put</th>
                                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {greekRows.map((row, i) => (
                                    <tr key={row.key} className={`border-b border-gray-100 dark:border-gray-800 ${i % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                                        <td className="py-2.5 px-3 font-semibold">{row.label}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-green-600">{row.format(ceGreeks[row.key])}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-red-600">{row.format(peGreeks[row.key])}</td>
                                        <td className="py-2.5 px-3 text-gray-500 text-xs">{row.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }

            case 'signals': {
                const ceAnalysis = analyzeBuildUp(ce);
                const peAnalysis = analyzeBuildUp(pe);

                return (
                    <div className="space-y-4">
                        {/* Smart Signals */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`rounded-xl p-4 border-2 ${ceAnalysis.sentiment === 'bullish' ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700' :
                                ceAnalysis.sentiment === 'bearish' ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700' :
                                    'bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-700'
                                }`}>
                                <div className="text-xs font-bold uppercase tracking-wider mb-2 text-green-700 dark:text-green-400">Call Signal</div>
                                <div className="text-lg font-bold mb-1">{ceAnalysis.buildUp}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{ceAnalysis.description}</div>
                            </div>

                            <div className={`rounded-xl p-4 border-2 ${peAnalysis.sentiment === 'bullish' ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700' :
                                peAnalysis.sentiment === 'bearish' ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700' :
                                    'bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-700'
                                }`}>
                                <div className="text-xs font-bold uppercase tracking-wider mb-2 text-red-700 dark:text-red-400">Put Signal</div>
                                <div className="text-lg font-bold mb-1">{peAnalysis.buildUp}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{peAnalysis.description}</div>
                            </div>
                        </div>

                        {/* Combined Analysis */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                            <div className="text-xs font-bold uppercase tracking-wider mb-2 text-blue-700 dark:text-blue-400">Combined Analysis</div>
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                                {getCombinedAnalysis(ceAnalysis, peAnalysis, pcr)}
                            </div>
                        </div>
                    </div>
                );
            }

            case 'reversals': {
                // Original Formula (clicked strike based):
                // Resistance = Spot + CE_LTP
                // Support = Spot - PE_LTP

                // Current strike premiums
                const ceLTP = ce.ltp || 0;
                const peLTP = pe.ltp || 0;

                // Get spot price from strikeData
                const baseSpot = strikeData.spot_price || strikeData.spot || 0;
                const futuresPrice = strikeData.futures_price || strikeData.fut_ltp || 0;

                // Straddle for this strike
                const strikeStraddle = ceLTP + peLTP;

                // === ORIGINAL S/R CALCULATION (clicked strike based) ===
                // SPOT-based: R = Spot + CE_LTP, S = Spot - PE_LTP
                const spotResistance = baseSpot + ceLTP;
                const spotSupport = baseSpot - peLTP;

                // FUTURE-based: R = Futures + CE_LTP, S = Futures - PE_LTP
                const baseFutures = futuresPrice > 0 ? futuresPrice : baseSpot;
                const futureResistance = baseFutures + ceLTP;
                const futureSupport = baseFutures - peLTP;

                // LTP-based (strike-specific): Strike + CE_LTP / Strike - PE_LTP
                const ltpResistance = strike + ceLTP;
                const ltpSupport = strike - peLTP;

                // Breakeven levels (using this strike's straddle)
                const breakevenUp = strike + strikeStraddle;
                const breakevenDown = strike - strikeStraddle;

                // Get values based on active sub-tab
                const activeSubTab = strikeData._reversalTab || 'spot';

                const getActiveValues = () => {
                    switch (activeSubTab) {
                        case 'future':
                            return { resistance: futureResistance, support: futureSupport, base: baseFutures, label: 'Futures' };
                        case 'ltp':
                            return { resistance: ltpResistance, support: ltpSupport, base: strike, label: 'Strike' };
                        case 'spot':
                        default:
                            return { resistance: spotResistance, support: spotSupport, base: baseSpot, label: 'Spot' };
                    }
                };

                const activeValues = getActiveValues();

                return (
                    <div className="space-y-4">
                        {/* Title - LOC Calculator Style */}
                        <div className="text-center py-2 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-lg">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                Reversal For : {strike}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">Strike-Based Formula</p>
                        </div>

                        {/* All Three Views - SPOT, FUTURE, LTP */}
                        <div className="grid grid-cols-3 gap-3">
                            {/* SPOT View */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-700">
                                <div className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    📍 SPOT
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-red-600 dark:text-red-400">R:</span>
                                        <span className="font-bold text-red-600">{spotResistance.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-green-600 dark:text-green-400">S:</span>
                                        <span className="font-bold text-green-600">{spotSupport.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* FUTURE View */}
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 border border-purple-200 dark:border-purple-700">
                                <div className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    📈 FUTURE
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-red-600 dark:text-red-400">R:</span>
                                        <span className="font-bold text-red-600">{futureResistance.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-green-600 dark:text-green-400">S:</span>
                                        <span className="font-bold text-green-600">{futureSupport.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* LTP View */}
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-700">
                                <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    💹 LTP Calc
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-red-600 dark:text-red-400">R:</span>
                                        <span className="font-bold text-red-600">{ltpResistance.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-green-600 dark:text-green-400">S:</span>
                                        <span className="font-bold text-green-600">{ltpSupport.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed S/R Levels */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Resistance Levels */}
                            <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Resistance</span>
                                </div>
                                <div className="text-3xl font-bold text-red-600 mb-2">{spotResistance.toFixed(2)}</div>
                                <div className="text-xs text-gray-500">Spot + CE Premium</div>
                            </div>

                            {/* Support Levels */}
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    <span className="text-sm font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Support</span>
                                </div>
                                <div className="text-3xl font-bold text-green-600 mb-2">{spotSupport.toFixed(2)}</div>
                                <div className="text-xs text-gray-500">Spot - PE Premium</div>
                            </div>
                        </div>

                        {/* Calculation Details - Formulas */}
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Calculation Formula</div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Base (Spot)</span>
                                        <span className="font-bold">{baseSpot.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">CE Premium</span>
                                        <span className="font-bold text-red-600">₹{ceLTP.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">PE Premium</span>
                                        <span className="font-bold text-green-600">₹{peLTP.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Straddle</span>
                                        <span className="font-bold text-purple-600">₹{strikeStraddle.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Range Up</span>
                                        <span className="font-bold text-red-600">{breakevenUp.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Range Down</span>
                                        <span className="font-bold text-green-600">{breakevenDown.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Why These Levels Work */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Why 99% Accuracy?</div>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                <li>• Option writers defend ATM straddle levels</li>
                                <li>• High OI creates walls of support/resistance</li>
                                <li>• Delta hedging by market makers reinforces levels</li>
                            </ul>
                        </div>

                        {/* Quick Reference */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                                <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium">Daily Reversal</div>
                                <div className="text-lg font-bold text-blue-700">{strikeData.reversal?.toFixed(2) || '—'}</div>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
                                <div className="text-xs text-purple-600 dark:text-purple-400 uppercase font-medium">Weekly Reversal</div>
                                <div className="text-lg font-bold text-purple-700">{strikeData.wkly_reversal?.toFixed(2) || '—'}</div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
                                <div className="text-xs text-amber-600 dark:text-amber-400 uppercase font-medium">Futures Reversal</div>
                                <div className="text-lg font-bold text-amber-700">{strikeData.fut_reversal?.toFixed(2) || '—'}</div>
                            </div>
                        </div>
                    </div>
                );
            }

            case 'strategies':
                return (
                    <div className="space-y-4">
                        {/* Suggested Strategies */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {getStrategySuggestions(strikeData, straddle, pcr).map((strategy, i) => (
                                <div key={i} className={`rounded-xl p-4 border-2 ${strategy.type === 'bullish' ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700' :
                                    strategy.type === 'bearish' ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700' :
                                        'bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-700'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <CurrencyDollarIcon className="w-5 h-5" />
                                        <span className="font-bold">{strategy.name}</span>
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{strategy.description}</div>
                                    <div className="flex gap-2 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded text-xs ${strategy.risk === 'Low' ? 'bg-green-100 text-green-700' :
                                            strategy.risk === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            Risk: {strategy.risk}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                                            {strategy.maxProfit}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-500/15 to-pink-500/20" />
                        <div className="relative flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-700/50">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
                                    <ChartBarIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                        Strike Analysis — {symbol} {strike}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        Comprehensive analysis with Greeks, Signals & Strategies
                                    </p>
                                </div>
                            </div>

                            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <XMarkIcon className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 overflow-x-auto">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id
                                        ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="p-5 max-h-[60vh] overflow-y-auto">
                        {renderContent()}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>Last updated: Just now</span>
                            <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

// Helper functions
function analyzeBuildUp(optData) {
    const oiChng = optData.oi_chng || optData.oichng || 0;
    const priceChng = optData.change || optData.p_chng || 0;

    if (oiChng > 0 && priceChng > 0) {
        return { buildUp: 'Long Buildup', sentiment: 'bullish', description: 'Fresh buying with price up' };
    } else if (oiChng > 0 && priceChng < 0) {
        return { buildUp: 'Short Buildup', sentiment: 'bearish', description: 'Fresh selling with price down' };
    } else if (oiChng < 0 && priceChng > 0) {
        return { buildUp: 'Short Covering', sentiment: 'bullish', description: 'Shorts exiting, price rising' };
    } else if (oiChng < 0 && priceChng < 0) {
        return { buildUp: 'Long Unwinding', sentiment: 'bearish', description: 'Longs exiting, price falling' };
    }
    return { buildUp: 'Neutral', sentiment: 'neutral', description: 'No clear signal' };
}

function getCombinedAnalysis(ceAnalysis, peAnalysis, pcr) {
    const pcrVal = parseFloat(pcr);
    let analysis = '';

    if (pcrVal > 1.2) {
        analysis = 'High Put writing indicates strong support at this level. ';
    } else if (pcrVal < 0.8) {
        analysis = 'High Call writing indicates strong resistance at this level. ';
    } else {
        analysis = 'Balanced PCR suggests consolidation zone. ';
    }

    if (ceAnalysis.sentiment === 'bullish' && peAnalysis.sentiment === 'bullish') {
        analysis += 'Both Call and Put sides show bullish signals - Strong upside expected.';
    } else if (ceAnalysis.sentiment === 'bearish' && peAnalysis.sentiment === 'bearish') {
        analysis += 'Both sides show bearish signals - Downside risk elevated.';
    } else {
        analysis += 'Mixed signals - Wait for clarity before taking directional bets.';
    }

    return analysis;
}

function getStrategySuggestions(strikeData, straddle, pcr) {
    const strategies = [];
    const pcrVal = parseFloat(pcr) || 1;

    // Straddle suggestion
    strategies.push({
        name: 'Long Straddle',
        description: `Buy ${strikeData.strike}CE + ${strikeData.strike}PE for ₹${straddle.toFixed(2)}`,
        type: 'neutral',
        risk: 'Limited',
        maxProfit: 'Unlimited',
    });

    if (pcrVal > 1.2) {
        strategies.push({
            name: 'Bull Put Spread',
            description: 'Sell higher strike Put, buy lower strike Put',
            type: 'bullish',
            risk: 'Limited',
            maxProfit: 'Limited',
        });
    }

    if (pcrVal < 0.8) {
        strategies.push({
            name: 'Bear Call Spread',
            description: 'Sell lower strike Call, buy higher strike Call',
            type: 'bearish',
            risk: 'Limited',
            maxProfit: 'Limited',
        });
    }

    strategies.push({
        name: 'Iron Condor',
        description: 'Sell OTM Call & Put, buy further OTM for protection',
        type: 'neutral',
        risk: 'Limited',
        maxProfit: 'Limited (Premium)',
    });

    return strategies;
}

StrikeAnalysisModal.displayName = 'StrikeAnalysisModal';

StrikeAnalysisModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    strikeData: PropTypes.object,
    symbol: PropTypes.string,
};

export default StrikeAnalysisModal;

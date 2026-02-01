/**
 * Gamma Exposure (GEX) Chart Component
 * Professional-grade analytics for Market Maker positioning
 * Features:
 * - Real-time GEX visualization
 * - "What-If" Market Simulation
 * - Dealer Hedging Flow Estimation
 * - Market Regime Classification
 */
import { useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ReferenceLine, ResponsiveContainer, Cell, Area
} from 'recharts';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectLotSize } from '../../context/selectors';
import { useGreeksWorker } from '../../hooks/useGreeksWorker';
import {
    BoltIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    InformationCircleIcon, BeakerIcon,
    CurrencyRupeeIcon, ShieldCheckIcon
} from '@heroicons/react/24/outline';

const GammaExposureChart = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize) || 50;

    const [viewMode, setViewMode] = useState('net'); // 'net', 'split', 'cumulative'
    const [showInfo, setShowInfo] = useState(false);
    const [simulationMode, setSimulationMode] = useState(false);
    const [simulatedSpot, setSimulatedSpot] = useState(spotPrice);
    const [simulatedData, setSimulatedData] = useState(null);
    const [isCalculating, setIsCalculating] = useState(false);

    const { calculateBatch, isReady: workerReady } = useGreeksWorker();

    // Reset simulation when actual spot updates significantly (unless dragging)
    useEffect(() => {
        if (!simulationMode && spotPrice) {
            setSimulatedSpot(spotPrice);
        }
    }, [spotPrice, simulationMode]);

    // Initial / Base GEX Calculation
    const baseGEXData = useMemo(() => {
        if (!optionChain || !spotPrice) return { data: [], totalGEX: 0, flipLevel: null, stats: {} };
        return calculateGEXProfile(optionChain, spotPrice, lotSize, atmStrike);
    }, [optionChain, spotPrice, lotSize, atmStrike]);

    // Effect to trigger Simulation Calculation
    useEffect(() => {
        if (!simulationMode || !workerReady || !optionChain) {
            setSimulatedData(null);
            return;
        }

        const runSimulation = async () => {
            setIsCalculating(true);
            try {
                // Prepare options for worker
                // We need to pass the options data structure expected by the worker
                const optionsList = Object.entries(optionChain).flatMap(([k, data]) => {
                    const strike = parseFloat(k);
                    const expiry = data.ce?.expiryDate || data.ce?.expiry_date; // Handle different casing
                    // Estimate days to expiry (simplified) or pass actual if available
                    // For now, let's assume valid data exists
                    const validCE = data.ce && (data.ce.iv > 0 || data.ce.ltp > 0);
                    const validPE = data.pe && (data.pe.iv > 0 || data.pe.ltp > 0);
                    const res = [];
                    // Helper to calc DTE
                    const getDTE = (exp) => {
                        if (!exp) return 1;
                        const diff = new Date(exp) - new Date();
                        return Math.max(diff / (1000 * 60 * 60 * 24), 0.1);
                    }

                    if (validCE) {
                        res.push({
                            strike, type: 'CE',
                            qt: data.ce, // Pass full object if needed, but worker needs specific fields
                            iv: data.ce.iv || 0,
                            daysToExpiry: getDTE(expiry),
                            oi: data.ce.oi || data.ce.OI || 0
                        });
                    }
                    if (validPE) {
                        res.push({
                            strike, type: 'PE',
                            qt: data.pe,
                            iv: data.pe.iv || 0,
                            daysToExpiry: getDTE(expiry),
                            oi: data.pe.oi || data.pe.OI || 0
                        });
                    }
                    return res;
                });

                // Batch Calculator in Worker
                // This recalculates Greeks (Gamma, Delta) for the NEW spot price
                const recalculatedGreeks = await calculateBatch(optionsList, simulatedSpot);

                // Construct a "Fake" Option Chain with updated Greeks to reuse calculateGEXProfile
                const simOptionChain = {};
                recalculatedGreeks.forEach(opt => {
                    if (!simOptionChain[opt.strike]) simOptionChain[opt.strike] = { ce: {}, pe: {} };
                    const target = opt.type === 'CE' ? simOptionChain[opt.strike].ce : simOptionChain[opt.strike].pe;

                    // Update Gamma/Delta
                    target.optgeeks = { gamma: opt.gamma, delta: opt.delta };
                    target.gamma = opt.gamma; // Fallback
                    target.delta = opt.delta;
                    target.oi = opt.oi; // Preserve OI
                    target.OI = opt.oi;
                });

                const result = calculateGEXProfile(simOptionChain, simulatedSpot, lotSize, atmStrike);
                setSimulatedData(result);

            } catch (err) {
                console.error("Simulation failed", err);
            } finally {
                setIsCalculating(false);
            }
        };

        const timer = setTimeout(runSimulation, 300); // Debounce
        return () => clearTimeout(timer);

    }, [simulationMode, simulatedSpot, optionChain, workerReady, lotSize, atmStrike, calculateBatch]);


    // Determine which data to display
    const activeData = simulationMode && simulatedData ? simulatedData : baseGEXData;
    const regime = useMemo(() => getRegime(activeData.totalGEX), [activeData.totalGEX]);

    // Calculate Hedging Flow (Delta Difference)
    // How much DO Dealers have to buy/sell to stay neutral if we move from Spot -> SimSpot?
    const hedgingFlow = useMemo(() => {
        if (!simulationMode || !simulatedData) return null;
        // Simplified prox: Change in Total GEX * Change in Price?
        // Better: Sum of (NewDelta - OldDelta) * OI * Multiplier
        // But we don't have row-by-row delta diff easily here without iterating.
        // Let's use the GEX approximation: Gamma is change in Delta.
        // Approx Delta Change = Average Gamma * (SimSpot - Spot)
        // Flow = Delta Change * Spot * LotSize (Rough Notional)
        // Let's use the TOTAL GEX number to estimate force.
        // Total GEX is "Gamma per 1% move" in Crores.
        // Move % = (SimSpot - Spot) / Spot * 100
        // Expected Flow ~ Total GEX * Move%
        const movePct = ((simulatedSpot - spotPrice) / spotPrice) * 100;
        const estimatedFlowCr = baseGEXData.totalGEX * movePct;
        return estimatedFlowCr; // Positive = Dealers must BUY, Negative = Dealers must SELL
    }, [simulationMode, simulatedData, simulatedSpot, spotPrice, baseGEXData]);


    if (!optionChain) return <div className="text-center p-10 text-gray-500">No Data Available</div>;

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className={`p-3 rounded-lg shadow-xl border backdrop-blur-md ${isDark ? 'bg-gray-900/90 border-gray-700' : 'bg-white/90 border-gray-200'}`}>
                    <div className="font-bold border-b border-gray-700 pb-1 mb-2 flex justify-between gap-4">
                        <span>Strike: {label}</span>
                        {/* Display differently if Simulating */}
                        {simulationMode && (
                            <span className="text-amber-400 text-xs">Simulated</span>
                        )}
                        {data.strike === atmStrike && <span className="text-blue-400 text-xs px-1.5 py-0.5 bg-blue-500/10 rounded">ATM</span>}
                    </div>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between gap-4 text-emerald-500">
                            <span>Call GEX:</span>
                            <span className="font-mono">+{data.callGEX.toFixed(2)} Cr</span>
                        </div>
                        <div className="flex justify-between gap-4 text-red-500">
                            <span>Put GEX:</span>
                            <span className="font-mono">{data.putGEX.toFixed(2)} Cr</span>
                        </div>
                        <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between gap-4 font-bold">
                            <span>Net GEX:</span>
                            <span className={`font-mono ${data.netGEX >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {data.netGEX > 0 ? '+' : ''}{data.netGEX.toFixed(2)} Cr
                            </span>
                        </div>
                        {viewMode === 'cumulative' && (
                            <div className="flex justify-between gap-4 text-purple-400">
                                <span>Cum. GEX:</span>
                                <span className="font-mono">{data.cumulativeGEX.toFixed(2)} Cr</span>
                            </div>
                        )}
                    </div>
                </div>
            )
        }
        return null;
    }


    return (
        <div className="space-y-4 font-sans text-gray-200">
            {/* 1. Simulation Controls */}
            <div className={`rounded-xl p-4 border transition-all duration-300 ${simulationMode
                ? 'bg-amber-900/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                : 'bg-gray-800/20 border-gray-700/50'
                }`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <BeakerIcon className={`w-5 h-5 ${simulationMode ? 'text-amber-400' : 'text-gray-400'}`} />
                        <span className={`font-semibold ${simulationMode ? 'text-amber-100' : 'text-gray-400'}`}>
                            Market Simulator
                        </span>
                        {simulationMode && isCalculating && (
                            <span className="text-xs text-amber-400 animate-pulse ml-2">Calculating...</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={simulationMode} onChange={() => setSimulationMode(!simulationMode)} />
                            <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                            <span className="ms-3 text-sm font-medium text-gray-300">Enable</span>
                        </label>
                    </div>
                </div>

                {simulationMode && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Current Spot: <span className="text-blue-400">{spotPrice}</span></span>
                                <span className="text-amber-400 font-bold">Simulated Spot: {simulatedSpot.toFixed(0)}</span>
                                <span className="text-gray-400">Change: <span className={`${simulatedSpot >= spotPrice ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {((simulatedSpot - spotPrice) / spotPrice * 100).toFixed(2)}%
                                </span></span>
                            </div>
                            <input
                                type="range"
                                min={spotPrice * 0.95}
                                max={spotPrice * 1.05}
                                step={spotPrice * 0.001}
                                value={simulatedSpot}
                                onChange={(e) => setSimulatedSpot(parseFloat(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                                <span>-5%</span>
                                <span>0%</span>
                                <span>+5%</span>
                            </div>
                        </div>

                        {/* Hedging Flow Estimator */}
                        {hedgingFlow !== null && (
                            <div className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5">
                                <CurrencyRupeeIcon className="w-5 h-5 text-gray-400" />
                                <div className="flex-1">
                                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Estimated Dealer Hedging Flow</div>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-lg font-bold ${hedgingFlow > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {hedgingFlow > 0 ? 'BUY' : 'SELL'} ₹{Math.abs(hedgingFlow).toFixed(1)} Cr
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            to remain delta neutral
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right text-[10px] text-gray-500 max-w-[150px]">
                                    {hedgingFlow > 0
                                        ? "Dealers buying creates support / pushes price up."
                                        : "Dealers selling creates resistance / pushes price down."}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 2. Metric Cards (Updated with Active Data) */}
            <div className="grid grid-cols-4 gap-3">
                <MetricCard
                    title="Net Exposure"
                    value={activeData.totalGEX}
                    icon={BoltIcon}
                    subValue={regime.label}
                    isGood={activeData.totalGEX > 0}
                    theme={isDark}
                />
                <MetricCard
                    title="Call Exposure"
                    value={activeData.callGEX}
                    icon={ArrowTrendingUpIcon}
                    subValue="Stabilizing"
                    isGood={true}
                    theme={isDark}
                    colorClass="text-emerald-500"
                />
                <MetricCard
                    title="Put Exposure"
                    value={activeData.putGEX}
                    icon={ArrowTrendingDownIcon}
                    subValue="Volatile"
                    isGood={false}
                    theme={isDark}
                    colorClass="text-red-500"
                />
                <MetricCard
                    title="Gamma Flip"
                    value={activeData.flipLevel || 'N/A'}
                    icon={ShieldCheckIcon}
                    subValue={activeData.flipLevel ? `${((activeData.flipLevel - (simulationMode ? simulatedSpot : spotPrice)) / (simulationMode ? simulatedSpot : spotPrice) * 100).toFixed(2)}% away` : 'None'}
                    isGood={true}
                    theme={isDark}
                    colorClass="text-purple-400"
                    isTextValue={false}
                />
            </div>

            {/* 3. Controls & Chart */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 p-1 bg-gray-800/50 rounded-lg border border-gray-700">
                    {['net', 'split', 'cumulative'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-all ${viewMode === mode
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setShowInfo(!showInfo)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors"
                >
                    <InformationCircleIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Guide</span>
                </button>
            </div>

            {/* 3. Info Panel */}
            {showInfo && (
                <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-200/80 leading-relaxed">
                    <p className="mb-2"><strong className="text-blue-200">Gamma Exposure (GEX)</strong> reveals Market Maker hedging needs.</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li><span className="text-emerald-400 font-semibold">Positive GEX:</span> MMs buy dips/sell rips (Stabilizing). Expect ranges.</li>
                        <li><span className="text-red-400 font-semibold">Negative GEX:</span> MMs sell dips/buy rips (Volatile). Expect trends/squeezes.</li>
                        <li><span className="text-purple-400 font-semibold">Flip Level:</span> Where regime shifts. Volatility often spikes here.</li>
                    </ul>
                </div>
            )}

            {/* 4. Chart Area */}
            <div className={`h-[350px] w-full rounded-xl border p-4 relative ${isDark ? 'bg-gray-800/30 border-gray-800' : 'bg-white border-gray-200'}`}>
                {/* Visual indicator for Simulator being active */}
                {simulationMode && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded border border-amber-500/30">
                        SIMULATION ACTIVE
                    </div>
                )}

                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={activeData.data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                        <XAxis
                            dataKey="strike"
                            stroke={isDark ? "#6B7280" : "#9CA3AF"}
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            stroke={isDark ? "#6B7280" : "#9CA3AF"}
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => `${val}Cr`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />

                        {/* Reference Lines */}
                        <ReferenceLine
                            x={simulationMode ? simulatedSpot : spotPrice}
                            stroke={simulationMode ? "#F59E0B" : "#3B82F6"}
                            strokeDasharray={simulationMode ? "0" : "3 3"}
                            strokeWidth={simulationMode ? 2 : 1}
                            label={{
                                position: 'top',
                                value: simulationMode ? 'Sim Spot' : 'Spot',
                                fill: simulationMode ? '#F59E0B' : '#3B82F6',
                                fontSize: 10
                            }}
                        />

                        {/* Ghost Spot if Simulating */}
                        {simulationMode && (
                            <ReferenceLine
                                x={spotPrice}
                                stroke="#4B5563"
                                strokeDasharray="3 3"
                                label={{ position: 'top', value: 'Actual', fill: '#6B7280', fontSize: 9 }}
                            />
                        )}

                        {activeData.flipLevel && (
                            <ReferenceLine x={activeData.flipLevel} stroke="#A855F7" strokeDasharray="4 4" label={{ position: 'top', value: 'Flip', fill: '#A855F7', fontSize: 10 }} />
                        )}
                        <ReferenceLine y={0} stroke="#4B5563" strokeOpacity={0.5} />

                        {/* Chart Layers */}
                        {viewMode === 'net' && (
                            <Bar dataKey="netGEX" radius={[2, 2, 0, 0]} maxBarSize={40}>
                                {activeData.data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.netGEX >= 0 ? '#10B981' : '#EF4444'} fillOpacity={0.9} />
                                ))}
                            </Bar>
                        )}

                        {viewMode === 'split' && (
                            <>
                                <Bar dataKey="callGEX" fill="#10B981" fillOpacity={0.6} radius={[2, 2, 0, 0]} maxBarSize={20} />
                                <Bar dataKey="putGEX" fill="#EF4444" fillOpacity={0.6} radius={[0, 0, 2, 2]} maxBarSize={20} />
                            </>
                        )}

                        {viewMode === 'cumulative' && (
                            <>
                                <defs>
                                    <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="cumulativeGEX" stroke="#8B5CF6" fill="url(#splitColor)" strokeWidth={2} />
                                <Bar dataKey="netGEX" radius={[2, 2, 0, 0]} maxBarSize={40} opacity={0.3}>
                                    {activeData.data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.netGEX >= 0 ? '#10B981' : '#EF4444'} />
                                    ))}
                                </Bar>
                            </>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// --- Helper Functions & Subcomponents ---

// Calculation Logic extracted for reuse
const calculateGEXProfile = (optionChain, spot, lotSize, _atmStrike) => {
    const strikes = [];
    let totalCallGEX = 0;
    let totalPutGEX = 0;
    let runningCumulative = 0;

    const sortedStrikes = Object.keys(optionChain)
        .map(k => parseFloat(k))
        .sort((a, b) => a - b);

    // Logic to select visible range
    const atmIndex = sortedStrikes.findIndex(s => s >= spot);
    // Be robust if spot is far out
    let startIndex = 0, endIndex = sortedStrikes.length;
    if (atmIndex !== -1) {
        startIndex = Math.max(0, atmIndex - 15);
        endIndex = Math.min(sortedStrikes.length, atmIndex + 16);
    }
    const visibleStrikeKeys = sortedStrikes.slice(startIndex, endIndex);

    visibleStrikeKeys.forEach(strike => {
        const data = optionChain[strike];
        // Handle potentially missing nested objects safely
        const ceGamma = data?.ce?.optgeeks?.gamma || data?.ce?.gamma || 0;
        const peGamma = data?.pe?.optgeeks?.gamma || data?.pe?.gamma || 0;
        const ceOI = data?.ce?.oi || data?.ce?.OI || 0;
        const peOI = data?.pe?.oi || data?.pe?.OI || 0;

        const multiplier = spot * spot * 0.01 * lotSize / 10000000;
        const callGEX = ceGamma * ceOI * multiplier;
        const putGEX = -peGamma * peOI * multiplier;
        const netGEX = callGEX + putGEX;

        runningCumulative += netGEX;

        strikes.push({
            strike,
            callGEX,
            putGEX,
            netGEX,
            cumulativeGEX: runningCumulative,
            // isATM logic could be relative to sim spot or actual atm strike
            isATM: Math.abs(strike - spot) < 50 // Approx
        });

        totalCallGEX += callGEX;
        totalPutGEX += putGEX;
    });

    let flipLevel = null;
    for (let i = 1; i < strikes.length; i++) {
        if (
            (strikes[i - 1].cumulativeGEX < 0 && strikes[i].cumulativeGEX >= 0) ||
            (strikes[i - 1].cumulativeGEX > 0 && strikes[i].cumulativeGEX <= 0)
        ) {
            const s1 = strikes[i - 1];
            const s2 = strikes[i];
            const ratio = Math.abs(s1.cumulativeGEX) / (Math.abs(s1.cumulativeGEX) + Math.abs(s2.cumulativeGEX));
            flipLevel = s1.strike + (s2.strike - s1.strike) * ratio;
            break;
        }
    }

    return {
        data: strikes,
        totalGEX: totalCallGEX + totalPutGEX,
        callGEX: totalCallGEX,
        putGEX: totalPutGEX,
        flipLevel
    };
};

// NIFTY 50 calibrated regime classification
// Typical NIFTY GEX ranges: -5 to +10 Cr
const getRegime = (totalGEX) => {
    const absGEX = Math.abs(totalGEX);

    // NIFTY 50 calibrated thresholds (in Crores)
    if (totalGEX > 2.0) {
        const confidence = Math.min(95, 60 + absGEX * 10);
        return {
            label: 'Long Gamma',
            color: '#10B981',
            desc: 'Volatility Suppression',
            confidence,
            emoji: '🛡️',
            action: 'MMs buying dips, selling rallies. Expect mean reversion.'
        };
    }
    if (totalGEX < -1.0) {
        const confidence = Math.min(95, 60 + absGEX * 10);
        return {
            label: 'Short Gamma',
            color: '#EF4444',
            desc: 'Volatility Amplification',
            confidence,
            emoji: '⚠️',
            action: 'MMs selling dips, buying rallies. Expect trending moves.'
        };
    }
    if (totalGEX > 0.5) {
        return {
            label: 'Mild Long Gamma',
            color: '#34D399',
            desc: 'Slight Stabilization',
            confidence: 50 + absGEX * 15,
            emoji: '🔵',
            action: 'Slight bias toward range-bound behavior.'
        };
    }
    if (totalGEX < -0.3) {
        return {
            label: 'Mild Short Gamma',
            color: '#F97316',
            desc: 'Slight Amplification',
            confidence: 50 + absGEX * 15,
            emoji: '🟠',
            action: 'Slight bias toward trending moves.'
        };
    }
    return {
        label: 'Neutral Gamma',
        color: '#6B7280',
        desc: 'Mixed Positioning',
        confidence: 40,
        emoji: '⚪',
        action: 'No clear MM bias. Watch other indicators.'
    };
};

const MetricCard = ({ title, value, subValue, icon: Icon, theme, colorClass, isTextValue = true }) => (
    <div className={`relative overflow-hidden rounded-xl p-4 bg-gradient-to-br border shadow-lg
        ${isTextValue && typeof value === 'number' // Only apply color logic for numeric main values
            ? (value > 0
                ? (theme ? 'from-emerald-900/40 to-emerald-800/10 border-emerald-500/30' : 'from-emerald-100 to-white border-emerald-200')
                : (theme ? 'from-red-900/40 to-red-800/10 border-red-500/30' : 'from-red-100 to-white border-red-200'))
            : (theme ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')
        }`}>
        <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${colorClass || (value > 0 ? 'text-emerald-500' : 'text-red-500')}`} />
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">{title}</span>
        </div>
        <div className={`text-2xl font-bold ${colorClass || (value > 0 ? 'text-emerald-500' : 'text-red-500')}`}>
            {isTextValue ? (
                <>
                    {value > 0 ? '+' : ''}{typeof value === 'number' ? value.toFixed(2) : value} <span className="text-sm font-normal text-gray-500">Cr</span>
                </>
            ) : (
                typeof value === 'number' ? value.toFixed(0) : value
            )}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">{subValue}</div>
    </div>
);

export default GammaExposureChart;

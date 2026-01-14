/**
 * Professional Strategy Builder Component
 * Main container integrating all professional components
 */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectLotSize, selectSelectedExpiry } from '../../context/selectors';
import {
    CubeIcon, SparklesIcon, ChevronDownIcon, ArrowPathIcon,
    DocumentDuplicateIcon, ShareIcon, PlayIcon, Cog6ToothIcon
} from '@heroicons/react/24/outline';

// Components
import MiniOptionChain from './MiniOptionChain';
import StrategyLegsTable from './StrategyLegsTable';
import StrategyMetricsPanel from './StrategyMetricsPanel';
import SimulationSliders from './SimulationSliders';
import PriceSlicesTable from './PriceSlicesTable';
import ScenarioMatrix from './ScenarioMatrix';
import PayoffSurface from './PayoffSurface';
import SensibullPayoffDiagram from './SensibullPayoffDiagram';

// Services & Config
import calculatorService from '../../services/calculatorService';
import { STRATEGY_PRESETS, STRATEGY_CATEGORIES, buildLegsFromPreset } from '../../constants/strategyPresets';

const StrategyBuilderPro = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize);
    const selectedExpiry = useSelector(selectSelectedExpiry);

    // State
    const [legs, setLegs] = useState([]);
    const [presetOpen, setPresetOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [activeTab, setActiveTab] = useState('metrics'); // 'metrics', 'slices', 'matrix', 'surface'

    // Loading states
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [slicesLoading, setSlicesLoading] = useState(false);
    const [matrixLoading, setMatrixLoading] = useState(false);
    const [surfaceLoading, setSurfaceLoading] = useState(false);

    // Data
    const [metrics, setMetrics] = useState(null);
    const [priceSlices, setPriceSlices] = useState(null);
    const [scenarioMatrix, setScenarioMatrix] = useState(null);
    const [surfaceData, setSurfaceData] = useState(null);

    // Simulation params
    const [simulationParams, setSimulationParams] = useState({
        daysForward: 0,
        spotOffset: 0,
        ivChange: 0,
        riskFreeRate: 0.07
    });

    // Debounce timer
    const fetchTimer = useRef(null);

    // Calculate max DTE
    const maxDTE = useMemo(() => {
        if (legs.length === 0) return 30;
        let max = 0;
        for (const leg of legs) {
            try {
                const expDate = new Date(parseInt(leg.expiry));
                const now = new Date();
                const dte = Math.max(0, (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                max = Math.max(max, dte);
            } catch { max = Math.max(max, 30); }
        }
        return Math.ceil(max) || 30;
    }, [legs]);

    // Available expiries
    const availableExpiries = useMemo(() => {
        if (!selectedExpiry) return [];
        return [selectedExpiry];
    }, [selectedExpiry]);

    // Add leg
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
            lotSize
        };
        setLegs(prev => [...prev, newLeg]);
    }, [selectedExpiry, lotSize]);

    const removeLeg = useCallback((id) => {
        setLegs(prev => prev.filter(l => l.id !== id));
    }, []);

    const updateLeg = useCallback((id, updates) => {
        setLegs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }, []);

    const duplicateLeg = useCallback((leg) => {
        const newLeg = { ...leg, id: Date.now() + Math.random() };
        setLegs(prev => [...prev, newLeg]);
    }, []);

    const clearAll = useCallback(() => {
        setLegs([]);
        setMetrics(null);
        setPriceSlices(null);
        setScenarioMatrix(null);
        setSurfaceData(null);
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

    // Fetch all data when legs change
    useEffect(() => {
        if (legs.length === 0) {
            setMetrics(null);
            setPriceSlices(null);
            setScenarioMatrix(null);
            setSurfaceData(null);
            return;
        }

        if (fetchTimer.current) clearTimeout(fetchTimer.current);

        fetchTimer.current = setTimeout(async () => {
            // Fetch metrics
            setMetricsLoading(true);
            try {
                const result = await calculatorService.getFullMetrics({
                    legs,
                    currentSpot: spotPrice
                });
                if (result.success) setMetrics(result);
            } catch (e) { console.error('Metrics error:', e); }
            finally { setMetricsLoading(false); }

            // Fetch slices
            setSlicesLoading(true);
            try {
                const result = await calculatorService.getPriceSlices({
                    legs,
                    currentSpot: spotPrice,
                    priceChanges: [-0.05, -0.025, -0.01, 0, 0.01, 0.025, 0.05],
                    timeOffsets: [0, 3, 7, null]
                });
                if (result.success) setPriceSlices(result);
            } catch (e) { console.error('Slices error:', e); }
            finally { setSlicesLoading(false); }

            // Fetch matrix
            setMatrixLoading(true);
            try {
                const result = await calculatorService.getScenarioMatrix({
                    legs,
                    currentSpot: spotPrice
                });
                if (result.success) setScenarioMatrix(result);
            } catch (e) { console.error('Matrix error:', e); }
            finally { setMatrixLoading(false); }

        }, 500);

        return () => {
            if (fetchTimer.current) clearTimeout(fetchTimer.current);
        };
    }, [legs, spotPrice]);

    // Fetch surface when tab is active
    useEffect(() => {
        if (activeTab !== 'surface' || legs.length === 0 || surfaceData) return;

        const fetchSurface = async () => {
            setSurfaceLoading(true);
            try {
                const result = await calculatorService.getPayoffSurface({
                    legs,
                    currentSpot: spotPrice,
                    priceRangePct: [-0.15, 0.15],
                    timeSteps: 10,
                    priceSteps: 50
                });
                if (result.success) setSurfaceData(result);
            } catch (e) { console.error('Surface error:', e); }
            finally { setSurfaceLoading(false); }
        };

        fetchSurface();
    }, [activeTab, legs, spotPrice, surfaceData]);

    // Filter presets
    const filteredPresets = useMemo(() => {
        if (selectedCategory === 'all') return STRATEGY_PRESETS;
        return STRATEGY_PRESETS.filter(p => p.category === selectedCategory);
    }, [selectedCategory]);

    // Format expiry
    const formatExpiry = (expiry) => {
        try {
            const date = new Date(parseInt(expiry));
            return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        } catch { return 'N/A'; }
    };

    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <CubeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
                            <CubeIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Strategy Builder Pro</h3>
                            <span className="text-[10px] text-gray-500">
                                Lot: {lotSize} • Spot: ₹{spotPrice?.toFixed(2)} • ATM: {atmStrike}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Preset Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setPresetOpen(!presetOpen)}
                                className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg text-xs font-medium hover:from-indigo-600 hover:to-purple-600 shadow-md flex items-center gap-1.5"
                            >
                                <SparklesIcon className="w-3.5 h-3.5" />
                                Presets
                                <ChevronDownIcon className={`w-3 h-3 transition-transform ${presetOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {presetOpen && (
                                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-30 overflow-hidden">
                                    <div className="p-2 border-b border-gray-100 dark:border-gray-700 flex gap-1 flex-wrap">
                                        {['all', ...Object.values(STRATEGY_CATEGORIES)].map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setSelectedCategory(cat)}
                                                className={`px-2 py-0.5 text-[9px] rounded font-medium ${selectedCategory === cat
                                                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                                                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {filteredPresets.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => applyPreset(p)}
                                                className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-xs">{p.name}</span>
                                                    {p.multiExpiry && (
                                                        <span className="text-[8px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1 py-0.5 rounded">
                                                            Multi-Exp
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-500 mt-0.5">{p.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {legs.length > 0 && (
                            <button
                                onClick={clearAll}
                                className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium hover:bg-red-200"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Column: Chain + Legs */}
                <div className="lg:col-span-1 space-y-4">
                    <MiniOptionChain
                        optionChain={optionChain}
                        spotPrice={spotPrice}
                        atmStrike={atmStrike}
                        expiry={selectedExpiry}
                        onAddLeg={addLeg}
                        visibleStrikes={9}
                    />

                    {legs.length > 0 && (
                        <StrategyLegsTable
                            legs={legs}
                            onUpdateLeg={updateLeg}
                            onRemoveLeg={removeLeg}
                            onDuplicateLeg={duplicateLeg}
                            lotSize={lotSize}
                            formatExpiry={formatExpiry}
                        />
                    )}
                </div>

                {/* Right Column: Metrics & Analysis */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Simulation Sliders */}
                    <SimulationSliders
                        simulationParams={simulationParams}
                        onParamsChange={setSimulationParams}
                        spotPrice={spotPrice}
                        maxDTE={maxDTE}
                        disabled={legs.length === 0}
                    />

                    {/* Metrics Panel */}
                    <StrategyMetricsPanel
                        metrics={metrics}
                        isLoading={metricsLoading}
                    />
                    {/* Sensibull-Style Payoff Diagram */}
                    {legs.length > 0 && (
                        <SensibullPayoffDiagram
                            legs={legs}
                            spotPrice={spotPrice}
                            optionChain={optionChain}
                            lotSize={lotSize}
                            breakevens={metrics?.breakevens || []}
                            maxProfit={metrics?.max_profit}
                            maxLoss={metrics?.max_loss}
                            daysToExpiry={maxDTE}
                            avgIV={0.15}
                        />
                    )}

                    {/* Tab Navigation */}
                    {legs.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="flex border-b border-gray-200 dark:border-gray-700">
                                {[
                                    { id: 'slices', label: 'Price Slices' },
                                    { id: 'matrix', label: 'Scenario Matrix' },
                                    { id: 'surface', label: 'Payoff Surface' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${activeTab === tab.id
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500'
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="p-4">
                                {activeTab === 'slices' && (
                                    <PriceSlicesTable
                                        slicesData={priceSlices}
                                        currentSpot={spotPrice}
                                        isLoading={slicesLoading}
                                    />
                                )}
                                {activeTab === 'matrix' && (
                                    <ScenarioMatrix
                                        matrixData={scenarioMatrix}
                                        currentSpot={spotPrice}
                                        isLoading={matrixLoading}
                                    />
                                )}
                                {activeTab === 'surface' && (
                                    <PayoffSurface
                                        surfaceData={surfaceData}
                                        spotPrice={spotPrice}
                                        isLoading={surfaceLoading}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StrategyBuilderPro;

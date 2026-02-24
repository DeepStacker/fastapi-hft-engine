/**
 * Strategy Finder Page - Pro Feature
 * 
 * Data-driven strategy recommendations with specific optimized legs:
 * - Uses live OI walls for strike selection
 * - Risk/Capital-aware position sizing
 * - Full metrics (POP, breakevens, Greeks)
 * - Real legs with LTP, IV, Greeks
 */
import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
    selectSpotPrice,
    selectATMIV,
    selectPCR,
    selectSelectedSymbol,
    selectSelectedExpiry,
    selectExpDates
} from '../context/selectors';
import PageLayout from '../components/layout/PageLayout';
import {
    LightBulbIcon,
    ChartBarIcon,
    ScaleIcon,
    CurrencyDollarIcon,
    BoltIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    InformationCircleIcon,
    SparklesIcon,
    AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { Card } from '../components/common';
import { optimizeStrategy, recommendStrategies, autoGenerateStrategy, STRATEGY_TYPES, RISK_PROFILES } from '../services/strategyOptimizer';
import { createPosition } from '../services/positionTracker';
import { showToast } from '../context/toastSlice';

// Imported Components
import RiskProfileSelector from '../components/features/strategies/RiskProfileSelector';
import CapitalInput from '../components/features/strategies/CapitalInput';
import StrategyTypeSelector from '../components/features/strategies/StrategyTypeSelector';
import StructureResult from '../components/features/strategies/StructureResult';

// ============ CONFIGURATION ============
const NIFTY_IV_CONTEXT = {
    historicalLow: 10,
    historicalHigh: 35
};

// ============ MAIN COMPONENT ============

const StrategySuggestions = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const symbol = useSelector(selectSelectedSymbol) || 'NIFTY';
    const expiry = useSelector(selectSelectedExpiry);
    const expiryDates = useSelector(selectExpDates);
    const spotPrice = useSelector(selectSpotPrice);
    const atmIV = useSelector(selectATMIV);
    const pcr = useSelector(selectPCR);

    // State
    const [riskProfile, setRiskProfile] = useState(RISK_PROFILES.MODERATE);
    const [maxCapital, setMaxCapital] = useState(100000);
    const [strategyType, setStrategyType] = useState(STRATEGY_TYPES.IRON_CONDOR);
    const [selectedExpiry, setSelectedExpiry] = useState(expiry || (expiryDates?.[0] || ''));
    const [recommendedStrategies, setRecommendedStrategies] = useState([]);
    const [structures, setStructures] = useState([]);
    const [loading, setLoading] = useState(false);
    const [autoGenerating, setAutoGenerating] = useState(false);
    const [error, setError] = useState(null);

    // Calculate IV Percentile
    const ivPercentile = atmIV
        ? Math.min(100, Math.max(0, ((atmIV - NIFTY_IV_CONTEXT.historicalLow) / (NIFTY_IV_CONTEXT.historicalHigh - NIFTY_IV_CONTEXT.historicalLow)) * 100))
        : 50;

    const ivRegime = ivPercentile > 60 ? 'High' : ivPercentile < 40 ? 'Low' : 'Normal';
    const sentiment = pcr > 1.2 ? 'Bullish' : pcr < 0.8 ? 'Bearish' : 'Neutral';

    // Fetch recommendations on load
    useEffect(() => {
        if (selectedExpiry) {
            fetchRecommendations();
        }
    }, [selectedExpiry, riskProfile]);

    // Update expiry when list changes
    useEffect(() => {
        if (expiryDates?.length && !selectedExpiry) {
            setSelectedExpiry(expiryDates[0]);
        }
    }, [expiryDates]);

    const fetchRecommendations = async () => {
        try {
            const response = await recommendStrategies({
                symbol,
                expiry: selectedExpiry,
                riskProfile,
                ivPercentile,
                pcr
            });
            if (response.success) {
                setRecommendedStrategies(response.recommended_strategies || []);
            }
        } catch (err) {
            console.error('Failed to fetch recommendations:', err);
        }
    };

    const handleAutoGenerate = useCallback(async () => {
        if (!selectedExpiry) {
            dispatch(showToast({ message: 'Please select an expiry date', type: 'error' }));
            return;
        }

        setLoading(true);
        setAutoGenerating(true);
        setError(null);
        setStructures([]);

        try {
            const response = await autoGenerateStrategy({
                symbol,
                riskProfile,
                maxCapital,
                expiry: selectedExpiry,
            });

            if (response.success) {
                // Backend returns a single strategy, wrap in array for display
                setStructures([response]);
                dispatch(showToast({ message: `Auto-detected optimal strategy: ${response.strategy_name}`, type: 'success' }));
            } else {
                const msg = response.message || 'Auto-generation failed';
                setError(msg);
                dispatch(showToast({ message: msg, type: 'warning' }));
            }
        } catch (err) {
            const message = err.response?.data?.detail || err.message || 'Auto-generation failed';
            setError(message);
            dispatch(showToast({ message, type: 'error' }));
        } finally {
            setLoading(false);
            setAutoGenerating(false);
        }
    }, [symbol, riskProfile, maxCapital, selectedExpiry]);

    const handleOptimize = useCallback(async () => {
        if (!selectedExpiry) {
            dispatch(showToast({ message: 'Please select an expiry date', type: 'error' }));
            return;
        }

        setLoading(true);
        setError(null);
        setStructures([]);

        try {
            const response = await optimizeStrategy({
                strategyType,
                symbol,
                expiry: selectedExpiry,
                riskProfile,
                maxCapital
            });

            if (response.success && response.structures?.length > 0) {
                setStructures(response.structures);
                dispatch(showToast({ message: `Found ${response.structures.length} optimized structure(s)`, type: 'success' }));
            } else {
                setError(response.message || 'No structures found for current conditions');
                dispatch(showToast({ message: response.message || 'No valid structures found', type: 'warning' }));
            }
        } catch (err) {
            const message = err.response?.data?.detail || err.message || 'Optimization failed';
            setError(message);
            dispatch(showToast({ message, type: 'error' }));
        } finally {
            setLoading(false);
        }
    }, [strategyType, symbol, selectedExpiry, riskProfile, maxCapital]);

    const handleTrackPosition = useCallback(async (structure) => {
        try {
            // Convert structure legs to position format
            const positionLegs = structure.legs.map(leg => ({
                strike: leg.strike,
                option_type: leg.option_type,
                action: leg.action,
                qty: leg.qty,
                lot_size: leg.lot_size,
                entry_price: leg.ltp,
                iv: leg.iv
            }));

            await createPosition({
                strategy_type: structure.strategy_type,
                symbol,
                expiry: String(selectedExpiry),
                legs: positionLegs,
                entry_spot: spotPrice,
                entry_atm_iv: atmIV,
                entry_pcr: pcr,
                entry_metrics: structure.metrics,
                market_context: structure.market_context,
                notes: `Auto-tracked from Strategy Finder: ${structure.rationale}`
            });

            dispatch(showToast({ message: 'Position tracked! Redirecting...', type: 'success' }));
            setTimeout(() => navigate('/positions'), 1000);
        } catch (err) {
            const message = err.response?.data?.detail || err.message || 'Failed to track position';
            dispatch(showToast({ message, type: 'error' }));
        }
    }, [symbol, selectedExpiry, spotPrice, atmIV, pcr]);

    if (!atmIV) {
        return (
            <PageLayout title="Strategy Finder" subtitle="AI-Driven Options Strategy Recommendations">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <LightBulbIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Loading market data...</p>
                        <p className="text-sm text-gray-400 mt-2">Please load an option chain first</p>
                    </div>
                </div>
            </PageLayout>
        );
    }

    return (
        <PageLayout title="Strategy Finder" subtitle="Data-Driven Leg Optimization">
            <Helmet><title>Strategy Finder | Stockify</title></Helmet>

            <div className="space-y-6">
                {/* Market Context Banner */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card variant="glass" className="relative overflow-hidden">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
                                <ChartBarIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">IV Percentile</p>
                                <h3 className={`text-2xl font-bold ${ivPercentile > 60 ? 'text-red-600' : ivPercentile < 40 ? 'text-green-600' : 'text-blue-600'}`}>
                                    {ivPercentile.toFixed(0)}%
                                    <span className="text-sm font-medium ml-2 text-gray-500">({ivRegime})</span>
                                </h3>
                            </div>
                        </div>
                    </Card>

                    <Card variant="glass">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600">
                                <ScaleIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">PCR</p>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{pcr?.toFixed(2) || '-'}</h3>
                                <p className={`text-xs font-bold ${sentiment === 'Bullish' ? 'text-green-600' : sentiment === 'Bearish' ? 'text-red-600' : 'text-gray-500'}`}>
                                    {sentiment} Sentiment
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card variant="glass">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600">
                                <CurrencyDollarIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Symbol</p>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{symbol}</h3>
                                <p className="text-xs text-gray-500">₹{spotPrice?.toFixed(2)}</p>
                            </div>
                        </div>
                    </Card>

                    <Card variant="glass">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl text-green-600">
                                <CheckCircleIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">ATM IV</p>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{atmIV?.toFixed(1)}%</h3>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Configuration Panel */}
                <Card className="p-6">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <AdjustmentsHorizontalIcon className="w-6 h-6 text-indigo-500" />
                        Configure Optimization
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    Risk Profile
                                </label>
                                <RiskProfileSelector value={riskProfile} onChange={setRiskProfile} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    Maximum Capital (₹)
                                </label>
                                <CapitalInput value={maxCapital} onChange={setMaxCapital} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    Expiry
                                </label>
                                <select
                                    value={selectedExpiry}
                                    onChange={(e) => setSelectedExpiry(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 
                                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                             focus:ring-2 focus:ring-indigo-500"
                                >
                                    {expiryDates?.map(exp => {
                                        // Format timestamp to readable date
                                        const formattedDate = typeof exp === 'number'
                                            ? new Date(exp < 1e12 ? exp * 1000 : exp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : exp;
                                        return (
                                            <option key={exp} value={exp}>{formattedDate}</option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Strategy Type
                            </label>
                            <StrategyTypeSelector
                                value={strategyType}
                                onChange={setStrategyType}
                                recommended={recommendedStrategies}
                            />
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex gap-4">
                        <button
                            onClick={handleOptimize}
                            disabled={loading || !selectedExpiry}
                            className="flex-1 py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white 
                                     rounded-xl font-bold text-lg shadow-lg hover:shadow-xl 
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     transition-all duration-200 flex items-center justify-center gap-3"
                        >
                            {loading && !autoGenerating ? (
                                <>
                                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                                    Optimizing...
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="w-6 h-6" />
                                    Find Optimal Legs
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleAutoGenerate}
                            disabled={loading || !selectedExpiry}
                            className="w-auto py-4 px-6 bg-amber-500 hover:bg-amber-600 text-white 
                                     rounded-xl font-bold text-lg shadow-lg hover:shadow-xl 
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     transition-all duration-200 flex items-center justify-center gap-2"
                            title="AI Auto-Detect Strategy"
                        >
                            {autoGenerating ? (
                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                <BoltIcon className="w-6 h-6" />
                            )}
                            <span className="hidden md:inline">Auto-Generate</span>
                        </button>
                    </div>
                </Card>

                {/* Error Message */}
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-red-700 dark:text-red-300">Optimization Failed</p>
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    </div>
                )}

                {/* Results */}
                {structures.length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <LightBulbIcon className="w-6 h-6 text-yellow-500" />
                            Optimized Structures
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                {structures.length} found
                            </span>
                        </h2>

                        <div className="space-y-6">
                            {structures.map((structure, idx) => (
                                <StructureResult
                                    key={idx}
                                    structure={structure}
                                    onTrack={handleTrackPosition}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Help Text */}
                {structures.length === 0 && !loading && !error && (
                    <div className="p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <InformationCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">Configure your preferences and click &quot;Find Optimal Legs&quot;</p>
                        <p className="text-sm text-gray-400 mt-2">
                            The optimizer will analyze OI walls, IV skew, and Greeks to suggest specific strikes.
                        </p>
                    </div>
                )}
            </div>
        </PageLayout>
    );
};

export default StrategySuggestions;

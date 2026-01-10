
import { useState, useEffect, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CurrencyRupeeIcon,
    ClockIcon,
    ArrowPathIcon,
    ChartBarIcon,
    ArrowRightIcon
} from '@heroicons/react/24/outline';
import { selectIsAuthenticated } from '../context/selectors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import optionsService from '../services/optionsService';
import { SYMBOLS } from '../constants';

/**
 * Futures Info Card
 */
const FutureInfoCard = memo(({ title, value, subValue, trend, icon: Icon, color }) => {
    const isPositive = trend === 'up';
    const trendColor = isPositive ? 'text-green-500' : 'text-red-500';
    const trendIcon = isPositive ? <ArrowTrendingUpIcon className="w-4 h-4" /> : <ArrowTrendingDownIcon className="w-4 h-4" />;

    return (
        <Card variant="glass" className="p-4">
            <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg ${color} bg-opacity-10 dark:bg-opacity-20`}>
                    <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {trendIcon}
                        <span>{subValue}</span>
                    </div>
                )}
            </div>
            <div className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">{title}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        </Card>
    );
});
FutureInfoCard.displayName = 'FutureInfoCard';

/**
 * Futures Dashboard Page
 */
const FuturesDashboard = () => {
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const navigate = useNavigate();
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const [selectedSymbol, setSelectedSymbol] = useState('NIFTY');
    const [selectedExpiry, setSelectedExpiry] = useState(null);
    const [expiryDates, setExpiryDates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [futuresData, setFuturesData] = useState(null);
    const [error, setError] = useState(null);


    // Initial load - fetch futures data directly (no expiry needed for summary)
    useEffect(() => {
        if (isAuthenticated) {
            fetchFuturesData();
        }
    }, [isAuthenticated, selectedSymbol]);

    // Optional: Load expiry dates for display purposes
    useEffect(() => {
        if (isAuthenticated && selectedSymbol) {
            loadExpiryDates(selectedSymbol);
        }
    }, [isAuthenticated, selectedSymbol]);

    const loadExpiryDates = async (symbol) => {
        try {
            const data = await optionsService.getExpiryDates(symbol);
            if (data.success && data.data.length > 0) {
                setExpiryDates(data.data);
                setSelectedExpiry(data.data[0]); // Default to nearest
            }
        } catch (err) {
            console.error("Failed to load expiries", err);
        }
    };

    const fetchFuturesData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch futures summary and live data in parallel
            const [futuresResponse, liveResponse] = await Promise.all([
                optionsService.getFuturesSummary(selectedSymbol),
                optionsService.getLiveData(selectedSymbol).catch(() => null) // Graceful fallback
            ]);

            if (futuresResponse.success && futuresResponse.contracts && futuresResponse.contracts.length > 0) {
                const contract = futuresResponse.contracts[0]; // Primary contract

                // Get spot price from live data
                const spotPrice = liveResponse?.sltp || liveResponse?.spot?.ltp || 0;
                const futuresLtp = contract.ltp || 0;

                // Calculate real basis (premium/discount)
                const basis = spotPrice > 0 ? (futuresLtp - spotPrice) : 0;

                // Calculate annualized rollover cost
                // Formula: (Basis / Spot) * (365 / DaysToExpiry) * 100
                const daysToExpiry = contract.days_to_expiry || 30; // Default 30 if not provided
                const rolloverCostAnnualized = spotPrice > 0 && daysToExpiry > 0
                    ? ((basis / spotPrice) * (365 / daysToExpiry) * 100)
                    : 0;

                // Map response to expected data structure
                setFuturesData({
                    price: futuresLtp,
                    change: contract.change || 0,
                    change_percent: contract.change_percent || 0,
                    oi: contract.oi || 0,
                    oi_change: contract.oi_change || 0,
                    oi_change_percent: contract.oi ? (contract.oi_change / contract.oi * 100) : 0,
                    volume: contract.volume || 0,
                    spot_price: spotPrice,
                    basis: basis,
                    rollover_cost: rolloverCostAnnualized,
                    buildup: contract.oi_change > 0 ? (contract.change > 0 ? 'LB' : 'SB') : (contract.change > 0 ? 'SC' : 'LU'),
                    buildup_desc: contract.oi_change > 0 ? (contract.change > 0 ? 'Long Buildup' : 'Short Buildup') : (contract.change > 0 ? 'Short Covering' : 'Long Unwinding'),
                    vwap: futuresLtp, // Approximate
                    expiry: contract.expiry,
                    symbol_name: contract.symbol,
                    days_to_expiry: daysToExpiry,
                });
            } else {
                setError("No futures contract data available");
            }
        } catch (err) {
            console.error("Error fetching futures data:", err);
            setError("Unable to connect to futures feed");
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Authentication Required</h2>
                <p className="text-gray-600 dark:text-gray-400">Please log in to view Futures Dashboard.</p>
                <Button onClick={() => navigate('/login')}>Login Now</Button>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Futures Dashboard | DeepStrike</title>
                <meta name="description" content="Advanced futures rolling analysis and basis charts" />
            </Helmet>

            <div className="w-full px-4 py-4 space-y-6">
                {/* Header & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            <ChartBarIcon className="w-8 h-8 text-purple-500" />
                            Futures Dashboard
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Basis, Rollover & Open Interest Analysis
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        {/* Symbol Selector */}
                        <select
                            value={selectedSymbol}
                            onChange={(e) => setSelectedSymbol(e.target.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold bg-transparent border-none focus:ring-0 ${isDark ? 'text-white' : 'text-gray-900'}`}
                        >
                            {SYMBOLS.map(sym => (
                                <option key={sym.value} value={sym.value}>{sym.label}</option>
                            ))}
                        </select>
                        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

                        {/* Expiry Selector */}
                        <select
                            value={selectedExpiry || ''}
                            onChange={(e) => setSelectedExpiry(e.target.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm bg-transparent border-none focus:ring-0 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                        >
                            {expiryDates.map(date => (
                                <option key={date} value={date}>
                                    {new Date(parseInt(date) * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={fetchFuturesData}
                            className={`p-2 rounded-lg transition-colors ${loading ? 'animate-spin' : ''} ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                        >
                            <ArrowPathIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {error ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center text-red-600 dark:text-red-400">
                        <p>{error}</p>
                        <Button className="mt-4" onClick={fetchFuturesData} variant="outline" size="sm">Retry</Button>
                    </div>
                ) : !futuresData ? (
                    <div className="flex justify-center py-20">
                        <ArrowPathIcon className="w-10 h-10 text-gray-300 animate-spin" />
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <FutureInfoCard
                                title="Futures Price"
                                value={`₹${futuresData.price?.toFixed(2)}`}
                                subValue={`${futuresData.change_percent?.toFixed(2)}%`}
                                trend={futuresData.change > 0 ? 'up' : 'down'}
                                icon={CurrencyRupeeIcon}
                                color="bg-blue-500"
                            />
                            <FutureInfoCard
                                title="Basis (Premium)"
                                value={`₹${futuresData.basis?.toFixed(2)}`}
                                subValue={futuresData.basis > 0 ? 'Premium' : 'Discount'}
                                trend="neutral"
                                icon={ChartBarIcon}
                                color="bg-purple-500"
                            />
                            <FutureInfoCard
                                title="Open Interest"
                                value={(futuresData.oi / 100000).toFixed(2) + ' L'}
                                subValue={`${futuresData.oi_change_percent?.toFixed(1)}%`}
                                trend={futuresData.oi_change > 0 ? 'up' : 'down'}
                                icon={ArrowRightIcon} // Changed to ArrowRight since UserGroup not imported
                                color="bg-orange-500"
                            />
                            <FutureInfoCard
                                title="Rollover Cost"
                                value={`${futuresData.rollover_cost?.toFixed(2)}%`}
                                subValue="Annualized"
                                trend="neutral"
                                icon={ClockIcon}
                                color="bg-emerald-500"
                            />
                        </div>

                        {/* Charts Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Basis Chart */}
                            <div className="lg:col-span-2">
                                <Card variant="glass" className="p-6 h-[400px]">
                                    <h3 className="text-lg font-bold mb-4 dark:text-white">Futures Basis Analysis</h3>

                                    {/* Basis Visualization */}
                                    <div className="flex flex-col h-[calc(100%-40px)] justify-between">
                                        {/* Premium/Discount Indicator */}
                                        <div className="text-center mb-4">
                                            <div className={`text-3xl font-bold ${futuresData.basis >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {futuresData.basis >= 0 ? '+' : ''}{futuresData.basis?.toFixed(2)} pts
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {futuresData.basis >= 0 ? 'Premium' : 'Discount'} to Spot
                                            </div>
                                        </div>

                                        {/* Visual Bars */}
                                        <div className="flex-1 flex items-center justify-center gap-8 px-8">
                                            {/* Spot Price Bar */}
                                            <div className="flex flex-col items-center">
                                                <div className="text-xs text-gray-400 mb-2">SPOT</div>
                                                <div className="w-16 bg-blue-500 rounded-lg flex items-center justify-center py-3"
                                                    style={{ height: `${Math.min(180, Math.max(80, (futuresData.spot_price || 0) / 150))}px` }}>
                                                    <span className="text-white font-bold text-sm transform -rotate-90 whitespace-nowrap">
                                                        ₹{(futuresData.spot_price || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Futures Price Bar */}
                                            <div className="flex flex-col items-center">
                                                <div className="text-xs text-gray-400 mb-2">FUTURES</div>
                                                <div className={`w-16 rounded-lg flex items-center justify-center py-3 ${futuresData.basis >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                                    style={{ height: `${Math.min(200, Math.max(80, (futuresData.price || 0) / 150))}px` }}>
                                                    <span className="text-white font-bold text-sm transform -rotate-90 whitespace-nowrap">
                                                        ₹{(futuresData.price || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Basis Bar (Difference) */}
                                            <div className="flex flex-col items-center">
                                                <div className="text-xs text-gray-400 mb-2">BASIS</div>
                                                <div className={`w-12 rounded-lg flex items-center justify-center ${futuresData.basis >= 0 ? 'bg-green-500/50' : 'bg-red-500/50'}`}
                                                    style={{ height: `${Math.max(40, Math.abs(futuresData.basis || 0) / 2)}px` }}>
                                                    <span className="text-white font-bold text-xs">
                                                        {Math.abs(futuresData.basis || 0).toFixed(0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Info */}
                                        <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                                            <div>
                                                <div className="text-xs text-gray-400">Days to Expiry</div>
                                                <div className="font-bold dark:text-white">{futuresData.days_to_expiry || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400">Annualized Cost</div>
                                                <div className={`font-bold ${futuresData.rollover_cost >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {futuresData.rollover_cost?.toFixed(2)}%
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400">Sentiment</div>
                                                <div className={`font-bold ${futuresData.basis >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {futuresData.basis >= 0 ? 'BULLISH' : 'BEARISH'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Market Depth / Snapshots */}
                            <div className="lg:col-span-1 space-y-4">
                                <Card variant="glass" className="p-4">
                                    <h3 className="text-sm font-bold mb-3 dark:text-white uppercase tracking-wider text-gray-500">Long/Short Buildup</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Buildup Type</span>
                                            <span className={`font-bold px-2 py-0.5 rounded ${futuresData.buildup === 'LB' ? 'bg-green-100 text-green-700' :
                                                futuresData.buildup === 'SB' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {futuresData.buildup_desc || futuresData.buildup}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Volume</span>
                                            <span className="dark:text-white font-medium">{futuresData.volume?.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">VWAP</span>
                                            <span className="dark:text-white font-medium">₹{futuresData.vwap?.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </Card>

                                <Card variant="glass" className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800">
                                    <h3 className="text-sm font-bold mb-2 text-blue-800 dark:text-blue-300">Smart Insight</h3>
                                    <p className="text-sm text-blue-600 dark:text-blue-400">
                                        Current basis suggests a {futuresData.basis > 0 ? 'bullish' : 'bearish'} sentiment.
                                        High rollover cost indicates aggressive positioning.
                                    </p>
                                </Card>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </>
    );
};

export default FuturesDashboard;

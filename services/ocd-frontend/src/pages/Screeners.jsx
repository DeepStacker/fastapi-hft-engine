/**
 * Multi-Symbol Screeners Page
 * Scans ALL symbols (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY) for trading signals
 * Professional-grade screener with filters and symbol tabs
 */
import { useState, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    BoltIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    ArrowPathIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    FunnelIcon,
    SparklesIcon,
    BellIcon,
    BellAlertIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import { toast } from "react-toastify";
import { selectIsAuthenticated } from '../context/selectors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import useMultiSymbolScreener from '../hooks/useMultiSymbolScreener';

/**
 * Signal Card Component - Individual screener signal
 */
const SignalCard = memo(({ signal }) => {
    const navigate = useNavigate();
    const isBuy = signal.signal === 'BUY';
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    // Symbol colors
    const symbolColors = {
        NIFTY: 'from-blue-600 to-cyan-500',
        BANKNIFTY: 'from-purple-600 to-fuchsia-500',
        FINNIFTY: 'from-green-600 to-emerald-500',
        MIDCPNIFTY: 'from-amber-600 to-orange-500',
    };

    const handleSetAlert = (e) => {
        e.stopPropagation();
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1000)),
            {
                pending: 'Setting alert...',
                success: `Alert set for ${signal.symbol} ${signal.strike} ${signal.option_type}`,
                error: 'Failed to set alert'
            }
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => navigate(`/option-chain?symbol=${signal.symbol}`)}
            className="cursor-pointer"
        >
            <Card variant="glass" className="p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {/* Symbol Badge */}
                        <span className={`px-2 py-1 rounded text-xs font-bold text-white bg-gradient-to-r ${symbolColors[signal.symbol] || 'from-gray-600 to-slate-600'}`}>
                            {signal.symbol}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${signal.option_type === 'CE'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                            {signal.option_type}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {signal.strike}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSetAlert}
                            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Set Alert"
                        >
                            <BellIcon className="w-4 h-4 text-gray-400 hover:text-blue-500" />
                        </button>
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${isBuy
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                            }`}>
                            {signal.signal}
                        </div>
                    </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {signal.reason}
                </p>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2">
                        <div className="text-gray-500">Entry</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                            ₹{signal.entry_price?.toFixed(2) || '--'}
                        </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                        <div className="text-green-600">Target</div>
                        <div className="font-semibold text-green-700 dark:text-green-400">
                            ₹{signal.target_price?.toFixed(2) || '--'}
                        </div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                        <div className="text-red-600">SL</div>
                        <div className="font-semibold text-red-700 dark:text-red-400">
                            ₹{signal.stop_loss?.toFixed(2) || '--'}
                        </div>
                    </div>
                </div>

                {/* Strength Indicator */}
                <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Signal Strength</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                            {(signal.strength || 0).toFixed(0)}%
                        </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all ${(signal.strength || 0) > 70 ? 'bg-green-500' :
                                (signal.strength || 0) > 40 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                            style={{ width: `${signal.strength || 0}%` }}
                        />
                    </div>
                </div>
            </Card>
        </motion.div>
    );
});

SignalCard.displayName = 'SignalCard';

/**
 * Screener Tab Configuration
 */
const SCREENER_TABS = [
    {
        id: 'scalp',
        label: 'Scalp',
        icon: BoltIcon,
        description: 'Short-term (5-15 min)',
        color: 'text-blue-500',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    {
        id: 'positional',
        label: 'Positional',
        icon: ChartBarIcon,
        description: 'Multi-day positions',
        color: 'text-purple-500',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30'
    },
    {
        id: 'sr',
        label: 'S/R OC',
        icon: ShieldCheckIcon,
        description: 'Support/Resistance',
        color: 'text-orange-500',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30'
    },
];

/**
 * Symbol Filter Chips
 */
const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

/**
 * Multi-Symbol Screeners Page
 */
const Screeners = () => {
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const navigate = useNavigate();
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const [activeTab, setActiveTab] = useState('scalp');
    const [selectedSymbols, setSelectedSymbols] = useState(SYMBOLS); // All selected by default
    const [minStrength, setMinStrength] = useState(0);
    const [minVolume, setMinVolume] = useState(0);
    const [signalFilter, setSignalFilter] = useState('all'); // all, buy, sell

    // Use multi-symbol screener hook
    const { allSignals, loading, error, lastUpdate, refresh, stats } = useMultiSymbolScreener(activeTab, SYMBOLS);

    // Filter signals
    const filteredSignals = allSignals.filter(signal => {
        if (!selectedSymbols.includes(signal.symbol)) return false;
        if ((signal.strength || 0) < minStrength) return false;
        // Check metrics for volume if available, assuming metrics.volume or similar
        const vol = signal.metrics?.volume || 0;
        if (minVolume > 0 && vol < minVolume) return false;

        if (signalFilter === 'buy' && signal.signal !== 'BUY') return false;
        if (signalFilter === 'sell' && signal.signal !== 'SELL') return false;
        return true;
    });

    const toggleSymbol = (symbol) => {
        if (selectedSymbols.includes(symbol)) {
            if (selectedSymbols.length > 1) {
                setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
            }
        } else {
            setSelectedSymbols([...selectedSymbols, symbol]);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Authentication Required</h2>
                <p className="text-gray-600 dark:text-gray-400">Please log in to use Screeners.</p>
                <Button onClick={() => navigate('/login')}>Login Now</Button>
            </div>
        );
    }

    const currentTab = SCREENER_TABS.find(t => t.id === activeTab);

    return (
        <>
            <Helmet>
                <title>Multi-Symbol Screeners | DeepStrike</title>
                <meta name="description" content="Scan all indices for trading signals" />
            </Helmet>

            <div className="w-full px-4 py-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            <SparklesIcon className="w-6 h-6 text-amber-500" />
                            Multi-Symbol Screener
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Scanning NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY simultaneously
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {lastUpdate && (
                            <span className="text-xs text-gray-400">
                                Updated {lastUpdate.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={refresh}
                            disabled={loading}
                            className={`p-2 rounded-lg ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
                        >
                            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''} ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                        </button>
                    </div>
                </div>

                {/* Symbol Filter Chips */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500 mr-2">Symbols:</span>
                    {SYMBOLS.map((symbol) => {
                        const isSelected = selectedSymbols.includes(symbol);
                        const count = stats.bySymbol?.[symbol] || 0;
                        return (
                            <button
                                key={symbol}
                                onClick={() => toggleSymbol(symbol)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSelected
                                    ? 'bg-blue-600 text-white'
                                    : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                                    }`}
                            >
                                {symbol}
                                {count > 0 && (
                                    <span className="ml-1 opacity-75">({count})</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Screener Tabs */}
                <div className="flex gap-2">
                    {SCREENER_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${isActive
                                    ? `${tab.bgColor} border-current ${tab.color}`
                                    : `border-transparent ${isDark ? 'bg-gray-800 text-gray-500 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`
                                    }`}
                            >
                                <Icon className="w-6 h-6" />
                                <span className="font-semibold">{tab.label}</span>
                                <span className="text-xs opacity-75">{tab.description}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Filters Row */}
                <div className={`flex flex-wrap items-center gap-4 p-3 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                        <FunnelIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-500">Filters:</span>
                    </div>

                    {/* Signal Type Filter */}
                    <div className="flex gap-1">
                        {['all', 'buy', 'sell'].map((type) => (
                            <button
                                key={type}
                                onClick={() => setSignalFilter(type)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${signalFilter === type
                                    ? type === 'buy' ? 'bg-green-500 text-white'
                                        : type === 'sell' ? 'bg-red-500 text-white'
                                            : 'bg-blue-500 text-white'
                                    : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                                    }`}
                            >
                                {type.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Min Strength */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Min Strength:</span>
                        <select
                            value={minStrength}
                            onChange={(e) => setMinStrength(Number(e.target.value))}
                            className={`px-2 py-1 rounded-lg text-xs ${isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} border-0`}
                        >
                            <option value={0}>All</option>
                            <option value={50}>50%+</option>
                            <option value={70}>70%+</option>
                            <option value={80}>80%+</option>
                        </select>
                    </div>

                    {/* Min Volume */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Min Vol:</span>
                        <select
                            value={minVolume}
                            onChange={(e) => setMinVolume(Number(e.target.value))}
                            className={`px-2 py-1 rounded-lg text-xs ${isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} border-0`}
                        >
                            <option value={0}>All</option>
                            <option value={10000}>10k+</option>
                            <option value={50000}>50k+</option>
                            <option value={100000}>1L+</option>
                            <option value={1000000}>10L+</option>
                        </select>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <Card variant="glass" className="p-4 text-center">
                        <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {filteredSignals.length}
                        </div>
                        <div className="text-sm text-gray-500">Total Signals</div>
                    </Card>
                    <Card variant="glass" className="p-4 text-center bg-green-50 dark:bg-green-900/10">
                        <div className="text-3xl font-bold text-green-600 flex items-center justify-center gap-2">
                            <ArrowTrendingUpIcon className="w-6 h-6" />
                            {filteredSignals.filter(s => s.signal === 'BUY').length}
                        </div>
                        <div className="text-sm text-green-600">Buy Signals</div>
                    </Card>
                    <Card variant="glass" className="p-4 text-center bg-red-50 dark:bg-red-900/10">
                        <div className="text-3xl font-bold text-red-600 flex items-center justify-center gap-2">
                            <ArrowTrendingDownIcon className="w-6 h-6" />
                            {filteredSignals.filter(s => s.signal === 'SELL').length}
                        </div>
                        <div className="text-sm text-red-600">Sell Signals</div>
                    </Card>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading && allSignals.length === 0 && (
                    <div className="flex items-center justify-center py-12">
                        <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="ml-2 text-gray-500">Scanning all indices...</span>
                    </div>
                )}

                {/* Signals Grid */}
                {filteredSignals.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSignals.map((signal, index) => (
                            <SignalCard key={`${signal.symbol}-${signal.strike}-${signal.option_type}-${index}`} signal={signal} />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredSignals.length === 0 && !error && (
                    <Card variant="glass" className="p-12 text-center">
                        {currentTab && <currentTab.icon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />}
                        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            No Signals Found
                        </h3>
                        <p className="text-gray-500">
                            No {currentTab?.label} trading signals detected across selected indices.
                            <br />
                            Try adjusting filters or wait for market conditions to change.
                        </p>
                    </Card>
                )}

                {/* Disclaimer */}
                <div className="text-xs text-gray-400 text-center mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <strong>Disclaimer:</strong> These signals are for educational purposes only.
                    Always do your own analysis before trading. Past performance is not indicative of future results.
                </div>
            </div>
        </>
    );
};

export default Screeners;

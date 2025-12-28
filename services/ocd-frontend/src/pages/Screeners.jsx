import { useState, useEffect, useCallback, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    BoltIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    ArrowPathIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { selectIsAuthenticated, selectSelectedSymbol, selectSelectedExpiry } from '../context/selectors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { screenerService } from '../services/screenerService';

/**
 * Signal Card Component - Individual screener signal
 */
const SignalCard = memo(({ signal }) => {
    const isBuy = signal.signal === 'BUY';

    return (
        <Card variant="glass" className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
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
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${isBuy
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                    }`}>
                    {signal.signal}
                </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {signal.reason}
            </p>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2">
                    <div className="text-gray-500">Entry</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                        ₹{signal.entry_price.toFixed(2)}
                    </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                    <div className="text-green-600">Target</div>
                    <div className="font-semibold text-green-700 dark:text-green-400">
                        ₹{signal.target_price.toFixed(2)}
                    </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                    <div className="text-red-600">SL</div>
                    <div className="font-semibold text-red-700 dark:text-red-400">
                        ₹{signal.stop_loss.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Strength Indicator */}
            <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Signal Strength</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                        {signal.strength.toFixed(0)}%
                    </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all ${signal.strength > 70 ? 'bg-green-500' :
                            signal.strength > 40 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                        style={{ width: `${signal.strength}%` }}
                    />
                </div>
            </div>
        </Card>
    );
});

SignalCard.displayName = 'SignalCard';

/**
 * Screener Tab Component
 */
const SCREENER_TABS = [
    {
        id: 'scalp',
        label: 'Scalp',
        icon: BoltIcon,
        description: 'Short-term trades (5-15 min)',
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
        description: 'Support/Resistance levels',
        color: 'text-orange-500',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30'
    },
];

/**
 * Screeners Page - Scalp, Positional, and S/R OC
 */
const Screeners = () => {
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const navigate = useNavigate();
    const selectedSymbol = useSelector(selectSelectedSymbol);
    const selectedExpiry = useSelector(selectSelectedExpiry);

    const [activeTab, setActiveTab] = useState('scalp');
    const [signals, setSignals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchSignals = useCallback(async (screenerType) => {
        if (!selectedExpiry) return;

        setLoading(true);
        setError(null);

        try {
            let response;
            switch (screenerType) {
                case 'scalp':
                    response = await screenerService.getScalpSignals({ symbol: selectedSymbol, expiry: selectedExpiry });
                    break;
                case 'positional':
                    response = await screenerService.getPositionalSignals({ symbol: selectedSymbol, expiry: selectedExpiry });
                    break;
                case 'sr':
                    response = await screenerService.getSRSignals({ symbol: selectedSymbol, expiry: selectedExpiry });
                    break;
                default:
                    response = { signals: [] };
            }
            setSignals(response.signals || []);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Failed to fetch signals:', err);
            setError(err.message || 'Failed to load screener data');
        } finally {
            setLoading(false);
        }
    }, [selectedSymbol, selectedExpiry]);

    useEffect(() => {
        if (selectedExpiry) {
            fetchSignals(activeTab);
        }
    }, [activeTab, selectedExpiry, fetchSignals]);

    // Auto-refresh every 60 seconds
    useEffect(() => {
        if (!selectedExpiry) return;

        const interval = setInterval(() => {
            fetchSignals(activeTab);
        }, 60000);

        return () => clearInterval(interval);
    }, [activeTab, selectedExpiry, fetchSignals]);

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
    const buySignals = signals.filter(s => s.signal === 'BUY').length;
    const sellSignals = signals.filter(s => s.signal === 'SELL').length;

    return (
        <>
            <Helmet>
                <title>Screeners | Stockify</title>
                <meta name="description" content="Option chain screeners for Scalp, Positional, and S/R trading" />
            </Helmet>

            <div className="w-full px-4 py-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Screeners
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Find trading opportunities based on option chain analysis
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {lastUpdate && (
                            <span className="text-xs text-gray-400">
                                Updated {lastUpdate.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={() => fetchSignals(activeTab)}
                            disabled={loading}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <ArrowPathIcon className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Symbol/Expiry Info */}
                <div className="flex items-center gap-4 text-sm">
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg font-medium">
                        {selectedSymbol}
                    </span>
                    <span className="text-gray-500">
                        Expiry: {selectedExpiry || 'Not selected'}
                    </span>
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
                                    : 'border-transparent bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <Icon className="w-6 h-6" />
                                <span className="font-semibold">{tab.label}</span>
                                <span className="text-xs opacity-75">{tab.description}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <Card variant="glass" className="p-4 text-center">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                            {signals.length}
                        </div>
                        <div className="text-sm text-gray-500">Total Signals</div>
                    </Card>
                    <Card variant="glass" className="p-4 text-center bg-green-50 dark:bg-green-900/10">
                        <div className="text-3xl font-bold text-green-600 flex items-center justify-center gap-2">
                            <ArrowTrendingUpIcon className="w-6 h-6" />
                            {buySignals}
                        </div>
                        <div className="text-sm text-green-600">Buy Signals</div>
                    </Card>
                    <Card variant="glass" className="p-4 text-center bg-red-50 dark:bg-red-900/10">
                        <div className="text-3xl font-bold text-red-600 flex items-center justify-center gap-2">
                            <ArrowTrendingDownIcon className="w-6 h-6" />
                            {sellSignals}
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
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="ml-2 text-gray-500">Scanning for signals...</span>
                    </div>
                )}

                {/* Signals Grid */}
                {!loading && signals.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {signals.map((signal, index) => (
                            <SignalCard key={`${signal.strike}-${signal.option_type}-${index}`} signal={signal} />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && signals.length === 0 && !error && (
                    <Card variant="glass" className="p-12 text-center">
                        <currentTab.icon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            No Signals Found
                        </h3>
                        <p className="text-gray-500">
                            No {currentTab?.label} trading signals detected at this time.
                            <br />
                            Signals refresh automatically every minute.
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

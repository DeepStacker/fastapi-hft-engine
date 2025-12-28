/**
 * Analytics Dashboard - Main Container
 * Tabbed interface for all analytics modules
 */
import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { 
    selectSelectedSymbol, 
    selectSelectedExpiry, 
    selectSpotPrice,
    selectDaysToExpiry,
    selectDataLoading,
    selectOptionChain,
    selectDataSymbol
} from '../context/selectors';
import { fetchLiveData } from '../context/dataSlice';
import { 
    ArrowPathIcon, 
    ChartBarIcon, 
    BeakerIcon,
    ScaleIcon,
    CubeIcon,
    ChartPieIcon,
    PresentationChartBarIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

// Import all analysis modules
import OIAnalysis from '../components/analytics/OIAnalysis';
import VolumeAnalysis from '../components/analytics/VolumeAnalysis';
import GreeksAnalysis from '../components/analytics/GreeksAnalysis';
import StraddleAnalysis from '../components/analytics/StraddleAnalysis';
import MultiStrikeAnalysis from '../components/analytics/MultiStrikeAnalysis';
import StrategyBuilder from '../components/analytics/StrategyBuilder';

const tabs = [
    { id: 'oi', label: 'OI Analysis', icon: ChartBarIcon, component: OIAnalysis },
    { id: 'volume', label: 'Volume', icon: PresentationChartBarIcon, component: VolumeAnalysis },
    { id: 'greeks', label: 'Greeks', icon: BeakerIcon, component: GreeksAnalysis },
    { id: 'straddle', label: 'Straddle', icon: ScaleIcon, component: StraddleAnalysis },
    { id: 'multistrike', label: 'Multi-Strike', icon: ChartPieIcon, component: MultiStrikeAnalysis },
    { id: 'strategy', label: 'Strategy', icon: CubeIcon, component: StrategyBuilder },
];

const Analytics = () => {
    const dispatch = useDispatch();
    const symbol = useSelector(selectSelectedSymbol);
    const dataSymbol = useSelector(selectDataSymbol); // Actual loaded data symbol
    const expiry = useSelector(selectSelectedExpiry);
    const spotPrice = useSelector(selectSpotPrice);
    const daysToExpiry = useSelector(selectDaysToExpiry);
    const isLoading = useSelector(selectDataLoading);
    const optionChain = useSelector(selectOptionChain);
    
    // Use dataSymbol if available, otherwise fall back to selected symbol
    const displaySymbol = dataSymbol || symbol || 'NIFTY';
    
    const [activeTab, setActiveTab] = useState('oi');
    const [lastUpdate, setLastUpdate] = useState(new Date());

    // Refresh data
    const refreshData = useCallback(() => {
        if (symbol && expiry) {
            dispatch(fetchLiveData({ symbol, expiry: String(expiry) }));
            setLastUpdate(new Date());
        }
    }, [dispatch, symbol, expiry]);

    useEffect(() => {
        // Auto-refresh every 30 seconds
        const interval = setInterval(refreshData, 30000);
        return () => clearInterval(interval);
    }, [refreshData]);

    const formatExpiry = (ts) => {
        if (!ts) return '';
        const date = new Date(Number(ts) * 1000);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
    };

    const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || OIAnalysis;

    // No data state
    if (!optionChain && !isLoading) {
        return (
            <>
                <Helmet><title>Analytics | Stockify</title></Helmet>
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                    <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md">
                        <ChartBarIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Data Available</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            Please visit the Option Chain page first to load market data.
                        </p>
                        <a 
                            href="/option-chain" 
                            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                        >
                            Go to Option Chain
                        </a>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Helmet>
                <title>{displaySymbol} Analytics | Stockify</title>
            </Helmet>

            <div className="min-h-screen bg-mesh-gradient">
                {/* Premium Sticky Header */}
                <div className="sticky top-0 z-40 glass-strong border-b border-slate-200/50 dark:border-slate-700/50">
                    <div className="px-4 py-3">
                        {/* Top row - Symbol info */}
                        <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                    </span>
                                    <span className="text-xs font-medium text-green-600 dark:text-green-400">Live</span>
                                </div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{displaySymbol}</h1>
                                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">₹{spotPrice?.toFixed(2)}</span>
                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-medium">
                                    {formatExpiry(expiry)}
                                </span>
                                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold flex items-center gap-1">
                                    <ClockIcon className="w-3 h-3" />
                                    {daysToExpiry} DTE
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 hidden sm:block">
                                    Updated: {lastUpdate.toLocaleTimeString()}
                                </span>
                                <button
                                    onClick={refreshData}
                                    disabled={isLoading}
                                    className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50"
                                >
                                    <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Premium Tab Navigation */}
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                                            isActive 
                                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25' 
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Main Content with Glass Card */}
                <div className="p-4 md:p-6">
                    <div className="glass-strong rounded-2xl p-4 md:p-6 animate-fade-in">
                        <ActiveComponent />
                    </div>
                </div>
            </div>
        </>
    );
};

export default Analytics;

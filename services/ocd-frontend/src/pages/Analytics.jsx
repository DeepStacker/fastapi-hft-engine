/**
* Analytics Dashboard - Enhanced with Trader Guidance
* Professional layout with educational tooltips and actionable insights
*/
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import {
    selectSelectedSymbol,
    selectSelectedExpiry,
    selectSpotPrice,
    selectDaysToExpiry,
    selectDataLoading,
    selectOptionChain,
    selectDataSymbol,
    selectPCR,
    selectATMStrike,
    selectMaxPainStrike
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
    ClockIcon,
    ArrowsPointingOutIcon,
    InformationCircleIcon,
    LightBulbIcon,
    AcademicCapIcon,
    SparklesIcon,
    XMarkIcon,
    QuestionMarkCircleIcon,
    BoltIcon,
    EyeIcon,
    ArrowUpIcon,
    BanknotesIcon,
    CurrencyDollarIcon,
    BuildingLibraryIcon,
    ArrowsRightLeftIcon,
    BookOpenIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    FireIcon,
    ChartBarSquareIcon
} from '@heroicons/react/24/outline';

// Import all analysis modules
import OIAnalysis from '../components/analytics/OIAnalysis';
import GreeksAnalysisPro from '../components/analytics/GreeksAnalysisPro';
import StrategyBuilderPro from '../components/analytics/StrategyBuilderPro';
import PCRTrendChart from '../components/analytics/PCRTrendChart';
import IVSkewChart from '../components/analytics/IVSkewChart';
import UnifiedMarketOverview from '../components/analytics/UnifiedMarketOverview';

// Pro Components
import OIHeatmapPro from '../components/analytics/OIHeatmapPro';
import BuildupAnalysisPro from '../components/analytics/BuildupAnalysisPro';
import COIBarsPro from '../components/analytics/COIBarsPro';
import MaxPainChartPro from '../components/analytics/MaxPainChartPro';
import ReversalLevelsPro from '../components/analytics/ReversalLevelsPro';

// Advanced Analysis Components
import GammaExposureChart from '../components/analytics/GammaExposureChart';
import UnusualActivityScanner from '../components/analytics/UnusualActivityScanner';
import VolumeSpikeDetection from '../components/analytics/VolumeSpikeDetection';
import OIWeightedPCRGauge from '../components/analytics/OIWeightedPCRGauge';
import IVPercentileGauge from '../components/analytics/IVPercentileGauge';
import BidAskSpreadHeatmap from '../components/analytics/BidAskSpreadHeatmap';
import NetPremiumFlowChart from '../components/analytics/NetPremiumFlowChart';
import BuildupPatternCards from '../components/analytics/BuildupPatternCards';
import OIConcentrationAnalysis from '../components/analytics/OIConcentrationAnalysis';
import StraddleExpectedMove from '../components/analytics/StraddleExpectedMove';
import OptionsFlowDashboard from '../components/analytics/OptionsFlowDashboard';
import MarketMakerPositioning from '../components/analytics/MarketMakerPositioning';
import ChartOfAccuracy from '../components/analytics/ChartOfAccuracy';

// Tab configurations with trader guidance
const tabCategories = [
    {
        id: 'overview',
        name: '📊 Market Overview',
        description: 'Start here to get the big picture of market sentiment',
        tabs: [
            {
                id: 'unified',
                label: 'Consensus Engine',
                icon: CubeIcon,
                component: UnifiedMarketOverview,
                difficulty: 'beginner',
                purpose: 'Aggregates all signals into one Confluence Score',
                howToUse: 'Look at the Confluence Score. >60 = Strong Buy. <-60 = Strong Sell. Check for conflicting signals.',
                tradingTip: 'Always trade in the direction of the Confluence Score. Avoid trading when score is near 0.',
            },
            {
                id: 'coa',
                label: 'Chart of Accuracy',
                icon: ChartBarSquareIcon,
                component: ChartOfAccuracy,
                difficulty: 'beginner',
                purpose: '9-scenario framework to identify market tops and bottoms',
                howToUse: 'Check the scenario (1.0-1.8). See if Support/Resistance is Strong, WTT, or WTB. Trade only at indicated levels.',
                tradingTip: 'Only take trades at EOS when Support is Strong. Only trade EOR when Resistance is Strong.',
            },
            {
                id: 'flow',
                label: 'Options Flow',
                icon: PresentationChartBarIcon,
                component: OptionsFlowDashboard,
                difficulty: 'beginner',
                purpose: 'See overall market sentiment at a glance',
                howToUse: 'Check the sentiment meter - Green = Bullish, Red = Bearish. Look at hot strikes for active traders.',
                tradingTip: 'When bullish signals > 3, lean towards call buying or put selling. Vice versa for bearish.',
            },
            {
                id: 'mm',
                label: 'MM Positioning',
                icon: BuildingLibraryIcon,
                component: MarketMakerPositioning,
                difficulty: 'advanced',
                purpose: 'Understand how market makers are positioned',
                howToUse: 'Positive GEX = Expect range-bound. Negative GEX = Expect trending/volatile moves.',
                tradingTip: 'Trade with market makers: In positive GEX, sell premium. In negative GEX, buy directional.',
            },
        ]
    },
    {
        id: 'smartmoney',
        name: '🎯 Smart Money Detection',
        description: 'Spot unusual activity that may indicate institutional moves',
        tabs: [
            {
                id: 'unusual',
                label: 'Unusual Activity',
                icon: EyeIcon,
                component: UnusualActivityScanner,
                difficulty: 'intermediate',
                purpose: 'Find contracts with abnormal trading patterns',
                howToUse: 'Score 70+ = Very unusual. Check the signal column for direction. Filter by Calls/Puts.',
                tradingTip: 'Follow high-score bullish signals near support, bearish signals near resistance.',
            },
            {
                id: 'volspikes',
                label: 'Volume Spikes',
                icon: ArrowUpIcon,
                component: VolumeSpikeDetection,
                difficulty: 'beginner',
                purpose: 'Identify sudden volume surges that precede big moves',
                howToUse: '5x+ spike = Extreme. Check if OI also increased (new positions) or decreased (exits).',
                tradingTip: 'Volume spike + OI increase + price up = Strong bullish. Opposite = Strong bearish.',
            },
            {
                id: 'premiumflow',
                label: 'Premium Flow',
                icon: BanknotesIcon,
                component: NetPremiumFlowChart,
                difficulty: 'intermediate',
                purpose: 'Track where money is flowing in the options market',
                howToUse: 'Bulls = Call buying + Put selling. Bears = Call selling + Put buying. Check the tug-of-war.',
                tradingTip: 'When bulls dominate, look for dips to buy. When bears dominate, look for rallies to sell.',
            },
        ]
    },
    {
        id: 'sentiment',
        name: '📈 Market Sentiment',
        description: 'Gauge bullish/bearish bias using proven indicators',
        tabs: [
            {
                id: 'wpcr',
                label: 'Weighted PCR',
                icon: ScaleIcon,
                component: OIWeightedPCRGauge,
                difficulty: 'beginner',
                purpose: 'Put-Call Ratio weighted by proximity to spot price',
                howToUse: 'PCR > 1.2 = Bullish (puts being written = support). PCR < 0.8 = Bearish (calls being written).',
                tradingTip: 'High PCR at support = Strong bounce zone. Low PCR at resistance = Strong rejection zone.',
            },
            {
                id: 'buildupCards',
                label: 'Buildup Patterns',
                icon: PresentationChartBarIcon,
                component: BuildupPatternCards,
                difficulty: 'beginner',
                purpose: 'Identify Long Buildup, Short Buildup, Covering, Unwinding',
                howToUse: 'Long Buildup = Bullish continuation. Short Covering = Bullish reversal. Check the overall sentiment.',
                tradingTip: 'Trade in direction of dominant pattern. Exit when opposite pattern emerges.',
            },
            {
                id: 'pcr',
                label: 'PCR Trend',
                icon: ScaleIcon,
                component: PCRTrendChart,
                difficulty: 'beginner',
                purpose: 'Track PCR changes over time',
                howToUse: 'Rising PCR = Becoming more bullish. Falling PCR = Becoming bearish.',
                tradingTip: 'Look for PCR extremes for contrarian trades. Very high PCR + overbought = Caution.',
            },
        ]
    },
    {
        id: 'oi',
        name: '🏛️ Open Interest Analysis',
        description: 'Identify support/resistance levels based on OI concentration',
        tabs: [
            {
                id: 'heatmap',
                label: 'OI Heatmap',
                icon: ChartBarIcon,
                component: OIHeatmapPro,
                difficulty: 'beginner',
                purpose: 'Visual map of OI distribution across strikes',
                howToUse: 'Dark colors = High OI = Strong levels. Call OI = Resistance. Put OI = Support.',
                tradingTip: 'Enter longs near high Put OI. Enter shorts near high Call OI. These are "walls".',
            },
            {
                id: 'oiconc',
                label: 'OI Walls',
                icon: ChartBarIcon,
                component: OIConcentrationAnalysis,
                difficulty: 'intermediate',
                purpose: 'Find strikes with highest % of total OI',
                howToUse: 'Walls with 5%+ concentration act as strong support/resistance.',
                tradingTip: 'Book profits near OI walls. Breakout through a wall = Strong move in that direction.',
            },
            {
                id: 'coi',
                label: 'Change in OI',
                icon: ChartBarIcon,
                component: COIBarsPro,
                difficulty: 'beginner',
                purpose: 'Track today\'s OI additions and exits',
                howToUse: 'Green bars = OI added (new positions). Red bars = OI reduced (positions closed).',
                tradingTip: 'Fresh OI at a strike = New support/resistance forming. Watch for continuation.',
            },
            {
                id: 'buildup',
                label: 'Buildup Details',
                icon: PresentationChartBarIcon,
                component: BuildupAnalysisPro,
                difficulty: 'intermediate',
                purpose: 'Detailed buildup analysis by strike',
                howToUse: 'Long Buildup = OI↑ + Price↑. Short Buildup = OI↑ + Price↓.',
                tradingTip: 'Follow the money: Trade in direction of maximum buildup.',
            },
        ]
    },
    {
        id: 'gamma',
        name: '⚡ Gamma & Greeks',
        description: 'Advanced analysis for understanding market maker hedging',
        tabs: [
            {
                id: 'gex',
                label: 'Gamma Exposure',
                icon: BoltIcon,
                component: GammaExposureChart,
                difficulty: 'advanced',
                purpose: 'Predict price behavior based on MM gamma hedging',
                howToUse: 'Positive GEX = Price stabilizes. Negative GEX = Price accelerates. Check gamma flip level.',
                tradingTip: 'Above gamma flip = Mean reversion trades. Below gamma flip = Momentum trades.',
            },
            {
                id: 'greeks',
                label: 'Greeks Analysis',
                icon: BeakerIcon,
                component: GreeksAnalysisPro,
                difficulty: 'advanced',
                purpose: 'Analyze Delta, Gamma, Theta, Vega distribution',
                howToUse: 'Net Delta shows directional bias. High Gamma = Expect explosive moves.',
                tradingTip: 'High Theta near ATM = Good for selling options. High Vega = Good for buying options.',
            },
        ]
    },
    {
        id: 'iv',
        name: '📉 Volatility Analysis',
        description: 'Understand if options are cheap or expensive',
        tabs: [
            {
                id: 'ivpct',
                label: 'IV Percentile',
                icon: ChartPieIcon,
                component: IVPercentileGauge,
                difficulty: 'intermediate',
                purpose: 'See if current IV is high or low vs historical range',
                howToUse: 'IV > 70% = Expensive options (sell premium). IV < 30% = Cheap options (buy premium).',
                tradingTip: 'Never buy expensive options. Use IV to decide between buying vs selling strategies.',
            },
            {
                id: 'straddle',
                label: 'Expected Move',
                icon: ArrowsRightLeftIcon,
                component: StraddleExpectedMove,
                difficulty: 'intermediate',
                purpose: 'Calculate expected price range by expiry',
                howToUse: 'Straddle price = Market\'s expected move. Upper/Lower breakevens show profit zones.',
                tradingTip: 'If you expect bigger move than straddle shows, buy straddle. Smaller move? Sell.',
            },
            {
                id: 'ivskew',
                label: 'IV Skew',
                icon: ChartPieIcon,
                component: IVSkewChart,
                difficulty: 'advanced',
                purpose: 'Compare Put vs Call IV for directional bias',
                howToUse: 'Put IV > Call IV = Market fears downside. Call IV > Put IV = Greed for upside.',
                tradingTip: 'Sell overpriced side (high IV). Buy underpriced side for directional bets.',
            },
        ]
    },
    {
        id: 'liquidity',
        name: '💧 Liquidity & Execution',
        description: 'Check before you trade - ensure good execution',
        tabs: [
            {
                id: 'bidask',
                label: 'Bid-Ask Spread',
                icon: CurrencyDollarIcon,
                component: BidAskSpreadHeatmap,
                difficulty: 'beginner',
                purpose: 'Identify liquid vs illiquid contracts',
                howToUse: 'Spread < 2% = Good liquidity. Spread > 5% = Avoid or use limit orders.',
                tradingTip: 'Always check spread before trading. Wide spread = Hidden cost eating your profits.',
            },
        ]
    },
    {
        id: 'levels',
        name: '🎯 Key Price Levels',
        description: 'Important levels for target setting and stop loss',
        tabs: [
            {
                id: 'maxpain',
                label: 'Max Pain',
                icon: ScaleIcon,
                component: MaxPainChartPro,
                difficulty: 'beginner',
                purpose: 'Strike where option buyers lose most money',
                howToUse: 'Price tends to gravitate toward max pain near expiry. Use as a target.',
                tradingTip: 'Use max pain as target for weekly expiry trades. Works best on Thursday.',
            },
            {
                id: 'reversal',
                label: 'Reversal Levels',
                icon: ArrowsPointingOutIcon,
                component: ReversalLevelsPro,
                difficulty: 'intermediate',
                purpose: 'Statistical reversal zones based on historical data',
                howToUse: 'High confidence levels = Strong reversal points. Use as entry/exit zones.',
                tradingTip: 'Combine with OI walls for high-probability reversal trades.',
            },
        ]
    },
    {
        id: 'strategy',
        name: '🛠️ Strategy Builder',
        description: 'Build and analyze multi-leg option strategies',
        tabs: [
            {
                id: 'strategy',
                label: 'Strategy Builder',
                icon: CubeIcon,
                component: StrategyBuilderPro,
                difficulty: 'intermediate',
                purpose: 'Create iron condors, straddles, spreads and more',
                howToUse: 'Add legs from option chain. See payoff diagram and greeks. Adjust position sizing.',
                tradingTip: 'Always check max loss before trading. Use simulation sliders to stress test.',
            },
        ]
    },
];

// Flatten tabs for lookup
const allTabs = tabCategories.flatMap(cat => cat.tabs);

const Analytics = () => {
    const dispatch = useDispatch();
    const symbol = useSelector(selectSelectedSymbol);
    const dataSymbol = useSelector(selectDataSymbol);
    const expiry = useSelector(selectSelectedExpiry);
    const spotPrice = useSelector(selectSpotPrice);
    const daysToExpiry = useSelector(selectDaysToExpiry);
    const isLoading = useSelector(selectDataLoading);
    const optionChain = useSelector(selectOptionChain);
    const pcr = useSelector(selectPCR);
    const atmStrike = useSelector(selectATMStrike);
    const maxPain = useSelector(selectMaxPainStrike);

    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'unified';
    const activeCategory = searchParams.get('cat') || 'overview';

    // setActiveTab helper to update URL and sync category
    const setActiveTab = (tabId) => {
        // Find which category this tab belongs to
        const category = tabCategories.find(c => c.tabs.some(t => t.id === tabId));
        const categoryId = category ? category.id : 'overview';

        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('tab', tabId);
            newParams.set('cat', categoryId);
            return newParams;
        });
    };

    const displaySymbol = dataSymbol || symbol || 'NIFTY';
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [showGuide, setShowGuide] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState(activeCategory);

    // Sync expanded category with URL active category
    useEffect(() => {
        setExpandedCategory(activeCategory);
    }, [activeCategory]);

    // Get active tab info
    const activeTabInfo = useMemo(() =>
        allTabs.find(t => t.id === activeTab) || allTabs[0]
        , [activeTab]);

    // Refresh data
    const refreshData = useCallback(() => {
        if (symbol && expiry) {
            dispatch(fetchLiveData({ symbol, expiry: String(expiry) }));
            setLastUpdate(new Date());
        }
    }, [dispatch, symbol, expiry]);

    useEffect(() => {
        const interval = setInterval(refreshData, 30000);
        return () => clearInterval(interval);
    }, [refreshData]);

    const formatExpiry = (ts) => {
        if (!ts) return '';
        const date = new Date(Number(ts) * 1000);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
    };

    // Quick market snapshot
    const marketSnapshot = useMemo(() => {
        if (!optionChain || !spotPrice) return null;

        const sentiment = pcr > 1.2 ? 'bullish' : pcr < 0.8 ? 'bearish' : 'neutral';
        const maxPainDist = maxPain ? ((maxPain - spotPrice) / spotPrice * 100).toFixed(1) : 0;

        return { sentiment, maxPainDist, pcr };
    }, [optionChain, spotPrice, pcr, maxPain]);

    const ActiveComponent = activeTabInfo?.component || UnifiedMarketOverview;

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

            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
                {/* Sticky Header */}
                <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
                    <div className="px-4 py-3">
                        {/* Top row - Symbol info + Quick Snapshot */}
                        <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                    </span>
                                    <span className="text-xs font-medium text-green-600">Live</span>
                                </div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{displaySymbol}</h1>
                                <span className="text-xl font-bold text-blue-600">₹{spotPrice?.toFixed(2)}</span>
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium">
                                    {formatExpiry(expiry)}
                                </span>
                                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold flex items-center gap-1">
                                    <ClockIcon className="w-3 h-3" />
                                    {daysToExpiry} DTE
                                </span>
                            </div>

                            {/* Quick Snapshot */}
                            {marketSnapshot && (
                                <div className="hidden md:flex items-center gap-3">
                                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${marketSnapshot.sentiment === 'bullish'
                                        ? 'bg-green-100 text-green-700'
                                        : marketSnapshot.sentiment === 'bearish'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-gray-100 text-gray-700'
                                        }`}>
                                        {marketSnapshot.sentiment === 'bullish' ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> :
                                            marketSnapshot.sentiment === 'bearish' ? <ArrowTrendingDownIcon className="w-3.5 h-3.5" /> : null}
                                        PCR: {marketSnapshot.pcr?.toFixed(2)}
                                    </div>
                                    <div className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">
                                        Max Pain: {maxPain} ({marketSnapshot.maxPainDist}%)
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowGuide(!showGuide)}
                                    className="p-2.5 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-all flex items-center gap-1.5"
                                    title="How to use this page"
                                >
                                    <AcademicCapIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline text-xs font-medium">Guide</span>
                                </button>
                                <button
                                    onClick={refreshData}
                                    disabled={isLoading}
                                    className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                                >
                                    <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Guide Modal */}
                {showGuide && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
                            <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 rounded-t-2xl flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AcademicCapIcon className="w-6 h-6" />
                                    <h2 className="font-bold text-lg">How to Use Analytics</h2>
                                </div>
                                <button onClick={() => setShowGuide(false)} className="p-1 hover:bg-white/20 rounded">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</span>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">Start with Market Overview</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Check "Options Flow" first to get the big picture. Is the market bullish or bearish today?</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">2</span>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">Find Key Levels</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Use "OI Walls" and "Max Pain" to identify support/resistance. These are your entry/exit zones.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">3</span>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">Spot Smart Money</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Check "Unusual Activity" and "Volume Spikes" to see where big players are positioning.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">4</span>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">Check IV Before Trading</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Use "IV Percentile" to know if options are cheap or expensive. Don't buy expensive options!</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">5</span>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">Build Your Strategy</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Use "Strategy Builder" to create and test your trades before executing.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">💡 Pro Tip</h4>
                                    <p className="text-sm text-blue-700 dark:text-blue-400">
                                        Each analysis tab has a <strong>how to use</strong> section and <strong>trading tip</strong> below the chart. Read these to understand what actions to take!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex">
                    {/* Left Sidebar - Category Navigation */}
                    <div className="hidden lg:block w-64 sticky top-[72px] h-[calc(100vh-72px)] overflow-y-auto border-r border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur p-3">
                        <div className="space-y-2">
                            {tabCategories.map(category => (
                                <div key={category.id}>
                                    <button
                                        onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${expandedCategory === category.id
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{category.name}</span>
                                            <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{category.tabs.length}</span>
                                        </div>
                                    </button>

                                    {expandedCategory === category.id && (
                                        <div className="mt-1 ml-2 space-y-1">
                                            {category.tabs.map(tab => {
                                                const Icon = tab.icon;
                                                const isActive = activeTab === tab.id;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setActiveTab(tab.id)}
                                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                            }`}
                                                    >
                                                        <Icon className="w-4 h-4" />
                                                        <span className="truncate">{tab.label}</span>
                                                        {tab.difficulty === 'advanced' && (
                                                            <SparklesIcon className="w-3 h-3 ml-auto text-amber-500" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mobile Tab Selector */}
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 p-2">
                        <div className="flex gap-1 overflow-x-auto pb-safe">
                            {allTabs.slice(0, 8).map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-medium transition-all min-w-[60px] ${isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="truncate">{tab.label.split(' ')[0]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
                        {/* Tab Info Header */}
                        <div className="mb-4 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            {activeTabInfo && <activeTabInfo.icon className="w-6 h-6 text-blue-600" />}
                                            {activeTabInfo?.label}
                                        </h2>
                                        {activeTabInfo?.difficulty === 'advanced' && (
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold flex items-center gap-1">
                                                <SparklesIcon className="w-3 h-3" /> Advanced
                                            </span>
                                        )}
                                        {activeTabInfo?.difficulty === 'intermediate' && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">
                                                Intermediate
                                            </span>
                                        )}
                                        {activeTabInfo?.difficulty === 'beginner' && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">
                                                Beginner Friendly
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{activeTabInfo?.purpose}</p>
                                </div>
                                <div className="text-xs text-gray-400">
                                    Updated: {lastUpdate.toLocaleTimeString()}
                                </div>
                            </div>

                            {/* How to Use & Trading Tip */}
                            <div className="grid md:grid-cols-2 gap-3 mt-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-semibold text-xs mb-1">
                                        <BookOpenIcon className="w-4 h-4" />
                                        How to Use
                                    </div>
                                    <p className="text-xs text-blue-600 dark:text-blue-300">{activeTabInfo?.howToUse}</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-xs mb-1">
                                        <LightBulbIcon className="w-4 h-4" />
                                        Trading Tip
                                    </div>
                                    <p className="text-xs text-amber-600 dark:text-amber-300">{activeTabInfo?.tradingTip}</p>
                                </div>
                            </div>
                        </div>

                        {/* Main Chart/Analysis Area */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <ActiveComponent />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Analytics;

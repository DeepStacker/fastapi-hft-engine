import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { selectCurrentUser, selectSpotPrice, selectSelectedSymbol, selectFuturesData } from '../context/selectors';
import { setSidAndFetchData } from '../context/dataSlice';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  CalculatorIcon,
  BeakerIcon,
  PresentationChartLineIcon,
  SparklesIcon,
  ArrowRightIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import TradingStatsWidget from '../components/dashboard/TradingStatsWidget';
import VIXWidget from '../components/dashboard/VIXWidget';
import MarketStatusWidget from '../components/dashboard/MarketStatusWidget';
import ExpiryCountdownWidget from '../components/dashboard/ExpiryCountdownWidget';
import PCRSummaryWidget from '../components/dashboard/PCRSummaryWidget';
import MaxPainWidget from '../components/dashboard/MaxPainWidget';
import OIBuildupWidget from '../components/dashboard/OIBuildupWidget';
import LiveMarketSummaryWidget from '../components/dashboard/LiveMarketSummaryWidget';
import MultiSymbolOverview from '../components/dashboard/MultiSymbolOverview';
// Institutional-Grade Widgets
import GEXWidget from '../components/dashboard/GEXWidget';
import FuturesBasisWidget from '../components/dashboard/FuturesBasisWidget';
import IVSkewWidget from '../components/dashboard/IVSkewWidget';
import MarketPulseWidget from '../components/dashboard/MarketPulseWidget';
import PositionsSummaryWidget from '../components/dashboard/PositionsSummaryWidget';

/**
 * Premium Dashboard - Trading Command Center
 */
const Dashboard = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const spotPrice = useSelector(selectSpotPrice);
  const symbol = useSelector(selectSelectedSymbol);
  const futuresData = useSelector(selectFuturesData);
  const theme = useSelector((state) => state.theme.theme);
  const navigate = useNavigate();

  useEffect(() => {
    if (!spotPrice) {
      dispatch(setSidAndFetchData({ newSid: 'NIFTY' }));
    }
  }, [dispatch, spotPrice]);

  const isDark = theme === 'dark';

  // Premium Feature Cards
  const features = [
    {
      title: 'Option Chain',
      description: 'Real-time Greeks, IV, PCR',
      icon: ChartBarIcon,
      action: () => navigate('/option-chain'),
      gradient: 'from-blue-600 to-cyan-500',
      glow: 'hover:shadow-blue-500/30',
    },
    {
      title: 'Analytics',
      description: 'OI, Volume, Strategy Builder',
      icon: BeakerIcon,
      action: () => navigate('/analytics'),
      gradient: 'from-violet-600 to-purple-500',
      glow: 'hover:shadow-violet-500/30',
    },
    {
      title: 'Live Charts',
      description: 'Candlesticks & Levels',
      icon: PresentationChartLineIcon,
      action: () => navigate('/charts'),
      gradient: 'from-emerald-600 to-teal-500',
      glow: 'hover:shadow-emerald-500/30',
    },
    {
      title: 'Position Sizing',
      description: 'Risk-based sizing',
      icon: CalculatorIcon,
      action: () => navigate('/position-sizing'),
      gradient: 'from-amber-500 to-orange-500',
      glow: 'hover:shadow-amber-500/30',
    },
  ];

  // Market indices data
  const indices = [
    {
      name: 'NIFTY 50',
      symbol: 'NIFTY',
      price: symbol === 'NIFTY' ? spotPrice : null,
      change: futuresData?.change || 0,
      changePercent: futuresData?.changePercent || 0,
    },
    {
      name: 'BANK NIFTY',
      symbol: 'BANKNIFTY',
      price: symbol === 'BANKNIFTY' ? spotPrice : null,
      change: 0,
      changePercent: 0,
    },
  ];

  const userName = user?.name || user?.email?.split('@')[0] || 'Trader';
  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <>
      <Helmet>
        <title>Dashboard | DeepStrike</title>
      </Helmet>

      <div className="w-full px-4 py-6 space-y-6">

        {/* Hero Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-3xl p-8 ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'} border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
        >
          {/* Background Glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-500/20 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-5 h-5 text-amber-500" />
              <span className={`text-sm font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                {greeting}
              </span>
            </div>
            <h1 className={`text-4xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Welcome, {userName}! 👋
            </h1>
            <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Your trading command center is ready.
            </p>
          </div>
        </motion.div>

        {/* Multi-Symbol Market Overview - ALL INDICES */}
        <MultiSymbolOverview />

        {/* Trading Stats Widget */}
        <TradingStatsWidget />

        {/* My Positions Quick View */}
        <PositionsSummaryWidget />

        {/* Market Status Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MarketStatusWidget />
          <VIXWidget />
          <ExpiryCountdownWidget />
        </div>

        {/* Pro Analytics Row - Institutional Grade */}
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              🔥 Pro Analytics
            </h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-full">
              LIVE
            </span>
          </div>
        </div>

        {/* Market Pulse (Full Width) */}
        <MarketPulseWidget />

        {/* Institutional Widgets Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GEXWidget />
          <FuturesBasisWidget />
          <IVSkewWidget />
        </div>

        {/* Live OI Analysis Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PCRSummaryWidget />
          <MaxPainWidget />
          <OIBuildupWidget />
        </div>

        {/* Quick Launch - Feature Cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Quick Launch
            </h2>
            <BoltIcon className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                onClick={feature.action}
                className={`group relative overflow-hidden p-5 rounded-2xl border text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-xl ${feature.glow} ${isDark
                  ? 'bg-slate-900/70 border-slate-700 hover:border-slate-600'
                  : 'bg-white/90 border-slate-200 hover:border-slate-300'
                  }`}
              >
                {/* Gradient Icon */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg mb-4`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>

                <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {feature.title}
                </h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {feature.description}
                </p>

                {/* Arrow on hover */}
                <div className={`absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <ArrowRightIcon className="w-5 h-5" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Live Market Summary (Replaced Quick Tips) */}
        <LiveMarketSummaryWidget />

      </div>
    </>
  );
};

export default Dashboard;

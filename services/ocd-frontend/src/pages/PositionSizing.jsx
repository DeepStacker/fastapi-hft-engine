import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  CalculatorIcon,
  ChartBarIcon,
  ScaleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import PositionCalculator from '../components/position/PositionCalculator';
import RiskAnalysis from '../components/position/RiskAnalysis';
import SuggestedPositions from '../components/position/SuggestedPositions';

/**
 * Professional Position Sizing Page
 * Features: Glass-morphism design, animated transitions, key metrics display
 */
const PositionSizing = () => {
  const theme = useSelector((state) => state.theme.theme);
  const [calculatedPosition, setCalculatedPosition] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  const isDark = theme === 'dark';

  useEffect(() => {
    document.title = 'DeepStrike | Position Sizing Calculator';
  }, []);

  // Memoized key metrics from calculated position
  const keyMetrics = useMemo(() => {
    if (!calculatedPosition) return null;
    return {
      positionSize: calculatedPosition.positionSize || 0,
      maxRisk: calculatedPosition.maxRisk || 0,
      stopLoss: calculatedPosition.stopLoss || 0,
      targetProfit: calculatedPosition.targetProfit || 0,
      riskRewardRatio: calculatedPosition.riskRewardRatio || 0,
    };
  }, [calculatedPosition]);

  // Handle calculation with loading state
  const handleCalculate = useCallback((position, analysis) => {
    setIsCalculating(true);
    // Simulate brief calculation time for smooth UX
    setTimeout(() => {
      setCalculatedPosition(position);
      setAnalysisData(analysis);
      setIsCalculating(false);
    }, 300);
  }, []);

  return (
    <>
      <Helmet>
        <title>Position Sizing | DeepStrike</title>
        <meta name="description" content="Professional position sizing calculator with risk management tools" />
      </Helmet>

      <div className={`min-h-screen transition-colors duration-300 ${
        isDark ? 'text-white' : 'text-gray-900'
      }`}>
        
        {/* Compact Header */}
        <div className={`sticky top-0 z-10 backdrop-blur-md border-b ${
          isDark ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-200'
        }`}>
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                  <CalculatorIcon className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Position Sizing</h1>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Risk-based position calculator
                  </p>
                </div>
              </div>

              {/* Quick Metrics */}
              {keyMetrics && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="hidden md:flex items-center gap-4"
                >
                  <MetricBadge 
                    label="Position" 
                    value={`₹${keyMetrics.positionSize.toLocaleString()}`}
                    icon={ScaleIcon}
                    color="blue"
                    isDark={isDark}
                  />
                  <MetricBadge 
                    label="Risk" 
                    value={`₹${keyMetrics.maxRisk.toLocaleString()}`}
                    icon={ExclamationTriangleIcon}
                    color="red"
                    isDark={isDark}
                  />
                  <MetricBadge 
                    label="R:R" 
                    value={`1:${keyMetrics.riskRewardRatio.toFixed(1)}`}
                    icon={ArrowTrendingUpIcon}
                    color="green"
                    isDark={isDark}
                  />
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Calculator Panel */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl border backdrop-blur-sm ${
                  isDark 
                    ? 'bg-gray-800/50 border-gray-700' 
                    : 'bg-white/80 border-gray-200 shadow-lg'
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <CalculatorIcon className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  <h2 className="font-semibold">Calculator</h2>
                </div>
                <PositionCalculator 
                  setCalculatedPosition={(pos) => handleCalculate(pos, analysisData)}
                  setAnalysisData={setAnalysisData}
                  isCalculating={isCalculating}
                />
              </motion.div>
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {isCalculating ? (
                  <LoadingState isDark={isDark} />
                ) : calculatedPosition ? (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <RiskAnalysis 
                      calculatedPosition={calculatedPosition}
                      analysisData={analysisData}
                      theme={theme}
                    />
                    <SuggestedPositions 
                      calculatedPosition={calculatedPosition}
                      analysisData={analysisData}
                      theme={theme}
                    />
                  </motion.div>
                ) : (
                  <EmptyState isDark={isDark} />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * Metric Badge Component
 */
const MetricBadge = memo(({ label, value, icon: Icon, color, isDark }) => {
  const colorClasses = {
    blue: isDark ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-50',
    red: isDark ? 'text-red-400 bg-red-500/10' : 'text-red-600 bg-red-50',
    green: isDark ? 'text-green-400 bg-green-500/10' : 'text-green-600 bg-green-50',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colorClasses[color]}`}>
      <Icon className="w-4 h-4" />
      <div>
        <div className="text-[10px] uppercase opacity-70">{label}</div>
        <div className="text-sm font-bold">{value}</div>
      </div>
    </div>
  );
});

MetricBadge.displayName = 'MetricBadge';

/**
 * Loading State Component
 */
const LoadingState = memo(({ isDark }) => (
  <motion.div
    key="loading"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className={`flex flex-col justify-center items-center h-80 rounded-2xl border backdrop-blur-sm ${
      isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200'
    }`}
  >
    <div className="relative">
      <div className="animate-spin rounded-full h-12 w-12 border-3 border-blue-200 border-t-blue-600" />
      <CalculatorIcon className="absolute inset-0 m-auto w-5 h-5 text-blue-600" />
    </div>
    <p className={`mt-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
      Calculating position...
    </p>
  </motion.div>
));

LoadingState.displayName = 'LoadingState';

/**
 * Empty State Component  
 */
const EmptyState = memo(({ isDark }) => (
  <motion.div
    key="empty"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className={`flex flex-col justify-center items-center h-80 rounded-2xl border backdrop-blur-sm ${
      isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200'
    }`}
  >
    <div className={`p-4 rounded-full mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
      <ChartBarIcon className={`w-8 h-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
    </div>
    <h3 className="text-lg font-semibold mb-2">Ready to Calculate</h3>
    <p className={`text-sm text-center max-w-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
      Enter your account balance, risk percentage, and trade details to calculate optimal position size
    </p>
  </motion.div>
));

EmptyState.displayName = 'EmptyState';

export default PositionSizing;

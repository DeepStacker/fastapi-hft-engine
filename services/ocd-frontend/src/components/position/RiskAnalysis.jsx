import { useState, memo, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { 
  ChartBarIcon, 
  SparklesIcon, 
  LightBulbIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { runMonteCarloSimulation, calculateRiskMetrics, generateTradingSuggestions } from '../../utils/positionAnalytics';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Enhanced Risk Analysis Component with glass-morphism styling
 */
const RiskAnalysis = memo(({ calculatedPosition, analysisData = {}, theme }) => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const isDark = theme === 'dark';
  const safeAnalysisData = useMemo(() => analysisData || {}, [analysisData]);
  
  // Memoize market data and calculations
  const { simulationResults, riskMetrics, tradingSuggestions, marketData } = useMemo(() => {
    const mktData = {
      price: calculatedPosition.entryPrice,
      stopLoss: calculatedPosition.stopLoss,
      target: calculatedPosition.targetPrice,
      volatility: safeAnalysisData.volatilityLevel || 'medium',
      volume: 500000
    };
    
    return {
      marketData: mktData,
      simulationResults: runMonteCarloSimulation(calculatedPosition, mktData),
      riskMetrics: calculateRiskMetrics(calculatedPosition, mktData),
      tradingSuggestions: generateTradingSuggestions(calculatedPosition, safeAnalysisData, mktData)
    };
  }, [calculatedPosition, safeAnalysisData]);

  // Chart configurations
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        titleColor: isDark ? '#fff' : '#111',
        bodyColor: isDark ? '#9ca3af' : '#666',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => typeof ctx.raw === 'number' ? `₹${ctx.raw.toFixed(2)}` : `${ctx.raw}%`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { color: isDark ? '#9ca3af' : '#6b7280' }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#9ca3af' : '#6b7280', font: { size: 10 } }
      }
    }
  }), [isDark]);

  const positionChartData = useMemo(() => ({
    labels: ['Position', 'Risk', 'Gain', 'Loss'],
    datasets: [{
      data: [
        calculatedPosition.totalValue || 0,
        calculatedPosition.riskAmount || 0,
        parseFloat(safeAnalysisData.potentialGain) || 0,
        parseFloat(safeAnalysisData.potentialLoss) || 0
      ],
      backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(239,68,68,0.7)', 'rgba(34,197,94,0.7)', 'rgba(249,115,22,0.7)'],
      borderRadius: 6
    }]
  }), [calculatedPosition, safeAnalysisData]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'simulation', label: 'Monte Carlo', icon: SparklesIcon },
    { id: 'suggestions', label: 'Insights', icon: LightBulbIcon },
  ];

  return (
    <div className={`rounded-2xl border backdrop-blur-sm ${
      isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200 shadow-lg'
    }`}>
      {/* Header with Tabs */}
      <div className={`px-5 py-3 border-b flex items-center gap-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className="font-semibold flex items-center gap-2">
          <ChartBarIcon className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          Risk Analysis
        </h3>
        <div className="flex-1" />
        <div className="flex rounded-lg overflow-hidden border ${isDark ? 'border-gray-600' : 'border-gray-200'}">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all ${
                selectedTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          {selectedTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Position Size', value: `${calculatedPosition.quantity || 0} units` },
                  { label: 'Risk:Reward', value: safeAnalysisData.riskRewardRatio },
                  { label: 'Portfolio Heat', value: `${safeAnalysisData.portfolioHeat}%` },
                  { label: 'Vol. Impact', value: `${safeAnalysisData.volatilityImpact}%` },
                ].map((metric) => (
                  <div key={metric.label} className={`p-3 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{metric.label}</p>
                    <p className="text-lg font-bold">{metric.value}</p>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="h-48 mb-5">
                <Bar data={positionChartData} options={chartOptions} />
              </div>

              {/* Risk Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <h4 className="text-sm font-medium mb-3">Market Risk</h4>
                  <div className="space-y-2 text-sm">
                    <MetricRow label="Volatility Risk" value={`${(riskMetrics.volatilityRisk * 100).toFixed(1)}%`} isDark={isDark} />
                    <MetricRow label="Liquidity Risk" value={riskMetrics.liquidityRisk} status={riskMetrics.liquidityRisk} isDark={isDark} />
                    <MetricRow label="Position Impact" value={`${(riskMetrics.positionImpact * 100).toFixed(2)}%`} isDark={isDark} />
                    <MetricRow label="Est. Slippage" value={`${riskMetrics.slippageEstimate.toFixed(2)}%`} isDark={isDark} />
                  </div>
                </div>
                <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <h4 className="text-sm font-medium mb-3">Position Risk</h4>
                  <div className="space-y-2 text-sm">
                    <MetricRow label="Correlation Risk" value={safeAnalysisData.correlationRisk} isDark={isDark} />
                    <MetricRow label="Time Frame Risk" value={safeAnalysisData.timeFrameRisk} isDark={isDark} />
                    <MetricRow label="Market Condition" value={marketData.volatility} isDark={isDark} />
                    <MetricRow label="Risk Score" value={`${simulationResults.confidenceScore?.toFixed(1) || 0}%`} 
                      status={simulationResults.confidenceScore > 70 ? 'low' : simulationResults.confidenceScore > 50 ? 'medium' : 'high'} isDark={isDark} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {selectedTab === 'simulation' && (
            <motion.div
              key="simulation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Win Probability', value: `${simulationResults.winProbability}%`, color: 'green' },
                  { label: 'Avg Days', value: `${simulationResults.averageDaysToOutcome} days`, color: 'blue' },
                  { label: 'Confidence', value: `${simulationResults.confidenceScore}%`, color: 'purple' },
                ].map((stat) => (
                  <div key={stat.label} className={`p-4 rounded-xl text-center ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <p className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                    <p className={`text-xl font-bold text-${stat.color}-500`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <h4 className="text-sm font-medium mb-2">Simulation Details</h4>
                <ul className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <li>• Based on {marketData.volatility} market volatility</li>
                  <li>• 1000 Monte Carlo iterations</li>
                  <li>• Maximum 20-day simulation period</li>
                  <li>• Includes market drift and random walk</li>
                </ul>
              </div>
            </motion.div>
          )}

          {selectedTab === 'suggestions' && (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {tradingSuggestions.length > 0 ? tradingSuggestions.map((suggestion, i) => (
                <div key={i} className={`p-4 rounded-xl border-l-4 ${
                  suggestion.type === 'danger' ? 'border-red-500' : 
                  suggestion.type === 'warning' ? 'border-amber-500' : 'border-blue-500'
                } ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <div className="flex items-start gap-2">
                    {suggestion.type === 'danger' ? <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" /> :
                     suggestion.type === 'warning' ? <InformationCircleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" /> :
                     <CheckCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />}
                    <div>
                      <p className="font-medium text-sm">{suggestion.message}</p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{suggestion.action}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className={`p-6 text-center rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <CheckCircleIcon className="w-10 h-10 mx-auto text-green-500 mb-2" />
                  <p className="font-medium">Position looks good!</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No significant risk warnings</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

RiskAnalysis.displayName = 'RiskAnalysis';

/**
 * Metric Row Helper
 */
const MetricRow = memo(({ label, value, status, isDark }) => {
  const statusColors = {
    high: 'text-red-500',
    medium: 'text-amber-500',
    low: 'text-green-500',
  };

  return (
    <div className="flex justify-between">
      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{label}</span>
      <span className={status ? statusColors[status] || '' : ''}>{value}</span>
    </div>
  );
});

MetricRow.displayName = 'MetricRow';

export default RiskAnalysis;

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheckIcon, 
  ScaleIcon, 
  BoltIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

/**
 * Enhanced Suggested Positions with glass-morphism styling
 */
const SuggestedPositions = memo(({ calculatedPosition, analysisData = {}, theme }) => {
  const isDark = theme === 'dark';
  const safeAnalysisData = useMemo(() => analysisData || {}, [analysisData]);

  // Memoize alternative calculations
  const alternatives = useMemo(() => {
    const qty = calculatedPosition.quantity || 0;
    const risk = calculatedPosition.riskAmount || 0;
    const gain = parseFloat(safeAnalysisData.potentialGain) || 0;
    const volImpact = parseFloat(safeAnalysisData.volatilityImpact) || 0;

    return {
      conservative: {
        quantity: Math.floor(qty * 0.75),
        risk: (risk * 0.75).toFixed(2),
        potential: (gain * 0.75).toFixed(2)
      },
      calculated: {
        quantity: qty,
        risk: risk.toFixed(2),
        potential: gain.toFixed(2)
      },
      aggressive: {
        quantity: Math.floor(qty * 1.25),
        risk: (risk * 1.25).toFixed(2),
        potential: (gain * 1.25).toFixed(2)
      },
      scaled: {
        quantity: Math.floor(qty * (1 - volImpact / 100)),
        risk: (risk * (1 - volImpact / 100)).toFixed(2),
        potential: (gain * (1 - volImpact / 100)).toFixed(2)
      }
    };
  }, [calculatedPosition, safeAnalysisData]);

  const positionCards = [
    {
      type: 'conservative',
      label: 'Conservative',
      icon: ShieldCheckIcon,
      color: 'green',
      badge: 'Lower Risk',
      ...alternatives.conservative
    },
    {
      type: 'calculated',
      label: 'Calculated',
      icon: ScaleIcon,
      color: 'blue',
      badge: 'Balanced',
      isMain: true,
      ...alternatives.calculated
    },
    {
      type: 'aggressive',
      label: 'Aggressive',
      icon: BoltIcon,
      color: 'red',
      badge: 'Higher Risk',
      ...alternatives.aggressive
    },
  ];

  return (
    <div className={`rounded-2xl border backdrop-blur-sm ${
      isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200 shadow-lg'
    }`}>
      {/* Header */}
      <div className={`px-5 py-3 border-b flex items-center gap-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <ScaleIcon className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
        <h3 className="font-semibold">Alternative Positions</h3>
      </div>

      {/* Cards Grid */}
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {positionCards.map((card, index) => (
            <motion.div
              key={card.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-4 rounded-xl ${
                card.isMain 
                  ? 'ring-2 ring-blue-500 ' + (isDark ? 'bg-blue-500/10' : 'bg-blue-50')
                  : isDark ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <card.icon className={`w-4 h-4 text-${card.color}-500`} />
                  <span className="font-medium text-sm">{card.label}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  card.color === 'green' ? 'bg-green-500/20 text-green-500' :
                  card.color === 'blue' ? 'bg-blue-500/20 text-blue-500' :
                  'bg-red-500/20 text-red-500'
                }`}>
                  {card.badge}
                </span>
              </div>

              {/* Metrics */}
              <div className="space-y-2">
                <MetricLine label="Quantity" value={card.quantity} isDark={isDark} />
                <MetricLine label="Risk" value={`₹${card.risk}`} isDark={isDark} />
                <MetricLine label="Potential" value={`₹${card.potential}`} isDark={isDark} color="green" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Volatility Adjusted */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`p-4 rounded-xl ${isDark ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-purple-500" />
              <span className="font-medium text-sm">Volatility Adjusted</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-500/20 text-purple-500">
              Market Adapted
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <MetricLine label="Quantity" value={alternatives.scaled.quantity} isDark={isDark} />
            <MetricLine label="Risk" value={`₹${alternatives.scaled.risk}`} isDark={isDark} />
            <MetricLine label="Potential" value={`₹${alternatives.scaled.potential}`} isDark={isDark} color="green" />
          </div>
          <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            * Adjusted for current market volatility of {safeAnalysisData.volatilityImpact || 0}%
          </p>
        </motion.div>
      </div>
    </div>
  );
});

SuggestedPositions.displayName = 'SuggestedPositions';

/**
 * Metric Line Helper
 */
const MetricLine = memo(({ label, value, isDark, color }) => (
  <div className="flex justify-between text-sm">
    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{label}</span>
    <span className={`font-semibold ${color === 'green' ? 'text-green-500' : ''}`}>{value}</span>
  </div>
));

MetricLine.displayName = 'MetricLine';

export default SuggestedPositions;

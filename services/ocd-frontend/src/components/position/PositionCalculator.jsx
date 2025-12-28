import { useState, useCallback, memo } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDownIcon, 
  ChevronUpIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

/**
 * Enhanced Position Calculator with modern styling
 */
const PositionCalculator = memo(({ setCalculatedPosition, setAnalysisData, isCalculating }) => {
  const theme = useSelector((state) => state.theme.theme);
  const isDark = theme === 'dark';
  
  // Basic Position Sizing
  const [accountSize, setAccountSize] = useState('');
  const [riskPercentage, setRiskPercentage] = useState('1');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  
  // Advanced Options
  const [positionType, setPositionType] = useState('long');
  const [leverageUsed, setLeverageUsed] = useState('1');
  const [correlatedPositions, setCorrelatedPositions] = useState('0');
  const [marketVolatility, setMarketVolatility] = useState('medium');
  const [timeFrame, setTimeFrame] = useState('intraday');
  const [portfolioHeatMap, setPortfolioHeatMap] = useState('0');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Input styling
  const inputClass = `w-full px-3 py-2 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 ${
    isDark 
      ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-400' 
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
  }`;

  const labelClass = `block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`;

  const selectClass = `w-full px-3 py-2 rounded-lg border text-sm transition-all cursor-pointer ${
    isDark 
      ? 'bg-gray-700/50 border-gray-600 text-white' 
      : 'bg-gray-50 border-gray-200 text-gray-900'
  }`;

  const calculatePosition = useCallback(() => {
    if (!accountSize || !entryPrice || !stopLoss) {
      return;
    }

    const riskAmount = (parseFloat(accountSize) * parseFloat(riskPercentage)) / 100;
    const stopLossDistance = Math.abs(parseFloat(entryPrice) - parseFloat(stopLoss));
    let positionSize = riskAmount / stopLossDistance;
    
    // Apply leverage
    positionSize *= parseFloat(leverageUsed);
    
    // Adjust for market volatility
    const volatilityMultiplier = {
      low: 1.2,
      medium: 1.0,
      high: 0.8
    }[marketVolatility];
    positionSize *= volatilityMultiplier;

    // Calculate risk metrics
    const potentialLoss = stopLossDistance * positionSize;
    const potentialGain = targetPrice ? 
      Math.abs(parseFloat(targetPrice) - parseFloat(entryPrice)) * positionSize : 0;
    const calculatedRR = potentialLoss > 0 ? potentialGain / potentialLoss : 0;

    // Portfolio heat calculation
    const portfolioHeat = (parseFloat(portfolioHeatMap) + parseFloat(riskPercentage)) / 100;

    const positionData = {
      positionSize: Math.floor(positionSize * parseFloat(entryPrice)),
      quantity: Math.floor(positionSize),
      totalValue: positionSize * parseFloat(entryPrice),
      maxRisk: riskAmount,
      stopLoss: parseFloat(stopLoss),
      targetProfit: potentialGain,
      riskRewardRatio: calculatedRR,
      leveragedValue: positionSize * parseFloat(entryPrice) * parseFloat(leverageUsed),
    };

    const analysisData = {
      riskRewardRatio: calculatedRR.toFixed(2),
      portfolioHeat: portfolioHeat.toFixed(2),
      potentialLoss: potentialLoss.toFixed(2),
      potentialGain: potentialGain.toFixed(2),
      volatilityImpact: ((1 - volatilityMultiplier) * 100).toFixed(1),
      correlationRisk: parseFloat(correlatedPositions) > 30 ? 'High' : 'Moderate',
      timeFrameRisk: timeFrame === 'intraday' ? 'Lower' : 'Higher',
      suggestions: []
    };

    // Generate suggestions
    if (calculatedRR < 2 && calculatedRR > 0) {
      analysisData.suggestions.push('Consider a better entry point for improved R:R ratio');
    }
    if (portfolioHeat > 0.5) {
      analysisData.suggestions.push('High portfolio heat - consider reducing position size');
    }
    if (parseFloat(leverageUsed) > 2) {
      analysisData.suggestions.push('High leverage - monitor position closely');
    }

    setCalculatedPosition(positionData);
    setAnalysisData(analysisData);
  }, [accountSize, riskPercentage, entryPrice, stopLoss, targetPrice, leverageUsed, 
      marketVolatility, correlatedPositions, portfolioHeatMap, timeFrame, 
      setCalculatedPosition, setAnalysisData]);

  const isValid = accountSize && entryPrice && stopLoss;

  return (
    <div className="space-y-4">
      {/* Position Type Toggle */}
      <div className="flex rounded-lg overflow-hidden border ${isDark ? 'border-gray-600' : 'border-gray-200'}">
        <button
          onClick={() => setPositionType('long')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all ${
            positionType === 'long'
              ? 'bg-green-500 text-white'
              : isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          <ArrowTrendingUpIcon className="w-4 h-4" />
          Long
        </button>
        <button
          onClick={() => setPositionType('short')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all ${
            positionType === 'short'
              ? 'bg-red-500 text-white'
              : isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          <ArrowTrendingDownIcon className="w-4 h-4" />
          Short
        </button>
      </div>

      {/* Basic Fields */}
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Account Size (₹)</label>
          <input
            type="number"
            value={accountSize}
            onChange={(e) => setAccountSize(e.target.value)}
            className={inputClass}
            placeholder="e.g. 100000"
          />
        </div>
        
        <div>
          <label className={labelClass}>Risk Per Trade (%)</label>
          <div className="flex gap-2">
            {['0.5', '1', '2', '3'].map((val) => (
              <button
                key={val}
                onClick={() => setRiskPercentage(val)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  riskPercentage === val
                    ? 'bg-blue-500 text-white'
                    : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Entry (₹)</label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className={inputClass}
              placeholder="Entry"
            />
          </div>
          <div>
            <label className={labelClass}>Stop Loss (₹)</label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className={inputClass}
              placeholder="SL"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Target (₹)</label>
          <input
            type="number"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className={inputClass}
            placeholder="Target price (optional)"
          />
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={`w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm font-medium transition-all ${
          isDark ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <span>Advanced Options</span>
        {showAdvanced ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
      </button>

      {/* Advanced Options */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Leverage</label>
                  <input
                    type="number"
                    value={leverageUsed}
                    onChange={(e) => setLeverageUsed(e.target.value)}
                    className={inputClass}
                    placeholder="1x"
                  />
                </div>
                <div>
                  <label className={labelClass}>Volatility</label>
                  <select
                    value={marketVolatility}
                    onChange={(e) => setMarketVolatility(e.target.value)}
                    className={selectClass}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Time Frame</label>
                <div className="flex gap-2">
                  {['intraday', 'swing', 'positional'].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeFrame(tf)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                        timeFrame === tf
                          ? 'bg-blue-500 text-white'
                          : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Correlation %</label>
                  <input
                    type="number"
                    value={correlatedPositions}
                    onChange={(e) => setCorrelatedPositions(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelClass}>Portfolio Heat %</label>
                  <input
                    type="number"
                    value={portfolioHeatMap}
                    onChange={(e) => setPortfolioHeatMap(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calculate Button */}
      <button
        onClick={calculatePosition}
        disabled={!isValid || isCalculating}
        className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-all ${
          isValid && !isCalculating
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25'
            : isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isCalculating ? 'Calculating...' : 'Calculate Position'}
      </button>
    </div>
  );
});

PositionCalculator.displayName = 'PositionCalculator';

export default PositionCalculator;

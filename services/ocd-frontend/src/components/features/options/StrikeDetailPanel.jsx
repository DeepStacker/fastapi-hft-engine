import { memo } from 'react';
import PropTypes from 'prop-types';
import {
  XMarkIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  ChartBarIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';

/**
 * Strike Detail Panel
 * Shows comprehensive data for a selected strike
 */
const StrikeDetailPanel = memo(({ strikeData, onClose }) => {
  if (!strikeData) return null;

  const {
    strike,
    reversal,
    wkly_reversal,
    fut_reversal,
    rs,
    rr: _rr,
    ss,
    sr_diff,
    ce_tv,
    pe_tv,
    pcr,
    price_range,
    trading_signals,
    market_regimes,
    recommended_strategy,
    alert,
    time_decay,
    ce: _ce,
    pe: _pe,
  } = strikeData;

  const regimeColors = {
    low: 'text-green-500 bg-green-100 dark:bg-green-900/30',
    medium: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
    high: 'text-red-500 bg-red-100 dark:bg-red-900/30',
    bullish: 'text-green-500 bg-green-100 dark:bg-green-900/30',
    bearish: 'text-red-500 bg-red-100 dark:bg-red-900/30',
    sideways: 'text-gray-500 bg-gray-100 dark:bg-gray-900/30',
  };

  const alertColors = {
    low: 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800',
    medium: 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20',
    high: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20',
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            Strike {strike}
          </div>
          {recommended_strategy && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              {recommended_strategy}
            </span>
          )}
          {alert && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${alertColors[alert.level]}`}>
              {alert.message}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
        {/* Reversal Levels */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowTrendingUpIcon className="w-5 h-5 text-blue-500" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Reversal Levels</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Daily</span>
              <span className="font-medium text-gray-900 dark:text-white">{reversal?.toFixed(2) || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Weekly</span>
              <span className="font-medium text-gray-900 dark:text-white">{wkly_reversal?.toFixed(2) || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Futures</span>
              <span className="font-medium text-gray-900 dark:text-white">{fut_reversal?.toFixed(2) || '—'}</span>
            </div>
          </div>
        </div>

        {/* Trading Signals */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BoltIcon className="w-5 h-5 text-yellow-500" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Trading Signals</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Entry</span>
              <span className="font-medium text-green-600">{trading_signals?.entry?.toFixed(2) || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Stop Loss</span>
              <span className="font-medium text-red-600">{trading_signals?.stop_loss?.toFixed(2) || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Take Profit</span>
              <span className="font-medium text-green-600">{trading_signals?.take_profit?.toFixed(2) || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Risk:Reward</span>
              <span className="font-medium text-blue-600">1:{trading_signals?.risk_reward || '—'}</span>
            </div>
          </div>
        </div>

        {/* Support/Resistance */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ChartBarIcon className="w-5 h-5 text-purple-500" />
            <h4 className="font-semibold text-gray-900 dark:text-white">S/R Levels</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Resistance</span>
              <span className="font-medium text-red-600">{rs?.toFixed(2) || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Support</span>
              <span className="font-medium text-green-600">{ss?.toFixed(2) || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Range</span>
              <span className="font-medium text-gray-900 dark:text-white">{sr_diff?.toFixed(2) || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">PCR</span>
              <span className="font-medium text-gray-900 dark:text-white">{pcr?.toFixed(3) || '0.00'}</span>
            </div>
          </div>
        </div>

        {/* Market Regime */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BeakerIcon className="w-5 h-5 text-cyan-500" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Market Regime</h4>
          </div>
          <div className="space-y-2">
            {market_regimes && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Volatility</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${regimeColors[market_regimes.volatility]}`}>
                    {market_regimes.volatility?.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Trend</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${regimeColors[market_regimes.trend]}`}>
                    {market_regimes.trend?.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Liquidity</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${regimeColors[market_regimes.liquidity]}`}>
                    {market_regimes.liquidity?.toUpperCase()}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500">Time Decay</span>
              <span className="font-medium text-gray-900 dark:text-white">{time_decay?.toFixed(4) || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Time Value Comparison */}
      <div className="px-4 pb-4">
        <div className="bg-gradient-to-r from-green-50 to-red-50 dark:from-green-900/20 dark:to-red-900/20 rounded-xl p-4 flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-xs text-gray-500 mb-1">CE Time Value</div>
            <div className="text-lg font-bold text-green-600">{ce_tv?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="w-px h-12 bg-gray-300 dark:bg-gray-600" />
          <div className="text-center flex-1">
            <div className="text-xs text-gray-500 mb-1">Price Range</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {price_range?.low?.toFixed(0)} - {price_range?.high?.toFixed(0)}
              <span className="text-xs text-gray-500 ml-1">({(price_range?.confidence * 100)?.toFixed(0)}%)</span>
            </div>
          </div>
          <div className="w-px h-12 bg-gray-300 dark:bg-gray-600" />
          <div className="text-center flex-1">
            <div className="text-xs text-gray-500 mb-1">PE Time Value</div>
            <div className="text-lg font-bold text-red-600">{pe_tv > 0.01 ? pe_tv?.toFixed(2) : '~0.00'}</div>
          </div>
        </div>
      </div>
    </div>
  );
});

StrikeDetailPanel.displayName = 'StrikeDetailPanel';

StrikeDetailPanel.propTypes = {
  strikeData: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

export default StrikeDetailPanel;

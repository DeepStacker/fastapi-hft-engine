import { memo, useState, useRef, useEffect } from 'react';
import { useColumnConfig } from '../../../context/ColumnConfigContext';
import { Cog6ToothIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

/**
 * Trading Presets - Optimized column configurations for different trading perspectives
 */
const TRADING_PRESETS = {
  // Default balanced view - IV/Delta (outer) -> OI Chg -> OI -> Vol -> LTP (near strike)
  default: {
    name: 'Default',
    description: 'IV, Delta, OI Chg, OI, Volume, LTP',
    icon: '⚖️',
    columns: [
      'ce_iv', 'ce_delta', 'ce_oichng', 'ce_oi', 'ce_volume', 'ce_ltp',
      'pe_ltp', 'pe_volume', 'pe_oi', 'pe_oichng', 'pe_delta', 'pe_iv'
    ],
  },

  // For option buyers - focus on premium, IV, and Greeks
  buyer: {
    name: 'Buyer View',
    description: 'Premium, IV, Delta, Theta - What buyers care about',
    icon: '📈',
    columns: [
      'ce_ltp', 'ce_chng', 'ce_iv', 'ce_delta', 'ce_theta', 'ce_volume',
      'pe_volume', 'pe_theta', 'pe_delta', 'pe_iv', 'pe_chng', 'pe_ltp'
    ],
  },

  // For option sellers - focus on OI, premium decay, and margins
  seller: {
    name: 'Seller View',
    description: 'OI, Theta decay, Bid/Ask spread - For option writers',
    icon: '📉',
    columns: [
      'ce_oi', 'ce_oichng', 'ce_buildup', 'ce_ltp', 'ce_theta', 'ce_bid', 'ce_ask',
      'pe_ask', 'pe_bid', 'pe_theta', 'pe_ltp', 'pe_buildup', 'pe_oichng', 'pe_oi'
    ],
  },

  // Bullish market view
  bullish: {
    name: 'Bullish View',
    description: 'Focus on CE buying and PE selling opportunities',
    icon: '🐂',
    columns: [
      'ce_ltp', 'ce_chng', 'ce_iv', 'ce_delta', 'ce_volume', 'ce_oichng',
      'pe_oi', 'pe_oichng', 'pe_buildup', 'pe_theta', 'pe_ltp'
    ],
  },

  // Bearish market view  
  bearish: {
    name: 'Bearish View',
    description: 'Focus on PE buying and CE selling opportunities',
    icon: '🐻',
    columns: [
      'ce_oi', 'ce_oichng', 'ce_buildup', 'ce_theta', 'ce_ltp',
      'pe_ltp', 'pe_chng', 'pe_iv', 'pe_delta', 'pe_volume', 'pe_oichng'
    ],
  },

  // High volatility / Range-bound scalping
  scalper: {
    name: 'Scalper View',
    description: 'Bid/Ask spreads, Volume for quick trades',
    icon: '⚡',
    columns: [
      'ce_ltp', 'ce_chng', 'ce_bid', 'ce_ask', 'ce_volume',
      'pe_volume', 'pe_ask', 'pe_bid', 'pe_chng', 'pe_ltp'
    ],
  },

  // Greeks analysis view
  greeks: {
    name: 'Greeks View',
    description: 'All Greeks for detailed risk analysis',
    icon: '🔬',
    columns: [
      'ce_iv', 'ce_delta', 'ce_gamma', 'ce_theta', 'ce_vega', 'ce_ltp',
      'pe_ltp', 'pe_vega', 'pe_theta', 'pe_gamma', 'pe_delta', 'pe_iv'
    ],
  },

  // OI Analysis for institutional tracking
  oiAnalysis: {
    name: 'OI Analysis',
    description: 'OI changes and buildup patterns for institutional tracking',
    icon: '🏛️',
    columns: [
      'ce_oi', 'ce_oichng', 'ce_buildup', 'ce_volume', 'ce_ltp',
      'pe_ltp', 'pe_volume', 'pe_buildup', 'pe_oichng', 'pe_oi'
    ],
  },

  // Minimal compact view
  compact: {
    name: 'Compact',
    description: 'Just LTP and OI - Minimal view',
    icon: '📊',
    columns: [
      'ce_oi', 'ce_ltp', 'pe_ltp', 'pe_oi'
    ],
  },
};

/**
 * Column Selector Component with Trading Presets
 */
const ColumnSelector = memo(() => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('presets');
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  
  const {
    allColumns,
    categories,
    isColumnVisible,
    toggleColumn,
    setColumnsVisibility,
    resetToDefaults,
  } = useColumnConfig();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Group columns by category
  const columnsByCategory = {};
  Object.values(allColumns).forEach(col => {
    if (!columnsByCategory[col.category]) {
      columnsByCategory[col.category] = [];
    }
    columnsByCategory[col.category].push(col);
  });

  // Apply a preset
  const applyPreset = (presetKey) => {
    const preset = TRADING_PRESETS[presetKey];
    if (!preset) return;

    const updates = {};
    Object.keys(allColumns).forEach(id => {
      updates[id] = preset.columns.includes(id);
    });
    setColumnsVisibility(updates);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-200
          ${isOpen 
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}
        `}
        title="Configure Columns"
      >
        <Cog6ToothIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Columns</span>
      </button>

      {/* Modal - Centered on screen */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" 
          onClick={() => setIsOpen(false)}
        >
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[80vh] overflow-hidden bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between p-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">Table Configuration</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetToDefaults}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                    title="Reset to Defaults"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Tabs */}
              <div className="flex border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('presets')}
                  className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'presets'
                      ? 'border-blue-500 text-blue-600 bg-blue-50/50 dark:bg-blue-900/20'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Trading Presets
                </button>
                <button
                  onClick={() => setActiveTab('custom')}
                  className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'custom'
                      ? 'border-blue-500 text-blue-600 bg-blue-50/50 dark:bg-blue-900/20'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Custom Columns
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh]">
              {activeTab === 'presets' && (
                <div className="p-3 space-y-2">
                  {Object.entries(TRADING_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{preset.icon}</span>
                        <span className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {preset.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                        {preset.description}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'custom' && (
                <div className="p-3 space-y-4">
                  {Object.entries(categories).map(([categoryKey, category]) => (
                    <div key={categoryKey}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${category.color}`} />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {category.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {columnsByCategory[categoryKey]?.map(col => (
                          <label
                            key={col.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                              isColumnVisible(col.id)
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isColumnVisible(col.id)}
                              onChange={() => toggleColumn(col.id)}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <span className="text-xs font-medium">
                              {col.side.toUpperCase()} {col.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

ColumnSelector.displayName = 'ColumnSelector';

export default ColumnSelector;

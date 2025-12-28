/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * Column Configuration Context
 * Manages dynamic column visibility and ordering for Option Chain table
 */

// All available columns with metadata
// Default view: LTP/Chg, Vol, OI, OI Chg, IV, Delta
export const AVAILABLE_COLUMNS = {
  // Call columns (left side) - Order: LTP, Vol, OI, OIChg, IV, Delta, then rest
  ce_ltp: { id: 'ce_ltp', label: 'LTP', side: 'ce', category: 'price', defaultVisible: true, width: 'w-20' },
  ce_chng: { id: 'ce_chng', label: 'Chg', side: 'ce', category: 'price', defaultVisible: false, width: 'w-16' }, // Hidden since LTP shows change
  ce_volume: { id: 'ce_volume', label: 'Volume', side: 'ce', category: 'volume', defaultVisible: true, width: 'w-20' },
  ce_oi: { id: 'ce_oi', label: 'OI', side: 'ce', category: 'oi', defaultVisible: true, width: 'w-24' },
  ce_oichng: { id: 'ce_oichng', label: 'OI Chg', side: 'ce', category: 'oi', defaultVisible: true, width: 'w-20' },
  ce_iv: { id: 'ce_iv', label: 'IV', side: 'ce', category: 'greeks', defaultVisible: true, width: 'w-16' },
  ce_delta: { id: 'ce_delta', label: 'Delta', side: 'ce', category: 'greeks', defaultVisible: true, width: 'w-16' },
  ce_gamma: { id: 'ce_gamma', label: 'Gamma', side: 'ce', category: 'greeks', defaultVisible: false, width: 'w-16' },
  ce_theta: { id: 'ce_theta', label: 'Theta', side: 'ce', category: 'greeks', defaultVisible: false, width: 'w-16' },
  ce_vega: { id: 'ce_vega', label: 'Vega', side: 'ce', category: 'greeks', defaultVisible: false, width: 'w-16' },
  ce_buildup: { id: 'ce_buildup', label: 'Buildup', side: 'ce', category: 'analysis', defaultVisible: false, width: 'w-16' },
  ce_bid: { id: 'ce_bid', label: 'Bid', side: 'ce', category: 'depth', defaultVisible: false, width: 'w-16' },
  ce_ask: { id: 'ce_ask', label: 'Ask', side: 'ce', category: 'depth', defaultVisible: false, width: 'w-16' },
  ce_pcr: { id: 'ce_pcr', label: 'PCR', side: 'ce', category: 'analysis', defaultVisible: false, width: 'w-16' },
  
  // Put columns (right side) - mirror of CE
  pe_ltp: { id: 'pe_ltp', label: 'LTP', side: 'pe', category: 'price', defaultVisible: true, width: 'w-20' },
  pe_chng: { id: 'pe_chng', label: 'Chg', side: 'pe', category: 'price', defaultVisible: false, width: 'w-16' },
  pe_volume: { id: 'pe_volume', label: 'Volume', side: 'pe', category: 'volume', defaultVisible: true, width: 'w-20' },
  pe_oi: { id: 'pe_oi', label: 'OI', side: 'pe', category: 'oi', defaultVisible: true, width: 'w-24' },
  pe_oichng: { id: 'pe_oichng', label: 'OI Chg', side: 'pe', category: 'oi', defaultVisible: true, width: 'w-20' },
  pe_iv: { id: 'pe_iv', label: 'IV', side: 'pe', category: 'greeks', defaultVisible: true, width: 'w-16' },
  pe_delta: { id: 'pe_delta', label: 'Delta', side: 'pe', category: 'greeks', defaultVisible: true, width: 'w-16' },
  pe_gamma: { id: 'pe_gamma', label: 'Gamma', side: 'pe', category: 'greeks', defaultVisible: false, width: 'w-16' },
  pe_theta: { id: 'pe_theta', label: 'Theta', side: 'pe', category: 'greeks', defaultVisible: false, width: 'w-16' },
  pe_vega: { id: 'pe_vega', label: 'Vega', side: 'pe', category: 'greeks', defaultVisible: false, width: 'w-16' },
  pe_buildup: { id: 'pe_buildup', label: 'Buildup', side: 'pe', category: 'analysis', defaultVisible: false, width: 'w-16' },
  pe_bid: { id: 'pe_bid', label: 'Bid', side: 'pe', category: 'depth', defaultVisible: false, width: 'w-16' },
  pe_ask: { id: 'pe_ask', label: 'Ask', side: 'pe', category: 'depth', defaultVisible: false, width: 'w-16' },
  pe_pcr: { id: 'pe_pcr', label: 'PCR', side: 'pe', category: 'analysis', defaultVisible: false, width: 'w-16' },
  
  // Strike-level data
  strike_reversal: { id: 'strike_reversal', label: 'Reversal', side: 'strike', category: 'signals', defaultVisible: false, width: 'w-20' },
  strike_signals: { id: 'strike_signals', label: 'Signals', side: 'strike', category: 'signals', defaultVisible: false, width: 'w-24' },
};

// Column categories for grouping in selector
export const COLUMN_CATEGORIES = {
  oi: { label: 'Open Interest', color: 'bg-blue-500' },
  volume: { label: 'Volume', color: 'bg-purple-500' },
  price: { label: 'Price', color: 'bg-green-500' },
  greeks: { label: 'Greeks', color: 'bg-orange-500' },
  depth: { label: 'Market Depth', color: 'bg-cyan-500' },
  analysis: { label: 'Analysis', color: 'bg-pink-500' },
  signals: { label: 'Signals', color: 'bg-yellow-500' },
};

const STORAGE_KEY = 'option_chain_columns';

// Default column order: IV, Delta (outer) -> OI Chg -> OI -> Vol -> LTP (near strike)
const DEFAULT_CE_ORDER = ['ce_iv', 'ce_delta', 'ce_oichng', 'ce_oi', 'ce_volume', 'ce_ltp'];
const DEFAULT_PE_ORDER = ['pe_ltp', 'pe_volume', 'pe_oi', 'pe_oichng', 'pe_delta', 'pe_iv'];

const ColumnConfigContext = createContext(null);

export function ColumnConfigProvider({ children }) {
  // Load saved preferences or use defaults
  const [columnConfig, setColumnConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load column config:', e);
    }
    
    // Default visibility based on column definitions
    const defaultVisibility = {};
    Object.values(AVAILABLE_COLUMNS).forEach(col => {
      defaultVisibility[col.id] = col.defaultVisible;
    });
    
    return {
      visibility: defaultVisibility,
      ceOrder: DEFAULT_CE_ORDER,
      peOrder: DEFAULT_PE_ORDER,
    };
  });

  // Toggle column visibility
  const toggleColumn = useCallback((columnId) => {
    setColumnConfig(prev => {
      const newConfig = {
        ...prev,
        visibility: {
          ...prev.visibility,
          [columnId]: !prev.visibility[columnId],
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      return newConfig;
    });
  }, []);

  // Set multiple columns visibility at once
  const setColumnsVisibility = useCallback((updates) => {
    setColumnConfig(prev => {
      const newConfig = {
        ...prev,
        visibility: {
          ...prev.visibility,
          ...updates,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      return newConfig;
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const defaultVisibility = {};
    Object.values(AVAILABLE_COLUMNS).forEach(col => {
      defaultVisibility[col.id] = col.defaultVisible;
    });
    
    const newConfig = {
      visibility: defaultVisibility,
      ceOrder: DEFAULT_CE_ORDER,
      peOrder: DEFAULT_PE_ORDER,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    setColumnConfig(newConfig);
  }, []);

  // Get visible columns for a side
  const getVisibleColumns = useCallback((side) => {
    const order = side === 'ce' ? columnConfig.ceOrder : columnConfig.peOrder;
    return order
      .filter(id => columnConfig.visibility[id])
      .map(id => AVAILABLE_COLUMNS[id])
      .filter(Boolean);
  }, [columnConfig]);

  // Check if a column is visible
  const isColumnVisible = useCallback((columnId) => {
    return columnConfig.visibility[columnId] ?? false;
  }, [columnConfig.visibility]);

  const value = useMemo(() => ({
    columnConfig,
    toggleColumn,
    setColumnsVisibility,
    resetToDefaults,
    getVisibleColumns,
    isColumnVisible,
    allColumns: AVAILABLE_COLUMNS,
    categories: COLUMN_CATEGORIES,
  }), [columnConfig, toggleColumn, setColumnsVisibility, resetToDefaults, getVisibleColumns, isColumnVisible]);

  return (
    <ColumnConfigContext.Provider value={value}>
      {children}
    </ColumnConfigContext.Provider>
  );
}

export function useColumnConfig() {
  const context = useContext(ColumnConfigContext);
  if (!context) {
    throw new Error('useColumnConfig must be used within ColumnConfigProvider');
  }
  return context;
}

export default ColumnConfigContext;

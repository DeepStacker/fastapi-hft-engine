/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * Table Settings Context
 * Manages table-level settings like sort order, ITM highlighting, compact mode
 */

const STORAGE_KEY = 'option_chain_table_settings';

const DEFAULT_SETTINGS = {
  sortOrder: 'desc', // 'asc' or 'desc' - strikes order
  highlightITM: true, // Highlight in-the-money options
  compactMode: true, // Compact row height - enabled by default for smaller rows
  showStrikePanel: false, // Show strike detail panel
  selectedStrike: null, // Currently selected strike for panel
  strikesPerPage: 21, // Number of strikes to show (10 OTM each side + ATM)
};

const TableSettingsContext = createContext(null);

export function TableSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load table settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Update a single setting
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // Toggle sort order
  const toggleSortOrder = useCallback(() => {
    setSettings(prev => {
      const newOrder = prev.sortOrder === 'asc' ? 'desc' : 'asc';
      const newSettings = { ...prev, sortOrder: newOrder };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // Toggle ITM highlighting
  const toggleITMHighlight = useCallback(() => {
    setSettings(prev => {
      const newSettings = { ...prev, highlightITM: !prev.highlightITM };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // Toggle compact mode
  const toggleCompactMode = useCallback(() => {
    setSettings(prev => {
      const newSettings = { ...prev, compactMode: !prev.compactMode };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // Select strike for detail panel
  const selectStrike = useCallback((strike) => {
    setSettings(prev => {
      const newSettings = { 
        ...prev, 
        selectedStrike: strike,
        showStrikePanel: strike !== null 
      };
      return newSettings;
    });
  }, []);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(() => ({
    settings,
    updateSetting,
    toggleSortOrder,
    toggleITMHighlight,
    toggleCompactMode,
    selectStrike,
    resetSettings,
  }), [settings, updateSetting, toggleSortOrder, toggleITMHighlight, toggleCompactMode, selectStrike, resetSettings]);

  return (
    <TableSettingsContext.Provider value={value}>
      {children}
    </TableSettingsContext.Provider>
  );
}

export function useTableSettings() {
  const context = useContext(TableSettingsContext);
  if (!context) {
    throw new Error('useTableSettings must be used within TableSettingsProvider');
  }
  return context;
}

export default TableSettingsContext;

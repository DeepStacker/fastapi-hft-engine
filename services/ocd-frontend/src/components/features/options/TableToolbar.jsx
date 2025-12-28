import { memo } from 'react';
import { useTableSettings } from '../../../context/TableSettingsContext';
import {
  ArrowsUpDownIcon,
  SunIcon,
  ViewColumnsIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

/**
 * Table Toolbar - Controls for table display settings
 */
const TableToolbar = memo(() => {
  const {
    settings,
    toggleSortOrder,
    toggleITMHighlight,
    toggleCompactMode,
  } = useTableSettings();

  const buttonClass = (active) => `
    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
    transition-all duration-200 border
    ${active
      ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700'
      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700'
    }
  `;

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Sort Order Toggle */}
      <button
        onClick={toggleSortOrder}
        className={buttonClass(false)}
        title={`Sort strikes ${settings.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
      >
        {settings.sortOrder === 'asc' ? (
          <>
            <ChevronUpIcon className="w-4 h-4" />
            <span>Ascending</span>
          </>
        ) : (
          <>
            <ChevronDownIcon className="w-4 h-4" />
            <span>Descending</span>
          </>
        )}
      </button>

      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

      {/* ITM Highlight Toggle */}
      <button
        onClick={toggleITMHighlight}
        className={buttonClass(settings.highlightITM)}
        title="Toggle ITM highlighting"
      >
        <SunIcon className="w-4 h-4" />
        <span>ITM Highlight</span>
      </button>

      {/* Compact Mode Toggle */}
      <button
        onClick={toggleCompactMode}
        className={buttonClass(settings.compactMode)}
        title="Toggle compact mode"
      >
        <ViewColumnsIcon className="w-4 h-4" />
        <span>Compact</span>
      </button>

      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

      {/* Info */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 ml-auto">
        <ArrowsUpDownIcon className="w-4 h-4" />
        <span>Click any cell for details</span>
      </div>
    </div>
  );
});

TableToolbar.displayName = 'TableToolbar';

export default TableToolbar;

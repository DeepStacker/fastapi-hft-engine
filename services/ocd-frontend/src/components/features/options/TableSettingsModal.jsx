import { memo, useState, Fragment } from 'react';
import { Dialog, Transition, Switch, Tab } from '@headlessui/react';
import { useTableSettings } from '../../../context/TableSettingsContext';
import { useColumnConfig } from '../../../context/ColumnConfigContext';
import {
  Cog6ToothIcon,
  XMarkIcon,
  ViewColumnsIcon,
  ArrowsUpDownIcon,
  SunIcon,
  TableCellsIcon,
  AdjustmentsHorizontalIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

// Column Groups for organized display
const COLUMN_GROUPS = {
  price: {
    label: 'Price Data',
    columns: ['ltp', 'chng', 'bid', 'ask'],
  },
  oi: {
    label: 'Open Interest',
    columns: ['oi', 'oichng', 'buildup'],
  },
  greeks: {
    label: 'Greeks',
    columns: ['iv', 'delta', 'gamma', 'theta', 'vega'],
  },
  volume: {
    label: 'Volume',
    columns: ['volume'],
  },
};

// Column Labels
const COLUMN_LABELS = {
  ltp: 'LTP',
  chng: 'Change',
  bid: 'Bid',
  ask: 'Ask',
  oi: 'OI',
  oichng: 'OI Chg',
  buildup: 'Buildup',
  iv: 'IV',
  delta: 'Delta',
  gamma: 'Gamma',
  theta: 'Theta',
  vega: 'Vega',
  volume: 'Volume',
};

// Presets
const PRESETS = {
  default: { name: 'Default', icon: '⚖️', desc: 'Balanced view' },
  buyer: { name: 'Buyer', icon: '📈', desc: 'Premium & Greeks' },
  seller: { name: 'Seller', icon: '📉', desc: 'OI & Theta' },
  scalper: { name: 'Scalper', icon: '⚡', desc: 'Quick trades' },
  greeks: { name: 'Greeks', icon: '🔬', desc: 'All Greeks' },
};

/**
 * Toggle Switch Component
 */
const SettingToggle = memo(({ label, description, enabled, onChange, icon: Icon }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <div className="flex items-center gap-3">
      {Icon && <Icon className="w-5 h-5 text-gray-400" />}
      <div>
        <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
        {description && (
          <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
        )}
      </div>
    </div>
    <Switch
      checked={enabled}
      onChange={onChange}
      className={`${enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
    >
      <span
        className={`${enabled ? 'translate-x-6' : 'translate-x-1'}
          inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
      />
    </Switch>
  </div>
));

SettingToggle.displayName = 'SettingToggle';

/**
 * Number Input Component
 */
const NumberSetting = memo(({ label, value, onChange, min, max, step = 1 }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
      >
        -
      </button>
      <span className="w-12 text-center font-medium">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
      >
        +
      </button>
    </div>
  </div>
));

NumberSetting.displayName = 'NumberSetting';

/**
 * Table Settings Modal
 */
const TableSettingsModal = memo(({ isOpen, onClose }) => {
  const {
    settings,
    toggleSortOrder,
    toggleITMHighlight,
    toggleCompactMode,
    setStrikesPerPage,
  } = useTableSettings();

  const { visibleColumns: _visibleColumns, toggleColumn, applyPreset, isColumnVisible } = useColumnConfig();

  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { name: 'Display', icon: AdjustmentsHorizontalIcon },
    { name: 'Columns', icon: ViewColumnsIcon },
    { name: 'Presets', icon: TableCellsIcon },
  ];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Cog6ToothIcon className="w-5 h-5" />
                    Table Settings
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Tabs */}
                <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
                  <Tab.List className="flex border-b border-gray-200 dark:border-gray-700">
                    {tabs.map((tab) => (
                      <Tab
                        key={tab.name}
                        className={({ selected }) =>
                          `flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors outline-none
                          ${selected
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                          }`
                        }
                      >
                        <tab.icon className="w-4 h-4" />
                        {tab.name}
                      </Tab>
                    ))}
                  </Tab.List>

                  <Tab.Panels className="p-4">
                    {/* Display Settings */}
                    <Tab.Panel>
                      <div className="space-y-1">
                        <SettingToggle
                          label="Compact Mode"
                          description="Reduce row height for more data"
                          enabled={settings.compactMode}
                          onChange={toggleCompactMode}
                          icon={ViewColumnsIcon}
                        />
                        <SettingToggle
                          label="ITM Highlight"
                          description="Highlight in-the-money strikes"
                          enabled={settings.highlightITM}
                          onChange={toggleITMHighlight}
                          icon={SunIcon}
                        />
                        <SettingToggle
                          label="Descending Order"
                          description="Show higher strikes first"
                          enabled={settings.sortOrder === 'desc'}
                          onChange={toggleSortOrder}
                          icon={ArrowsUpDownIcon}
                        />
                        <NumberSetting
                          label="Visible Strikes"
                          value={settings.strikesPerPage}
                          onChange={setStrikesPerPage}
                          min={11}
                          max={51}
                          step={2}
                        />
                      </div>
                    </Tab.Panel>

                    {/* Column Settings */}
                    <Tab.Panel>
                      <div className="space-y-4 max-h-80 overflow-y-auto">
                        {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => (
                          <div key={groupKey}>
                            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                              {group.label}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {group.columns.map((col) => {
                                const ceKey = `ce_${col}`;
                                const peKey = `pe_${col}`;
                                const ceVisible = isColumnVisible(ceKey);
                                const peVisible = isColumnVisible(peKey);
                                const bothVisible = ceVisible && peVisible;

                                return (
                                  <button
                                    key={col}
                                    onClick={() => {
                                      toggleColumn(ceKey);
                                      toggleColumn(peKey);
                                    }}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                                      bothVisible
                                        ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                                        : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                                    }`}
                                  >
                                    <span className="text-sm">{COLUMN_LABELS[col]}</span>
                                    {bothVisible && <CheckIcon className="w-4 h-4" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Tab.Panel>

                    {/* Presets */}
                    <Tab.Panel>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(PRESETS).map(([key, preset]) => (
                          <button
                            key={key}
                            onClick={() => {
                              applyPreset(key);
                              onClose();
                            }}
                            className="flex flex-col items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group"
                          >
                            <span className="text-2xl mb-2">{preset.icon}</span>
                            <span className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600">
                              {preset.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {preset.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab.Group>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
});

TableSettingsModal.displayName = 'TableSettingsModal';

/**
 * Settings Button - Opens the settings modal
 */
export const SettingsButton = memo(() => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700"
        title="Table Settings"
      >
        <Cog6ToothIcon className="w-4 h-4" />
      </button>
      <TableSettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
});

SettingsButton.displayName = 'SettingsButton';

export default TableSettingsModal;

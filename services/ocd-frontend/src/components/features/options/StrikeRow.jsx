import { memo, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { BUILDUP_TYPES } from '../../../constants';
import { useColumnConfig } from '../../../context/ColumnConfigContext';
import { useTableSettings } from '../../../context/TableSettingsContext';
import { XMarkIcon, ChartBarIcon } from '@heroicons/react/24/outline';

/**
 * Format number as K/M/B/T
 */
const formatNumber = (num) => {
  if (num === null || num === undefined) return '—';
  if (num === 0) return '0';

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1e12) return sign + (absNum / 1e12).toFixed(2) + 'T';
  if (absNum >= 1e9) return sign + (absNum / 1e9).toFixed(2) + 'B';
  if (absNum >= 1e6) return sign + (absNum / 1e6).toFixed(2) + 'M';
  if (absNum >= 1e3) return sign + (absNum / 1e3).toFixed(1) + 'K';
  return sign + absNum.toFixed(0);
};

/**
 * Greeks Tooltip - Shows all 12 Greeks on hover
 */
const GreeksTooltip = memo(({ optgeeks, isVisible, position }) => {
  if (!isVisible || !optgeeks) return null;

  const greekItems = [
    { key: 'delta', label: 'Δ Delta', color: 'text-blue-500' },
    { key: 'gamma', label: 'Γ Gamma', color: 'text-green-500' },
    { key: 'theta', label: 'Θ Theta', color: 'text-red-500' },
    { key: 'vega', label: 'ν Vega', color: 'text-purple-500' },
    { key: 'rho', label: 'ρ Rho', color: 'text-cyan-500' },
    { key: 'vanna', label: 'Vanna', color: 'text-orange-400' },
    { key: 'vomma', label: 'Vomma', color: 'text-pink-500' },
    { key: 'charm', label: 'Charm', color: 'text-yellow-500' },
    { key: 'speed', label: 'Speed', color: 'text-indigo-500' },
    { key: 'zomma', label: 'Zomma', color: 'text-lime-500' },
    { key: 'color', label: 'Color', color: 'text-amber-500' },
    { key: 'ultima', label: 'Ultima', color: 'text-rose-500' },
  ];

  return (
    <div
      className={`
        absolute z-50 bg-gray-900/95 dark:bg-gray-800/95 text-white
        rounded-lg shadow-2xl p-3 min-w-[220px]
        border border-gray-700
        ${position === 'left' ? 'right-full mr-2' : 'left-full ml-2'}
      `}
      style={{ top: '50%', transform: 'translateY(-50%)' }}
    >
      <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
        Option Greeks
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {greekItems.map(({ key, label, color }) => (
          <div key={key} className="flex justify-between items-center text-xs">
            <span className={`${color} font-medium`}>{label}</span>
            <span className="text-gray-300 font-mono">
              {optgeeks[key]?.toFixed(4) ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

GreeksTooltip.displayName = 'GreeksTooltip';

/**
 * Strike Detail Popup - Shows support/resistance from reversal at strike level
 */
const StrikeDetailPopup = memo(({ data, strike, spotPrice, onClose }) => {
  if (!data) return null;

  const ce = data.ce || {};
  const pe = data.pe || {};

  const ce_oi = ce.OI || ce.oi || 0;
  const pe_oi = pe.OI || pe.oi || 0;
  const ce_oi_chng = ce.oichng || 0;
  const pe_oi_chng = pe.oichng || 0;

  // PCR calculations
  const pcr_oi = ce_oi > 0 ? (pe_oi / ce_oi) : 0;
  const pcr_oi_chng = ce_oi_chng !== 0 ? (pe_oi_chng / ce_oi_chng) : 0;

  // Reversal at strike level - resistance above spot, support below
  const reversal = data.reversal || 0;
  const wklyReversal = data.wkly_reversal || 0;
  const futReversal = data.fut_reversal || 0;
  const isAboveSpot = strike > (spotPrice || 0);
  const strikePCR = data.pcr || pcr_oi;

  // Trading signals
  const signals = data.trading_signals || {};
  const _priceRange = data.price_range || {};
  const _regime = data.market_regimes || {};

  const getPCRColor = (pcrValue) => {
    if (pcrValue > 1.5) return 'text-green-600 bg-green-50 dark:bg-green-900/30';
    if (pcrValue > 1.0) return 'text-green-500 bg-green-50/50 dark:bg-green-900/20';
    if (pcrValue > 0.7) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30';
    return 'text-red-600 bg-red-50 dark:bg-red-900/30';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold">Strike {strike}</h3>
            <span className={`text-sm ${isAboveSpot ? 'text-red-500' : 'text-green-500'}`}>
              {isAboveSpot ? '↑ Above Spot (Resistance Zone)' : '↓ Below Spot (Support Zone)'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Reversal - Support/Resistance - COPYABLE */}
        <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-700 dark:text-purple-300">
                {isAboveSpot ? 'Resistance Level' : 'Support Level'}
              </span>
            </div>
            {reversal && (
              <button
                onClick={() => navigator.clipboard.writeText(reversal.toFixed(2))}
                className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 rounded hover:bg-purple-200 dark:hover:bg-purple-700"
                title="Copy to clipboard"
              >
                📋 Copy
              </button>
            )}
          </div>
          <div
            className="text-3xl font-bold text-purple-800 dark:text-purple-200 mb-2 cursor-pointer select-all"
            onClick={() => reversal && navigator.clipboard.writeText(reversal.toFixed(2))}
            title="Click to copy"
          >
            {reversal ? reversal.toFixed(2) : 'N/A'}
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/50 p-1 rounded" onClick={() => wklyReversal && navigator.clipboard.writeText(wklyReversal.toFixed(2))}>
              <span className="text-gray-500 text-xs">Weekly:</span>
              <span className="ml-1 font-medium select-all">{wklyReversal ? wklyReversal.toFixed(2) : '—'}</span>
            </div>
            <div className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/50 p-1 rounded" onClick={() => futReversal && navigator.clipboard.writeText(futReversal.toFixed(2))}>
              <span className="text-gray-500 text-xs">Futures:</span>
              <span className="ml-1 font-medium select-all">{futReversal ? futReversal.toFixed(2) : '—'}</span>
            </div>
            <div className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/50 p-1 rounded" onClick={() => strikePCR && navigator.clipboard.writeText(strikePCR.toFixed(2))}>
              <span className="text-gray-500 text-xs">PCR:</span>
              <span className="ml-1 font-medium select-all">{strikePCR ? strikePCR.toFixed(2) : '—'}</span>
            </div>
          </div>
        </div>

        {/* Dual PCR - OI and OI Change */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className={`p-4 rounded-xl ${getPCRColor(pcr_oi)}`}>
            <div className="text-xs text-gray-500 mb-1">OI PCR (PE/CE)</div>
            <div className="text-2xl font-bold">{pcr_oi.toFixed(2)}</div>
            <div className="text-xs mt-1">
              {pcr_oi > 1 ? '🟢 Bullish' : '🔴 Bearish'}
            </div>
          </div>
          <div className={`p-4 rounded-xl ${getPCRColor(Math.abs(pcr_oi_chng))}`}>
            <div className="text-xs text-gray-500 mb-1">OI Chng PCR</div>
            <div className="text-2xl font-bold">{pcr_oi_chng.toFixed(2)}</div>
            <div className="text-xs mt-1">
              {pcr_oi_chng > 1 ? '📈 Put Activity' : '📉 Call Activity'}
            </div>
          </div>
        </div>

        {/* OI Details */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <div className="text-xs text-green-600 mb-1">Call OI</div>
            <div className="text-xl font-bold text-green-700">{formatNumber(ce_oi)}</div>
            <div className={`text-sm ${ce_oi_chng >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {ce_oi_chng >= 0 ? '+' : ''}{formatNumber(ce_oi_chng)}
            </div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <div className="text-xs text-red-600 mb-1">Put OI</div>
            <div className="text-xl font-bold text-red-700">{formatNumber(pe_oi)}</div>
            <div className={`text-sm ${pe_oi_chng >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {pe_oi_chng >= 0 ? '+' : ''}{formatNumber(pe_oi_chng)}
            </div>
          </div>
        </div>

        {/* Price Details */}
        <div className="space-y-2 text-sm border-t pt-4 border-gray-200 dark:border-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-500">CE LTP</span>
            <span className="font-medium">
              ₹{ce.ltp?.toFixed(2) || '—'}
              <span className={`ml-1 text-xs ${ce.p_chng >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ({ce.p_chng >= 0 ? '+' : ''}{ce.p_chng?.toFixed(2) || 0})
              </span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">PE LTP</span>
            <span className="font-medium">
              ₹{pe.ltp?.toFixed(2) || '—'}
              <span className={`ml-1 text-xs ${pe.p_chng >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ({pe.p_chng >= 0 ? '+' : ''}{pe.p_chng?.toFixed(2) || 0})
              </span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">CE IV / PE IV</span>
            <span className="font-medium">{ce.iv?.toFixed(1) || '—'}% / {pe.iv?.toFixed(1) || '—'}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Straddle</span>
            <span className="font-bold text-purple-600">₹{((ce.ltp || 0) + (pe.ltp || 0)).toFixed(2)}</span>
          </div>
        </div>

        {/* Trading Signals if available */}
        {signals.entry && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <div className="text-xs text-blue-600 font-medium mb-2">Trading Signals</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-gray-500">Entry:</span> <span className="font-bold">{signals.entry?.toFixed(2)}</span></div>
              <div><span className="text-gray-500">SL:</span> <span className="font-bold text-red-600">{signals.stop_loss?.toFixed(2)}</span></div>
              <div><span className="text-gray-500">TP:</span> <span className="font-bold text-green-600">{signals.take_profit?.toFixed(2)}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

StrikeDetailPopup.displayName = 'StrikeDetailPopup';

/**
 * Clickable Cell - Universal clickable cell wrapper
 */
const ClickableCell = memo(({ children, onClick, className = '' }) => (
  <div
    onClick={onClick}
    className={`
      cursor-pointer transition-all duration-150
      hover:bg-blue-100 dark:hover:bg-blue-900/40
      hover:ring-1 hover:ring-blue-300 dark:hover:ring-blue-700
      rounded px-1 -mx-1
      ${className}
    `}
  >
    {children}
  </div>
));

ClickableCell.displayName = 'ClickableCell';

/**
 * Buildup Indicator
 */
const BuildupIndicator = memo(({ type }) => {
  const buildup = BUILDUP_TYPES[type] || BUILDUP_TYPES.NT;

  const colors = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <span
      className={`px-1.5 py-0.5 text-[11px] rounded font-medium ${colors[buildup.color]}`}
      title={`${buildup.name}: ${buildup.description || ''}`}
    >
      {type}
    </span>
  );
});

BuildupIndicator.displayName = 'BuildupIndicator';

/**
 * PCR Display - Shows OI PCR, OI Change PCR, and Volume PCR
 * PCR (Put/Call Ratio) - Buyer View styling
 */
const PCRDisplay = memo(({ oiPcr, oiChngPcr, volPcr, compact = false }) => {
  // Only OI Change gets color
  const getPCRColor = (value) => {
    if (!value || value === 0) return 'text-gray-400 bg-gray-100 dark:bg-gray-700';
    if (value > 1.2) return 'text-green-700 bg-green-100 dark:bg-green-900/50 dark:text-green-300';
    if (value > 0.8) return 'text-amber-700 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300';
    return 'text-red-700 bg-red-100 dark:bg-red-900/50 dark:text-red-300';
  };

  const textSize = compact ? 'text-[8px]' : 'text-[10px]';
  const padding = compact ? 'px-0.5' : '';

  return (
    <div className={`flex items-center gap-0.5 ${textSize}`}>
      {/* OI PCR - Simple text (no color) */}
      <span className={`rounded font-medium ${padding} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`} title="OI PCR (PE/CE)">
        {oiPcr > 0 ? oiPcr.toFixed(1) : '—'}
      </span>
      {/* OI Change PCR - Colored */}
      <span className={`rounded font-medium ${padding} ${getPCRColor(Math.abs(oiChngPcr))}`} title="OI Change PCR">
        Δ{oiChngPcr !== 0 ? Math.abs(oiChngPcr).toFixed(1) : '—'}
      </span>
      {/* Volume PCR - Simple text (no color) */}
      <span className={`rounded font-medium ${padding} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`} title="Volume PCR (PE/CE)">
        V{volPcr > 0 ? volPcr.toFixed(1) : '—'}
      </span>
    </div>
  );
});

PCRDisplay.displayName = 'PCRDisplay';

/**
 * Strike Row Component - Dynamic columns, all cells clickable
 * Enhanced with K/M/B formatting, dual PCR, larger font, combined LTP cell
 */
const StrikeRow = memo(({ data, strike, atmStrike, spotPrice, onCellClick, onStrikeSelect: _onStrikeSelect, onStrikeClick, highlightData }) => {
  const { isColumnVisible } = useColumnConfig();
  const { settings } = useTableSettings();

  // Helper to get highlight background class
  const getHighlight = (key) => highlightData?.[key]?.color || '';
  // Helper to get percentage value
  const getPct = (key) => highlightData?.[key]?.pct || 0;

  const ce = useMemo(() => data.ce || {}, [data.ce]);
  const pe = useMemo(() => data.pe || {}, [data.pe]);
  const [hoveredGreeks, setHoveredGreeks] = useState(null);
  const [showStrikePopup, setShowStrikePopup] = useState(false);

  // ATM Calculation: Strict equality (with epsilon for floats) to highlight ONLY the exact ATM strike
  const isATM = Math.abs(strike - atmStrike) < 0.01;
  const isITM_CE = ce.mness === 'I';
  const isITM_PE = pe.mness === 'I';
  const showITM = settings.highlightITM;
  const isCompact = settings.compactMode;

  // Calculate strike PCR (OI, OI Change, and Volume)
  const ce_oi = ce.OI || ce.oi || 0;
  const pe_oi = pe.OI || pe.oi || 0;
  const ce_oi_chng = ce.oichng || 0;
  const pe_oi_chng = pe.oichng || 0;
  const ce_vol = ce.volume || 0;
  const pe_vol = pe.volume || 0;

  const oiPcr = ce_oi > 0 ? pe_oi / ce_oi : 0;
  const oiChngPcr = ce_oi_chng !== 0 ? pe_oi_chng / ce_oi_chng : 0;
  const volPcr = ce_vol > 0 ? pe_vol / ce_vol : 0; // Reverted to PCR (PE/CE)

  const handleCellClick = useCallback((side, field, value) => {
    if (onCellClick) {
      onCellClick({
        strike,
        side,
        field,
        value,
        symbol: side === 'ce' ? ce.sym : pe.sym,
        sid: side === 'ce' ? ce.sid : pe.sid,
        fullData: data,
      });
    }
  }, [strike, ce.sym, ce.sid, pe.sym, pe.sid, onCellClick, data]);

  const handleStrikeClick = useCallback(() => {
    // Trigger Strike Analysis Modal with full strike data
    if (onStrikeClick) {
      onStrikeClick({ strike, ce, pe, ...data });
    } else {
      setShowStrikePopup(true);
    }
  }, [onStrikeClick, strike, ce, pe, data]);

  // Compact padding for smaller row height - but keep readable font
  const cellPadding = isCompact ? 'py-1 px-1.5' : 'p-2';
  const fontSize = 'text-sm'; // Always readable font size
  // ITM background - subtle tint
  const itmBg = (isITM) => showITM && isITM ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : '';
  // Cell class builder - highlight takes priority over ITM
  const cellClass = (isITM, highlight = '') => {
    const bgClass = highlight || itmBg(isITM); // Percentage highlight overrides ITM
    return `${cellPadding} ${fontSize} text-center border-r border-gray-100 dark:border-gray-800 ${bgClass}`;
  };

  return (
    <>
      <tr
        className={`
          border-b border-gray-100 dark:border-gray-800
          hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors
          ${isATM
            ? 'bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 dark:from-yellow-900/30 dark:via-amber-900/20 dark:to-yellow-900/30 ring-2 ring-yellow-400 dark:ring-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] relative z-10'
            : ''
          }
        `}
      >
        {/* ============ CALLS (Left) - Order: IV/Delta (outer) -> OI Chg -> OI -> Vol -> LTP (near strike) ============ */}

        {/* IV with Greeks Tooltip - OUTER */}
        {isColumnVisible('ce_iv') && (
          <td
            className={`${cellClass(isITM_CE)} text-blue-600 dark:text-blue-400 relative`}
            onMouseEnter={() => setHoveredGreeks('ce')}
            onMouseLeave={() => setHoveredGreeks(null)}
          >
            <ClickableCell onClick={() => handleCellClick('ce', 'iv', ce.iv)}>
              <span className="cursor-help underline decoration-dotted decoration-blue-400/50 font-medium">
                {ce.iv?.toFixed(1) || '—'}
              </span>
            </ClickableCell>
            <GreeksTooltip optgeeks={ce.optgeeks} isVisible={hoveredGreeks === 'ce'} position="right" />
          </td>
        )}

        {/* Delta - Next to IV */}
        {isColumnVisible('ce_delta') && (
          <td className={cellClass(isITM_CE)}>
            <ClickableCell onClick={() => handleCellClick('ce', 'delta', ce.optgeeks?.delta)}>
              {ce.optgeeks?.delta?.toFixed(3) || '—'}
            </ClickableCell>
          </td>
        )}

        {/* Other Greeks (hidden by default) */}
        {isColumnVisible('ce_gamma') && (
          <td className={cellClass(isITM_CE)}>
            <ClickableCell onClick={() => handleCellClick('ce', 'gamma', ce.optgeeks?.gamma)}>
              {ce.optgeeks?.gamma?.toFixed(5) || '—'}
            </ClickableCell>
          </td>
        )}
        {isColumnVisible('ce_theta') && (
          <td className={`${cellClass(isITM_CE)} text-red-500`}>
            <ClickableCell onClick={() => handleCellClick('ce', 'theta', ce.optgeeks?.theta)}>
              {ce.optgeeks?.theta?.toFixed(2) || '—'}
            </ClickableCell>
          </td>
        )}
        {isColumnVisible('ce_vega') && (
          <td className={cellClass(isITM_CE)}>
            <ClickableCell onClick={() => handleCellClick('ce', 'vega', ce.optgeeks?.vega)}>
              {ce.optgeeks?.vega?.toFixed(3) || '—'}
            </ClickableCell>
          </td>
        )}

        {/* OI Change */}
        {isColumnVisible('ce_oichng') && (
          <td className={cellClass(isITM_CE, getHighlight('ce_oichng'))}>
            <ClickableCell onClick={() => handleCellClick('ce', 'oichng', ce.oichng)}>
              <div className="flex flex-col items-center">
                <span className={`font-medium ${ce.oichng > 0 ? 'text-green-600' : ce.oichng < 0 ? 'text-red-600' : ''}`}>
                  {ce.oichng > 0 ? '+' : ''}{formatNumber(ce.oichng)}
                </span>
                {getPct('ce_oichng') > 0 && (
                  <span className="text-xs text-gray-500">{getPct('ce_oichng').toFixed(0)}%</span>
                )}
              </div>
            </ClickableCell>
          </td>
        )}

        {/* OI */}
        {isColumnVisible('ce_oi') && (
          <td className={cellClass(isITM_CE, getHighlight('ce_oi'))}>
            <ClickableCell onClick={() => handleCellClick('ce', 'OI', ce.OI)}>
              <div className="flex flex-col items-center">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {formatNumber(ce.OI)}
                </span>
                {getPct('ce_oi') > 0 && (
                  <span className="text-xs text-gray-500">{getPct('ce_oi').toFixed(0)}%</span>
                )}
              </div>
            </ClickableCell>
          </td>
        )}

        {/* Volume */}
        {isColumnVisible('ce_volume') && (
          <td className={`${cellClass(isITM_CE, getHighlight('ce_volume'))} text-gray-600 dark:text-gray-400`}>
            <ClickableCell onClick={() => handleCellClick('ce', 'volume', ce.volume)}>
              <div className="flex flex-col items-center">
                <span>{formatNumber(ce.volume)}</span>
                {getPct('ce_volume') > 0 && (
                  <span className="text-xs text-gray-500">{getPct('ce_volume').toFixed(0)}%</span>
                )}
              </div>
            </ClickableCell>
          </td>
        )}

        {/* Buildup */}
        {isColumnVisible('ce_buildup') && (
          <td className={cellClass(isITM_CE)}>
            <ClickableCell onClick={() => handleCellClick('ce', 'buildup', ce.btyp)}>
              <BuildupIndicator type={ce.btyp} />
            </ClickableCell>
          </td>
        )}

        {/* LTP + Change Combined - NEAR STRIKE */}
        {isColumnVisible('ce_ltp') && (
          <td className={`${cellClass(isITM_CE)} font-semibold`}>
            <ClickableCell onClick={() => handleCellClick('ce', 'ltp', ce.ltp)}>
              <div className="flex flex-col items-center">
                <span className="text-gray-900 dark:text-white">{ce.ltp?.toFixed(2) || '—'}</span>
                <span className={`text-xs ${ce.p_chng > 0 ? 'text-green-600' : ce.p_chng < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {ce.p_chng > 0 ? '+' : ''}{ce.p_chng?.toFixed(1) || '0'}
                </span>
              </div>
            </ClickableCell>
          </td>
        )}

        {/* Bid/Ask */}
        {isColumnVisible('ce_bid') && (
          <td className={`${cellClass(isITM_CE)} text-xs text-gray-400`}>
            <ClickableCell onClick={() => handleCellClick('ce', 'bid', ce.bid)}>
              {ce.bid || '—'}
            </ClickableCell>
          </td>
        )}
        {isColumnVisible('ce_ask') && (
          <td className={`${cellClass(isITM_CE)} text-xs text-gray-400`}>
            <ClickableCell onClick={() => handleCellClick('ce', 'ask', ce.ask)}>
              {ce.ask || '—'}
            </ClickableCell>
          </td>
        )}

        {/* ============ STRIKE (Center) with dual PCR ============ */}
        <td
          onClick={handleStrikeClick}
          className={`
            ${isCompact ? 'py-0.5 px-1' : cellPadding} text-center font-bold sticky left-0 z-10 cursor-pointer
            ${isATM ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}
            ${isCompact ? 'text-sm' : 'text-lg'}
            bg-gray-100 dark:bg-gray-800 border-x-2 border-gray-300 dark:border-gray-600
            hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors
            min-w-[60px]
          `}
        >
          {/* Vertical layout with tight gaps */}
          <div className={`flex flex-col items-center ${isCompact ? 'gap-0 leading-tight' : 'gap-0.5'}`}>
            <span className={isATM ? 'font-bold' : ''}>{strike}</span>
            {!isCompact && isATM && <span className="text-[10px] text-blue-500 font-medium px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded">ATM</span>}
            <PCRDisplay oiPcr={oiPcr} oiChngPcr={oiChngPcr} volPcr={volPcr} compact={isCompact} />
          </div>
        </td>

        {/* ============ PUTS (Right) - Order: LTP (near strike) -> Vol -> OI -> OI Chg -> Delta/IV (outer) ============ */}

        {/* Bid/Ask - near strike */}
        {isColumnVisible('pe_bid') && (
          <td className={`${cellClass(isITM_PE)} text-xs text-gray-400`}>
            <ClickableCell onClick={() => handleCellClick('pe', 'bid', pe.bid)}>
              {pe.bid || '—'}
            </ClickableCell>
          </td>
        )}
        {isColumnVisible('pe_ask') && (
          <td className={`${cellClass(isITM_PE)} text-xs text-gray-400`}>
            <ClickableCell onClick={() => handleCellClick('pe', 'ask', pe.ask)}>
              {pe.ask || '—'}
            </ClickableCell>
          </td>
        )}

        {/* LTP + Change Combined - NEAR STRIKE */}
        {isColumnVisible('pe_ltp') && (
          <td className={`${cellClass(isITM_PE)} font-semibold`}>
            <ClickableCell onClick={() => handleCellClick('pe', 'ltp', pe.ltp)}>
              <div className="flex flex-col items-center">
                <span className="text-gray-900 dark:text-white">{pe.ltp?.toFixed(2) || '—'}</span>
                <span className={`text-xs ${pe.p_chng > 0 ? 'text-green-600' : pe.p_chng < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {pe.p_chng > 0 ? '+' : ''}{pe.p_chng?.toFixed(1) || '0'}
                </span>
              </div>
            </ClickableCell>
          </td>
        )}

        {/* Buildup */}
        {isColumnVisible('pe_buildup') && (
          <td className={cellClass(isITM_PE)}>
            <ClickableCell onClick={() => handleCellClick('pe', 'buildup', pe.btyp)}>
              <BuildupIndicator type={pe.btyp} />
            </ClickableCell>
          </td>
        )}

        {/* Volume */}
        {isColumnVisible('pe_volume') && (
          <td className={`${cellClass(isITM_PE, getHighlight('pe_volume'))} text-gray-600 dark:text-gray-400`}>
            <ClickableCell onClick={() => handleCellClick('pe', 'volume', pe.volume)}>
              <div className="flex flex-col items-center">
                <span>{formatNumber(pe.volume)}</span>
                {getPct('pe_volume') > 0 && (
                  <span className="text-xs text-gray-500">{getPct('pe_volume').toFixed(0)}%</span>
                )}
              </div>
            </ClickableCell>
          </td>
        )}

        {/* OI */}
        {isColumnVisible('pe_oi') && (
          <td className={cellClass(isITM_PE, getHighlight('pe_oi'))}>
            <ClickableCell onClick={() => handleCellClick('pe', 'OI', pe.OI)}>
              <div className="flex flex-col items-center">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {formatNumber(pe.OI)}
                </span>
                {getPct('pe_oi') > 0 && (
                  <span className="text-xs text-gray-500">{getPct('pe_oi').toFixed(0)}%</span>
                )}
              </div>
            </ClickableCell>
          </td>
        )}

        {/* OI Change */}
        {isColumnVisible('pe_oichng') && (
          <td className={cellClass(isITM_PE, getHighlight('pe_oichng'))}>
            <ClickableCell onClick={() => handleCellClick('pe', 'oichng', pe.oichng)}>
              <div className="flex flex-col items-center">
                <span className={`font-medium ${pe.oichng > 0 ? 'text-green-600' : pe.oichng < 0 ? 'text-red-600' : ''}`}>
                  {pe.oichng > 0 ? '+' : ''}{formatNumber(pe.oichng)}
                </span>
                {getPct('pe_oichng') > 0 && (
                  <span className="text-xs text-gray-500">{getPct('pe_oichng').toFixed(0)}%</span>
                )}
              </div>
            </ClickableCell>
          </td>
        )}

        {/* Delta - next to IV */}
        {isColumnVisible('pe_delta') && (
          <td className={cellClass(isITM_PE)}>
            <ClickableCell onClick={() => handleCellClick('pe', 'delta', pe.optgeeks?.delta)}>
              {pe.optgeeks?.delta?.toFixed(3) || '—'}
            </ClickableCell>
          </td>
        )}

        {/* IV with Greeks Tooltip - OUTER */}
        {isColumnVisible('pe_iv') && (
          <td
            className={`${cellClass(isITM_PE)} text-blue-600 dark:text-blue-400 relative`}
            onMouseEnter={() => setHoveredGreeks('pe')}
            onMouseLeave={() => setHoveredGreeks(null)}
          >
            <ClickableCell onClick={() => handleCellClick('pe', 'iv', pe.iv)}>
              <span className="cursor-help underline decoration-dotted decoration-blue-400/50 font-medium">
                {pe.iv?.toFixed(1) || '—'}
              </span>
            </ClickableCell>
            <GreeksTooltip optgeeks={pe.optgeeks} isVisible={hoveredGreeks === 'pe'} position="left" />
          </td>
        )}

        {/* Other Greeks (hidden by default) */}
        {isColumnVisible('pe_gamma') && (
          <td className={cellClass(isITM_PE)}>
            <ClickableCell onClick={() => handleCellClick('pe', 'gamma', pe.optgeeks?.gamma)}>
              {pe.optgeeks?.gamma?.toFixed(5) || '—'}
            </ClickableCell>
          </td>
        )}
        {isColumnVisible('pe_theta') && (
          <td className={`${cellClass(isITM_PE)} text-red-500`}>
            <ClickableCell onClick={() => handleCellClick('pe', 'theta', pe.optgeeks?.theta)}>
              {pe.optgeeks?.theta?.toFixed(2) || '—'}
            </ClickableCell>
          </td>
        )}
        {isColumnVisible('pe_vega') && (
          <td className={cellClass(isITM_PE)}>
            <ClickableCell onClick={() => handleCellClick('pe', 'vega', pe.optgeeks?.vega)}>
              {pe.optgeeks?.vega?.toFixed(3) || '—'}
            </ClickableCell>
          </td>
        )}
      </tr>

      {/* Strike Detail Popup */}
      {showStrikePopup && (
        <StrikeDetailPopup
          data={data}
          strike={strike}
          spotPrice={spotPrice}
          onClose={() => setShowStrikePopup(false)}
        />
      )}
    </>
  );
});

StrikeRow.displayName = 'StrikeRow';

StrikeRow.propTypes = {
  data: PropTypes.object.isRequired,
  strike: PropTypes.number.isRequired,
  atmStrike: PropTypes.number,
  spotPrice: PropTypes.number,
  onCellClick: PropTypes.func,
  onStrikeSelect: PropTypes.func,
};

export default StrikeRow;

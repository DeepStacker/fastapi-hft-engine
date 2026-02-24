import { memo, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { BUILDUP_TYPES } from '../../../constants';
import { useColumnConfig } from '../../../context/ColumnConfigContext';
import { useTableSettings } from '../../../context/TableSettingsContext';
import { XMarkIcon, ChartBarIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

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

  // Use the passed onStrikeSelect callback
  const handleExpandClick = useCallback((e) => {
    e.stopPropagation();
    if (_onStrikeSelect) {
      _onStrikeSelect(data);
    }
  }, [_onStrikeSelect, data]);

  // ATM Calculation: Strict equality (with epsilon for floats) to highlight ONLY the exact ATM strike
  const isATM = Math.abs(strike - atmStrike) < 0.01;
  const isITM_CE = ce.mness === 'I';
  const isITM_PE = pe.mness === 'I';
  const showITM = settings.highlightITM;
  const isCompact = settings.compactMode;

  // Calculate strike PCR (OI, OI Change, and Volume)
  const ce_oi = ce.OI || ce.oi || 0;
  const pe_oi = pe.OI || pe.oi || 0;
  const ce_oi_chng = ce.oichng || ce.oi_change || 0;
  const pe_oi_chng = pe.oichng || pe.oi_change || 0;
  const ce_vol = ce.volume || ce.vol || 0;
  const pe_vol = pe.volume || pe.vol || 0;

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
                  {formatNumber(ce.OI || ce.oi)}
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

            {/* Expand Button for Depth Panel */}
            <button
              onClick={handleExpandClick}
              className="mt-0.5 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Expand Analysis Panel"
            >
              <ChevronDownIcon className="w-3 h-3 text-gray-500 hover:text-blue-500" />
            </button>
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
                  {formatNumber(pe.OI || pe.oi || 0)}
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

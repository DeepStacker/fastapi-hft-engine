import { memo } from 'react';
import { useColumnConfig } from '../../../context/ColumnConfigContext';
import { useTableSettings } from '../../../context/TableSettingsContext';

/**
 * Dynamic Option Chain Table Header
 * Column Order: IV/Delta at edges | OI Chg | OI | Vol | LTP/Chg | STRIKE | LTP/Chg | Vol | OI | OI Chg | Delta/IV
 * Clickable columns: OI, OI Chg, Vol open aggregate chart modal
 */
const TableHeader = memo(({ onColumnClick }) => {
    const { isColumnVisible } = useColumnConfig();
    const { settings } = useTableSettings();

    const isCompact = settings.compactMode;
    const basePadding = isCompact ? 'p-1.5' : 'p-2.5';
    const commonHeaders = `${basePadding} text-center font-semibold text-sm uppercase text-gray-600 dark:text-gray-300 tracking-wide whitespace-nowrap border-b border-gray-200 dark:border-gray-700`;
    const clickableHeader = `${commonHeaders} cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors`;
    const centerHeader = `${basePadding} text-center font-bold text-base tracking-wide sticky left-0 z-20 bg-gray-100 dark:bg-gray-800 border-x-2 border-gray-300 dark:border-gray-600 min-w-[100px]`;

    // Count visible columns for colspan
    const ceColumns = [
        'ce_iv', 'ce_delta', 'ce_gamma', 'ce_theta', 'ce_vega',
        'ce_oichng', 'ce_oi', 'ce_volume', 'ce_ltp', 'ce_chng', 'ce_buildup', 'ce_bid', 'ce_ask'
    ];
    const peColumns = [
        'pe_ltp', 'pe_chng', 'pe_bid', 'pe_ask',
        'pe_volume', 'pe_oi', 'pe_oichng',
        'pe_delta', 'pe_iv', 'pe_gamma', 'pe_theta', 'pe_vega', 'pe_buildup'
    ];

    const ceColspan = ceColumns.filter(id => isColumnVisible(id)).length || 1;
    const peColspan = peColumns.filter(id => isColumnVisible(id)).length || 1;

    return (
        <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-20 shadow-sm">
            <tr>
                {/* CALLS */}
                {/* CALLS (Red/Resistance) */}
                <th colSpan={ceColspan} className={`${basePadding} text-center font-bold text-base border-b border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 group`}>
                    <span className="text-rose-600 dark:text-rose-400">CALLS</span> <span className="text-gray-400 text-xs font-normal ml-1">(Resistance)</span>
                </th>
                {/* STRIKE */}
                <th className={`${basePadding} bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700`}></th>
                {/* PUTS */}
                {/* PUTS (Green/Support) */}
                <th colSpan={peColspan} className={`${basePadding} text-center font-bold text-base border-b border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 group`}>
                    <span className="text-emerald-600 dark:text-emerald-400">PUTS</span> <span className="text-gray-400 text-xs font-normal ml-1">(Support)</span>
                </th>
            </tr>
            <tr className="bg-gray-100 dark:bg-gray-800/50">
                {/* CALLS COLUMNS - Order: IV, Delta (outer) -> OI Chg -> OI -> Vol -> LTP (near strike) */}
                {isColumnVisible('ce_iv') && <th className={`${commonHeaders} cursor-help text-blue-600 dark:text-blue-400`} title="Hover for all Greeks">IV ⓘ</th>}
                {isColumnVisible('ce_delta') && <th className={commonHeaders}>Δ</th>}
                {isColumnVisible('ce_gamma') && <th className={commonHeaders}>Γ</th>}
                {isColumnVisible('ce_theta') && <th className={`${commonHeaders} text-red-500`}>Θ</th>}
                {isColumnVisible('ce_vega') && <th className={commonHeaders}>ν</th>}
                {/* OI Chg = Standard, Call OI = Default */}
                {isColumnVisible('ce_oichng') && <th className={clickableHeader} onClick={() => onColumnClick?.('oi_chng')} title="Click for OI Change Distribution">OI Chg 📊</th>}
                {isColumnVisible('ce_oi') && <th className={clickableHeader} onClick={() => onColumnClick?.('oi')} title="Click for OI Distribution">OI 📊</th>}
                {isColumnVisible('ce_volume') && <th className={clickableHeader} onClick={() => onColumnClick?.('volume')} title="Click for Volume Distribution">Vol 📊</th>}
                {isColumnVisible('ce_buildup') && <th className={commonHeaders}>Buildup</th>}
                {isColumnVisible('ce_ltp') && <th className={`${commonHeaders} font-bold`}>LTP / Chg</th>}
                {isColumnVisible('ce_chng') && !isColumnVisible('ce_ltp') && <th className={commonHeaders}>Chg</th>}
                {isColumnVisible('ce_bid') && <th className={commonHeaders}>Bid</th>}
                {isColumnVisible('ce_ask') && <th className={commonHeaders}>Ask</th>}

                {/* CENTER STRIKE */}
                <th className={centerHeader}>
                    <div className="flex flex-col items-center">
                        <span>STRIKE</span>
                        <span className="text-[9px] text-gray-500 font-normal">PCR</span>
                    </div>
                </th>

                {/* PUTS COLUMNS - Order: LTP (near strike) -> Vol -> OI -> OI Chg -> Delta, IV (outer) */}
                {isColumnVisible('pe_bid') && <th className={`${commonHeaders}`}>Bid</th>}
                {isColumnVisible('pe_ask') && <th className={`${commonHeaders}`}>Ask</th>}
                {isColumnVisible('pe_ltp') && <th className={`${commonHeaders} font-bold`}>LTP / Chg</th>}
                {isColumnVisible('pe_chng') && !isColumnVisible('pe_ltp') && <th className={`${commonHeaders}`}>Chg</th>}
                {isColumnVisible('pe_buildup') && <th className={`${commonHeaders}`}>Buildup</th>}
                {isColumnVisible('pe_volume') && <th className={clickableHeader} onClick={() => onColumnClick?.('volume')} title="Click for Volume Distribution">Vol 📊</th>}
                {/* Put OI = Default, Put OI Chg = Standard */}
                {isColumnVisible('pe_oi') && <th className={clickableHeader} onClick={() => onColumnClick?.('oi')} title="Click for OI Distribution">OI 📊</th>}
                {isColumnVisible('pe_oichng') && <th className={clickableHeader} onClick={() => onColumnClick?.('oi_chng')} title="Click for OI Change Distribution">OI Chg 📊</th>}
                {isColumnVisible('pe_delta') && <th className={`${commonHeaders}`}>Δ</th>}
                {isColumnVisible('pe_iv') && <th className={`${commonHeaders} cursor-help text-blue-600 dark:text-blue-400`} title="Hover for all Greeks">IV ⓘ</th>}
                {isColumnVisible('pe_gamma') && <th className={`${commonHeaders}`}>Γ</th>}
                {isColumnVisible('pe_theta') && <th className={`${commonHeaders} text-red-500`}>Θ</th>}
                {isColumnVisible('pe_vega') && <th className={`${commonHeaders}`}>ν</th>}
            </tr>
        </thead>
    );
});

TableHeader.displayName = 'TableHeader';

export default TableHeader;

import { memo, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectSid, selectSelectedExpiry, selectExpDates } from '../../../context/selectors';
import { setSidAndFetchData, setExp_sid, fetchLiveData } from '../../../context/dataSlice';
import { setSymbols } from '../../../context/chartSlice';
import { analyticsService } from '../../../services/analyticsService';

/**
 * Premium Symbol Selector - Inline version for OptionControls with Portal
 */
const PremiumSymbolSelector = ({ symbols, currentSymbol, onSelect, theme }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const containerRef = useRef(null);
    const buttonRef = useRef(null);
    const inputRef = useRef(null);

    // Known indices
    const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX', 'NIFTYNXT50'];

    // Filter symbols
    const filtered = symbols.filter(s =>
        s.symbol.toLowerCase().includes(search.toLowerCase()) ||
        (s.name || '').toLowerCase().includes(search.toLowerCase())
    );

    const indices = filtered.filter(s => INDICES.includes(s.symbol));
    const equities = filtered.filter(s => !INDICES.includes(s.symbol));

    // Calculate dropdown position
    const openDropdown = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 8,
                left: rect.left,
            });
        }
        setIsOpen(true);
    };

    // Close on outside click - handled by backdrop now
    useEffect(() => {
        if (isOpen && inputRef.current) inputRef.current.focus();
    }, [isOpen]);

    const handleSelect = (s) => {
        onSelect(s.symbol);
        setIsOpen(false);
        setSearch('');
    };

    const isDark = theme === 'dark';
    const isIndex = INDICES.includes(currentSymbol);

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger */}
            <button
                ref={buttonRef}
                onClick={() => isOpen ? setIsOpen(false) : openDropdown()}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl border shadow-md
                    font-bold text-sm transition-all duration-200 min-w-[140px]
                    ${isDark
                        ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-slate-600 text-white hover:border-slate-500'
                        : 'bg-gradient-to-r from-white to-gray-50 border-gray-200 text-gray-900 hover:border-gray-300'}
                    ${isOpen ? 'ring-2 ring-emerald-500/50 shadow-lg' : ''}
                `}
            >
                <span className="text-lg">{isIndex ? '📈' : '🏢'}</span>
                <span className="tracking-wide">{currentSymbol || 'Select'}</span>
                <svg className={`w-4 h-4 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown - Portal to escape stacking contexts */}
            {isOpen && createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[2147483646]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        className={`fixed w-80 max-h-[70vh] rounded-xl border shadow-2xl z-[2147483647] overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}
                        style={{ top: dropdownPos.top, left: dropdownPos.left }}
                    >
                        {/* Search */}
                        <div className={`p-3 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                            <div className="relative">
                                <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search symbols..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 ${isDark ? 'bg-slate-800 text-white placeholder-gray-500 focus:ring-emerald-500/50' : 'bg-gray-100 text-gray-900 placeholder-gray-400 focus:ring-emerald-400/50'}`}
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto max-h-80 p-2">
                            {indices.length > 0 && (
                                <div className="mb-3">
                                    <div className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>📊 Indices</div>
                                    {indices.map(s => (
                                        <button key={s.symbol} onClick={() => handleSelect(s)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${currentSymbol === s.symbol ? (isDark ? 'bg-emerald-600/20 text-emerald-400 font-bold' : 'bg-emerald-50 text-emerald-700 font-bold') : (isDark ? 'hover:bg-slate-700/50 text-gray-200' : 'hover:bg-gray-100 text-gray-800')}`}>
                                            <span className="text-lg">📈</span>
                                            <span className="font-semibold">{s.symbol}</span>
                                            {currentSymbol === s.symbol && <svg className="w-4 h-4 ml-auto text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {equities.length > 0 && (
                                <div>
                                    <div className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>🏢 Equities</div>
                                    {equities.map(s => (
                                        <button key={s.symbol} onClick={() => handleSelect(s)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${currentSymbol === s.symbol ? (isDark ? 'bg-emerald-600/20 text-emerald-400 font-bold' : 'bg-emerald-50 text-emerald-700 font-bold') : (isDark ? 'hover:bg-slate-700/50 text-gray-200' : 'hover:bg-gray-100 text-gray-800')}`}>
                                            <span className="text-lg">🏢</span>
                                            <span className="font-semibold">{s.symbol}</span>
                                            {currentSymbol === s.symbol && <svg className="w-4 h-4 ml-auto text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {filtered.length === 0 && <div className={`text-center py-8 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No symbols found</div>}
                        </div>
                    </div>
                </>,
                document.getElementById('dropdown-root') || document.body
            )}
        </div>
    );
};

/**
 * Compact Option Controls - Symbol, Expiry, and Chart Toggle
 */
const OptionControls = memo(({ showChart, onToggleChart }) => {
    const dispatch = useDispatch();
    const sid = useSelector(selectSid);
    const expiry = useSelector(selectSelectedExpiry);
    const expiryList = useSelector(selectExpDates);
    const theme = useSelector((state) => state.theme.theme);
    const symbols = useSelector((state) => state.chart.symbols);

    const displaySymbol = sid || 'NIFTY';

    // Fetch symbols if not already loaded
    useEffect(() => {
        if (symbols.length === 0) {
            const fetchSymbols = async () => {
                try {
                    const data = await analyticsService.getSymbols();
                    if (data.success && data.data) {
                        dispatch(setSymbols(data.data));
                    }
                } catch (error) {
                    console.error('Failed to fetch symbols:', error);
                }
            };
            fetchSymbols();
        }
    }, [symbols.length, dispatch]);

    const handleSymbolChange = (symbolValue) => {
        dispatch(setSidAndFetchData({ newSid: symbolValue }));
    };

    const handleExpiryChange = (e) => {
        const newExpiry = Number(e.target.value);
        dispatch(setExp_sid(newExpiry));
        // Immediately fetch data for the new expiry
        if (sid && newExpiry) {
            dispatch(fetchLiveData({ sid, exp_sid: newExpiry }));
        }
    };

    const formatExpiryDate = (timestamp) => {
        const date = new Date(Number(timestamp) * 1000);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
    };

    return (
        <div className="flex items-center gap-3 p-1">
            {/* Premium Symbol Selector */}
            <PremiumSymbolSelector
                symbols={symbols.length > 0 ? symbols : [{ symbol: 'NIFTY' }, { symbol: 'BANKNIFTY' }, { symbol: 'FINNIFTY' }]}
                currentSymbol={displaySymbol}
                onSelect={handleSymbolChange}
                theme={theme}
            />

            {/* Expiry - hide in chart mode */}
            {!showChart && (
                <div className="relative group">
                    <select
                        value={expiry || ""}
                        onChange={handleExpiryChange}
                        className={`
                            appearance-none pl-4 pr-8 py-1.5 text-sm font-medium rounded-full 
                            border transition-all duration-200 cursor-pointer shadow-sm
                            ${theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600 focus:ring-2 focus:ring-emerald-500/50'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 focus:ring-2 focus:ring-emerald-500/50'
                            }
                        `}
                    >
                        {expiryList?.map((exp) => (
                            <option key={exp} value={exp}>
                                {formatExpiryDate(exp)}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
            )}

            {/* Chart Toggle Button */}
            {onToggleChart && (
                <button
                    onClick={onToggleChart}
                    className={`
                        flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm
                        transition-all duration-200 border
                        ${showChart
                            ? theme === 'dark'
                                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500 hover:shadow-emerald-500/20'
                                : 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600 hover:shadow-emerald-500/20'
                            : theme === 'dark'
                                ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                        }
                    `}
                    title={showChart ? 'View Option Chain Table' : 'View Chart'}
                >
                    {showChart ? (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Table View
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                            Chart View
                        </>
                    )}
                </button>
            )}
        </div>
    );
});

OptionControls.displayName = 'OptionControls';

export default OptionControls;

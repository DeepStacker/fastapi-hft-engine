import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

/**
 * Premium Symbol Selector - Searchable dropdown with categories
 * Features: Search, Indices/Equities grouping, keyboard navigation, glassmorphism
 */
const SymbolSelector = ({ symbols, currentSymbol, onSelect, theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);

  // Group symbols by type
  const groupedSymbols = useMemo(() => {
    const indices = [];
    const equities = [];
    
    symbols.forEach(s => {
      // Check if symbol name contains index-like patterns or is known index
      const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX', 'NIFTYNXT50'].includes(s.symbol);
      if (isIndex) {
        indices.push(s);
      } else {
        equities.push(s);
      }
    });
    
    return { indices, equities };
  }, [symbols]);

  // Filter symbols based on search
  const filteredGroups = useMemo(() => {
    const query = search.toLowerCase();
    return {
      indices: groupedSymbols.indices.filter(s => 
        s.symbol.toLowerCase().includes(query) || 
        (s.name || '').toLowerCase().includes(query)
      ),
      equities: groupedSymbols.equities.filter(s => 
        s.symbol.toLowerCase().includes(query) || 
        (s.name || '').toLowerCase().includes(query)
      ),
    };
  }, [groupedSymbols, search]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => [
    ...filteredGroups.indices,
    ...filteredGroups.equities,
  ], [filteredGroups]);

  // Calculate dropdown position when opening
  const openDropdown = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
    setIsOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        openDropdown();
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        setHighlightedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
        e.preventDefault();
        break;
      case 'ArrowUp':
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        e.preventDefault();
        break;
      case 'Enter':
        if (flatList[highlightedIndex]) {
          onSelect(flatList[highlightedIndex]);
          setIsOpen(false);
          setSearch('');
        }
        e.preventDefault();
        break;
      case 'Escape':
        setIsOpen(false);
        setSearch('');
        break;
      default:
        break;
    }
  };

  const handleSelect = (symbol) => {
    onSelect(symbol);
    setIsOpen(false);
    setSearch('');
  };

  const isDark = theme === 'dark';

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => isOpen ? setIsOpen(false) : openDropdown()}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg border
          font-semibold text-xs transition-all duration-200 min-w-[120px]
          ${isDark 
            ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700' 
            : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'}
          ${isOpen ? (isDark ? 'ring-1 ring-blue-500' : 'ring-1 ring-blue-400') : ''}
        `}
      >
        <span className="font-bold">{currentSymbol?.symbol || 'Select'}</span>
        <svg 
          className={`w-3 h-3 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Panel - Using Portal to render to body, escaping all stacking contexts */}
      {isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[2147483646]" 
            onClick={() => setIsOpen(false)}
          />
          <div 
            className={`
              fixed w-72 max-h-80 rounded-xl border shadow-2xl z-[2147483647]
              overflow-hidden
              ${isDark 
                ? 'bg-gray-900 border-gray-700' 
                : 'bg-white border-gray-200'}
            `}
            style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
          >
            {/* Search Input */}
            <div className={`p-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="relative">
                <svg 
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(0); }}
                  className={`
                    w-full pl-8 pr-3 py-1.5 rounded-lg text-xs
                    focus:outline-none focus:ring-1 transition-all
                    ${isDark 
                      ? 'bg-gray-800 text-white placeholder-gray-500 focus:ring-blue-500' 
                      : 'bg-gray-100 text-gray-900 placeholder-gray-400 focus:ring-blue-400'}
                  `}
                />
              </div>
            </div>

            {/* Symbol List */}
            <div className="overflow-y-auto max-h-64 p-1">
              {/* Indices Section */}
              {filteredGroups.indices.length > 0 && (
                <div className="mb-1">
                  <div className={`px-2 py-1 text-[10px] font-semibold uppercase ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    Indices
                  </div>
                  {filteredGroups.indices.map((s, idx) => (
                    <SymbolItem 
                      key={s.symbol} 
                      symbol={s} 
                      isSelected={currentSymbol?.symbol === s.symbol}
                      isHighlighted={highlightedIndex === idx}
                      onClick={() => handleSelect(s)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              )}

              {/* Equities Section */}
              {filteredGroups.equities.length > 0 && (
                <div>
                  <div className={`px-2 py-1 text-[10px] font-semibold uppercase ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    Equities
                  </div>
                  {filteredGroups.equities.map((s, idx) => (
                    <SymbolItem 
                      key={s.symbol} 
                      symbol={s} 
                      isSelected={currentSymbol?.symbol === s.symbol}
                      isHighlighted={highlightedIndex === (filteredGroups.indices.length + idx)}
                      onClick={() => handleSelect(s)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              )}

              {/* No Results */}
              {flatList.length === 0 && (
                <div className={`text-center py-4 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  No symbols found
                </div>
              )}
            </div>
          </div>
        </>,
        document.getElementById('dropdown-root') || document.body
      )}
    </div>
  );
};

/**
 * Individual Symbol Item
 */
const SymbolItem = ({ symbol, isSelected, isHighlighted, onClick, isDark }) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs
        transition-all duration-100
        ${isSelected 
          ? (isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
          : isHighlighted 
            ? (isDark ? 'bg-gray-800' : 'bg-gray-100')
            : (isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')
        }
      `}
    >
      <div className="flex-1 min-w-0">
        <div className={`font-semibold ${isSelected ? 'text-white' : isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {symbol.symbol}
        </div>
      </div>
      {isSelected && (
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
};

export default SymbolSelector;

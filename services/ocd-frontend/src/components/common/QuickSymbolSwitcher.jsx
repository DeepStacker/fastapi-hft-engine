/**
 * Quick Symbol Switcher
 * Floating widget for rapid symbol navigation with keyboard shortcuts
 */
import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { setSidAndFetchData } from '../../context/dataSlice';
import { selectSelectedSymbol, selectDataLoading } from '../../context/selectors';
import { 
    ChartBarIcon, 
    CommandLineIcon,
    XMarkIcon 
} from '@heroicons/react/24/outline';

// Quick switch symbols
const SYMBOLS = [
    { key: 'N', symbol: 'NIFTY', label: 'NIFTY 50', color: 'from-blue-500 to-blue-600' },
    { key: 'B', symbol: 'BANKNIFTY', label: 'BANK NIFTY', color: 'from-emerald-500 to-emerald-600' },
    { key: 'F', symbol: 'FINNIFTY', label: 'FIN NIFTY', color: 'from-violet-500 to-violet-600' },
    { key: 'M', symbol: 'MIDCPNIFTY', label: 'MIDCAP', color: 'from-amber-500 to-amber-600' },
];

const QuickSymbolSwitcher = () => {
    const dispatch = useDispatch();
    const currentSymbol = useSelector(selectSelectedSymbol);
    const isLoading = useSelector(selectDataLoading);
    const theme = useSelector((state) => state.theme.theme);
    const [isOpen, setIsOpen] = useState(false);
    const [showHint, setShowHint] = useState(false);

    const isDark = theme === 'dark';

    // Handle symbol switch
    const switchSymbol = useCallback((symbol) => {
        dispatch(setSidAndFetchData({ newSid: symbol }));
        setIsOpen(false);
    }, [dispatch]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Toggle panel with backtick
            if (e.key === '`' || e.key === 'Escape') {
                e.preventDefault();
                setIsOpen(prev => !prev);
                return;
            }

            // Quick switch with letter keys
            const symbol = SYMBOLS.find(s => s.key.toLowerCase() === e.key.toLowerCase());
            if (symbol && !isLoading) {
                e.preventDefault();
                switchSymbol(symbol.symbol);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [switchSymbol, isLoading]);

    // Show hint on first load
    useEffect(() => {
        const hasSeenHint = localStorage.getItem('seenQuickSwitchHint');
        if (!hasSeenHint) {
            setTimeout(() => setShowHint(true), 3000);
            setTimeout(() => {
                setShowHint(false);
                localStorage.setItem('seenQuickSwitchHint', 'true');
            }, 8000);
        }
    }, []);

    return (
        <>
            {/* Floating Trigger Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-2xl transition-all ${
                    isDark 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' 
                        : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                } hover:shadow-blue-500/30`}
                title="Quick Switch (Press `)"
            >
                <ChartBarIcon className="w-6 h-6" />
                {isLoading && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
                )}
            </motion.button>

            {/* Floating Hint */}
            <AnimatePresence>
                {showHint && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className={`fixed bottom-24 right-6 z-50 px-4 py-3 rounded-xl shadow-lg ${
                            isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'
                        } border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
                    >
                        <div className="flex items-center gap-2 text-sm">
                            <CommandLineIcon className="w-4 h-4 text-blue-500" />
                            <span>Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-bold">N</kbd> <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-bold">B</kbd> <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-bold">F</kbd> for quick switch</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Quick Switch Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className={`fixed bottom-24 right-6 z-50 w-72 rounded-2xl shadow-2xl border overflow-hidden ${
                                isDark 
                                    ? 'bg-slate-900 border-slate-700' 
                                    : 'bg-white border-slate-200'
                            }`}
                        >
                            {/* Header */}
                            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                                <div className="flex items-center gap-2">
                                    <ChartBarIcon className="w-5 h-5 text-blue-500" />
                                    <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Quick Switch</span>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Symbol List */}
                            <div className="p-2">
                                {SYMBOLS.map((item) => (
                                    <button
                                        key={item.symbol}
                                        onClick={() => switchSymbol(item.symbol)}
                                        disabled={isLoading}
                                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                                            currentSymbol === item.symbol 
                                                ? `bg-gradient-to-r ${item.color} text-white shadow-lg` 
                                                : isDark 
                                                    ? 'hover:bg-slate-800 text-slate-300' 
                                                    : 'hover:bg-slate-100 text-slate-700'
                                        } ${isLoading ? 'opacity-50' : ''}`}
                                    >
                                        {/* Keyboard shortcut */}
                                        <kbd className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${
                                            currentSymbol === item.symbol 
                                                ? 'bg-white/20' 
                                                : isDark ? 'bg-slate-700' : 'bg-slate-100'
                                        }`}>
                                            {item.key}
                                        </kbd>
                                        <div className="flex-1 text-left">
                                            <div className="font-bold">{item.symbol}</div>
                                            <div className={`text-xs ${currentSymbol === item.symbol ? 'opacity-80' : 'opacity-60'}`}>{item.label}</div>
                                        </div>
                                        {currentSymbol === item.symbol && (
                                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Footer hint */}
                            <div className={`px-4 py-2 text-xs text-center border-t ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
                                Press <kbd className="px-1 bg-slate-100 dark:bg-slate-700 rounded font-bold">`</kbd> to toggle • <kbd className="px-1 bg-slate-100 dark:bg-slate-700 rounded font-bold">Esc</kbd> to close
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default QuickSymbolSwitcher;

/**
 * Command Palette - Quick Search & Action Component
 * Provides fast keyboard-driven navigation and actions
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MagnifyingGlassIcon,
    HomeIcon,
    TableCellsIcon,
    ChartPieIcon,
    UserGroupIcon,
    CalculatorIcon,
    BoltIcon,
    ClockIcon,
    ScaleIcon,
    UserCircleIcon,
    SunIcon,
    MoonIcon,
    Cog6ToothIcon,
    ArrowRightOnRectangleIcon,
    CommandLineIcon,
} from '@heroicons/react/24/outline';
import { toggleTheme } from '../../context/themeSlice';
import { performLogout } from '../../context/authSlice';

// Command categories and items
const COMMANDS = [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard', category: 'Navigation', icon: HomeIcon, path: '/dashboard', shortcut: '1' },
    { id: 'nav-optionchain', label: 'Go to Option Chain', category: 'Navigation', icon: TableCellsIcon, path: '/option-chain', shortcut: '2' },
    { id: 'nav-analytics', label: 'Go to Analytics', category: 'Navigation', icon: ChartPieIcon, path: '/analytics', shortcut: '3' },
    { id: 'nav-community', label: 'Go to Community', category: 'Navigation', icon: UserGroupIcon, path: '/community', shortcut: '4' },
    { id: 'nav-calculators', label: 'Go to Calculators', category: 'Navigation', icon: CalculatorIcon, path: '/calculators', shortcut: '5' },
    { id: 'nav-screeners', label: 'Go to Screeners', category: 'Navigation', icon: BoltIcon, path: '/screeners', shortcut: '6' },
    { id: 'nav-historical', label: 'Go to Historical', category: 'Navigation', icon: ClockIcon, path: '/historical', shortcut: '7' },
    { id: 'nav-position', label: 'Go to Position Sizing', category: 'Navigation', icon: ScaleIcon, path: '/position-sizing', shortcut: '8' },
    { id: 'nav-profile', label: 'Go to Profile', category: 'Navigation', icon: UserCircleIcon, path: '/profile', shortcut: '9' },

    // Actions
    { id: 'action-theme', label: 'Toggle Dark/Light Mode', category: 'Actions', icon: SunIcon, action: 'toggleTheme', shortcut: '⌘D' },
    { id: 'action-settings', label: 'Open Settings', category: 'Actions', icon: Cog6ToothIcon, path: '/profile', tab: 'settings' },
    { id: 'action-logout', label: 'Log Out', category: 'Actions', icon: ArrowRightOnRectangleIcon, action: 'logout' },
];

const CommandPalette = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const theme = useSelector((state) => state.theme?.theme);
    const isDark = theme === 'dark';

    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!query.trim()) return COMMANDS;

        const lowerQuery = query.toLowerCase();
        return COMMANDS.filter(cmd =>
            cmd.label.toLowerCase().includes(lowerQuery) ||
            cmd.category.toLowerCase().includes(lowerQuery)
        );
    }, [query]);

    // Group commands by category
    const groupedCommands = useMemo(() => {
        const groups = {};
        filteredCommands.forEach(cmd => {
            if (!groups[cmd.category]) groups[cmd.category] = [];
            groups[cmd.category].push(cmd);
        });
        return groups;
    }, [filteredCommands]);

    // Execute command
    const executeCommand = useCallback((command) => {
        if (command.path) {
            navigate(command.path);
        } else if (command.action === 'toggleTheme') {
            dispatch(toggleTheme());
        } else if (command.action === 'logout') {
            dispatch(performLogout());
            navigate('/login');
        }
        onClose();
        setQuery('');
        setSelectedIndex(0);
    }, [navigate, dispatch, onClose]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(i => Math.max(i - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredCommands[selectedIndex]) {
                        executeCommand(filteredCommands[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIndex, filteredCommands, executeCommand, onClose]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Command Palette Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={`fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 ${isDark ? 'bg-gray-900' : 'bg-white'
                            } rounded-2xl shadow-2xl border ${isDark ? 'border-gray-700' : 'border-gray-200'
                            } overflow-hidden`}
                    >
                        {/* Search Input */}
                        <div className={`flex items-center gap-3 px-4 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'
                            }`}>
                            <CommandLineIcon className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setSelectedIndex(0);
                                }}
                                placeholder="Type a command or search..."
                                className={`flex-1 bg-transparent outline-none text-lg ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
                                    }`}
                            />
                            <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
                                }`}>
                                ESC
                            </kbd>
                        </div>

                        {/* Commands List */}
                        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
                            {Object.entries(groupedCommands).map(([category, commands]) => (
                                <div key={category}>
                                    <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'
                                        }`}>
                                        {category}
                                    </div>
                                    {commands.map((cmd, idx) => {
                                        const globalIndex = filteredCommands.indexOf(cmd);
                                        const isSelected = globalIndex === selectedIndex;
                                        const Icon = cmd.icon;

                                        return (
                                            <button
                                                key={cmd.id}
                                                data-index={globalIndex}
                                                onClick={() => executeCommand(cmd)}
                                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected
                                                        ? isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                                                        : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className={`p-2 rounded-lg ${isSelected
                                                        ? isDark ? 'bg-blue-600/30' : 'bg-blue-100'
                                                        : isDark ? 'bg-gray-800' : 'bg-gray-100'
                                                    }`}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <span className="flex-1 font-medium">{cmd.label}</span>
                                                {cmd.shortcut && (
                                                    <kbd className={`px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'
                                                        }`}>
                                                        {cmd.shortcut}
                                                    </kbd>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}

                            {filteredCommands.length === 0 && (
                                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <MagnifyingGlassIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>No commands found for "{query}"</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className={`flex items-center justify-between px-4 py-3 border-t text-xs ${isDark ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400'
                            }`}>
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-gray-800">↑↓</kbd> Navigate
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-gray-800">↵</kbd> Select
                                </span>
                            </div>
                            <span className="font-medium">DeepStrike Command</span>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CommandPalette;

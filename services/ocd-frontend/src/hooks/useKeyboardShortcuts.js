/**
 * useKeyboardShortcuts - Global Keyboard Shortcuts Hook
 * Provides power-user keyboard navigation and actions
 */
import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toggleTheme } from '../context/themeSlice';

// Default keyboard shortcuts configuration
const DEFAULT_SHORTCUTS = {
    // Navigation shortcuts (number keys)
    '1': '/dashboard',
    '2': '/option-chain',
    '3': '/analytics',
    '4': '/community',
    '5': '/calculators',
    '6': '/screeners',
    '7': '/historical',
    '8': '/position-sizing',
    '9': '/profile',
};

/**
 * Custom hook for global keyboard shortcuts
 * @param {Object} options - Configuration options
 * @param {Function} options.onCommandPalette - Callback when Cmd+K is pressed
 * @param {Function} options.onHelp - Callback when Cmd+/ is pressed
 * @param {Object} options.customShortcuts - Additional custom shortcuts
 */
const useKeyboardShortcuts = ({
    onCommandPalette = null,
    onHelp = null,
    customShortcuts = {},
    enabled = true
} = {}) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const theme = useSelector((state) => state.theme?.theme);

    const handleKeyDown = useCallback((event) => {
        if (!enabled) return;

        // Ignore if user is typing in an input/textarea
        const target = event.target;
        const isInput = target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable;

        const isMeta = event.metaKey || event.ctrlKey;

        // Command Palette: Cmd/Ctrl + K
        if (isMeta && event.key === 'k') {
            event.preventDefault();
            if (onCommandPalette) onCommandPalette();
            return;
        }

        // Help/Shortcuts: Cmd/Ctrl + /
        if (isMeta && event.key === '/') {
            event.preventDefault();
            if (onHelp) onHelp();
            return;
        }

        // Theme Toggle: Cmd/Ctrl + D
        if (isMeta && event.key === 'd') {
            event.preventDefault();
            dispatch(toggleTheme());
            return;
        }

        // Escape: Close modals (handled by individual components usually)
        if (event.key === 'Escape') {
            // Emit custom event for modals to listen
            window.dispatchEvent(new CustomEvent('globalEscape'));
            return;
        }

        // Number key navigation (only when not in input)
        if (!isInput && !isMeta && /^[1-9]$/.test(event.key)) {
            const route = DEFAULT_SHORTCUTS[event.key] || customShortcuts[event.key];
            if (route) {
                event.preventDefault();
                navigate(route);
                return;
            }
        }

        // Custom shortcuts
        const shortcutKey = isMeta ? `cmd+${event.key.toLowerCase()}` : event.key.toLowerCase();
        if (customShortcuts[shortcutKey]) {
            event.preventDefault();
            const action = customShortcuts[shortcutKey];
            if (typeof action === 'function') {
                action();
            } else if (typeof action === 'string') {
                navigate(action);
            }
        }
    }, [enabled, navigate, dispatch, onCommandPalette, onHelp, customShortcuts]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return {
        shortcuts: { ...DEFAULT_SHORTCUTS, ...customShortcuts },
        theme,
    };
};

// Shortcut display helper
export const SHORTCUT_LABELS = {
    '1': { key: '1', label: 'Dashboard' },
    '2': { key: '2', label: 'Option Chain' },
    '3': { key: '3', label: 'Analytics' },
    '4': { key: '4', label: 'Community' },
    '5': { key: '5', label: 'Calculators' },
    '6': { key: '6', label: 'Screeners' },
    '7': { key: '7', label: 'Historical' },
    '8': { key: '8', label: 'Position Sizing' },
    '9': { key: '9', label: 'Profile' },
    'cmd+k': { key: '⌘K', label: 'Command Palette' },
    'cmd+/': { key: '⌘/', label: 'Keyboard Shortcuts' },
    'cmd+d': { key: '⌘D', label: 'Toggle Theme' },
    'esc': { key: 'Esc', label: 'Close Modal' },
};

export default useKeyboardShortcuts;

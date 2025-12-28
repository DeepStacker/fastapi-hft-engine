import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';

/**
 * Secret Admin Access Hook
 * 
 * Access mechanism:
 * 1. Key combo: Ctrl+Shift+K (3 times within 2 seconds)
 * 2. Then type the secret phrase within 5 seconds
 * 
 * The secret phrase is stored in environment variable for security.
 * Default fallback for development only.
 */
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'deepstrike2024';
const KEY_COMBO_COUNT = 3;
const KEY_COMBO_TIMEOUT = 2000; // 2 seconds to press combo 3 times
const PHRASE_TIMEOUT = 5000; // 5 seconds to type phrase

export const useAdminAccess = () => {
    const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
    const [keyComboCount, setKeyComboCount] = useState(0);
    const [isWaitingForPhrase, setIsWaitingForPhrase] = useState(false);
    const [typedPhrase, setTypedPhrase] = useState('');

    const user = useSelector((state) => state.auth.user);

    // Check if user has admin role from backend
    const hasAdminRole = user?.role === 'admin' || user?.role === 'ADMIN';

    // Reset combo count after timeout
    useEffect(() => {
        if (keyComboCount > 0 && keyComboCount < KEY_COMBO_COUNT) {
            const timer = setTimeout(() => {
                setKeyComboCount(0);
            }, KEY_COMBO_TIMEOUT);
            return () => clearTimeout(timer);
        }
    }, [keyComboCount]);

    // Reset phrase entry after timeout
    useEffect(() => {
        if (isWaitingForPhrase) {
            const timer = setTimeout(() => {
                setIsWaitingForPhrase(false);
                setTypedPhrase('');
            }, PHRASE_TIMEOUT);
            return () => clearTimeout(timer);
        }
    }, [isWaitingForPhrase]);

    // Key combo handler
    const handleKeyDown = useCallback((event) => {
        // Check for Ctrl+Shift+K combo
        if (event.ctrlKey && event.shiftKey && event.key === 'K') {
            event.preventDefault();

            if (isWaitingForPhrase) return;

            const newCount = keyComboCount + 1;
            setKeyComboCount(newCount);

            if (newCount >= KEY_COMBO_COUNT) {
                setIsWaitingForPhrase(true);
                setKeyComboCount(0);
                console.log('🔐 Admin access: Enter secret phrase...');
            }
        }

        // Capture phrase when waiting
        if (isWaitingForPhrase && event.key.length === 1) {
            const newPhrase = typedPhrase + event.key;
            setTypedPhrase(newPhrase);

            // Check if phrase matches
            if (newPhrase === ADMIN_SECRET) {
                if (hasAdminRole) {
                    setIsAdminUnlocked(true);
                    setIsWaitingForPhrase(false);
                    setTypedPhrase('');
                    console.log('✅ Admin panel unlocked');
                } else {
                    console.warn('❌ Admin access denied - insufficient permissions');
                    setIsWaitingForPhrase(false);
                    setTypedPhrase('');
                }
            } else if (!ADMIN_SECRET.startsWith(newPhrase)) {
                // Wrong phrase, reset
                setIsWaitingForPhrase(false);
                setTypedPhrase('');
            }
        }

        // Escape to cancel
        if (event.key === 'Escape') {
            setIsWaitingForPhrase(false);
            setTypedPhrase('');
            setKeyComboCount(0);
        }
    }, [keyComboCount, isWaitingForPhrase, typedPhrase, hasAdminRole]);

    // Attach global key listener
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Lock admin access
    const lockAdmin = useCallback(() => {
        setIsAdminUnlocked(false);
    }, []);

    return {
        isAdminUnlocked,
        isWaitingForPhrase,
        hasAdminRole,
        lockAdmin,
    };
};

export default useAdminAccess;

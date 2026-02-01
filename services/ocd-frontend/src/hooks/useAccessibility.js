/**
 * Accessibility Utilities
 * 
 * Provides focus management, ARIA helpers, and accessibility enhancements.
 */
import { useRef, useEffect, useCallback } from 'react';

/**
 * Focus Trap - Keeps focus within a container (for modals, dialogs)
 * 
 * @example
 * const { containerRef } = useFocusTrap({ enabled: isModalOpen });
 * return <div ref={containerRef}>...</div>
 */
export function useFocusTrap({ enabled = true, returnFocus = true }) {
    const containerRef = useRef(null);
    const previousActiveElement = useRef(null);

    useEffect(() => {
        if (!enabled) return;

        // Store currently focused element
        previousActiveElement.current = document.activeElement;

        const container = containerRef.current;
        if (!container) return;

        // Find all focusable elements
        const getFocusableElements = () => {
            const selector = [
                'button:not([disabled])',
                'input:not([disabled])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                'a[href]',
                '[tabindex]:not([tabindex="-1"])',
            ].join(', ');

            return container.querySelectorAll(selector);
        };

        // Focus first element
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }

        // Handle tab key
        const handleKeyDown = (e) => {
            if (e.key !== 'Tab') return;

            const focusable = getFocusableElements();
            if (focusable.length === 0) return;

            const firstElement = focusable[0];
            const lastElement = focusable[focusable.length - 1];

            if (e.shiftKey) {
                // Shift+Tab: If on first, go to last
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab: If on last, go to first
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('keydown', handleKeyDown);

            // Return focus to previous element
            if (returnFocus && previousActiveElement.current) {
                previousActiveElement.current.focus();
            }
        };
    }, [enabled, returnFocus]);

    return { containerRef };
}

/**
 * Skip Link - Provides "Skip to content" functionality
 * 
 * @example
 * const { SkipLink } = useSkipLink({ targetId: 'main-content' });
 * return <><SkipLink /><main id="main-content">...</main></>
 */
export function useSkipLink({ targetId, label = 'Skip to main content' }) {
    const handleClick = useCallback((e) => {
        e.preventDefault();
        const target = document.getElementById(targetId);
        if (target) {
            target.tabIndex = -1;
            target.focus();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    }, [targetId]);

    const SkipLink = () => (
        <a
            href={`#${targetId}`}
            onClick={handleClick}
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
            {label}
        </a>
    );

    return { SkipLink };
}

/**
 * Announce to screen readers via live region
 * 
 * @example
 * const { announce } = useAnnounce();
 * announce('Data updated successfully');
 */
export function useAnnounce() {
    const announcerRef = useRef(null);

    useEffect(() => {
        // Create announcer element if it doesn't exist
        let announcer = document.getElementById('sr-announcer');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'sr-announcer';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.className = 'sr-only';
            document.body.appendChild(announcer);
        }
        announcerRef.current = announcer;

        return () => {
            // Don't remove - other components may use it
        };
    }, []);

    const announce = useCallback((message, priority = 'polite') => {
        if (!announcerRef.current) return;

        announcerRef.current.setAttribute('aria-live', priority);
        announcerRef.current.textContent = '';

        // Small delay to ensure the change is detected
        requestAnimationFrame(() => {
            if (announcerRef.current) {
                announcerRef.current.textContent = message;
            }
        });
    }, []);

    const announceAssertive = useCallback((message) => {
        announce(message, 'assertive');
    }, [announce]);

    return { announce, announceAssertive };
}

/**
 * Generate unique IDs for form fields (for label associations)
 */
let idCounter = 0;
export function useUniqueId(prefix = 'id') {
    const idRef = useRef(null);
    if (idRef.current === null) {
        idRef.current = `${prefix}-${++idCounter}`;
    }
    return idRef.current;
}

/**
 * Reduced motion preference hook
 * 
 * @example
 * const prefersReducedMotion = usePrefersReducedMotion();
 * const animationDuration = prefersReducedMotion ? 0 : 300;
 */
export function usePrefersReducedMotion() {
    const query = '(prefers-reduced-motion: reduce)';

    const getMatch = () => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    };

    // Using a simple state pattern
    const prefersReducedMotion = useRef(getMatch());

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const handler = (e) => { prefersReducedMotion.current = e.matches; };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    return prefersReducedMotion.current;
}

/**
 * ARIA props helpers for common patterns
 */
export const ariaHelpers = {
    // For expandable sections
    expandable: (isExpanded, controlsId) => ({
        'aria-expanded': isExpanded,
        'aria-controls': controlsId,
    }),

    // For tab panels
    tabPanel: (id, labelledBy, isSelected) => ({
        id,
        role: 'tabpanel',
        'aria-labelledby': labelledBy,
        hidden: !isSelected,
        tabIndex: isSelected ? 0 : -1,
    }),

    // For tabs
    tab: (id, controls, isSelected) => ({
        id,
        role: 'tab',
        'aria-controls': controls,
        'aria-selected': isSelected,
        tabIndex: isSelected ? 0 : -1,
    }),

    // For grid cells
    gridCell: (rowIndex, colIndex) => ({
        role: 'gridcell',
        'aria-rowindex': rowIndex + 1,
        'aria-colindex': colIndex + 1,
    }),

    // For loading states
    loading: (isLoading, label = 'Loading') => ({
        'aria-busy': isLoading,
        'aria-label': isLoading ? label : undefined,
    }),

    // For sortable columns
    sortable: (sortDirection) => ({
        'aria-sort': sortDirection || 'none',
    }),
};

export default {
    useFocusTrap,
    useSkipLink,
    useAnnounce,
    useUniqueId,
    usePrefersReducedMotion,
    ariaHelpers,
};

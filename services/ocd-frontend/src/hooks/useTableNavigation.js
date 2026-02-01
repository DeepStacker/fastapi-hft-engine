/**
 * useTableNavigation - Keyboard navigation for table components
 * 
 * Provides arrow key navigation, focus management, and keyboard shortcuts
 * for interactive data tables like the option chain.
 * 
 * @example
 * const { activeRowIndex, activeColIndex, handleKeyDown, setActiveCell } = useTableNavigation({
 *   rowCount: strikes.length,
 *   colCount: columns.length,
 *   onEnter: (row, col) => handleCellClick(row, col),
 *   onEscape: () => setSelectedStrike(null),
 * });
 */
import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for table keyboard navigation
 */
export function useTableNavigation({
    rowCount,
    colCount,
    initialRow = 0,
    initialCol = 0,
    onEnter = null,
    onEscape = null,
    onCellChange = null,
    wrapAround = false,
    enabled = true,
}) {
    const [activeRowIndex, setActiveRowIndex] = useState(initialRow);
    const [activeColIndex, setActiveColIndex] = useState(initialCol);
    const [isNavigating, setIsNavigating] = useState(false);

    const tableRef = useRef(null);

    // Clamp values within bounds
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    // Move to specific cell
    const setActiveCell = useCallback((row, col) => {
        const newRow = clamp(row, 0, rowCount - 1);
        const newCol = clamp(col, 0, colCount - 1);

        setActiveRowIndex(newRow);
        setActiveColIndex(newCol);
        setIsNavigating(true);

        if (onCellChange) {
            onCellChange(newRow, newCol);
        }
    }, [rowCount, colCount, onCellChange]);

    // Navigate by delta
    const navigate = useCallback((rowDelta, colDelta) => {
        let newRow = activeRowIndex + rowDelta;
        let newCol = activeColIndex + colDelta;

        if (wrapAround) {
            // Wrap around at boundaries
            if (newRow < 0) newRow = rowCount - 1;
            if (newRow >= rowCount) newRow = 0;
            if (newCol < 0) newCol = colCount - 1;
            if (newCol >= colCount) newCol = 0;
        } else {
            // Clamp at boundaries
            newRow = clamp(newRow, 0, rowCount - 1);
            newCol = clamp(newCol, 0, colCount - 1);
        }

        setActiveCell(newRow, newCol);
    }, [activeRowIndex, activeColIndex, rowCount, colCount, wrapAround, setActiveCell]);

    // Handle keyboard events
    const handleKeyDown = useCallback((e) => {
        if (!enabled) return;

        const key = e.key;
        let handled = true;

        switch (key) {
            case 'ArrowUp':
                navigate(-1, 0);
                break;
            case 'ArrowDown':
                navigate(1, 0);
                break;
            case 'ArrowLeft':
                navigate(0, -1);
                break;
            case 'ArrowRight':
                navigate(0, 1);
                break;
            case 'Home':
                if (e.ctrlKey) {
                    // Ctrl+Home: Go to first cell
                    setActiveCell(0, 0);
                } else {
                    // Home: Go to first column
                    setActiveCell(activeRowIndex, 0);
                }
                break;
            case 'End':
                if (e.ctrlKey) {
                    // Ctrl+End: Go to last cell
                    setActiveCell(rowCount - 1, colCount - 1);
                } else {
                    // End: Go to last column
                    setActiveCell(activeRowIndex, colCount - 1);
                }
                break;
            case 'PageUp':
                // Jump 10 rows up
                navigate(-10, 0);
                break;
            case 'PageDown':
                // Jump 10 rows down
                navigate(10, 0);
                break;
            case 'Enter':
            case ' ':
                if (onEnter) {
                    onEnter(activeRowIndex, activeColIndex);
                }
                break;
            case 'Escape':
                setIsNavigating(false);
                if (onEscape) {
                    onEscape();
                }
                break;
            default:
                handled = false;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, [enabled, navigate, setActiveCell, activeRowIndex, activeColIndex, rowCount, colCount, onEnter, onEscape]);

    // Reset when row/col count changes
    useEffect(() => {
        if (activeRowIndex >= rowCount) {
            setActiveRowIndex(Math.max(0, rowCount - 1));
        }
        if (activeColIndex >= colCount) {
            setActiveColIndex(Math.max(0, colCount - 1));
        }
    }, [rowCount, colCount, activeRowIndex, activeColIndex]);

    // Jump to row by search
    const jumpToRow = useCallback((predicate) => {
        for (let i = 0; i < rowCount; i++) {
            if (predicate(i)) {
                setActiveCell(i, activeColIndex);
                return true;
            }
        }
        return false;
    }, [rowCount, activeColIndex, setActiveCell]);

    return {
        activeRowIndex,
        activeColIndex,
        isNavigating,
        handleKeyDown,
        setActiveCell,
        navigate,
        jumpToRow,
        tableRef,
        // For ARIA attributes
        getRowProps: (rowIndex) => ({
            'aria-selected': rowIndex === activeRowIndex,
            'tabIndex': rowIndex === activeRowIndex ? 0 : -1,
        }),
        getCellProps: (rowIndex, colIndex) => ({
            'aria-selected': rowIndex === activeRowIndex && colIndex === activeColIndex,
            'tabIndex': rowIndex === activeRowIndex && colIndex === activeColIndex ? 0 : -1,
        }),
    };
}

/**
 * Hook for virtual focus management in lists/tables
 * Coordinates with virtualization libraries
 */
export function useVirtualFocus({
    totalItems,
    visibleStartIndex,
    visibleEndIndex,
    itemHeight,
    containerRef,
}) {
    const [focusedIndex, setFocusedIndex] = useState(0);

    // Ensure focused item is visible
    const scrollToFocusedItem = useCallback(() => {
        if (!containerRef.current) return;

        if (focusedIndex < visibleStartIndex || focusedIndex > visibleEndIndex) {
            const scrollTop = focusedIndex * itemHeight;
            containerRef.current.scrollTop = scrollTop;
        }
    }, [focusedIndex, visibleStartIndex, visibleEndIndex, itemHeight, containerRef]);

    useEffect(() => {
        scrollToFocusedItem();
    }, [focusedIndex, scrollToFocusedItem]);

    const handleKeyDown = useCallback((e) => {
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => Math.max(0, prev - 1));
                break;
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev => Math.min(totalItems - 1, prev + 1));
                break;
            case 'Home':
                e.preventDefault();
                setFocusedIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setFocusedIndex(totalItems - 1);
                break;
            case 'PageUp':
                e.preventDefault();
                setFocusedIndex(prev => Math.max(0, prev - 10));
                break;
            case 'PageDown':
                e.preventDefault();
                setFocusedIndex(prev => Math.min(totalItems - 1, prev + 10));
                break;
            default:
                break;
        }
    }, [totalItems]);

    return {
        focusedIndex,
        setFocusedIndex,
        handleKeyDown,
        isFocused: (index) => index === focusedIndex,
    };
}

export default useTableNavigation;

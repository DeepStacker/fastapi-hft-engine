/**
 * Virtual Scrolling Hook for Large Lists
 * 
 * Provides efficient rendering for large datasets without react-window dependency.
 * Uses intersection observer and dynamic row rendering.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * Virtual scrolling configuration
 */
const DEFAULT_CONFIG = {
    itemHeight: 40,         // Height of each row in pixels
    overscan: 5,            // Extra items to render above/below viewport
    containerHeight: 600,   // Default container height
};

/**
 * Hook for virtual scrolling in large lists
 * 
 * @param {Array} items - Full array of items
 * @param {Object} config - Configuration options
 * @returns {Object} Virtual scroll state and handlers
 */
export function useVirtualScroll(items, config = {}) {
    const {
        itemHeight = DEFAULT_CONFIG.itemHeight,
        overscan = DEFAULT_CONFIG.overscan,
        containerHeight = DEFAULT_CONFIG.containerHeight
    } = config;

    const containerRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(containerHeight);

    // Calculate total height
    const totalHeight = items.length * itemHeight;

    // Calculate visible range
    const visibleRange = useMemo(() => {
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const visibleCount = Math.ceil(viewportHeight / itemHeight);
        const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

        return { startIndex, endIndex };
    }, [scrollTop, viewportHeight, itemHeight, overscan, items.length]);

    // Get visible items with their positions
    const virtualItems = useMemo(() => {
        const { startIndex, endIndex } = visibleRange;
        const result = [];

        for (let i = startIndex; i < endIndex; i++) {
            result.push({
                index: i,
                item: items[i],
                style: {
                    position: 'absolute',
                    top: i * itemHeight,
                    height: itemHeight,
                    width: '100%',
                }
            });
        }

        return result;
    }, [items, visibleRange, itemHeight]);

    // Handle scroll
    const handleScroll = useCallback((e) => {
        const target = e.target || e.currentTarget;
        if (target) {
            setScrollTop(target.scrollTop);
        }
    }, []);

    // Scroll to specific index
    const scrollToIndex = useCallback((index, align = 'start') => {
        if (!containerRef.current) return;

        let targetTop;
        switch (align) {
            case 'center':
                targetTop = index * itemHeight - viewportHeight / 2 + itemHeight / 2;
                break;
            case 'end':
                targetTop = (index + 1) * itemHeight - viewportHeight;
                break;
            case 'start':
            default:
                targetTop = index * itemHeight;
        }

        containerRef.current.scrollTop = Math.max(0, targetTop);
    }, [itemHeight, viewportHeight]);

    // Update viewport height on resize
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setViewportHeight(entry.contentRect.height);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Container style
    const containerStyle = useMemo(() => ({
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
    }), [containerHeight]);

    // Inner container style (creates scrollable area)
    const innerStyle = useMemo(() => ({
        height: totalHeight,
        width: '100%',
        position: 'relative',
    }), [totalHeight]);

    return {
        containerRef,
        containerStyle,
        innerStyle,
        virtualItems,
        handleScroll,
        scrollToIndex,
        totalHeight,
        visibleRange,
        isVirtualized: items.length > 50, // Only virtualize for larger lists
    };
}

/**
 * Simple virtualized table wrapper component
 */
export function VirtualTable({
    items,
    renderRow,
    headerContent,
    rowHeight = 40,
    containerHeight = 500,
    className = '',
}) {
    const {
        containerRef,
        containerStyle,
        innerStyle,
        virtualItems,
        handleScroll,
        isVirtualized,
    } = useVirtualScroll(items, { itemHeight: rowHeight, containerHeight });

    // For small lists, render normally
    if (!isVirtualized) {
        return (
            <div className={className}>
                {headerContent}
                <div style={{ maxHeight: containerHeight, overflow: 'auto' }}>
                    {items.map((item, index) => (
                        <div key={index} style={{ height: rowHeight }}>
                            {renderRow({ item, index, style: { height: rowHeight } })}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            {headerContent}
            <div
                ref={containerRef}
                style={containerStyle}
                onScroll={handleScroll}
            >
                <div style={innerStyle}>
                    {virtualItems.map(({ index, item, style }) => (
                        <div key={index} style={style}>
                            {renderRow({ item, index, style })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Hook for windowed option chain data
 * Optimizes for the specific option chain use case
 */
export function useWindowedOptionChain(strikes, visibleCount = 21) {
    const [centerIndex, setCenterIndex] = useState(null);

    // Find ATM strike index
    useEffect(() => {
        if (!strikes || strikes.length === 0) return;

        // Find ATM (first strike marked as ATM, or middle)
        const atmIndex = strikes.findIndex(s => s.isATM);
        setCenterIndex(atmIndex >= 0 ? atmIndex : Math.floor(strikes.length / 2));
    }, [strikes]);

    // Calculate visible window
    const window = useMemo(() => {
        if (centerIndex === null || !strikes || strikes.length === 0) {
            return { strikes: [], startIndex: 0, endIndex: 0 };
        }

        const halfWindow = Math.floor(visibleCount / 2);
        let startIndex = Math.max(0, centerIndex - halfWindow);
        let endIndex = Math.min(strikes.length, startIndex + visibleCount);

        // Adjust if at end
        if (endIndex === strikes.length) {
            startIndex = Math.max(0, endIndex - visibleCount);
        }

        return {
            strikes: strikes.slice(startIndex, endIndex),
            startIndex,
            endIndex,
            totalCount: strikes.length,
        };
    }, [strikes, centerIndex, visibleCount]);

    // Navigation functions
    const showMore = useCallback((direction) => {
        setCenterIndex(prev => {
            if (prev === null) return null;
            const step = Math.floor(visibleCount / 2);
            if (direction === 'up') {
                return Math.max(step, prev - step);
            } else {
                return Math.min(strikes.length - step - 1, prev + step);
            }
        });
    }, [strikes.length, visibleCount]);

    const canShowMore = useMemo(() => ({
        up: window.startIndex > 0,
        down: window.endIndex < (strikes?.length || 0),
    }), [window.startIndex, window.endIndex, strikes?.length]);

    return {
        ...window,
        centerIndex,
        showMore,
        canShowMore,
        setCenterIndex,
    };
}

export default useVirtualScroll;

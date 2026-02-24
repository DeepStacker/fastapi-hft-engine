import { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import '../styles/resizable.css';

import {
    Squares2X2Icon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import {
    selectIsAuthenticated,
    selectSid,
    selectExpSid,
    selectData
} from '../context/selectors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

// Imported Components
import ChartPanel from '../components/features/splitview/ChartPanel';
import TradingChartPanel from '../components/features/splitview/TradingChartPanel';
import OptionChainTable from '../components/features/options/OptionChainTable';
import { ColumnConfigProvider } from '../context/ColumnConfigContext';
import { TableSettingsProvider } from '../context/TableSettingsContext';

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * Split View Page - Fully Resizable Dashboard
 */
const SplitView = () => {
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const navigate = useNavigate();
    const selectedSymbol = useSelector(selectSid) || 'NIFTY';
    const selectedExpiry = useSelector(selectExpSid);
    const data = useSelector(selectData);
    const optionChainData = data?.options?.data;

    // --- State Management ---
    // Combined list of all widgets: Option Chain + Charts
    // ID 'oc' is reserved for Option Chain
    // Numeric IDs for charts
    // --- State Management ---
    // Combined list of all widgets: Option Chain + Trading Chart
    // ID 'oc' is reserved for Option Chain
    // ID '1' for the first Trading Chart
    // --- State Management ---
    // Persistence Keys
    const STORAGE_KEY_WIDGETS = 'splitview_widgets_v1';
    const STORAGE_KEY_LAYOUTS = 'splitview_layouts_v1';

    // Default Configurations
    const defaultWidgets = [
        { id: 'oc', type: 'option_chain' },
        { id: '1', type: 'trading_chart' },
    ];

    const defaultLayouts = {
        lg: [
            { i: 'oc', x: 0, y: 0, w: 6, h: 20, minW: 3, minH: 10 },
            { i: '1', x: 6, y: 0, w: 6, h: 20, minW: 3, minH: 10 },
        ]
    };

    // Initialize State from LocalStorage or Defaults
    const [widgets, setWidgets] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_WIDGETS);
            return saved ? JSON.parse(saved) : defaultWidgets;
        } catch (e) {
            console.error("Failed to load widgets", e);
            return defaultWidgets;
        }
    });

    const [layouts, setLayouts] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_LAYOUTS);
            return saved ? JSON.parse(saved) : defaultLayouts;
        } catch (e) {
            console.error("Failed to load layouts", e);
            return defaultLayouts;
        }
    });

    // Calculate next ID based on existing numeric IDs to prevent collision
    const [nextId, setNextId] = useState(() => {
        const ids = widgets.map(w => parseInt(w.id)).filter(n => !isNaN(n));
        return ids.length > 0 ? Math.max(...ids) + 1 : 1;
    });

    // --- Persistence Effects ---
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(widgets));
    }, [widgets]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_LAYOUTS, JSON.stringify(layouts));
    }, [layouts]);

    // --- Handlers ---

    const handleResetLayout = () => {
        if (window.confirm("Reset dashboard to default view?")) {
            setWidgets(defaultWidgets);
            setLayouts(defaultLayouts);
            setNextId(5); // Reset ID counter
        }
    };

    const handleLayoutChange = (currentLayout, allLayouts) => {
        setLayouts(allLayouts);
    };

    const handleAddPanel = () => {
        const newId = String(nextId);
        setNextId(prev => prev + 1);

        // Add to widgets
        setWidgets(prev => [...prev, { id: newId, type: 'coi' }]);

        // Add to layout (find first available spot handled by RGL usually, but we can hint)
        // RGL handles placement automatically if not specified, but providing one is better
        setLayouts(prev => ({
            ...prev,
            lg: [
                ...(prev.lg || []),
                { i: newId, x: 0, y: Infinity, w: 3, h: 5 } // Put at bottom
            ]
        }));
    };

    const handleRemoveWidget = (id) => {
        setWidgets(prev => prev.filter(w => w.id !== id));
        // Layout clean up happens automatically by RGL on re-render but explicit is clean
        setLayouts(prev => {
            const newLayouts = { ...prev };
            Object.keys(newLayouts).forEach(bp => {
                newLayouts[bp] = newLayouts[bp].filter(l => l.i !== id);
            });
            return newLayouts;
        });
    };

    const handleChangeChartType = (id, newType) => {
        setWidgets(prev => prev.map(w =>
            w.id === id ? { ...w, type: newType } : w
        ));
    };

    // --- Render Helpers ---

    const renderWidget = (widget) => {
        const commonProps = {
            style: { height: '100%', width: '100%' } // Helper for internal sizing
        };

        if (widget.type === 'option_chain') {
            return (
                <div key={widget.id} className="h-full relative group flex flex-col">
                    <Card variant="glass" className="h-full flex flex-col" padding="none">
                        {/* Option Chain Drag Handle */}
                        <div className="card-header-drag px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-move">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Option Chain</span>
                            {/* Optional: Add close button if we want to allow removing OC */}
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden relative">
                            <ColumnConfigProvider>
                                <TableSettingsProvider>
                                    <div className="h-full bg-white dark:bg-gray-900 overflow-hidden">
                                        <OptionChainTable
                                            showControls={false}
                                            isLiveMode={true}
                                        />
                                    </div>
                                </TableSettingsProvider>
                            </ColumnConfigProvider>
                        </div>
                    </Card>
                </div>
            );
        }

        // It's a Chart Panel
        if (widget.type === 'trading_chart') {
            return (
                <div key={widget.id} className="h-full">
                    <TradingChartPanel
                        id={widget.id}
                        onRemove={() => handleRemoveWidget(widget.id)}
                        onChangeType={handleChangeChartType}
                    />
                </div>
            );
        }

        return (
            <div key={widget.id} className="h-full">
                <ChartPanel
                    id={widget.id}
                    symbol={selectedSymbol}
                    expiry={selectedExpiry}
                    chartType={widget.type}
                    onChangeType={handleChangeChartType}
                    onRemove={() => handleRemoveWidget(widget.id)}
                />
            </div>
        );
    };


    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Authentication Required</h2>
                <p className="text-gray-600 dark:text-gray-400">Please log in to use Split View.</p>
                <Button onClick={() => navigate('/login')}>Login Now</Button>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Split View | Stockify</title>
                <meta name="description" content="Customizable Dashboard" />
            </Helmet>

            <div className="w-full h-[calc(100vh-64px)] flex flex-col p-2 gap-2 overflow-hidden">
                {/* Header Controls */}
                <div className="flex items-center justify-between px-2 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Squares2X2Icon className="w-5 h-5" />
                            Smart Dashboard
                        </h1>
                        <span className="text-sm text-gray-500">
                            {selectedSymbol} • {selectedExpiry}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleResetLayout}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-2"
                        >
                            Reset View
                        </button>
                        <button
                            onClick={handleAddPanel}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Add Widget
                        </button>
                    </div>
                </div>

                {/* Resizable Grid Area */}
                <div className="flex-1 w-full min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-950">
                    <ResponsiveGridLayout
                        className="layout"
                        layouts={layouts}
                        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                        rowHeight={20}
                        draggableHandle=".card-header-drag"
                        resizeHandles={['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']}
                        isDraggable={true}
                        isResizable={true}
                        compactType="vertical"
                        preventCollision={false}
                        onLayoutChange={handleLayoutChange}
                        margin={[2, 2]}
                        containerPadding={[0, 0]}
                    >
                        {widgets.map(renderWidget)}
                    </ResponsiveGridLayout>
                </div>
            </div>
        </>
    );
};

export default SplitView;
